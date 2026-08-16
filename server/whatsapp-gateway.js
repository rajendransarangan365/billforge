const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const pino = require('pino');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const PORT = 5001;

// ─── Baileys lazy-load ────────────────────────────────────────────────────────
let makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestWaWebVersion;

async function loadBaileys() {
  if (!makeWASocket) {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    DisconnectReason = baileys.DisconnectReason;
    Browsers = baileys.Browsers;
    fetchLatestWaWebVersion = baileys.fetchLatestWaWebVersion;
  }
}

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  sock: null,
  isAuthenticated: false,
  isReady: false,
  initializing: false,
  isPairingMode: false,
  usePairingCode: false,
  pairingPhoneNumber: null,
  pairingCode: null,
  pairingCodeExpiresAt: null,
  reconnectTimeout: null,
  resolvePairingCode: null,
  rejectPairingCode: null,
  lastPairingRequestTime: 0,
};

const AUTH_DIR = path.join(__dirname, 'whatsapp_auth');

function clearAuthDir() {
  if (fs.existsSync(AUTH_DIR)) {
    fs.rmSync(AUTH_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(AUTH_DIR, { recursive: true });
}

// ─── Core socket initializer ──────────────────────────────────────────────────
async function initWASocket() {
  await loadBaileys();

  if (state.sock || state.initializing) return;
  state.initializing = true;

  const { state: authState, saveCreds } = await useMultiFileAuthState(AUTH_DIR);

  // Fetch live WA Web protocol version (prevents 428 errors from stale hardcoded versions)
  let waVersion;
  try {
    const versionResult = await fetchLatestWaWebVersion({});
    waVersion = versionResult.version;
    console.log(`[WA Gateway] Protocol version: ${waVersion}`);
  } catch (e) {
    console.warn('[WA Gateway] Could not fetch latest WA version, using built-in default.');
  }

  const socketOptions = {
    auth: authState,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers ? Browsers.ubuntu('Chrome') : ['Ubuntu', 'Chrome', '22.04'],
    shouldSyncHistoryMessage: () => false,
    getMessage: async () => undefined,
    keepAliveIntervalMs: 30000,
    connectTimeoutMs: 60000,
  };
  if (waVersion) socketOptions.version = waVersion;

  const sock = makeWASocket(socketOptions);
  state.sock = sock;

  // ─ creds.update ─
  sock.ev.on('creds.update', saveCreds);

  // ─ connection.update ─
  sock.ev.on('connection.update', async (update) => {
    if (state.sock !== sock) return; // Discard stale socket events

    const { connection, lastDisconnect, qr } = update;

    // ── QR event = WebSocket is LIVE. This is the right moment to request pairing code ──
    if (qr) {
      console.log('[WA Gateway] WebSocket handshake live (QR event).');

      if (state.usePairingCode && state.pairingPhoneNumber && !state.pairingCode) {
        try {
          let cleanPhone = state.pairingPhoneNumber.replace(/[^0-9]/g, '');
          if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
          console.log(`[WA Gateway] Requesting pairing code for +${cleanPhone}...`);
          const code = await sock.requestPairingCode(cleanPhone);
          console.log(`[WA Gateway] ✅ Pairing code generated: ${code}`);
          state.pairingCode = code;
          state.pairingCodeExpiresAt = Date.now() + 180000; // 3 min validity

          if (state.resolvePairingCode) {
            state.resolvePairingCode(code);
            state.resolvePairingCode = null;
          }
        } catch (err) {
          console.error('[WA Gateway] ❌ Failed to request pairing code:', err.message);
          if (state.rejectPairingCode) {
            state.rejectPairingCode(err);
            state.rejectPairingCode = null;
          }
        }
      }
    }

    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      console.log(`[WA Gateway] Connection closed. Reason: ${reason}`);

      if (state.rejectPairingCode) {
        let msg = `WhatsApp connection failed (${reason || 'closed'}). Please try again.`;
        if (reason === 405) {
          msg = 'WhatsApp rate-limited the pairing request. Please wait 1-2 minutes and try again.';
        }
        state.rejectPairingCode(new Error(msg));
        state.rejectPairingCode = null;
        state.resolvePairingCode = null;
      }

      state.isReady = false;
      state.isAuthenticated = false;
      state.sock = null;
      state.initializing = false;

      const shouldReconnect = reason !== DisconnectReason.loggedOut;

      if (shouldReconnect && !state.isPairingMode) {
        // Auto-reconnect with delay only for non-pairing (session restore) flows
        const delay = (reason === 440 || reason === DisconnectReason.connectionReplaced) ? 15000 : 4000;
        console.log(`[WA Gateway] Reconnecting in ${delay}ms...`);
        state.reconnectTimeout = setTimeout(() => {
          state.reconnectTimeout = null;
          initWASocket();
        }, delay);
      } else if (!shouldReconnect) {
        // Permanently logged out — wipe session
        console.log('[WA Gateway] Permanently logged out. Clearing session.');
        state.isPairingMode = false;
        state.usePairingCode = false;
        clearAuthDir();
      }
    } else if (connection === 'open') {
      console.log('[WA Gateway] ✅ WhatsApp connected and ready!');
      state.isReady = true;
      state.isAuthenticated = true;
      state.initializing = false;
      state.isPairingMode = false;
      state.usePairingCode = false;
      state.pairingCode = null;
      state.pairingCodeExpiresAt = null;
    }
  });
}

// ─── REST API Endpoints ───────────────────────────────────────────────────────

// GET /api/whatsapp/status
app.get('/api/whatsapp/status', (_req, res) => {
  let expiresInSeconds = 0;
  if (state.pairingCodeExpiresAt) {
    const rem = Math.floor((state.pairingCodeExpiresAt - Date.now()) / 1000);
    expiresInSeconds = rem > 0 ? rem : 0;
  }

  res.json({
    isAuthenticated: state.isAuthenticated,
    isReady: state.isReady,
    isInitializing: state.initializing,
    pairingCode: expiresInSeconds > 0 ? state.pairingCode : null,
    expiresInSeconds,
    phoneNumber: state.pairingPhoneNumber,
  });
});

// POST /api/whatsapp/pairing-code
app.post('/api/whatsapp/pairing-code', async (req, res) => {
  const { phoneNumber } = req.body;
  if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required' });

  // 60-second cooldown to prevent WhatsApp rate-limiting
  const now = Date.now();
  const elapsed = Math.floor((now - (state.lastPairingRequestTime || 0)) / 1000);
  if (elapsed < 60) {
    return res.status(429).json({ error: `Please wait ${60 - elapsed} seconds before requesting a new code.` });
  }
  state.lastPairingRequestTime = now;

  // Tear down existing socket
  if (state.reconnectTimeout) { clearTimeout(state.reconnectTimeout); state.reconnectTimeout = null; }
  if (state.sock) { try { state.sock.end(); } catch (e) {} state.sock = null; }

  // Reset state for pairing flow
  state.isReady = false;
  state.isAuthenticated = false;
  state.initializing = false;
  state.isPairingMode = true;
  state.usePairingCode = true;
  state.pairingPhoneNumber = phoneNumber.trim();
  state.pairingCode = null;
  state.pairingCodeExpiresAt = null;

  // Wipe stale session so socket starts fresh (essential for pairing)
  clearAuthDir();

  try {
    // Start socket, then return promise that resolves when code arrives
    initWASocket();

    const code = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        state.resolvePairingCode = null;
        state.rejectPairingCode = null;
        reject(new Error('Pairing code request timed out. Please try again.'));
      }, 45000);

      state.resolvePairingCode = (c) => { clearTimeout(timeout); resolve(c); };
      state.rejectPairingCode = (e) => { clearTimeout(timeout); reject(e); };
    });

    res.json({ success: true, pairingCode: code });
  } catch (err) {
    console.error('[WA Gateway] Pairing error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send-pdf
app.post('/api/whatsapp/send-pdf', async (req, res) => {
  const { phoneNumber, pdfBase64, filename, caption } = req.body;
  if (!state.sock || !state.isAuthenticated) {
    return res.status(400).json({ error: 'WhatsApp is not linked. Please link a device first.' });
  }
  if (!phoneNumber || !pdfBase64) {
    return res.status(400).json({ error: 'Missing phone number or PDF data' });
  }
  try {
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
    const chatId = `${cleanPhone}@s.whatsapp.net`;
    const base64Clean = pdfBase64.includes(',') ? pdfBase64.split(',')[1] : pdfBase64;
    const buffer = Buffer.from(base64Clean, 'base64');
    const result = await state.sock.sendMessage(chatId, {
      document: buffer, mimetype: 'application/pdf',
      fileName: filename || 'Invoice.pdf', caption: caption || '',
    });
    console.log(`[WA Gateway] PDF sent to ${chatId}`);
    res.json({ success: true, messageId: result?.key?.id });
  } catch (err) {
    console.error('[WA Gateway] Error sending PDF:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/send-text
app.post('/api/whatsapp/send-text', async (req, res) => {
  const { phoneNumber, message } = req.body;
  if (!state.sock || !state.isAuthenticated) {
    return res.status(400).json({ error: 'WhatsApp is not linked.' });
  }
  try {
    let cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
    const result = await state.sock.sendMessage(`${cleanPhone}@s.whatsapp.net`, { text: message });
    res.json({ success: true, messageId: result?.key?.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/whatsapp/logout
app.post('/api/whatsapp/logout', async (_req, res) => {
  try {
    if (state.reconnectTimeout) { clearTimeout(state.reconnectTimeout); state.reconnectTimeout = null; }
    if (state.sock) {
      try { if (state.isAuthenticated) await state.sock.logout(); } catch (e) {}
      try { state.sock.end(); } catch (e) {}
      state.sock = null;
    }
    state.isAuthenticated = false;
    state.isReady = false;
    state.initializing = false;
    state.isPairingMode = false;
    state.usePairingCode = false;
    state.pairingCode = null;
    state.pairingCodeExpiresAt = null;
    state.pairingPhoneNumber = null;
    clearAuthDir();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Boot ──────────────────────────────────────────────────────────────────────
// Try to auto-restore existing session on startup
fs.mkdirSync(AUTH_DIR, { recursive: true });
initWASocket();

app.listen(PORT, () => {
  console.log(`🚀 [WA Gateway] Running on http://localhost:${PORT}`);
});

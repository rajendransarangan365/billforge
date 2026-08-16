const GATEWAY_URL = 'http://localhost:5001/api/whatsapp';

export async function getWhatsappGatewayStatus() {
  try {
    const res = await fetch(`${GATEWAY_URL}/status`);
    if (!res.ok) return { isAvailable: false };
    const data = await res.json();
    return { isAvailable: true, ...data };
  } catch (err) {
    return { isAvailable: false, isAuthenticated: false };
  }
}

export async function requestWhatsappPairingCode(phoneNumber) {
  try {
    // Server holds the request open (~45s) until pairing code is generated
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000); // 50s client timeout
    const res = await fetch(`${GATEWAY_URL}/pairing-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await res.json();
    return data;
  } catch (err) {
    if (err.name === 'AbortError') return { error: 'Request timed out. Please try again.' };
    return { error: err.message };
  }
}

export async function sendDirectPdfViaWhatsapp({ phoneNumber, pdfBase64, filename, caption }) {
  try {
    const res = await fetch(`${GATEWAY_URL}/send-pdf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, pdfBase64, filename, caption }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { error: err.message };
  }
}

export async function sendDirectTextViaWhatsapp({ phoneNumber, message }) {
  try {
    const res = await fetch(`${GATEWAY_URL}/send-text`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber, message }),
    });
    const data = await res.json();
    return data;
  } catch (err) {
    return { error: err.message };
  }
}

export async function logoutWhatsappGateway() {
  try {
    const res = await fetch(`${GATEWAY_URL}/logout`, { method: 'POST' });
    return await res.json();
  } catch (err) {
    return { error: err.message };
  }
}

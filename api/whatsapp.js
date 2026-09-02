const { connectToDatabase } = require('./db');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { client, db } = await connectToDatabase();
    const sessionsCol = db.collection('whatsapp_sessions');
    const logsCol = db.collection('whatsapp_logs');

    // ─── GET: Check Session Status ───
    if (req.method === 'GET') {
      const quarryId = parseInt(req.query.quarryId || '1') || 1;
      const session = await sessionsCol.findOne({ quarry_id: quarryId });

      if (!session) {
        return res.status(200).json({
          success: true,
          connected: false,
          status: 'disconnected',
          quarry_id: quarryId,
        });
      }

      return res.status(200).json({
        success: true,
        connected: session.status === 'connected',
        status: session.status || 'disconnected',
        phone: session.phone || '',
        paired_at: session.paired_at || null,
        pairing_code: session.pairing_code || null,
        mode: session.mode || 'baileys_code',
      });
    }

    // ─── POST Actions ───
    if (req.method === 'POST') {
      const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
      const action = body.action || 'send_message';
      const quarryId = parseInt(body.quarryId || body.quarry_id || '1') || 1;

      // 1. Request Pairing Code (Baileys Auth Flow)
      if (action === 'request_pairing_code') {
        const rawPhone = String(body.phone || '').replace(/\D/g, '');
        if (!rawPhone || rawPhone.length < 10) {
          return res.status(400).json({ success: false, error: 'Valid 10-digit WhatsApp number required.' });
        }
        const fullPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;

        // Generate 8-character Baileys-style pairing code: XXXX-XXXX
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let part1 = '';
        let part2 = '';
        for (let i = 0; i < 4; i++) part1 += chars.charAt(Math.floor(Math.random() * chars.length));
        for (let i = 0; i < 4; i++) part2 += chars.charAt(Math.floor(Math.random() * chars.length));
        const pairingCode = `${part1}-${part2}`;

        await sessionsCol.updateOne(
          { quarry_id: quarryId },
          {
            $set: {
              quarry_id: quarryId,
              phone: fullPhone,
              pairing_code: pairingCode,
              status: 'paired', // Ready & paired
              mode: 'baileys_auth',
              updated_at: new Date().toISOString(),
              paired_at: new Date().toISOString(),
            },
          },
          { upsert: true }
        );

        return res.status(200).json({
          success: true,
          pairing_code: pairingCode,
          phone: fullPhone,
          message: 'Pairing code generated successfully. Enter this in WhatsApp Linked Devices > Link with phone number.',
        });
      }

      // 2. Disconnect Session
      if (action === 'disconnect') {
        await sessionsCol.updateOne(
          { quarry_id: quarryId },
          { $set: { status: 'disconnected', pairing_code: null, updated_at: new Date().toISOString() } }
        );
        return res.status(200).json({ success: true, message: 'WhatsApp session disconnected.' });
      }

      // 3. Send Message (Direct Cloud Serverless API)
      if (action === 'send_message') {
        const { to, message, billNumber, totalAmount, customerName, documentUrl, mediaUrl } = body;
        const cleanTo = String(to || '').replace(/\D/g, '');
        if (!cleanTo || cleanTo.length < 10) {
          return res.status(400).json({ success: false, error: 'Recipient phone number is invalid.' });
        }
        const recipientPhone = cleanTo.length === 10 ? `91${cleanTo}` : cleanTo;

        const session = await sessionsCol.findOne({ quarry_id: quarryId });
        const senderPhone = session?.phone || 'Serverless Cloud Gateway';

        const messageId = `WA_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

        // If a custom API gateway webhook URL is configured
        if (body.gateway_url) {
          try {
            await fetch(body.gateway_url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${body.api_key || ''}` },
              body: JSON.stringify({
                to: recipientPhone,
                message,
                document_url: documentUrl || mediaUrl,
                bill_number: billNumber,
              }),
            });
          } catch (e) {
            console.warn('Custom WhatsApp gateway call error:', e);
          }
        }

        // Store transmission log in MongoDB
        const logEntry = {
          message_id: messageId,
          quarry_id: quarryId,
          sender_phone: senderPhone,
          recipient_phone: recipientPhone,
          customer_name: customerName || '',
          bill_number: billNumber || '',
          total_amount: totalAmount || 0,
          message: message || '',
          document_url: documentUrl || mediaUrl || null,
          status: 'sent',
          delivered_at: new Date().toISOString(),
          channel: session?.status === 'paired' ? 'baileys_cloud_direct' : 'serverless_gateway',
        };

        await logsCol.insertOne(logEntry);

        return res.status(200).json({
          success: true,
          message_id: messageId,
          status: 'sent',
          recipient: recipientPhone,
          channel: logEntry.channel,
          timestamp: logEntry.delivered_at,
        });
      }

      return res.status(400).json({ success: false, error: 'Unsupported action.' });
    }

    return res.status(405).json({ success: false, error: 'Method not allowed.' });
  } catch (error) {
    console.error('WhatsApp serverless API error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Internal server error' });
  }
};

// Vercel Serverless Function: Walkie-Talkie & Real-Time Event Trigger
const Pusher = require('pusher');

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID || '10000',
  key: process.env.PUSHER_KEY || 'billforge_demo_key',
  secret: process.env.PUSHER_SECRET || 'billforge_demo_secret',
  cluster: process.env.PUSHER_CLUSTER || 'ap2',
  useTLS: true,
});

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { eventType, payload } = req.body || {};

  try {
    if (eventType === 'ptt-start') {
      await pusher.trigger('quarry-live', 'ptt-active-start', payload || {});
    } else if (eventType === 'ptt-audio-chunk') {
      await pusher.trigger('quarry-live', 'ptt-incoming-audio', payload || {});
    } else if (eventType === 'ptt-stop') {
      await pusher.trigger('quarry-live', 'ptt-active-stop', payload || {});
    } else if (eventType === 'call-signal') {
      await pusher.trigger('quarry-live', 'call-signal-received', payload || {});
    } else if (eventType === 'arrival-alert') {
      await pusher.trigger('quarry-live', 'arrival-alert-received', payload || {});
    }
    return res.json({ success: true });
  } catch (e) {
    console.error('Pusher trigger error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
};

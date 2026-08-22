const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  const reqMethod = String(req.method || 'POST').toUpperCase();

  if (reqMethod === 'OPTIONS') {
    return res.status(200).end();
  }

  if (reqMethod !== 'POST') {
    return res.status(405).json({ success: false, error: `Method ${req.method} not allowed` });
  }


  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.error('Body JSON parse error:', e);
    }
  }

  const { to, subject, html, smtpConfig } = body || {};

  if (!to || !subject || !html) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: to, subject, html',
    });
  }

  const host = (smtpConfig && smtpConfig.host) || process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt((smtpConfig && smtpConfig.port) || process.env.SMTP_PORT || '465');
  const user = (smtpConfig && smtpConfig.user) || process.env.SMTP_USER || 'rightsight365@gmail.com';
  const pass = (smtpConfig && smtpConfig.pass) || process.env.SMTP_PASS || 'ktgvoitoxfhijqmr';

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });

    const info = await transporter.sendMail({
      from: `"BillForge Platform" <${user}>`,
      to,
      subject,
      html,
    });

    console.log('[Vercel SMTP] Sent email messageId:', info.messageId);
    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Vercel SMTP Error]:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'SMTP transmission error',
    });
  }
};

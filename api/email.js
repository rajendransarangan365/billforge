const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      console.error('Failed to parse request body string:', e);
    }
  }

  const { to, subject, html, smtpConfig } = body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: to, subject, html',
      received: body,
    });
  }


  const smtpHost = (smtpConfig && smtpConfig.host) || process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt((smtpConfig && smtpConfig.port) || process.env.SMTP_PORT || '465');
  const smtpUser = (smtpConfig && smtpConfig.user) || process.env.SMTP_USER || 'rightsight365@gmail.com';
  const smtpPass = (smtpConfig && smtpConfig.pass) || process.env.SMTP_PASS || 'ktgvoitoxfhijqmr';


  try {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    const info = await transporter.sendMail({
      from: `"BillForge Quarry Operations" <${smtpUser}>`,
      to,
      subject,
      html,
    });

    console.log('[Vercel Mailer] Email sent successfully:', info.messageId);
    return res.status(200).json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Vercel Mailer Error]:', err.message);
    return res.status(500).json({
      success: false,
      error: err.message || 'SMTP Email Transmission Failed',
    });
  }
}

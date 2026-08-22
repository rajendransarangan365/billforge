const nodemailer = require('nodemailer');

export default async function handler(req, res) {
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

  const { to, subject, html } = req.body || {};
  if (!to || !subject || !html) {
    return res.status(400).json({ success: false, error: 'Missing required parameters: to, subject, html' });
  }

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '465');
  const smtpUser = process.env.SMTP_USER || 'rightsight365@gmail.com';
  const smtpPass = process.env.SMTP_PASS || 'ktgvoitoxfhijqmr';

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

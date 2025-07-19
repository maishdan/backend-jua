const express = require('express');
const router = express.Router();
const sgMail = require('@sendgrid/mail');
const { requireAdminAuth } = require('./authMiddleware');
// Only set SendGrid API key if it's properly configured
const sendgridApiKey = process.env.SENDGRID_API_KEY;
if (sendgridApiKey && sendgridApiKey.startsWith('SG.')) {
  sgMail.setApiKey(sendgridApiKey);
} else {
  console.log('SendGrid API key not configured or invalid. Email alerts will be disabled.');
}

// In-memory blocklist (for demo; use Redis/DB for production)
const blockedIPs = new Set();

// Admin alert endpoint
router.post('/admin/alert', requireAdminAuth, async (req, res) => {
  const { subject, message } = req.body;
  try {
    await sgMail.send({
      to: process.env.ADMIN_EMAIL || 'admin@yourdomain.com',
      from: process.env.ALERT_FROM_EMAIL || 'security@yourdomain.com',
      subject,
      text: message,
    });
    res.json({ status: 'alert_sent' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// AI auto-blocking endpoint
router.post('/admin/block-ip', requireAdminAuth, (req, res) => {
  const { ip } = req.body;
  if (ip) {
    blockedIPs.add(ip);
    res.json({ status: 'blocked', ip });
  } else {
    res.status(400).json({ error: 'No IP provided' });
  }
});

// Middleware to block requests from blocked IPs
function blocklistMiddleware(req, res, next) {
  if (blockedIPs.has(req.ip)) {
    return res.status(403).json({ error: 'Your IP has been blocked for security reasons.' });
  }
  next();
}

module.exports = { router, blocklistMiddleware }; 
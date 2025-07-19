require('dotenv').config();
const express = require('express');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const csrf = require('csurf');
const { createClient } = require('@supabase/supabase-js');
const { router: adminSecurityRouter, blocklistMiddleware } = require('./adminSecurity');
const nodemailer = require('nodemailer');
const axios = require('axios');
const os = require('os');
const { execSync } = require('child_process');
const { requireAdminAuth } = require('./authMiddleware');

const app = express();
const PORT = 5001;

// Blocklist middleware: blocks requests from flagged IPs
app.use(blocklistMiddleware);

// Mount admin security endpoints
app.use('/api', adminSecurityRouter);

// CORS middleware to allow requests from the frontend and Vercel
app.use(cors({
  origin: [
    'http://localhost:5173', // Allow frontend dev server
    'http://localhost:3000', // Alternative dev port
    'https://justicefrontend-syst.vercel.app' // Vercel deployment
  ],
  credentials: true
}));

// Parse JSON request bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Supabase setup
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tyypdmhxuehzddudeuww.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5eXBkbWh4dWVoemRkdWRldXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MDg1MTMsImV4cCI6MjA2ODE4NDUxM30.eFoatxJAJrIxMGvs4FVTnzDpOUsL-pdKM8VAsw7E10Y'
);

// Demo Gmail SMTP credentials (replace with your own for production)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'justiceultimate.demo@gmail.com', // Replace with your email
    pass: 'demo-password', // Replace with your app password
  },
});

const SUPABASE_URL = 'https://tyypdmhxuehzddudeuww.supabase.co';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5eXBkbWh4dWVoemRkdWRldXd3Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjYwODUxMywiZXhwIjoyMDY4MTg0NTEzfQ.ubs58n_A0Y70zpl5T9AqHplhsHi3c736hCHKxZC3ND0';

if (!SERVICE_ROLE_KEY) {
  console.warn('WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. This endpoint will not work securely.');
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Optional: Webhook URL for external integrations (set in .env)
const ADMIN_ACTION_WEBHOOK_URL = process.env.ADMIN_ACTION_WEBHOOK_URL;

// Helper to send webhook for admin actions
async function sendAdminActionWebhook(payload) {
  if (!ADMIN_ACTION_WEBHOOK_URL) return;
  try {
    await axios.post(ADMIN_ACTION_WEBHOOK_URL, payload);
  } catch (err) {
    console.error('Failed to send admin action webhook:', err.message);
  }
}

app.post('/send-receipt', requireAdminAuth, async (req, res) => {
  const { to, subject, html, pdfBase64, filename } = req.body;
  if (!to || !subject || !html || !pdfBase64 || !filename) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    await transporter.sendMail({
      from: 'Justice Ultimate Automobiles <justiceultimate.demo@gmail.com>',
      to,
      subject,
      html,
      attachments: [
        {
          filename,
          content: Buffer.from(pdfBase64, 'base64'),
          contentType: 'application/pdf',
        },
      ],
    });
    res.json({ success: true });
  } catch (err) {
    console.error('Email send error:', err);
    res.status(500).json({ error: 'Failed to send email' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});
app.get('/', (req, res) => {
  res.send('Backend JUA is working!');
});

// Improved /auth-users with better error handling
app.get('/auth-users', requireAdminAuth, async (req, res) => {
  try {
    let users = [];
    let page = 1;
    let perPage = 100;
    let done = false;
    while (!done) {
      const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error('Supabase listUsers error:', error.message);
        return res.status(500).json([]);
      }
      users = users.concat(data.users);
      if (data.users.length < perPage) done = true;
      else page++;
    }
    const result = users.map(u => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      user_metadata: u.user_metadata,
      phone: u.phone,
      last_sign_in_at: u.last_sign_in_at,
      app_metadata: u.app_metadata
    }));
    res.json(result);
  } catch (err) {
    console.error('Unexpected /auth-users error:', err);
    res.status(500).json([]);
  }
});

// Impersonation endpoint (should be protected in production!)
app.post('/impersonate', requireAdminAuth, async (req, res) => {
  const { user_id, admin_id, admin_email } = req.body;
  if (!user_id || !admin_id || !admin_email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    // Create a session for the target user
    const { data, error } = await supabaseAdmin.auth.admin.createSession({ user_id });
    if (error) {
      console.error('Impersonation error:', error.message);
      return res.status(500).json({ error: error.message });
    }
    // Log impersonation in audit_logs
    await supabaseAdmin.from('audit_logs').insert([
      {
        action: 'impersonate',
        admin_id,
        admin_email,
        affected_user_ids: [user_id],
        details: `Admin impersonated user ${user_id}`,
        timestamp: new Date().toISOString(),
      },
    ]);
    res.json({ session: data.session });
  } catch (err) {
    console.error('Unexpected /impersonate error:', err);
    res.status(500).json({ error: err.message || 'Failed to impersonate' });
  }
});

// Global audit log endpoint
app.get('/audit-logs', requireAdminAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin.from('audit_logs').select('*').order('timestamp', { ascending: false });
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to fetch audit logs' });
  }
});

// Secure system metrics endpoint
app.get('/api/system-metrics', async (req, res) => {
  try {
    // Auth: Require Bearer token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    // Validate token and get user
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    // RBAC: Only allow admin (2FA check relaxed for dev)
    if (user.app_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admins only (2FA check relaxed for dev)' });
    }
    // System metrics
    const cpuUsage = os.loadavg()[0];
    const memoryUsage = ((os.totalmem() - os.freemem()) / os.totalmem()) * 100;
    // Disk usage (Linux/Mac only, fallback to 0 on error)
    let diskUsage = 0;
    try {
      const df = execSync('df -h /').toString();
      const match = df.match(/\d+%/g);
      if (match && match[0]) diskUsage = parseInt(match[0]);
    } catch { diskUsage = 0; /* Ignore errors on Windows */ }
    // Network traffic (not trivial in Node, set to 0 or use a monitoring agent)
    const networkTraffic = 0;
    // DB connections (Postgres example)
    let dbConnections = 0;
    try {
      const { data } = await supabaseAdmin.rpc('pg_stat_activity_count');
      dbConnections = data || 0;
    } catch {}
    // Active users (example: count from profiles with recent activity)
    let activeUsers = 0;
    try {
      const { count } = await supabaseAdmin.from('profiles').select('*', { count: 'exact', head: true });
      activeUsers = count || 0;
    } catch {}
    res.json({
      cpuUsage,
      memoryUsage,
      diskUsage,
      networkTraffic,
      dbConnections,
      activeUsers
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Secure admin dashboard route (IDOR protection)
app.get('/dashboard/admin', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user || user.app_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }
    // If using SSR, render admin dashboard here
    // res.render('admin-dashboard');
    // For API, return success
    res.json({ status: 'ok', message: 'Welcome to the admin dashboard!' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Middleware: Enforce single-device login, session expiry, and IP/User-Agent binding
async function enforceSessionSecurity(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }
    // Check user_sessions table
    const { data: sessionRow, error: sessionError } = await supabase
      .from('user_sessions')
      .select('*')
      .eq('user_id', user.id)
      .single();
    if (sessionError || !sessionRow) {
      return res.status(401).json({ error: 'Session not found. Please log in again.' });
    }
    // Check token, IP, and user-agent
    if (
      sessionRow.token !== token ||
      sessionRow.ip !== req.ip ||
      sessionRow.user_agent !== req.headers['user-agent']
    ) {
      return res.status(401).json({ error: 'Session invalidated (new device or location)' });
    }
    // Check session expiry (15 min)
    const now = new Date();
    const created = new Date(sessionRow.created_at);
    if ((now - created) > 15 * 60 * 1000) {
      // Session expired
      await supabase.from('user_sessions').delete().eq('user_id', user.id);
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Session security check failed' });
  }
}

// Example: Protect all /dashboard/* routes
app.use('/dashboard', enforceSessionSecurity);

// Login logic: upsert session info (call this after successful login)
app.post('/api/login', async (req, res) => {
  try {
    const { token } = req.body; // Supabase JWT
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    // Upsert session info
    await supabase.from('user_sessions').upsert({
      user_id: user.id,
      token,
      ip: req.ip,
      user_agent: req.headers['user-agent'],
      created_at: new Date().toISOString()
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Login session setup failed' });
  }
});

// Logout everywhere endpoint
app.post('/api/logout-everywhere', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Invalid token' });
    await supabase.from('user_sessions').delete().eq('user_id', user.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Logout everywhere failed' });
  }
});

// Middleware: Update session_logs on every request
app.use(async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (user) {
        // Use a hash of token as session_id for privacy
        const session_id = require('crypto').createHash('sha256').update(token).digest('hex');
        await supabase.from('session_logs').upsert({
          user_id: user.id,
          session_id,
          last_active: new Date().toISOString()
        });
      }
    }
  } catch (err) {
    // Ignore errors for session logging
  }
  next();
});

// Admin endpoint: fetch all session logs for Activity Logs page
app.get('/api/admin/session-logs', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user || user.app_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admins only' });
    }
    const { data, error: logsError } = await supabase.from('session_logs').select('*').order('last_active', { ascending: false });
    if (logsError) return res.status(500).json({ error: logsError.message });
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch session logs' });
  }
});

// Setup reCAPTCHA endpoint
const { setupRecaptchaEndpoint } = require('./recaptchaEndpoint');
setupRecaptchaEndpoint(app);

app.listen(PORT, () => {
  console.log(`Receipt email server running on http://localhost:${PORT}`);
});

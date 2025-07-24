const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://gzmgfgcgytafngvliqqj.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6bWdmZ2NneXRhZm5ndmxpcXFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMyNTQzODEsImV4cCI6MjA2ODgzMDM4MX0.8xGAFdz9I4q-FOMjSBLMSqGpPL-_7hHh-5gjzt3uvwM'
);

async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    // DEV ONLY: Relax 2FA check for admin
    if (error || !user || user.app_metadata?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admins only (2FA check relaxed for dev)'});
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
  }
}

module.exports = { requireAdminAuth }; 
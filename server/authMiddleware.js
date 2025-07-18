const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://tyypdmhxuehzddudeuww.supabase.co',
  process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR5eXBkbWh4dWVoemRkdWRldXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2MDg1MTMsImV4cCI6MjA2ODE4NDUxM30.eFoatxJAJrIxMGvs4FVTnzDpOUsL-pdKM8VAsw7E10Y'
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
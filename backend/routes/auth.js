import { Router } from 'express';
import { query, queryOne, execute, getTableColumns, erpQuery } from '../lib/db.js';
import { getCurrentUser, createToken } from '../lib/auth.js';
import { LINE_CHANNEL_ID, LINE_CHANNEL_SECRET, LINE_CALLBACK_URL } from '../config.js';

const router = Router();

router.get('/me', (req, res) => {
  const user = getCurrentUser(req);
  if (!user) return res.status(401).json({ error: 'missing or invalid token' });
  res.json({ user });
});

router.post('/line', async (req, res) => {
  try {
    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ error: 'code is required' });

    if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
      return res.status(500).json({ error: 'LINE login not configured' });
    }

    // 1. Exchange code for LINE access token
    const tokenRes = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: LINE_CALLBACK_URL,
        client_id: LINE_CHANNEL_ID,
        client_secret: LINE_CHANNEL_SECRET,
      }),
    });
    const tokenData = tokenRes.ok ? await tokenRes.json() : null;
    if (!tokenRes.ok || !tokenData?.access_token) {
      return res.status(401).json({ error: 'LINE token exchange failed', detail: tokenData });
    }

    // 2. Get LINE profile
    const profileRes = await fetch('https://api.line.me/v2/profile', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = profileRes.ok ? await profileRes.json() : null;
    if (!profileRes.ok || !profile?.userId) {
      return res.status(401).json({ error: 'failed to get LINE profile' });
    }

    // 3. Check erp_user in odg DB
    const erpUsers = await erpQuery(
      "SELECT code, name_1 FROM erp_user WHERE side = '800' AND line_id = $1",
      [profile.userId]
    );
    const erpUser = erpUsers[0] || null;
    if (!erpUser) {
      return res.status(401).json({ error: 'LINE account not found in ERP system.' });
    }

    // 4. Ensure line_user_id column exists
    const columns = await getTableColumns('users');
    if (!columns.has('line_user_id')) {
      await execute('ALTER TABLE users ADD COLUMN IF NOT EXISTS line_user_id TEXT UNIQUE');
    }
    if (columns.has('password')) {
      await execute('ALTER TABLE users ALTER COLUMN password DROP NOT NULL');
    }

    // 5. Check if user exists
    let user = await queryOne(
      'SELECT id, username, name, role FROM users WHERE line_user_id = $1',
      [profile.userId]
    );

    // 6. If not found, insert
    if (!user) {
      const MANAGER_CODES = new Set(['22020']);
      const role = MANAGER_CODES.has(String(erpUser.code)) ? 'manager' : 'user';
      const users = await query(
        'INSERT INTO users (username, name, role, line_user_id) VALUES ($1, $2, $3, $4) RETURNING id, username, name, role',
        [erpUser.code, erpUser.name_1, role, profile.userId]
      );
      user = users[0];
    }

    // 7. Create token
    const token = createToken(user);
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        avatar: profile.pictureUrl,
        displayName: profile.displayName,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/line/callback', (req, res) => {
  const code = req.query.code || '';
  if (!code) return res.redirect('/login');
  res.redirect(`/login?code=${code}`);
});

export default router;

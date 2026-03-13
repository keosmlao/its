import { Router } from 'express';
import { query, queryOne, execute } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

async function ensureTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  await execute(`
    CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications (user_id, is_read) WHERE is_read = FALSE
  `);
}

router.get('/', requireAuth(), async (req, res) => {
  try {
    const user = req.user;
    await ensureTable();

    const rows = await query(
      'SELECT id, type, title, message, link, is_read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [user.id]
    );
    const countRow = await queryOne(
      'SELECT COUNT(*)::int AS unread FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [user.id]
    );
    res.json({ data: rows, unread: countRow?.unread || 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/', requireAuth(), async (req, res) => {
  try {
    const user = req.user;
    await ensureTable();
    const body = req.body || {};
    const ids = body.ids || [];

    if (Array.isArray(ids) && ids.length) {
      await execute(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND id = ANY($2::int[])',
        [user.id, ids]
      );
    } else {
      await execute(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
        [user.id]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

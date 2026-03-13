import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

router.get('/', requireAuth(['manager', 'helpdesk']), async (req, res) => {
  try {
    const rows = await query("SELECT id, username, name, role FROM users WHERE role IN ('helpdesk', 'it_support') ORDER BY name ASC");
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

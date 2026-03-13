import { Router } from 'express';
import { erpQuery } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { DEBUG } from '../config.js';

const router = Router();

router.get('/', requireAuth(['manager', 'helpdesk']), async (req, res) => {
  try {
    const rows = await erpQuery(
      `SELECT DISTINCT department_code, department_name_lo
       FROM odg_department
       WHERE department_code IS NOT NULL
         AND department_name_lo IS NOT NULL
       ORDER BY department_name_lo ASC`
    );
    res.json(rows.map(r => ({ code: r.department_code, name: r.department_name_lo })));
  } catch (err) {
    const msg = DEBUG ? err.message : 'failed to load departments';
    res.status(500).json({ error: msg });
  }
});

export default router;

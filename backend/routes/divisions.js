import { Router } from 'express';
import { erpQuery } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

router.get('/', requireAuth(['manager', 'helpdesk']), async (req, res) => {
  try {
    const rows = await erpQuery('SELECT division_code, division_name_lo FROM odg_division ORDER BY division_name_lo ASC');
    res.json(rows.map(r => ({ code: r.division_code, name: r.division_name_lo })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:code/departments', requireAuth(['manager', 'helpdesk']), async (req, res) => {
  try {
    const { code } = req.params;
    if (!code) return res.status(400).json({ error: 'division_code is required' });
    const rows = await erpQuery(
      'SELECT department_code, department_name_lo FROM odg_department WHERE division_code = $1 ORDER BY department_name_lo ASC',
      [code]
    );
    res.json(rows.map(r => ({ code: r.department_code, name: r.department_name_lo })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

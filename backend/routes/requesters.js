import { Router } from 'express';
import { erpQuery } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';
import { DEBUG } from '../config.js';

const router = Router();

// List employees from odg_employee (supports optional division_code & department_code filters)
router.get('/', requireAuth(['manager', 'helpdesk']), async (req, res) => {
  try {
    const { division_code, department_code } = req.query;
    let sql = "SELECT employee_code, fullname_lo, division_code, department_code FROM odg_employee WHERE employment_status = 'ACTIVE'";
    const params = [];
    if (division_code) {
      params.push(division_code);
      sql += ` AND division_code = $${params.length}`;
    }
    if (department_code) {
      params.push(department_code);
      sql += ` AND department_code = $${params.length}`;
    }
    sql += ' ORDER BY fullname_lo ASC';
    const rows = await erpQuery(sql, params);
    res.json(rows.map(r => ({
      code: r.employee_code,
      name: r.fullname_lo,
      division_code: r.division_code,
      department_code: r.department_code,
    })));
  } catch (err) {
    const msg = DEBUG ? err.message : 'failed to load requesters';
    res.status(500).json({ error: msg });
  }
});

export default router;

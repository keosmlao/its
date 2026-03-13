import { Router } from 'express';
import { query } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

router.get('/', requireAuth(['it_support', 'manager']), async (req, res) => {
  try {
    const user = req.user;
    let rows;
    if (user.role === 'it_support') {
      rows = await query(
        `SELECT a.id AS assignment_id, a.ticket_id, a.assignee_id, a.assigned_at,
                a.status AS assignment_status, t.title, t.status AS ticket_status,
                t.priority, t.requester_id
         FROM assignments a
         JOIN tickets t ON t.id = a.ticket_id
         WHERE a.assignee_id = $1 AND a.status = 'active'
         ORDER BY a.assigned_at DESC`,
        [user.id]
      );
    } else {
      rows = await query(
        `SELECT a.id AS assignment_id, a.ticket_id, a.assignee_id, a.assigned_at,
                a.status AS assignment_status, t.title, t.status AS ticket_status,
                t.priority, t.requester_id
         FROM assignments a
         JOIN tickets t ON t.id = a.ticket_id
         ORDER BY a.assigned_at DESC`
      );
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

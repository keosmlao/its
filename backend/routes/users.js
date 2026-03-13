import { Router } from 'express';
import { query, queryOne, execute, getTableColumns, getTransaction } from '../lib/db.js';
import { requireAuth, getCurrentUser, ALL_ROLES } from '../lib/auth.js';

const router = Router();

const trim = v => String(v ?? '').trim();

router.get('/', requireAuth(['manager', 'helpdesk']), async (req, res) => {
  try {
    const user = req.user;
    if (user.role === 'helpdesk') {
      const rows = await query(
        "SELECT id, username, role, name FROM public.users WHERE role IN ('it_support', 'programmer', 'lead_programmer', 'manager') ORDER BY name ASC NULLS LAST, username ASC"
      );
      return res.json(rows);
    }
    const rows = await query('SELECT id, username, role, name, line_user_id, created_at FROM public.users');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth(['manager']), async (req, res) => {
  try {
    const body = req.body || {};
    const username = trim(body.username).toLowerCase();
    const role = trim(body.role).toLowerCase();
    const name = trim(body.name);
    const lineUserId = trim(body.line_user_id) || null;

    const users = await query(
      'INSERT INTO users (username, name, role, line_user_id) VALUES ($1, $2, $3, $4) RETURNING id, username, name, role, line_user_id',
      [username, name, role, lineUserId]
    );
    if (!users.length) return res.status(500).json({ error: 'failed to insert user' });
    res.status(201).json(users[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:userId', requireAuth(['manager']), async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const body = req.body || {};
    const columns = await getTableColumns('users');
    const setParts = [];
    const values = [];
    let idx = 1;

    if ('username' in body && columns.has('username')) {
      setParts.push(`username = $${idx++}`);
      values.push(trim(body.username).toLowerCase() || null);
    }
    if ('name' in body && columns.has('name')) {
      setParts.push(`name = $${idx++}`);
      values.push(trim(body.name) || null);
    }
    if ('role' in body && columns.has('role')) {
      const role = trim(body.role).toLowerCase();
      if (role && !ALL_ROLES.has(role)) return res.status(400).json({ error: 'invalid role' });
      setParts.push(`role = $${idx++}`);
      values.push(role || null);
    }
    if ('line_user_id' in body && columns.has('line_user_id')) {
      setParts.push(`line_user_id = $${idx++}`);
      values.push(trim(body.line_user_id) || null);
    }

    if (setParts.length === 0) return res.status(400).json({ error: 'no fields to update' });

    values.push(userId);
    const user = await queryOne(
      `UPDATE users SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING id, username, name, role, line_user_id, created_at`,
      values
    );
    if (!user) return res.status(404).json({ error: 'user not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:userId', requireAuth(['manager']), async (req, res) => {
  const tx = await getTransaction();
  try {
    const userId = parseInt(req.params.userId, 10);
    const currentUser = getCurrentUser(req);
    if (currentUser && currentUser.id === userId) {
      await tx.rollback();
      return res.status(400).json({ error: 'ບໍ່ສາມາດລົບ user ທີ່ກຳລັງ login ໄດ້' });
    }

    const target = await tx.queryOne('SELECT id, role FROM users WHERE id = $1', [userId]);
    if (!target) { await tx.rollback(); return res.status(404).json({ error: 'user not found' }); }

    if (target.role === 'manager') {
      const countRow = await tx.queryOne("SELECT COUNT(*)::int AS total FROM users WHERE role = 'manager' AND id <> $1", [userId]);
      if ((countRow?.total || 0) <= 0) {
        await tx.rollback();
        return res.status(400).json({ error: 'ຕ້ອງມີ manager ຢ່າງນ້ອຍ 1 ຄົນ' });
      }
    }

    const ticketCols = await getTableColumns('tickets');
    const assignmentCols = await getTableColumns('assignments');
    const projectCols = await getTableColumns('projects');
    const taskCols = await getTableColumns('tasks');

    if (ticketCols.has('requester_id')) await tx.execute('UPDATE tickets SET requester_id = NULL WHERE requester_id = $1', [userId]);
    if (ticketCols.has('assignee_id')) await tx.execute('UPDATE tickets SET assignee_id = NULL WHERE assignee_id = $1', [userId]);
    if (assignmentCols.has('assignee_id')) await tx.execute('UPDATE assignments SET assignee_id = NULL WHERE assignee_id = $1', [userId]);
    if (assignmentCols.has('assigned_by_id')) await tx.execute('UPDATE assignments SET assigned_by_id = NULL WHERE assigned_by_id = $1', [userId]);
    if (projectCols.has('project_lead_id')) await tx.execute('UPDATE projects SET project_lead_id = NULL WHERE project_lead_id = $1', [userId]);
    if (projectCols.has('created_by')) await tx.execute('UPDATE projects SET created_by = NULL WHERE created_by = $1', [userId]);
    if (taskCols.has('assigned_to')) await tx.execute('UPDATE tasks SET assigned_to = NULL WHERE assigned_to = $1', [userId]);
    if (taskCols.has('assigned_by')) await tx.execute('UPDATE tasks SET assigned_by = NULL WHERE assigned_by = $1', [userId]);

    await tx.execute('DELETE FROM users WHERE id = $1', [userId]);
    await tx.commit();
    res.json({ deleted: true });
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ error: err.message });
  }
});

export default router;

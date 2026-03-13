import { Router } from 'express';
import { query, queryOne, getTableColumns, getTransaction } from '../lib/db.js';
import { requireAuth, getCurrentUser } from '../lib/auth.js';

const router = Router();

const TASK_STATUSES = new Set(['pending', 'assigned', 'in_progress', 'submitted', 'testing', 'rejected', 'lead_approved', 'manager_approved']);

const trim = v => String(v ?? '').trim();

function parseFloat_(v) {
  if (v == null || v === '') return null;
  const n = parseFloat(v);
  return isNaN(n) ? NaN : n;
}

router.get('/', requireAuth(['manager', 'lead_programmer', 'programmer']), async (req, res) => {
  try {
    const user = req.user;
    const cols = await getTableColumns('tasks');
    if (cols.size === 0) return res.json([]);

    let rows;
    if (user.role === 'programmer' && cols.has('assigned_to')) {
      rows = await query('SELECT * FROM tasks WHERE assigned_to = $1 ORDER BY id DESC', [user.id]);
    } else {
      rows = await query('SELECT * FROM tasks ORDER BY id DESC');
    }
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth(['manager', 'lead_programmer']), async (req, res) => {
  const tx = await getTransaction();
  try {
    const currentUser = getCurrentUser(req);
    const body = req.body || {};
    let projectId = body.project_id;
    const title = trim(body.title);
    const subTitle = trim(body.sub_title);
    const description = trim(body.description);
    let assignedTo = null;
    const status = trim(body.status).toLowerCase();
    const estimatedHours = parseFloat_(body.estimated_hours);

    if (!projectId || !title) { await tx.rollback(); return res.status(400).json({ error: 'project_id and title are required' }); }
    projectId = parseInt(projectId, 10);
    if (isNaN(projectId)) { await tx.rollback(); return res.status(400).json({ error: 'project_id must be an integer' }); }

    if (body.assigned_to != null && body.assigned_to !== '') {
      assignedTo = parseInt(body.assigned_to, 10);
      if (isNaN(assignedTo)) { await tx.rollback(); return res.status(400).json({ error: 'assigned_to must be an integer' }); }
    }

    if (estimatedHours !== null && Number.isNaN(estimatedHours)) { await tx.rollback(); return res.status(400).json({ error: 'estimated_hours must be a number' }); }
    if (status && !TASK_STATUSES.has(status)) { await tx.rollback(); return res.status(400).json({ error: 'invalid task status' }); }

    const cols = await getTableColumns('tasks');
    if (cols.size === 0) { await tx.rollback(); return res.status(500).json({ error: 'tasks table not found' }); }

    const project = await tx.queryOne('SELECT id FROM projects WHERE id = $1', [projectId]);
    if (!project) { await tx.rollback(); return res.status(404).json({ error: 'project not found' }); }
    if (assignedTo) {
      const assignee = await tx.queryOne('SELECT id FROM users WHERE id = $1', [assignedTo]);
      if (!assignee) { await tx.rollback(); return res.status(404).json({ error: 'assignee not found' }); }
    }

    let taskNumber = null;
    if (cols.has('task_number')) {
      const row = await tx.queryOne('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM tasks');
      taskNumber = `TASK-${String(row.next_id).padStart(3, '0')}`;
    }

    const fields = { project_id: projectId, title };
    if (cols.has('task_number')) fields.task_number = taskNumber;
    if (cols.has('sub_title')) fields.sub_title = subTitle || null;
    if (cols.has('description')) fields.description = description || null;
    if (cols.has('assigned_to')) fields.assigned_to = assignedTo;
    if (cols.has('assigned_by')) fields.assigned_by = (assignedTo && currentUser) ? currentUser.id : null;
    if (cols.has('status')) fields.status = status || (assignedTo ? 'assigned' : 'pending');
    if (cols.has('estimated_hours')) fields.estimated_hours = estimatedHours;

    const colNames = Object.keys(fields);
    const values = colNames.map(k => fields[k]);
    const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
    const task = await tx.queryOne(
      `INSERT INTO tasks (${colNames.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    await tx.commit();
    res.status(201).json(task);
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:taskId', requireAuth(['manager', 'lead_programmer', 'programmer']), async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId, 10);
    const currentUser = getCurrentUser(req);
    const body = req.body || {};
    const cols = await getTableColumns('tasks');
    if (cols.size === 0) return res.status(500).json({ error: 'tasks table not found' });

    const fields = {};
    if ('title' in body && cols.has('title')) fields.title = trim(body.title);
    if ('sub_title' in body && cols.has('sub_title')) fields.sub_title = trim(body.sub_title);
    if ('description' in body && cols.has('description')) fields.description = trim(body.description);
    if ('status' in body && cols.has('status')) {
      const s = trim(body.status).toLowerCase();
      if (!TASK_STATUSES.has(s)) return res.status(400).json({ error: 'invalid task status' });
      fields.status = s;
    }
    if ('assigned_to' in body && cols.has('assigned_to')) {
      const v = body.assigned_to;
      if (v == null || v === '') fields.assigned_to = null;
      else {
        const n = parseInt(v, 10);
        if (isNaN(n)) return res.status(400).json({ error: 'assigned_to must be an integer' });
        fields.assigned_to = n;
      }
      if (cols.has('assigned_by')) {
        fields.assigned_by = (fields.assigned_to && currentUser) ? currentUser.id : null;
      }
    }
    if ('reject_reason' in body && cols.has('reject_reason')) fields.reject_reason = trim(body.reject_reason);
    if ('estimated_hours' in body && cols.has('estimated_hours')) {
      const eh = parseFloat_(body.estimated_hours);
      if (eh !== null && Number.isNaN(eh)) return res.status(400).json({ error: 'estimated_hours must be a number' });
      fields.estimated_hours = eh;
    }

    if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'no fields to update' });

    // Programmer can only update own tasks
    if (currentUser?.role === 'programmer') {
      const own = await queryOne('SELECT assigned_to FROM tasks WHERE id = $1', [taskId]);
      if (!own || own.assigned_to !== currentUser.id) return res.status(403).json({ error: 'forbidden' });
    }

    const setParts = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of Object.entries(fields)) {
      setParts.push(`${key} = $${idx++}`);
      values.push(value === '' ? null : value);
    }
    setParts.push('updated_at = now()');
    values.push(taskId);

    const task = await queryOne(
      `UPDATE tasks SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!task) return res.status(404).json({ error: 'task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:taskId', requireAuth(['manager', 'lead_programmer']), async (req, res) => {
  try {
    const task = await queryOne('DELETE FROM tasks WHERE id = $1 RETURNING *', [parseInt(req.params.taskId, 10)]);
    if (!task) return res.status(404).json({ error: 'task not found' });
    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

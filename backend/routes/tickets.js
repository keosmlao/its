import { Router } from 'express';
import { query, queryOne, execute, getTableColumns, getTableColumnTypes, getTransaction } from '../lib/db.js';
import { requireAuth, getCurrentUser, ALL_ROLES, SUPPORT_ONLY_ROLES, DEV_ROLES } from '../lib/auth.js';
import { notifyHelpdeskStaff, notifyManagers, createNotification } from '../lib/notifications.js';

const router = Router();

const trim = v => String(v ?? '').trim();

function parseInt_(v) {
  if (v == null || v === '') return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? NaN : n;
}

router.get('/', requireAuth([...ALL_ROLES]), async (req, res) => {
  try {
    const user = req.user;
    const cols = await getTableColumns('tickets');
    const hasAssignee = cols.has('assignee_id');
    const join = hasAssignee
      ? "LEFT JOIN users u ON u.id = NULLIF(t.assignee_id::text, '')::integer"
      : 'LEFT JOIN users u ON FALSE';

    const baseSql = `SELECT t.*, u.name AS assignee_name, u.username AS assignee_username FROM tickets t ${join}`;

    const queryUserId = trim(req.query.user_id);
    let rows;
    if (queryUserId) {
      if (!hasAssignee) return res.json([]);
      rows = await query(`${baseSql} WHERE t.assignee_id::text = $1 ORDER BY t.id DESC`, [queryUserId]);
    } else if (SUPPORT_ONLY_ROLES.has(user.role) || DEV_ROLES.has(user.role)) {
      if (!hasAssignee) return res.json([]);
      rows = await query(`${baseSql} WHERE t.assignee_id::text = $1 ORDER BY t.id DESC`, [String(user.id)]);
    } else {
      rows = await query(`${baseSql} ORDER BY t.id DESC`);
    }

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth([...ALL_ROLES]), async (req, res) => {
  try {
    const user = req.user;
    const body = req.body || {};
    const title = trim(body.title);
    const description = trim(body.description);
    const priority = trim(body.priority || 'medium').toLowerCase();

    let categoryId = null;
    if (body.category_id != null && body.category_id !== '') {
      categoryId = parseInt(body.category_id, 10);
      if (isNaN(categoryId)) return res.status(400).json({ error: 'category_id must be an integer' });
    }

    const divisionCode = trim(body.division_code) || null;
    const divisionName = trim(body.division_name) || null;
    const departmentCode = trim(body.department_code) || null;
    const departmentName = trim(body.department_name) || null;
    const requesterCode = trim(body.requester_code) || null;
    const requesterName = trim(body.requester_name) || null;
    const expectedDoneDate = trim(body.expected_done_date) || null;

    const cols = await getTableColumns('tickets');
    const insertCols = [];
    const insertVals = [];

    function add(name, value) {
      if (cols.has(name)) {
        insertCols.push(name);
        insertVals.push(value);
      }
    }

    add('title', title);
    add('description', description);
    add('priority', priority);
    add('category_id', categoryId);
    add('division_code', divisionCode);
    add('division_name', divisionName);
    add('department_code', departmentCode);
    add('department_name', departmentName);
    add('requester_code', requesterCode);
    add('requester_name', requesterName);
    add('expected_done_date', expectedDoneDate);

    const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
    const ticket = await queryOne(
      `INSERT INTO tickets (${insertCols.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      insertVals
    );

    // Log initial status
    try {
      await execute(
        "INSERT INTO ticket_status_logs (ticket_id, from_status, to_status, changed_by_id, note) VALUES ($1, NULL, 'open', $2, $3)",
        [ticket.id, user.id, 'ສ້າງ Ticket ໃໝ່']
      );
    } catch {}

    // Notify helpdesk
    try {
      await notifyHelpdeskStaff('Ticket ໃໝ່', 'ticket', `#${ticket.id}: ${title}`, '/tickets');
    } catch {}

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ticketId', requireAuth([...ALL_ROLES]), async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const user = req.user;
    const cols = await getTableColumns('tickets');
    const hasAssignee = cols.has('assignee_id');
    const join = hasAssignee
      ? "LEFT JOIN users u ON u.id = NULLIF(t.assignee_id::text, '')::integer"
      : 'LEFT JOIN users u ON FALSE';
    const baseSql = `SELECT t.*, u.name AS assignee_name, u.username AS assignee_username FROM tickets t ${join}`;

    let ticket;
    if (user.role === 'user' && cols.has('requester_id')) {
      ticket = await queryOne(`${baseSql} WHERE t.id = $1 AND t.requester_id = $2`, [ticketId, user.id]);
    } else {
      ticket = await queryOne(`${baseSql} WHERE t.id = $1`, [ticketId]);
    }

    if (!ticket) return res.status(404).json({ error: 'ticket not found' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:ticketId', requireAuth(['helpdesk', 'manager']), async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const body = req.body || {};
    const cols = await getTableColumns('tickets');
    if (cols.size === 0) return res.status(500).json({ error: 'tickets table not found' });

    const fields = {};
    if ('title' in body && cols.has('title')) {
      const title = trim(body.title);
      if (!title) return res.status(400).json({ error: 'title is required' });
      fields.title = title;
    }
    if ('description' in body && cols.has('description')) {
      const desc = trim(body.description);
      if (!desc) return res.status(400).json({ error: 'description is required' });
      fields.description = desc;
    }
    if ('category_id' in body && cols.has('category_id')) {
      const cid = parseInt_(body.category_id);
      if (Number.isNaN(cid)) return res.status(400).json({ error: 'category_id must be an integer' });
      fields.category_id = cid;
    }
    for (const key of ['division_code', 'division_name', 'department_code', 'department_name', 'requester_code', 'requester_name']) {
      if (key in body && cols.has(key)) {
        fields[key] = trim(body[key]) || null;
      }
    }

    if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'no fields to update' });

    const setParts = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of Object.entries(fields)) {
      setParts.push(`${key} = $${idx++}`);
      values.push(value);
    }
    if (cols.has('updated_at')) setParts.push('updated_at = now()');

    values.push(ticketId);
    const ticket = await queryOne(
      `UPDATE tickets SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!ticket) return res.status(404).json({ error: 'ticket not found' });
    res.json({ ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:ticketId', requireAuth(['helpdesk', 'manager']), async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const ticket = await queryOne('DELETE FROM tickets WHERE id = $1 RETURNING *', [ticketId]);
    if (!ticket) return res.status(404).json({ error: 'ticket not found' });
    res.json({ ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:ticketId/status', requireAuth(['it_support', 'helpdesk', 'manager', 'programmer', 'lead_programmer']), async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const body = req.body || {};
    const status = trim(body.status).toLowerCase();
    const allowed = new Set(['open', 'assigned', 'accepted', 'in_progress', 'waiting', 'closed']);
    if (!allowed.has(status)) return res.status(400).json({ error: 'invalid status' });

    let sparePartDate = body.spare_part_date || null;
    let expectedDoneDate = body.expected_done_date || null;
    let closeReason = trim(body.close_reason) || null;

    const cols = await getTableColumns('tickets');
    const colTypes = await getTableColumnTypes('tickets');
    const hasDates = cols.has('spare_part_date') && cols.has('expected_done_date')
      && colTypes.spare_part_date === 'date' && colTypes.expected_done_date === 'date';
    const hasCloseReason = cols.has('close_reason');
    const hasClosedAt = cols.has('closed_at');

    if (status !== 'waiting') { sparePartDate = null; expectedDoneDate = null; }
    if (status !== 'closed') closeReason = null;

    const currentUser = getCurrentUser(req);
    const fromRow = await queryOne('SELECT status FROM tickets WHERE id = $1', [ticketId]);
    const fromStatus = fromRow?.status || null;

    const setClauses = ['status = $1', 'updated_at = now()'];
    const values = [status];
    let idx = 2;

    if (hasDates) {
      setClauses.push(`spare_part_date = $${idx++}`);
      values.push(sparePartDate);
      setClauses.push(`expected_done_date = $${idx++}`);
      values.push(expectedDoneDate);
    }
    if (hasCloseReason) {
      setClauses.push(`close_reason = $${idx++}`);
      values.push(closeReason);
    }
    if (hasClosedAt) {
      if (status === 'closed') setClauses.push('closed_at = now()');
      else setClauses.push('closed_at = NULL');
    }

    values.push(ticketId);
    const ticket = await queryOne(
      `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!ticket) return res.status(404).json({ error: 'ticket not found' });

    // Log status change
    try {
      await execute(
        'INSERT INTO ticket_status_logs (ticket_id, from_status, to_status, changed_by_id) VALUES ($1, $2, $3, $4)',
        [ticketId, fromStatus, status, currentUser?.id || null]
      );
    } catch {}

    const STATUS_LABELS = {
      open: 'ລໍຖ້າຮັບງານ', assigned: 'ຖືກມອບໝາຍ',
      in_progress: 'ກຳລັງດຳເນີນ', waiting: 'ລໍຖ້າອາໄຫຼ່', closed: 'ປິດ Job',
    };
    try {
      await notifyManagers('ອັບເດດສະຖານະ', 'status',
        `Ticket #${ticketId} → ${STATUS_LABELS[status] || status}`, '/tickets');
    } catch {}

    res.json({ ticket });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ticketId/assign', requireAuth(['helpdesk', 'manager']), async (req, res) => {
  const tx = await getTransaction();
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const body = req.body || {};
    let assigneeId = body.assignee_id;
    if (!assigneeId) { await tx.rollback(); return res.status(400).json({ error: 'assignee_id is required' }); }
    assigneeId = parseInt(assigneeId, 10);
    if (isNaN(assigneeId)) { await tx.rollback(); return res.status(400).json({ error: 'assignee_id must be an integer' }); }

    const currentUser = getCurrentUser(req);
    const assignedById = currentUser?.id || null;

    const assignee = await tx.queryOne('SELECT role, name, username FROM users WHERE id = $1', [assigneeId]);
    const allowedRoles = new Set([...SUPPORT_ONLY_ROLES, ...DEV_ROLES, 'manager']);
    if (req.user.role === 'manager') allowedRoles.add('helpdesk');
    if (!assignee || !allowedRoles.has(assignee.role)) {
      await tx.rollback();
      return res.status(400).json({ error: 'assignee must be it_support, programmer or manager' });
    }

    const assignment = await tx.queryOne(
      'INSERT INTO assignments (ticket_id, assignee_id, assigned_by_id) VALUES ($1, $2, $3) RETURNING *',
      [ticketId, assigneeId, assignedById]
    );

    const prev = await tx.queryOne('SELECT status FROM tickets WHERE id = $1', [ticketId]);
    const fromStatus = prev?.status || null;

    const ticket = await tx.queryOne(
      "UPDATE tickets SET assignee_id = $1, status = 'assigned', updated_at = now() WHERE id = $2 RETURNING *",
      [assigneeId, ticketId]
    );

    await tx.execute(
      "INSERT INTO ticket_status_logs (ticket_id, from_status, to_status, changed_by_id, note) VALUES ($1, $2, 'assigned', $3, $4)",
      [ticketId, fromStatus, assignedById, `ມອບໝາຍໃຫ້ ${assignee.name || assignee.username}`]
    );

    await tx.commit();

    try {
      await createNotification(assigneeId, 'ມອບໝາຍ Ticket ໃໝ່', 'assign',
        `ທ່ານໄດ້ຮັບມອບໝາຍ Ticket #${ticketId}`, '/tickets');
    } catch {}

    res.json({ assignment, ticket });
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ticketId/assign-status', requireAuth(['helpdesk', 'manager']), async (req, res) => {
  const tx = await getTransaction();
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const body = req.body || {};
    let assigneeId = body.assignee_id;
    const status = trim(body.status).toLowerCase();
    if (!assigneeId) { await tx.rollback(); return res.status(400).json({ error: 'assignee_id is required' }); }
    if (!status) { await tx.rollback(); return res.status(400).json({ error: 'status is required' }); }
    assigneeId = parseInt(assigneeId, 10);
    if (isNaN(assigneeId)) { await tx.rollback(); return res.status(400).json({ error: 'assignee_id must be an integer' }); }

    const currentUser = getCurrentUser(req);
    const assignedById = currentUser?.id || null;

    const assignee = await tx.queryOne('SELECT role FROM users WHERE id = $1', [assigneeId]);
    const allowedRoles = new Set([...SUPPORT_ONLY_ROLES, ...DEV_ROLES]);
    if (!assignee || !allowedRoles.has(assignee.role)) {
      await tx.rollback();
      return res.status(400).json({ error: 'assignee must be it_support or programmer' });
    }

    const assignment = await tx.queryOne(
      'INSERT INTO assignments (ticket_id, assignee_id, assigned_by_id) VALUES ($1, $2, $3) RETURNING *',
      [ticketId, assigneeId, assignedById]
    );
    const ticket = await tx.queryOne(
      'UPDATE tickets SET assignee_id = $1, status = $2, updated_at = now() WHERE id = $3 RETURNING *',
      [assigneeId, status, ticketId]
    );

    await tx.commit();
    res.json({ assignment, ticket });
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ticketId/take', requireAuth(['it_support', 'programmer', 'lead_programmer', 'manager']), async (req, res) => {
  const tx = await getTransaction();
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const user = getCurrentUser(req);
    const body = req.body || {};
    let assigneeId = body.assignee_id;
    if (assigneeId == null || assigneeId === '') assigneeId = req.query.assignee_id;
    if ((assigneeId == null || assigneeId === '') && user) assigneeId = user.id;
    assigneeId = parseInt(assigneeId, 10);
    if (isNaN(assigneeId)) { await tx.rollback(); return res.status(400).json({ error: 'assignee_id must be an integer' }); }

    const prev = await tx.queryOne('SELECT status FROM tickets WHERE id = $1', [ticketId]);
    const fromStatus = prev?.status || null;

    await tx.queryOne(
      'INSERT INTO assignments (ticket_id, assignee_id, assigned_by_id) VALUES ($1, $2, $3) RETURNING *',
      [ticketId, assigneeId, assigneeId]
    );
    const ticket = await tx.queryOne(
      "UPDATE tickets SET assignee_id = $1, status = 'accepted', updated_at = now() WHERE id = $2 RETURNING *",
      [assigneeId, ticketId]
    );
    await tx.execute(
      "INSERT INTO ticket_status_logs (ticket_id, from_status, to_status, changed_by_id, note) VALUES ($1, $2, 'accepted', $3, $4)",
      [ticketId, fromStatus, user?.id || null, 'ຮັບງານ']
    );

    await tx.commit();
    res.json({ ticket });
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ error: err.message });
  }
});

router.post('/:ticketId/assign-take', requireAuth([...ALL_ROLES]), async (req, res) => {
  const tx = await getTransaction();
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const body = req.body || {};
    const assigneeId = body.assignee_id;
    if (!assigneeId) { await tx.rollback(); return res.status(400).json({ error: 'Missing assignee_id' }); }

    const existing = await tx.queryOne('SELECT status FROM tickets WHERE id = $1', [ticketId]);
    if (!existing) { await tx.rollback(); return res.status(404).json({ error: 'Ticket not found' }); }
    if (existing.status === 'closed') { await tx.rollback(); return res.status(400).json({ error: 'Cannot assign a closed ticket' }); }

    const ticket = await tx.queryOne(
      "UPDATE tickets SET assignee_id = $1, status = 'in_progress', updated_at = NOW() WHERE id = $2 RETURNING *",
      [assigneeId, ticketId]
    );

    await tx.commit();
    res.json({ ticket });
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:ticketId/priority', requireAuth(['manager']), async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const priority = trim(req.body?.priority).toLowerCase();
    if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
      return res.status(400).json({ error: 'invalid priority' });
    }

    const ticket = await queryOne(
      'UPDATE tickets SET priority = $1, updated_at = now() WHERE id = $2 RETURNING id, priority, updated_at',
      [priority, ticketId]
    );
    if (!ticket) return res.status(404).json({ error: 'ticket not found' });
    res.json(ticket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:ticketId/history', requireAuth(['manager', 'helpdesk', 'it_support', 'programmer', 'lead_programmer', 'user']), async (req, res) => {
  try {
    const ticketId = parseInt(req.params.ticketId, 10);
    const ticket = await queryOne(
      'SELECT id, title, status, priority, created_at, updated_at, closed_at, requester_name, assignee_id FROM tickets WHERE id = $1',
      [ticketId]
    );
    if (!ticket) return res.status(404).json({ error: 'ticket not found' });

    let statusLogs = [];
    try {
      statusLogs = await query(
        `SELECT l.id, l.from_status, l.to_status, l.note, l.created_at,
                u.name AS changed_by_name, u.username AS changed_by_username
         FROM ticket_status_logs l
         LEFT JOIN users u ON u.id = l.changed_by_id
         WHERE l.ticket_id = $1 ORDER BY l.created_at ASC`,
        [ticketId]
      );
    } catch {}

    res.json({ ticket, statusLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

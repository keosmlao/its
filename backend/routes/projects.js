import { Router } from 'express';
import { query, queryOne, execute, getTableColumns, getTableColumnTypes, getTransaction } from '../lib/db.js';
import { requireAuth, getCurrentUser } from '../lib/auth.js';
import { saveUploadedFile } from '../lib/uploads.js';
import multer from 'multer';

const router = Router();
const upload = multer({ dest: '/tmp/uploads' });

const PROJECT_TYPES = new Set(['new_system', 'system_improvement']);
const PROJECT_STATUSES = new Set(['registered', 'requirements', 'subtasks', 'presenting', 'development', 'completed']);

const trim = v => String(v ?? '').trim();

router.get('/', requireAuth(['manager', 'lead_programmer', 'programmer']), async (req, res) => {
  try {
    const cols = await getTableColumns('projects');
    if (cols.size === 0) return res.json([]);
    const rows = await query('SELECT * FROM projects ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth(['manager', 'lead_programmer']), async (req, res) => {
  const tx = await getTransaction();
  try {
    const body = req.body || {};
    const title = trim(body.title);
    const description = trim(body.description);
    const projectType = trim(body.type).toLowerCase();
    const departmentCode = trim(body.department_code) || null;
    const departmentName = trim(body.department_name) || null;
    const requesterCode = trim(body.requester_code) || null;
    const requesterName = trim(body.requester_name) || null;
    const startDate = trim(body.start_date) || null;
    const expectedDoneDate = trim(body.expected_done_date) || null;
    let projectLeadId = null;

    if (!title || !projectType) { await tx.rollback(); return res.status(400).json({ error: 'title and type are required' }); }
    if (!PROJECT_TYPES.has(projectType)) { await tx.rollback(); return res.status(400).json({ error: 'invalid project type' }); }

    if (body.project_lead_id != null && body.project_lead_id !== '') {
      projectLeadId = parseInt(body.project_lead_id, 10);
      if (isNaN(projectLeadId)) { await tx.rollback(); return res.status(400).json({ error: 'project_lead_id must be an integer' }); }
    }

    const currentUser = getCurrentUser(req);
    const cols = await getTableColumns('projects');
    if (cols.size === 0) { await tx.rollback(); return res.status(500).json({ error: 'projects table not found' }); }

    let projectNumber = null;
    if (cols.has('project_number')) {
      const row = await tx.queryOne('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM projects');
      projectNumber = `DEV-2024-${String(row.next_id).padStart(3, '0')}`;
    }

    const fields = {};
    if (cols.has('project_number')) fields.project_number = projectNumber;
    if (cols.has('title')) fields.title = title;
    if (cols.has('description')) fields.description = description || null;
    if (cols.has('type')) fields.type = projectType;
    if (cols.has('status')) fields.status = 'registered';
    if (cols.has('created_by')) fields.created_by = currentUser?.id || null;
    if (cols.has('department_code')) fields.department_code = departmentCode;
    if (cols.has('department_name')) fields.department_name = departmentName;
    if (cols.has('requester_code')) fields.requester_code = requesterCode;
    if (cols.has('requester_name')) fields.requester_name = requesterName;
    if (cols.has('start_date')) fields.start_date = startDate;
    if (cols.has('project_lead_id')) fields.project_lead_id = projectLeadId;
    if (cols.has('expected_done_date')) fields.expected_done_date = expectedDoneDate;

    const colNames = Object.keys(fields);
    if (colNames.length === 0) { await tx.rollback(); return res.status(400).json({ error: 'no valid columns to insert' }); }

    const values = colNames.map(k => fields[k]);
    const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
    const project = await tx.queryOne(
      `INSERT INTO projects (${colNames.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    if (project?.id) {
      try {
        await tx.execute(
          "INSERT INTO project_status_logs (project_id, from_status, to_status, changed_by_id, note, created_at) VALUES ($1, NULL, 'registered', $2, $3, NOW())",
          [project.id, currentUser?.id || null, 'ລົງທະບຽນໂຄງການ']
        );
      } catch {}
    }

    await tx.commit();
    res.status(201).json(project);
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ error: err.message });
  }
});

router.get('/:projectId', requireAuth(['manager', 'lead_programmer', 'programmer']), async (req, res) => {
  try {
    const project = await queryOne('SELECT * FROM projects WHERE id = $1', [parseInt(req.params.projectId, 10)]);
    if (!project) return res.status(404).json({ error: 'project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:projectId', requireAuth(['manager', 'lead_programmer']), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const body = req.body || {};
    const cols = await getTableColumns('projects');
    const colTypes = await getTableColumnTypes('projects');
    if (cols.size === 0) return res.status(500).json({ error: 'projects table not found' });

    const fields = {};
    let oldStatus = null;

    if ('title' in body && cols.has('title')) fields.title = trim(body.title);
    if ('description' in body && cols.has('description')) fields.description = trim(body.description);
    if ('type' in body && cols.has('type')) {
      const t = trim(body.type).toLowerCase();
      if (!PROJECT_TYPES.has(t)) return res.status(400).json({ error: 'invalid project type' });
      fields.type = t;
    }
    if ('status' in body && cols.has('status')) {
      const s = trim(body.status).toLowerCase();
      if (!PROJECT_STATUSES.has(s)) return res.status(400).json({ error: 'invalid project status' });
      fields.status = s;
      const cur = await queryOne('SELECT status FROM projects WHERE id = $1', [projectId]);
      if (cur) oldStatus = cur.status;
    }
    for (const key of ['department_code', 'department_name', 'requester_code', 'requester_name', 'start_date', 'expected_done_date']) {
      if (key in body && cols.has(key)) fields[key] = trim(body[key]) || null;
    }
    if ('project_lead_id' in body && cols.has('project_lead_id')) {
      const v = body.project_lead_id;
      if (v === '' || v == null) fields.project_lead_id = null;
      else {
        const pid = parseInt(v, 10);
        if (isNaN(pid)) return res.status(400).json({ error: 'project_lead_id must be an integer' });
        fields.project_lead_id = pid;
      }
    }
    if ('requirements_text' in body && cols.has('requirements_text')) {
      fields.requirements_text = trim(body.requirements_text) || null;
    }
    if ('requirements_items' in body && cols.has('requirements_items')) {
      let items = body.requirements_items;
      if (typeof items === 'string') {
        try { items = items.trim() ? JSON.parse(items) : []; } catch { items = null; }
      }
      if (!Array.isArray(items)) items = [];
      fields.requirements_items = JSON.stringify(items);
    }

    if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'no fields to update' });

    const setParts = [];
    const values = [];
    let idx = 1;
    const reqItemsType = colTypes.requirements_items || '';
    const reqTextType = colTypes.requirements_text || '';

    // Handle completed_at
    if ('status' in fields && cols.has('completed_at')) {
      if (fields.status === 'completed') setParts.push('completed_at = now()');
      else setParts.push('completed_at = NULL');
    }

    for (const [key, value] of Object.entries(fields)) {
      if (key === 'requirements_items' && ['json', 'jsonb'].includes(reqItemsType)) {
        setParts.push(`requirements_items = $${idx++}::${reqItemsType}`);
        values.push(value);
        continue;
      }
      if (key === 'requirements_text' && ['json', 'jsonb'].includes(reqTextType)) {
        if (value == null) {
          setParts.push('requirements_text = NULL');
        } else {
          const castFn = reqTextType === 'jsonb' ? 'to_jsonb' : 'to_json';
          setParts.push(`requirements_text = ${castFn}($${idx++}::text)`);
          values.push(value);
        }
        continue;
      }
      setParts.push(`${key} = $${idx++}`);
      values.push(value === '' ? null : value);
    }

    if (cols.has('updated_at')) setParts.push('updated_at = now()');

    values.push(projectId);
    const project = await queryOne(
      `UPDATE projects SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!project) return res.status(404).json({ error: 'project not found' });

    // Log status change
    if (oldStatus != null && 'status' in fields && oldStatus !== fields.status) {
      const STATUS_NOTES = {
        requirements: 'ເກັບຄວາມຕ້ອງການ', subtasks: 'ກຳນົດໜ້າວຽກ',
        development: 'ເລີ່ມພັດທະນາ', completed: 'ສຳເລັດໂຄງການ', registered: 'ເປີດໃໝ່',
      };
      try {
        await execute(
          'INSERT INTO project_status_logs (project_id, from_status, to_status, changed_by_id, note, created_at) VALUES ($1, $2, $3, $4, $5, NOW())',
          [projectId, oldStatus, fields.status, req.user?.id, STATUS_NOTES[fields.status] || null]
        );
      } catch {}
    }

    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:projectId', requireAuth(['manager']), async (req, res) => {
  try {
    const project = await queryOne('DELETE FROM projects WHERE id = $1 RETURNING *', [parseInt(req.params.projectId, 10)]);
    if (!project) return res.status(404).json({ error: 'project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:projectId/requirements', requireAuth(['manager', 'lead_programmer']), upload.array('files'), async (req, res) => {
  const tx = await getTransaction();
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const requirementsText = (req.body.requirements_text || '').trim() || null;

    let requirementsItems = [];
    const rawItems = req.body.requirements_items || '';
    if (typeof rawItems === 'string' && rawItems.trim()) {
      try { requirementsItems = JSON.parse(rawItems); } catch { requirementsItems = []; }
    }
    if (!Array.isArray(requirementsItems)) requirementsItems = [];

    const files = req.files || [];
    const filesPayload = [];
    for (const f of files) {
      if (f && f.originalname) {
        const payload = saveUploadedFile(f, `projects/${projectId}`);
        if (payload) filesPayload.push(payload);
      }
    }

    await tx.execute(`
      ALTER TABLE projects
      ADD COLUMN IF NOT EXISTS requirements_text TEXT,
      ADD COLUMN IF NOT EXISTS requirements_files JSONB,
      ADD COLUMN IF NOT EXISTS requirements_items JSONB
    `);

    const cols = await getTableColumns('projects');
    let mergedFiles = filesPayload;
    if (cols.has('requirements_files')) {
      const row = await tx.queryOne('SELECT requirements_files FROM projects WHERE id = $1', [projectId]);
      if (!row) { await tx.rollback(); return res.status(404).json({ error: 'project not found' }); }
      let existing = row.requirements_files || [];
      if (typeof existing === 'string') {
        try { existing = JSON.parse(existing); } catch { existing = []; }
      }
      if (!Array.isArray(existing)) existing = [];
      mergedFiles = filesPayload.length ? [...existing, ...filesPayload] : existing;
    } else {
      const row = await tx.queryOne('SELECT id FROM projects WHERE id = $1', [projectId]);
      if (!row) { await tx.rollback(); return res.status(404).json({ error: 'project not found' }); }
    }

    const setParts = ["status = 'requirements'"];
    const values = [];
    let idx = 1;

    if (cols.has('requirements_text')) {
      setParts.push(`requirements_text = $${idx++}`);
      values.push(requirementsText);
    }
    if (cols.has('requirements_files')) {
      setParts.push(`requirements_files = $${idx++}::jsonb`);
      values.push(JSON.stringify(mergedFiles));
    }
    if (cols.has('requirements_items')) {
      setParts.push(`requirements_items = $${idx++}::jsonb`);
      values.push(JSON.stringify(requirementsItems));
    }
    if (cols.has('updated_at')) setParts.push('updated_at = now()');

    values.push(projectId);
    const project = await tx.queryOne(
      `UPDATE projects SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    await tx.commit();
    if (!project) return res.status(404).json({ error: 'project not found' });
    res.json(project);
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ error: err.message });
  }
});

router.get('/:projectId/history', requireAuth(['manager', 'lead_programmer', 'programmer']), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const project = await queryOne(
      'SELECT id, title, status, created_at, updated_at, completed_at FROM projects WHERE id = $1',
      [projectId]
    );
    if (!project) return res.status(404).json({ error: 'project not found' });

    let statusLogs = [];
    try {
      statusLogs = await query(
        `SELECT l.id, l.from_status, l.to_status, l.note, l.created_at,
                u.name AS changed_by_name, u.username AS changed_by_username
         FROM project_status_logs l
         LEFT JOIN users u ON u.id = l.changed_by_id
         WHERE l.project_id = $1 ORDER BY l.created_at ASC`,
        [projectId]
      );
    } catch {}

    res.json({ project, statusLogs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:projectId/close', requireAuth(['manager']), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const cols = await getTableColumns('projects');
    const setParts = ["status = 'completed'"];
    if (cols.has('updated_at')) setParts.push('updated_at = now()');
    if (cols.has('completed_at')) setParts.push('completed_at = now()');

    const project = await queryOne(
      `UPDATE projects SET ${setParts.join(', ')} WHERE id = $1 RETURNING *`,
      [projectId]
    );
    if (!project) return res.status(404).json({ error: 'project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:projectId/reopen', requireAuth(['manager']), async (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId, 10);
    const cols = await getTableColumns('projects');
    const setParts = ["status = 'development'"];
    if (cols.has('updated_at')) setParts.push('updated_at = now()');
    if (cols.has('completed_at')) setParts.push('completed_at = NULL');

    const project = await queryOne(
      `UPDATE projects SET ${setParts.join(', ')} WHERE id = $1 RETURNING *`,
      [projectId]
    );
    if (!project) return res.status(404).json({ error: 'project not found' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

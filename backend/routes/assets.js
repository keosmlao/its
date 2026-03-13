import { Router } from 'express';
import { query, queryOne, execute, getTableColumns, getTransaction } from '../lib/db.js';
import { requireAuth, getCurrentUser } from '../lib/auth.js';

const router = Router();

const ASSET_TYPES = new Set(['computer', 'printer', 'network', 'software', 'peripheral', 'other']);
const ASSET_STATUSES = new Set(['in_stock', 'deployed', 'maintenance', 'retired']);

const trim = v => String(v ?? '').trim();

router.get('/', requireAuth(['manager']), async (req, res) => {
  try {
    const cols = await getTableColumns('assets');
    if (cols.size === 0) return res.json([]);
    const rows = await query('SELECT * FROM assets ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth(['manager']), async (req, res) => {
  const tx = await getTransaction();
  try {
    const body = req.body || {};
    const name = trim(body.name);
    const assetType = trim(body.type).toLowerCase();

    if (!name) { await tx.rollback(); return res.status(400).json({ error: 'name is required' }); }
    if (!assetType || !ASSET_TYPES.has(assetType)) { await tx.rollback(); return res.status(400).json({ error: 'invalid asset type' }); }

    const status = trim(body.status).toLowerCase() || 'in_stock';
    if (!ASSET_STATUSES.has(status)) { await tx.rollback(); return res.status(400).json({ error: 'invalid status' }); }

    const currentUser = getCurrentUser(req);
    const cols = await getTableColumns('assets');
    if (cols.size === 0) { await tx.rollback(); return res.status(500).json({ error: 'assets table not found' }); }

    let assetCode = null;
    if (cols.has('asset_code')) {
      const row = await tx.queryOne('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM assets');
      assetCode = `AST-${String(row.next_id).padStart(4, '0')}`;
    }

    const fields = {};
    if (cols.has('asset_code')) fields.asset_code = assetCode;
    if (cols.has('name')) fields.name = name;
    if (cols.has('type')) fields.type = assetType;
    if (cols.has('serial_number')) fields.serial_number = trim(body.serial_number) || null;
    if (cols.has('brand')) fields.brand = trim(body.brand) || null;
    if (cols.has('model')) fields.model = trim(body.model) || null;
    if (cols.has('status')) fields.status = status;
    if (cols.has('division')) fields.division = trim(body.division) || null;
    if (cols.has('department')) fields.department = trim(body.department) || null;
    if (cols.has('purchase_date')) fields.purchase_date = trim(body.purchase_date) || null;
    if (cols.has('warranty_expiry')) fields.warranty_expiry = trim(body.warranty_expiry) || null;
    if (cols.has('notes')) fields.notes = trim(body.notes) || null;

    const colNames = Object.keys(fields);
    const values = colNames.map(k => fields[k]);
    const placeholders = colNames.map((_, i) => `$${i + 1}`).join(', ');
    const asset = await tx.queryOne(
      `INSERT INTO assets (${colNames.join(', ')}) VALUES (${placeholders}) RETURNING *`,
      values
    );

    if (asset?.id) {
      try {
        await tx.execute(
          "INSERT INTO asset_holder_logs (asset_id, action, note, changed_by_id, changed_by_name, created_at) VALUES ($1, 'create', $2, $3, $4, NOW())",
          [asset.id, 'ລົງທະບຽນຊັບສິນ', currentUser?.id || null, currentUser?.name || null]
        );
      } catch {}
    }

    await tx.commit();
    res.status(201).json(asset);
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:assetId', requireAuth(['manager']), async (req, res) => {
  try {
    const assetId = parseInt(req.params.assetId, 10);
    const body = req.body || {};
    const cols = await getTableColumns('assets');
    const setParts = [];
    const values = [];
    let idx = 1;

    if ('name' in body && cols.has('name')) {
      const v = trim(body.name);
      if (!v) return res.status(400).json({ error: 'name is required' });
      setParts.push(`name = $${idx++}`); values.push(v);
    }
    if ('type' in body && cols.has('type')) {
      const v = trim(body.type).toLowerCase();
      if (!ASSET_TYPES.has(v)) return res.status(400).json({ error: 'invalid type' });
      setParts.push(`type = $${idx++}`); values.push(v);
    }
    if ('status' in body && cols.has('status')) {
      const v = trim(body.status).toLowerCase();
      if (!ASSET_STATUSES.has(v)) return res.status(400).json({ error: 'invalid status' });
      setParts.push(`status = $${idx++}`); values.push(v);
    }
    for (const key of ['serial_number', 'brand', 'model', 'division', 'department', 'purchase_date', 'warranty_expiry', 'notes']) {
      if (key in body && cols.has(key)) {
        setParts.push(`${key} = $${idx++}`);
        values.push(trim(body[key]) || null);
      }
    }

    if (setParts.length === 0) return res.status(400).json({ error: 'no fields to update' });

    values.push(assetId);
    const asset = await queryOne(
      `UPDATE assets SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!asset) return res.status(404).json({ error: 'asset not found' });
    res.json(asset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:assetId', requireAuth(['manager']), async (req, res) => {
  try {
    const count = await execute('DELETE FROM assets WHERE id = $1', [parseInt(req.params.assetId, 10)]);
    if (!count) return res.status(404).json({ error: 'asset not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:assetId/history', requireAuth(['manager']), async (req, res) => {
  try {
    const assetId = parseInt(req.params.assetId, 10);
    const asset = await queryOne('SELECT * FROM assets WHERE id = $1', [assetId]);
    if (!asset) return res.status(404).json({ error: 'asset not found' });

    const logs = await query(
      `SELECT id, action, from_holder_id, from_holder_name, to_holder_id, to_holder_name,
              note, changed_by_id, changed_by_name, created_at
       FROM asset_holder_logs WHERE asset_id = $1 ORDER BY created_at DESC`,
      [assetId]
    );
    res.json({ asset, logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:assetId/transfer', requireAuth(['manager']), async (req, res) => {
  const tx = await getTransaction();
  try {
    const assetId = parseInt(req.params.assetId, 10);
    const body = req.body || {};
    const action = trim(body.action).toLowerCase();
    if (!['assign', 'return', 'transfer'].includes(action)) {
      await tx.rollback();
      return res.status(400).json({ error: 'action must be assign, return, or transfer' });
    }

    let toHolderId = null;
    if (body.to_holder_id) {
      const n = parseInt(body.to_holder_id, 10);
      if (!isNaN(n)) toHolderId = n;
    }
    const toHolderName = trim(body.to_holder_name) || null;
    const note = trim(body.note) || null;

    if (action !== 'return' && !toHolderName) {
      await tx.rollback();
      return res.status(400).json({ error: 'to_holder_name is required for assign/transfer' });
    }

    const currentUser = getCurrentUser(req);

    const asset = await tx.queryOne('SELECT * FROM assets WHERE id = $1 FOR UPDATE', [assetId]);
    if (!asset) { await tx.rollback(); return res.status(404).json({ error: 'asset not found' }); }

    const fromHolderId = asset.current_holder_id || null;
    const fromHolderName = asset.current_holder_name || null;

    await tx.execute(
      `INSERT INTO asset_holder_logs (asset_id, action, from_holder_id, from_holder_name, to_holder_id, to_holder_name, note, changed_by_id, changed_by_name, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())`,
      [assetId, action, fromHolderId, fromHolderName,
       action === 'return' ? null : toHolderId,
       action === 'return' ? null : toHolderName,
       note, currentUser?.id || null, currentUser?.name || null]
    );

    if (action === 'return') {
      await tx.execute(
        "UPDATE assets SET current_holder_id = NULL, current_holder_name = NULL, status = 'in_stock' WHERE id = $1",
        [assetId]
      );
    } else {
      await tx.execute(
        "UPDATE assets SET current_holder_id = $1, current_holder_name = $2, status = 'deployed' WHERE id = $3",
        [toHolderId, toHolderName, assetId]
      );
    }

    const updated = await tx.queryOne('SELECT * FROM assets WHERE id = $1', [assetId]);
    await tx.commit();
    res.json(updated);
  } catch (err) {
    await tx.rollback();
    res.status(500).json({ error: err.message });
  }
});

export default router;

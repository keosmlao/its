import { Router } from 'express';
import { query, queryOne } from '../lib/db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const rows = await query('SELECT id, name, icon, color, created_at FROM categories ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    const name = String(body.name || '').trim();
    const icon = String(body.icon || '').trim();
    const color = String(body.color || '').trim();
    if (!name) return res.status(400).json({ error: 'name is required' });

    const cat = await queryOne(
      'INSERT INTO categories (name, icon, color) VALUES ($1, $2, $3) RETURNING id, name, icon, color, created_at',
      [name, icon || null, color || null]
    );
    res.status(201).json(cat);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:categoryId', async (req, res) => {
  try {
    const row = await queryOne('DELETE FROM categories WHERE id = $1 RETURNING id', [parseInt(req.params.categoryId, 10)]);
    if (!row) return res.status(404).json({ error: 'category not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from 'express';
import { query, queryOne } from '../lib/db.js';
import { requireAuth, ALL_ROLES } from '../lib/auth.js';

const router = Router();

const trim = v => String(v ?? '').trim();

router.get('/', requireAuth([...ALL_ROLES]), async (req, res) => {
  try {
    const rows = await query('SELECT id, title, category, icon, content, views, created_at, updated_at FROM knowledge_articles ORDER BY id DESC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth(['manager', 'helpdesk']), async (req, res) => {
  try {
    const body = req.body || {};
    const title = trim(body.title);
    const category = trim(body.category);
    const icon = trim(body.icon);
    const content = trim(body.content);
    if (!title || !category || !content) {
      return res.status(400).json({ error: 'title, category, content are required' });
    }

    const article = await queryOne(
      'INSERT INTO knowledge_articles (title, category, icon, content) VALUES ($1, $2, $3, $4) RETURNING id, title, category, icon, content, views, created_at, updated_at',
      [title, category, icon || null, content]
    );
    res.status(201).json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:articleId', requireAuth(['manager', 'helpdesk']), async (req, res) => {
  try {
    const articleId = parseInt(req.params.articleId, 10);
    const body = req.body || {};
    const fields = {};
    for (const key of ['title', 'category', 'icon', 'content']) {
      if (key in body) fields[key] = trim(body[key]);
    }

    if (Object.keys(fields).length === 0) return res.status(400).json({ error: 'no fields to update' });

    const setParts = [];
    const values = [];
    let idx = 1;
    for (const [key, value] of Object.entries(fields)) {
      setParts.push(`${key} = $${idx++}`);
      values.push(value || null);
    }
    setParts.push('updated_at = now()');
    values.push(articleId);

    const article = await queryOne(
      `UPDATE knowledge_articles SET ${setParts.join(', ')} WHERE id = $${idx} RETURNING id, title, category, icon, content, views, created_at, updated_at`,
      values
    );
    if (!article) return res.status(404).json({ error: 'article not found' });
    res.json(article);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:articleId', requireAuth(['manager', 'helpdesk']), async (req, res) => {
  try {
    const row = await queryOne('DELETE FROM knowledge_articles WHERE id = $1 RETURNING id', [parseInt(req.params.articleId, 10)]);
    if (!row) return res.status(404).json({ error: 'article not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

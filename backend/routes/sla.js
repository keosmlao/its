import { Router } from 'express';
import { query, queryOne } from '../lib/db.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

router.get('/', requireAuth(['manager', 'it_support', 'helpdesk']), async (req, res) => {
  try {
    const rows = await query('SELECT id, priority, response_minutes, resolution_minutes, is_active, created_at FROM sla ORDER BY id ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', requireAuth(['manager']), async (req, res) => {
  try {
    const body = req.body || {};
    const priority = String(body.priority || '').trim().toLowerCase();
    const responseMinutes = parseInt(body.response_minutes, 10);
    const resolutionMinutes = parseInt(body.resolution_minutes, 10);

    if (isNaN(responseMinutes) || isNaN(resolutionMinutes)) {
      return res.status(400).json({ error: 'response_minutes and resolution_minutes must be integers' });
    }
    if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
      return res.status(400).json({ error: 'invalid priority' });
    }
    if (responseMinutes <= 0 || resolutionMinutes <= 0) {
      return res.status(400).json({ error: 'response_minutes and resolution_minutes must be greater than 0' });
    }

    const sla = await queryOne(
      'INSERT INTO sla (priority, response_minutes, resolution_minutes) VALUES ($1, $2, $3) RETURNING id, priority, response_minutes, resolution_minutes, is_active, created_at',
      [priority, responseMinutes, resolutionMinutes]
    );
    res.status(201).json(sla);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:slaId', requireAuth(['manager']), async (req, res) => {
  try {
    const slaId = parseInt(req.params.slaId, 10);
    const body = req.body || {};
    const priority = String(body.priority || '').trim().toLowerCase();
    const responseMinutes = parseInt(body.response_minutes, 10);
    const resolutionMinutes = parseInt(body.resolution_minutes, 10);

    if (isNaN(responseMinutes) || isNaN(resolutionMinutes)) {
      return res.status(400).json({ error: 'response_minutes and resolution_minutes must be integers' });
    }
    if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
      return res.status(400).json({ error: 'invalid priority' });
    }
    if (responseMinutes <= 0 || resolutionMinutes <= 0) {
      return res.status(400).json({ error: 'response_minutes and resolution_minutes must be greater than 0' });
    }

    const sla = await queryOne(
      'UPDATE sla SET priority = $1, response_minutes = $2, resolution_minutes = $3 WHERE id = $4 RETURNING id, priority, response_minutes, resolution_minutes, is_active, created_at',
      [priority, responseMinutes, resolutionMinutes, slaId]
    );
    if (!sla) return res.status(404).json({ error: 'sla not found' });
    res.json(sla);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:slaId', requireAuth(['manager']), async (req, res) => {
  try {
    const row = await queryOne('DELETE FROM sla WHERE id = $1 RETURNING id', [parseInt(req.params.slaId, 10)]);
    if (!row) return res.status(404).json({ error: 'sla not found' });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

import { Router } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { UPLOAD_DIR } from '../config.js';

const router = Router();

const MIME_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.zip': 'application/zip',
};

router.get('/*', (req, res) => {
  const filePath = req.params[0];
  const fullPath = path.join(UPLOAD_DIR, filePath);
  const resolved = fs.realpathSync(fullPath, { throwIfNoEntry: false });
  const uploadRoot = fs.realpathSync(UPLOAD_DIR, { throwIfNoEntry: false });

  if (!resolved || !uploadRoot || !resolved.startsWith(uploadRoot)) {
    return res.status(403).json({ error: 'forbidden' });
  }

  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ error: 'not found' });
  }

  const ext = path.extname(resolved).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  fs.createReadStream(resolved).pipe(res);
});

export default router;

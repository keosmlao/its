import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { UPLOAD_DIR } from '../config.js';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function secureFilename(name) {
  let base = path.basename(String(name || ''));
  base = base.replace(/\s+/g, '_');
  base = base.replace(/[^A-Za-z0-9._-]/g, '_');
  base = base.replace(/_+/g, '_');
  base = base.replace(/^\.+/, '');
  base = base.replace(/^_+|_+$/g, '');
  return base;
}

export function saveUploadedFile(file, subDir) {
  const safeName = secureFilename(file.originalname);
  if (!safeName) return null;

  const dirPath = path.join(UPLOAD_DIR, subDir);
  fs.mkdirSync(dirPath, { recursive: true });

  const uniqueName = `${randomUUID().replace(/-/g, '')}_${safeName}`;
  const filePath = path.join(dirPath, uniqueName);
  fs.renameSync(file.path, filePath);

  const relPath = path.relative(UPLOAD_DIR, filePath).replace(/\\/g, '/');
  const fileSize = fs.statSync(filePath).size;

  return {
    name: safeName,
    stored_name: uniqueName,
    path: relPath,
    url: `/api/uploads/${relPath}`,
    size: fileSize,
    content_type: file.mimetype || 'application/octet-stream',
    uploaded_at: new Date().toISOString(),
  };
}

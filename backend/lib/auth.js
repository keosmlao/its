import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_MINUTES, AUTH_DISABLED } from '../config.js';

export const ALL_ROLES = new Set(['user', 'manager', 'lead_programmer', 'programmer', 'it_support', 'helpdesk']);
export const SUPPORT_ONLY_ROLES = new Set(['it_support']);
export const DEV_ROLES = new Set(['lead_programmer', 'programmer']);
export const SUPPORT_ROLES = new Set(['it_support', 'helpdesk']);
export const MANAGER_ROLES = new Set(['manager']);

function extractToken(req) {
  const auth = req.headers.authorization || '';
  let token = '';
  if (auth) {
    token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : auth.trim();
  }
  if (!token) token = (req.headers['x-access-token'] || '').trim();
  if (!token) token = (req.query.token || '').trim();
  return token || null;
}

export function getCurrentUser(req) {
  const token = extractToken(req);
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    const role = String(payload.role || '').trim().toLowerCase();
    const userId = payload.sub;
    if (!role || userId == null) return null;
    if (!ALL_ROLES.has(role)) return null;
    const numericId = parseInt(userId, 10);
    if (isNaN(numericId)) return null;
    return {
      id: numericId,
      role,
      name: payload.name,
      username: payload.username,
    };
  } catch {
    return null;
  }
}

export function createToken(user) {
  const payload = {
    sub: user.id,
    role: user.role,
    name: user.name || undefined,
    username: user.username || undefined,
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${JWT_EXPIRES_MINUTES}m` });
}

function authenticate(req, allowedRoles) {
  const user = getCurrentUser(req);
  if (AUTH_DISABLED) {
    return user || { id: 0, role: 'manager', name: 'Dev User', username: 'dev' };
  }
  if (!user) return null;
  if (allowedRoles && !allowedRoles.has(user.role)) return false;
  return user;
}

export function requireAuth(allowedRoles) {
  const roleSet = allowedRoles ? new Set(allowedRoles) : null;
  return (req, res, next) => {
    const user = authenticate(req, roleSet);
    if (user === null) return res.status(401).json({ error: 'missing or invalid token' });
    if (user === false) return res.status(403).json({ error: 'forbidden' });
    req.user = user;
    next();
  };
}

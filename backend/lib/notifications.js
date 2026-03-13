import { query, execute } from './db.js';

async function ensureNotificationsTable() {
  await execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT,
      link TEXT,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

export async function createNotification(userId, title, type = 'info', message = null, link = null) {
  await ensureNotificationsTable();
  await execute(
    'INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1, $2, $3, $4, $5)',
    [userId, type, title, message, link]
  );
}

export async function notifyManagers(title, type = 'info', message = null, link = null) {
  await ensureNotificationsTable();
  const rows = await query("SELECT id FROM users WHERE role = 'manager'");
  for (const row of rows) {
    await createNotification(row.id, title, type, message, link);
  }
}

export async function notifyHelpdeskStaff(title, type = 'info', message = null, link = null) {
  await ensureNotificationsTable();
  const rows = await query("SELECT id FROM users WHERE role IN ('helpdesk', 'manager')");
  for (const row of rows) {
    await createNotification(row.id, title, type, message, link);
  }
}

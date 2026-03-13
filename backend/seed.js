import { createHash, randomBytes, pbkdf2Sync } from 'node:crypto';
import {
  DEFAULT_ADMIN_USERNAME, DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_NAME, DEFAULT_ADMIN_ROLE,
} from './config.js';
import { getTransaction, queryOne } from './lib/db.js';

function generatePasswordHash(password) {
  const iterations = 600000;
  const algorithm = 'sha256';
  const salt = randomBytes(16).toString('hex');
  const dk = pbkdf2Sync(password, salt, iterations, 32, algorithm);
  const digest = dk.toString('hex');
  return `pbkdf2:${algorithm}:${iterations}$${salt}$${digest}`;
}

async function main() {
  const username = DEFAULT_ADMIN_USERNAME.trim().toLowerCase();
  const password = DEFAULT_ADMIN_PASSWORD;
  const name = DEFAULT_ADMIN_NAME;
  const role = DEFAULT_ADMIN_ROLE.trim().toLowerCase();

  if (!username || !password || !name || !role) {
    throw new Error('DEFAULT_ADMIN_* env vars must not be empty');
  }

  const existing = await queryOne('SELECT id FROM users WHERE username = $1', [username]);
  if (existing) {
    console.log(`user '${username}' already exists`);
    process.exit(0);
  }

  const tx = await getTransaction();
  try {
    const col = await tx.queryOne(
      "SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash'"
    );
    const hasPasswordHash = col != null;

    let row;
    if (hasPasswordHash) {
      const passwordHash = generatePasswordHash(password);
      row = await tx.queryOne(
        'INSERT INTO users (username, name, role, password_hash) VALUES ($1, $2, $3, $4) RETURNING id',
        [username, name, role, passwordHash]
      );
    } else {
      row = await tx.queryOne(
        'INSERT INTO users (username, name, role, password) VALUES ($1, $2, $3, $4) RETURNING id',
        [username, name, role, password]
      );
    }

    await tx.commit();
    console.log(`created user '${username}' with id ${row.id}`);
  } catch (err) {
    await tx.rollback();
    throw err;
  }

  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

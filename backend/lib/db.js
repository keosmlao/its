import pg from 'pg';
import {
  DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD,
  ERP_DB_HOST, ERP_DB_PORT, ERP_DB_NAME, ERP_DB_USER, ERP_DB_PASSWORD,
} from '../config.js';

const pool = new pg.Pool({
  host: DB_HOST, port: DB_PORT, database: DB_NAME,
  user: DB_USER, password: DB_PASSWORD, max: 10,
});

const erpPool = new pg.Pool({
  host: ERP_DB_HOST, port: ERP_DB_PORT, database: ERP_DB_NAME,
  user: ERP_DB_USER, password: ERP_DB_PASSWORD, max: 5,
  connectionTimeoutMillis: 5000,
});

export async function query(sql, params) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function queryOne(sql, params) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

export async function execute(sql, params) {
  const res = await pool.query(sql, params);
  return res.rowCount;
}

export async function queryReturning(sql, params) {
  const { rows } = await pool.query(sql, params);
  return rows;
}

export async function erpQuery(sql, params) {
  const { rows } = await erpPool.query(sql, params);
  return rows;
}

export async function getTableColumns(tableName) {
  const rows = await query(
    'SELECT column_name FROM information_schema.columns WHERE table_name = $1',
    [tableName]
  );
  return new Set(rows.map(r => r.column_name));
}

export async function getTableColumnTypes(tableName) {
  const rows = await query(
    'SELECT column_name, data_type FROM information_schema.columns WHERE table_name = $1',
    [tableName]
  );
  const map = {};
  for (const r of rows) map[r.column_name] = r.data_type;
  return map;
}

export async function getTransaction() {
  const client = await pool.connect();
  await client.query('BEGIN');

  return {
    async query(sql, params) {
      const { rows } = await client.query(sql, params);
      return rows;
    },
    async queryOne(sql, params) {
      const { rows } = await client.query(sql, params);
      return rows[0] || null;
    },
    async execute(sql, params) {
      const res = await client.query(sql, params);
      return res.rowCount;
    },
    async commit() {
      await client.query('COMMIT');
      client.release();
    },
    async rollback() {
      await client.query('ROLLBACK');
      client.release();
    },
  };
}

export { pool, erpPool };

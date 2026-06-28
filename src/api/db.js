/**
 * Shared PostgreSQL connection adapter for API routes.
 */

let pool;

function getPool() {
  if (!pool) {
    const { Pool } = require('pg');

    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      host: process.env.DB_HOST,
      port: process.env.DB_PORT ? Number(process.env.DB_PORT) : undefined,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: process.env.DB_POOL_MAX ? Number(process.env.DB_POOL_MAX) : undefined,
      idleTimeoutMillis: process.env.DB_IDLE_TIMEOUT_MS
        ? Number(process.env.DB_IDLE_TIMEOUT_MS)
        : undefined,
    });
  }

  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

async function close() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}

module.exports = {
  close,
  getPool,
  query,
};

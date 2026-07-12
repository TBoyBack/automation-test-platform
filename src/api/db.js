/**
 * PostgreSQL connection pool shared by API routes.
 */

require('dotenv').config();

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_SIZE, 10) || 10,
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
};

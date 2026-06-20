const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number.parseInt(process.env.DATABASE_POOL_SIZE || '10', 10),
});

module.exports = {
  query(text, params) {
    return pool.query(text, params);
  },
  pool,
};

const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : undefined
);

module.exports = {
  query(text, params) {
    return pool.query(text, params);
  },
  pool,
};

const { Pool } = require('pg');

let pool;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

module.exports = {
  query,
};

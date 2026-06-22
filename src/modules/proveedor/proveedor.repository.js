const pool = require('../../config/db');

async function findAll() {
  const [rows] = await pool.query('SELECT id, nombre FROM proveedor ORDER BY nombre');
  return rows;
}

module.exports = { findAll };

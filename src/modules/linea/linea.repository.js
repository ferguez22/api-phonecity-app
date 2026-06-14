const pool = require('../../config/db');

// Capa de acceso a datos: SOLO SQL. Sin reglas de negocio.

async function findAll() {
  const [rows] = await pool.query('SELECT * FROM linea ORDER BY id DESC');
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM linea WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.query('INSERT INTO linea SET ?', [data]);
  return result.insertId;
}

async function update(id, data) {
  const [result] = await pool.query('UPDATE linea SET ? WHERE id = ?', [data, id]);
  return result.affectedRows;
}

async function remove(id) {
  const [result] = await pool.query('DELETE FROM linea WHERE id = ?', [id]);
  return result.affectedRows;
}

module.exports = { findAll, findById, create, update, remove };

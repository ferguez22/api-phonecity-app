const pool = require('../../config/db');

// SOLO SQL de la tabla cliente.

async function findAll(search) {
  if (search) {
    const like = `%${search}%`;
    const [rows] = await pool.query(
      'SELECT * FROM cliente WHERE nombre LIKE ? OR telefono LIKE ? ORDER BY nombre',
      [like, like],
    );
    return rows;
  }
  const [rows] = await pool.query('SELECT * FROM cliente ORDER BY nombre');
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query('SELECT * FROM cliente WHERE id = ?', [id]);
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.query('INSERT INTO cliente SET ?', [data]);
  return result.insertId;
}

async function update(id, data) {
  await pool.query('UPDATE cliente SET ? WHERE id = ?', [data, id]);
}

async function remove(id) {
  await pool.query('DELETE FROM cliente WHERE id = ?', [id]);
}

// Cuantas lineas (reparaciones) tiene asociadas -> para bloquear borrado
async function countLineas(clienteId) {
  const [rows] = await pool.query(
    'SELECT COUNT(*) AS total FROM linea WHERE cliente_id = ?',
    [clienteId],
  );
  return rows[0].total;
}

module.exports = { findAll, findById, create, update, remove, countLineas };

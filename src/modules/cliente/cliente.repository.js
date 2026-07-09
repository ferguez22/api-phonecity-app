const pool = require('../../config/db');

const SELECT_CLIENTE_STATS =
  'SELECT c.id, c.nombre, c.telefono, ' +
  'COUNT(l.id) AS num_lineas, ' +
  "DATE_FORMAT(MIN(l.fecha_entrada), '%Y-%m-%d') AS primera_visita " +
  'FROM cliente c ' +
  'LEFT JOIN linea l ON l.cliente_id = c.id';


async function findAll(search) {
  if (search) {
    const like = `%${search}%`;
    const [rows] = await pool.query(
      `${SELECT_CLIENTE_STATS} WHERE c.nombre LIKE ? OR c.telefono LIKE ? GROUP BY c.id ORDER BY c.nombre`,
      [like, like],
    );
    return rows;
  }
  const [rows] = await pool.query(`${SELECT_CLIENTE_STATS} GROUP BY c.id ORDER BY c.nombre`);
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

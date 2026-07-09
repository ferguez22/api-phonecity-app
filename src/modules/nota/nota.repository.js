const pool = require('../../config/db');

const SELECT_NOTA =
  'SELECT n.id, n.tienda_id, n.texto, ' +
  "DATE_FORMAT(n.creado_en, '%Y-%m-%dT%H:%i') AS creado_en, " +
  'n.resuelto, ' +
  "DATE_FORMAT(n.resuelto_en, '%Y-%m-%dT%H:%i') AS resuelto_en, " +
  'n.cliente_id ' +
  'FROM nota n';

async function findAll(tiendaId, incluirResueltas) {
  let sql = `${SELECT_NOTA} WHERE n.tienda_id = ?`;
  const values = [tiendaId];
  if (!incluirResueltas) {
    sql += ' AND n.resuelto = 0';
  }
  sql += ' ORDER BY n.creado_en ASC, n.id ASC';
  const [rows] = await pool.query(sql, values);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(`${SELECT_NOTA} WHERE n.id = ?`, [id]);
  return rows[0] || null;
}

async function create(data) {
  const [result] = await pool.query('INSERT INTO nota SET ?', [data]);
  return result.insertId;
}

async function update(id, data) {
  const [result] = await pool.query('UPDATE nota SET ? WHERE id = ?', [data, id]);
  return result.affectedRows;
}

module.exports = { findAll, findById, create, update };
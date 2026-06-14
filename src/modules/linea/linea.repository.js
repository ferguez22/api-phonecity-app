const pool = require('../../config/db');

// Capa de acceso a datos: SOLO SQL.
// Las consultas de lectura hacen LEFT JOIN con cliente para traer
// nombre + telefono (cliente_id NULL = TIENDA -> esos campos quedan NULL).
// Columnas de la linea van prefijadas con 'l.' (evita ambiguedad con cliente).

const SELECT_LINEA =
  'SELECT l.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono ' +
  'FROM linea l LEFT JOIN cliente c ON c.id = l.cliente_id';

async function findAll(filters = {}, orderByExpr = 'l.id', orderDir = 'DESC') {
  const clauses = [];
  const values = [];

  for (const [column, value] of Object.entries(filters)) {
    clauses.push(`l.${column} = ?`);
    values.push(value);
  }

  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `${SELECT_LINEA} ${where} ORDER BY ${orderByExpr} ${orderDir}`;

  const [rows] = await pool.query(sql, values);
  return rows;
}

async function findById(id) {
  const [rows] = await pool.query(`${SELECT_LINEA} WHERE l.id = ?`, [id]);
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

const pool = require('../../config/db');

const SELECT_LINEA =
  'SELECT l.*, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono ' +
  'FROM linea l LEFT JOIN cliente c ON c.id = l.cliente_id';

async function findAll(filters = {}, orderByExpr = 'l.id', orderDir = 'ASC') {
  const clauses = [];
  const values  = [];
  for (const [column, value] of Object.entries(filters)) {
    if (value === null) {
      clauses.push(`l.${column} IS NULL`);
    } else {
      clauses.push(`l.${column} = ?`);
      values.push(value);
    }
  }
  const where = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const sql = `${SELECT_LINEA} ${where} ORDER BY ${orderByExpr} ${orderDir}`;
  const [rows] = await pool.query(sql, values);
  return rows;
}

async function findMovilesEnTienda(orderByExpr = 'l.id', orderDir = 'ASC') {
  const sql = `
    ${SELECT_LINEA}
    WHERE (
      (l.flujo = 'reparacion' AND l.fase IN ('por_reparar','reparado','por_enviar_taller','no_reparable'))
      OR (l.flujo = 'pieza' AND l.fase = 'por_pedir' AND l.movil_en_tienda = 1)
    )
    ORDER BY ${orderByExpr} ${orderDir}
  `;
  const [rows] = await pool.query(sql);
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

module.exports = { findAll, findById, findMovilesEnTienda, create, update, remove };

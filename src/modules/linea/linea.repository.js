const pool = require('../../config/db');

const SELECT_LINEA =
  'SELECT l.*, ' +
  "DATE_FORMAT(l.fecha_entrada, '%Y-%m-%d') AS fecha_entrada, " +
"DATE_FORMAT(l.fecha_recogida_prevista, '%Y-%m-%dT%H:%i') AS fecha_recogida_prevista, " +
  "DATE_FORMAT(l.fecha_ultimo_aviso, '%Y-%m-%dT%H:%i') AS fecha_ultimo_aviso, " +
  'c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, ' +  'c.nombre AS cliente_nombre, c.telefono AS cliente_telefono, ' +
  'p.nombre AS proveedor_nombre ' +
  'FROM linea l ' +
  'LEFT JOIN cliente c ON c.id = l.cliente_id ' +
  'LEFT JOIN proveedor p ON p.id = l.proveedor_id';

const FASES_TIMER_EXCLUIDAS = ['reparado', 'no_reparable', 'entregado', 'cancelado', 'por_enviar_taller', 'en_taller'];

async function findAll(filters = {}, orderByExpr = 'l.id', orderDir = 'ASC') {
  const clauses = [];
  const values = [];
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
  const sql = `${SELECT_LINEA} WHERE l.movil_en_tienda = 1 ORDER BY ${orderByExpr} ${orderDir}`;
  const [rows] = await pool.query(sql);
  return rows;
}

async function findTemporizadores(orderByExpr = 'l.fecha_recogida_prevista', orderDir = 'ASC') {
  const placeholders = FASES_TIMER_EXCLUIDAS.map(() => '?').join(', ');
  const sql =
    `${SELECT_LINEA} ` +
    `WHERE l.fecha_recogida_prevista IS NOT NULL ` +
    `AND l.flujo = 'reparacion' ` +
    `AND l.fase NOT IN (${placeholders}) ` +
    `ORDER BY ${orderByExpr} ${orderDir}`;
  const [rows] = await pool.query(sql, FASES_TIMER_EXCLUIDAS);
  return rows;
}

async function findAllConHistorial(filters = {}, fasesHistorial = [], orderByExpr = 'l.id', orderDir = 'ASC') {
  const clauses = [];
  const values = [];
  for (const [column, value] of Object.entries(filters)) {
    if (value === null) {
      clauses.push(`l.${column} IS NULL`);
    } else {
      clauses.push(`l.${column} = ?`);
      values.push(value);
    }
  }
  const actual =
    clauses.length > 0
      ? `(${clauses.join(' AND ')} AND l.fase NOT IN ('entregado','cancelado'))`
      : `l.fase NOT IN ('entregado','cancelado')`;

  let histCond = 'lf.linea_id = l.id AND lf.flujo = ?';
  const histValues = [filters.flujo];
  if (fasesHistorial.length > 0) {
    const ph = fasesHistorial.map(() => '?').join(', ');
    histCond += ` AND lf.fase IN (${ph})`;
    histValues.push(...fasesHistorial);
  }
  const matchHist = `EXISTS (SELECT 1 FROM linea_flujos lf WHERE ${histCond})`;

  const selectConFlag = SELECT_LINEA.replace(
    'SELECT l.*, ',
    `SELECT l.*, CASE WHEN l.fase IN ('entregado','cancelado') THEN 1 ELSE 0 END AS es_historico, `
  );

  const sql =
    `${selectConFlag} ` +
    `WHERE ${actual} ` +
    `OR (l.fase IN ('entregado','cancelado') AND ${matchHist}) ` +
    `ORDER BY ${orderByExpr} ${orderDir}`;

  const [rows] = await pool.query(sql, [...values, ...histValues]);
  return rows;
}

async function registrarFlujo(lineaId, flujo, fase) {
  await pool.query(
    'INSERT IGNORE INTO linea_flujos (linea_id, flujo, fase) VALUES (?, ?, ?)',
    [lineaId, flujo, fase]
  );
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

module.exports = { findAll, findAllConHistorial, registrarFlujo, findById, findMovilesEnTienda, findTemporizadores, create, update, remove };
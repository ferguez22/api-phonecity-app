const pool = require('../../config/db');

async function findByLinea(lineaId, conn = pool) {
  const [rows] = await conn.query(
    'SELECT id, linea_id, descripcion, importe, orden FROM linea_pieza WHERE linea_id = ? ORDER BY orden ASC, id ASC',
    [lineaId],
  );
  return rows;
}

async function findByLineas(ids, conn = pool) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const ph = ids.map(() => '?').join(',');
  const [rows] = await conn.query(
    `SELECT id, linea_id, descripcion, importe, orden FROM linea_pieza WHERE linea_id IN (${ph}) ORDER BY linea_id ASC, orden ASC, id ASC`,
    ids,
  );
  return rows;
}
async function replaceAll(lineaId, piezas, conn = pool) {
  await conn.query('DELETE FROM linea_pieza WHERE linea_id = ?', [lineaId]);
  if (!Array.isArray(piezas) || piezas.length === 0) return;
  const filas = piezas.map((p, i) => [lineaId, p.descripcion, p.importe, i]);
  await conn.query(
    'INSERT INTO linea_pieza (linea_id, descripcion, importe, orden) VALUES ?',
    [filas],
  );
}

module.exports = { findByLinea, findByLineas, replaceAll };
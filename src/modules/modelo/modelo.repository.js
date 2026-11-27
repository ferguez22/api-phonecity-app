const pool = require('../../config/db');

async function findDistintos(tiendaId) {
  const [rows] = await pool.query(
    `SELECT MIN(modelo) AS modelo, COUNT(*) AS lineas
       FROM linea
      WHERE tienda_id = ? AND modelo IS NOT NULL
      GROUP BY BINARY modelo
      ORDER BY MIN(modelo), BINARY MIN(modelo)`,
    [tiendaId],
  );
  return rows;
}

async function createLote(conn, tiendaId, usuarioId) {
  const [result] = await conn.query(
    'INSERT INTO modelo_lote (tienda_id, usuario_id) VALUES (?, ?)',
    [tiendaId, usuarioId],
  );
  return result.insertId;
}

async function lockLineasByModelo(conn, tiendaId, modelo) {
  const [rows] = await conn.query(
    'SELECT id FROM linea WHERE tienda_id = ? AND BINARY modelo = ? FOR UPDATE',
    [tiendaId, modelo],
  );
  return rows.length;
}

async function insertCambios(conn, loteId, tiendaId, de, a) {
  const [result] = await conn.query(
    `INSERT INTO modelo_cambio (lote_id, linea_id, modelo_anterior, modelo_nuevo)
     SELECT ?, id, modelo, ?
       FROM linea
      WHERE tienda_id = ? AND BINARY modelo = ?`,
    [loteId, a, tiendaId, de],
  );
  return result.affectedRows;
}

async function updateModelo(conn, tiendaId, de, a) {
  const [result] = await conn.query(
    'UPDATE linea SET modelo = ? WHERE tienda_id = ? AND BINARY modelo = ?',
    [a, tiendaId, de],
  );
  return result.affectedRows;
}

const SELECT_LOTE =
  `SELECT l.id AS lote,
          DATE_FORMAT(l.fecha, '%Y-%m-%dT%H:%i') AS fecha,
          l.usuario_id,
          u.nombre_usuario AS usuario,
          (SELECT COUNT(*) FROM modelo_cambio c WHERE c.lote_id = l.id) AS lineas,
          (SELECT COUNT(*) FROM modelo_cambio c WHERE c.lote_id = l.id AND c.restaurado = 1) AS restauradas,
          (l.deshecho_en IS NOT NULL) AS deshecho,
          DATE_FORMAT(l.deshecho_en, '%Y-%m-%dT%H:%i') AS deshecho_en
     FROM modelo_lote l
     LEFT JOIN usuario u ON u.id = l.usuario_id`;

async function findLotes(tiendaId) {
  const [rows] = await pool.query(
    `${SELECT_LOTE} WHERE l.tienda_id = ? ORDER BY l.id DESC`,
    [tiendaId],
  );
  return rows;
}

async function findLote(loteId, tiendaId) {
  const [rows] = await pool.query(
    `${SELECT_LOTE} WHERE l.id = ? AND l.tienda_id = ?`,
    [loteId, tiendaId],
  );
  return rows[0] || null;
}

async function findCambiosDeLote(loteId) {
  const [rows] = await pool.query(
    `SELECT MIN(modelo_anterior) AS de,
            MIN(modelo_nuevo) AS a,
            COUNT(*) AS lineas,
            COUNT(CASE WHEN restaurado = 1 THEN 1 END) AS restauradas
       FROM modelo_cambio
      WHERE lote_id = ?
      GROUP BY BINARY modelo_anterior, BINARY modelo_nuevo
      ORDER BY MIN(modelo_nuevo), MIN(modelo_anterior)`,
    [loteId],
  );
  return rows;
}

async function lockLote(conn, loteId, tiendaId) {
  const [rows] = await conn.query(
    'SELECT id, deshecho_en FROM modelo_lote WHERE id = ? AND tienda_id = ? FOR UPDATE',
    [loteId, tiendaId],
  );
  return rows[0] || null;
}

async function lockLineasDeLote(conn, loteId, tiendaId) {
  await conn.query(
    `SELECT l.id
       FROM linea l
       JOIN modelo_cambio c ON c.linea_id = l.id
      WHERE c.lote_id = ? AND l.tienda_id = ?
        FOR UPDATE`,
    [loteId, tiendaId],
  );
}

async function countCambios(conn, loteId) {
  const [rows] = await conn.query(
    'SELECT COUNT(*) AS total FROM modelo_cambio WHERE lote_id = ?',
    [loteId],
  );
  return rows[0].total;
}

async function marcarRestaurables(conn, loteId, tiendaId) {
  const [result] = await conn.query(
    `UPDATE modelo_cambio c
       JOIN linea l ON l.id = c.linea_id
        SET c.restaurado = 1
      WHERE c.lote_id = ?
        AND l.tienda_id = ?
        AND BINARY l.modelo = BINARY c.modelo_nuevo`,
    [loteId, tiendaId],
  );
  return result.affectedRows;
}

async function restaurarLineas(conn, loteId, tiendaId) {
  const [result] = await conn.query(
    `UPDATE linea l
       JOIN modelo_cambio c ON c.linea_id = l.id
        SET l.modelo = c.modelo_anterior
      WHERE c.lote_id = ?
        AND l.tienda_id = ?
        AND c.restaurado = 1`,
    [loteId, tiendaId],
  );
  return result.affectedRows;
}

async function marcarDeshecho(conn, loteId, usuarioId) {
  const [result] = await conn.query(
    `UPDATE modelo_lote
        SET deshecho_en = NOW(), deshecho_por = ?
      WHERE id = ? AND deshecho_en IS NULL`,
    [usuarioId, loteId],
  );
  return result.affectedRows;
}

module.exports = {
  findDistintos,
  createLote,
  lockLineasByModelo,
  insertCambios,
  updateModelo,
  findLotes,
  findLote,
  findCambiosDeLote,
  lockLote,
  lockLineasDeLote,
  countCambios,
  marcarRestaurables,
  restaurarLineas,
  marcarDeshecho,
};

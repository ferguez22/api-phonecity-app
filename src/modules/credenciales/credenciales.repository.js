const pool = require('../../config/db');

// SOLO SQL de la tabla credenciales (1:1 con linea, PK = linea_id).

async function findByLineaId(lineaId) {
  const [rows] = await pool.query(
    'SELECT * FROM credenciales WHERE linea_id = ?',
    [lineaId],
  );
  return rows[0] || null;
}

// Upsert: crea si no existen, actualiza si ya existen
async function upsert(lineaId, data) {
  const fila = { linea_id: lineaId, ...data };
  await pool.query(
    'INSERT INTO credenciales SET ? ON DUPLICATE KEY UPDATE ?',
    [fila, data],
  );
}

async function remove(lineaId) {
  const [result] = await pool.query(
    'DELETE FROM credenciales WHERE linea_id = ?',
    [lineaId],
  );
  return result.affectedRows;
}

module.exports = { findByLineaId, upsert, remove };

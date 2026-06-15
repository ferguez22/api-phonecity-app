const pool = require('../../config/db');

// SOLO SQL de la tabla linea_historial.

// Registra una foto del estado de la linea
async function log(lineaId, { fase, avisado, movil_en_tienda }) {
  await pool.query(
    `INSERT INTO linea_historial (linea_id, fase, avisado, movil_en_tienda)
     VALUES (?, ?, ?, ?)`,
    [lineaId, fase, avisado, movil_en_tienda],
  );
}

// Linea de tiempo completa de una linea (orden cronologico)
async function findByLineaId(lineaId) {
  const [rows] = await pool.query(
    'SELECT * FROM linea_historial WHERE linea_id = ? ORDER BY fecha ASC, id ASC',
    [lineaId],
  );
  return rows;
}

module.exports = { log, findByLineaId };

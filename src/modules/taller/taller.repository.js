const pool = require('../../config/db');

const SQL_CONSULTA =
  'SELECT l.id, l.modelo, l.problema_o_pieza, l.taller, ' +
  "DATE_FORMAT(MAX(h.fecha), '%d/%m/%y') AS fecha_envio, " +
  'DATEDIFF(CURDATE(), DATE(MAX(h.fecha))) AS dias ' +
  'FROM linea l ' +
  "LEFT JOIN linea_historial h ON h.linea_id = l.id AND h.fase = 'en_taller' " +
  "WHERE l.flujo = 'reparacion' AND l.fase = 'en_taller' " +
  'GROUP BY l.id ' +
  'ORDER BY (MAX(h.fecha) IS NULL), MAX(h.fecha) ASC';

async function findConsulta() {
  const [rows] = await pool.query(SQL_CONSULTA);
  return rows;
}

module.exports = { findConsulta };
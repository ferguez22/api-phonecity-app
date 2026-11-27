const pool = require('../../config/db');

const SQL_TS_IMPORTACION =
  'SELECT fecha FROM linea_historial WHERE flujo IS NULL ' +
  'GROUP BY fecha HAVING COUNT(DISTINCT fase) > 1';

const SQL_PRIMER_PEDIDO =
  'SELECT h.linea_id, MIN(h.fecha) AS primera, MAX(i.fecha IS NOT NULL) AS importada ' +
  'FROM linea_historial h ' +
  `LEFT JOIN (${SQL_TS_IMPORTACION}) i ON i.fecha = h.fecha AND h.flujo IS NULL ` +
  "WHERE h.fase = 'pedido' " +
  'GROUP BY h.linea_id';

async function findPedidosEnRango(clasif, params, desde, hasta) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(f.fecha, '%Y-%m-%d') AS fecha, l.id, l.modelo, p.descripcion AS problema_o_pieza
       FROM (
         SELECT l.id,
                IF(pp.importada, l.fecha_pedido, COALESCE(DATE(pp.primera), l.fecha_pedido)) AS fecha
           FROM linea l
           LEFT JOIN (${SQL_PRIMER_PEDIDO}) pp ON pp.linea_id = l.id
          WHERE ${clasif}
       ) f
       JOIN linea l ON l.id = f.id
       LEFT JOIN linea_pieza p ON p.linea_id = l.id
      WHERE f.fecha BETWEEN COALESCE(?, COALESCE(?, CURDATE()) - INTERVAL 59 DAY)
                        AND COALESCE(?, CURDATE())
      ORDER BY f.fecha DESC, l.id ASC, p.orden ASC, p.id ASC`,
    [...params, desde, hasta, hasta]
  );
  return rows;
}

module.exports = { findPedidosEnRango };

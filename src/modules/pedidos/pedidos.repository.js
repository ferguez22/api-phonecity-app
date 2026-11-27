const pool = require('../../config/db');

const SQL_TS_IMPORTACION =
  'SELECT fecha FROM linea_historial WHERE flujo IS NULL ' +
  'GROUP BY fecha HAVING COUNT(DISTINCT fase) > 1';

const SQL_EVENTOS_PEDIDO =
  'SELECT h.linea_id, h.id AS hid, h.fecha AS ts, ' +
  'IF(i.fecha IS NOT NULL, l.fecha_pedido, DATE(h.fecha)) AS fecha, ' +
  'IF(h.flujo IS NULL, l.flujo, h.flujo) AS flujo, ' +
  'IF(h.flujo IS NULL, l.proveedor_id, ph.id) AS proveedor_id ' +
  'FROM linea_historial h ' +
  'JOIN linea l ON l.id = h.linea_id ' +
  `LEFT JOIN (${SQL_TS_IMPORTACION}) i ON i.fecha = h.fecha AND h.flujo IS NULL ` +
  'LEFT JOIN proveedor ph ON ph.nombre = h.proveedor_nombre ' +
  "WHERE h.fase = 'pedido' " +
  'UNION ALL ' +
  'SELECT l.id, 0, NULL, l.fecha_pedido, l.flujo, l.proveedor_id ' +
  'FROM linea l ' +
  'WHERE l.fecha_pedido IS NOT NULL ' +
  "AND NOT EXISTS (SELECT 1 FROM linea_historial h WHERE h.linea_id = l.id AND h.fase = 'pedido')";

async function findPedidosEnRango(clasif, params, desde, hasta) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(e.fecha, '%Y-%m-%d') AS fecha, l.id, l.modelo, p.descripcion AS problema_o_pieza
       FROM (
         SELECT x.*, ROW_NUMBER() OVER (PARTITION BY x.linea_id, x.fecha ORDER BY x.ts, x.hid) AS rn
           FROM (${SQL_EVENTOS_PEDIDO}) x
          WHERE x.fecha BETWEEN COALESCE(?, COALESCE(?, CURDATE()) - INTERVAL 59 DAY)
                            AND COALESCE(?, CURDATE())
       ) e
       JOIN linea l ON l.id = e.linea_id
       LEFT JOIN linea_pieza p ON p.linea_id = l.id
      WHERE e.rn = 1 AND ${clasif}
      ORDER BY e.fecha DESC, l.id ASC, p.orden ASC, p.id ASC`,
    [desde, hasta, hasta, ...params]
  );
  return rows;
}

module.exports = { findPedidosEnRango, SQL_TS_IMPORTACION, SQL_EVENTOS_PEDIDO };

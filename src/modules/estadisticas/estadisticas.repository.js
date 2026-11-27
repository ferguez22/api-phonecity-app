const pool = require('../../config/db');
const { SQL_TS_IMPORTACION, SQL_EVENTOS_PEDIDO } = require('../pedidos/pedidos.repository');

const BASE_REPARACION =
  "l.fecha_entrada BETWEEN ? AND ? AND l.flujo IN ('reparacion','pieza') AND l.fase <> 'cancelado'";

const MODELO_VALIDO =
  "l.modelo IS NOT NULL AND TRIM(l.modelo) NOT IN ('', 'Universal', 'Material tienda', 'Otros')";

async function findRango(meses) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(CURDATE() - INTERVAL ? MONTH, '%Y-%m-%d') AS desde,
            DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hasta,
            DATEDIFF(CURDATE(), CURDATE() - INTERVAL ? MONTH) AS dias,
            DATE_FORMAT(CURDATE() - INTERVAL 11 MONTH, '%Y-%m-01') AS desde_meses,
            DATE_FORMAT(CURDATE() - INTERVAL ? MONTH, '%Y-%m-%d') AS desde_ant,
            DATE_FORMAT(CURDATE() - INTERVAL ? MONTH - INTERVAL 1 DAY, '%Y-%m-%d') AS hasta_ant,
            (SELECT DATE_FORMAT(MIN(t.fecha), '%Y-%m-%d') FROM (${SQL_TS_IMPORTACION}) t) AS fiable_desde`,
    [meses, meses, meses * 2, meses]
  );
  return rows[0];
}

async function findTiempoProveedor(clasif, params, desde, hasta) {
  const [rows] = await pool.query(
    `SELECT AVG(d.horas) / 24 AS dias, COUNT(d.horas) AS lineas
       FROM (
         SELECT TIMESTAMPDIFF(HOUR, e.ts, (
                  SELECT MIN(t.fecha) FROM linea_historial t
                   WHERE t.linea_id = e.linea_id AND t.fase = 'en_tienda' AND t.fecha > e.ts
                )) AS horas
           FROM (
             SELECT x.*, ROW_NUMBER() OVER (PARTITION BY x.linea_id ORDER BY x.ts, x.hid) AS rn
               FROM (${SQL_EVENTOS_PEDIDO}) x
              WHERE x.hid > 0
                AND x.ts NOT IN (SELECT i.fecha FROM (${SQL_TS_IMPORTACION}) i)
           ) e
          WHERE e.rn = 1 AND e.fecha BETWEEN ? AND ? AND ${clasif}
       ) d`,
    [desde, hasta, ...params]
  );
  return rows[0];
}

async function findLineasReparacion(desde, hasta) {
  const [rows] = await pool.query(
    `SELECT l.id, l.importe, l.fase, l.tipo_cobro, l.problema_o_pieza, p.descripcion
       FROM linea l
       LEFT JOIN linea_pieza p ON p.linea_id = l.id
      WHERE ${BASE_REPARACION}
      ORDER BY l.id ASC, p.orden ASC, p.id ASC`,
    [desde, hasta]
  );
  return rows;
}

async function findDiasMediosEntrega(desde, hasta) {
  const [rows] = await pool.query(
    `SELECT AVG(DATEDIFF(e.primera, l.fecha_entrada)) AS dias
       FROM linea l
       JOIN (
         SELECT h.linea_id, MIN(h.fecha) AS primera
           FROM linea_historial h
          WHERE h.fase = 'entregado'
            AND h.fecha NOT IN (SELECT t.fecha FROM (${SQL_TS_IMPORTACION}) t)
          GROUP BY h.linea_id
       ) e ON e.linea_id = l.id
      WHERE ${BASE_REPARACION}`,
    [desde, hasta]
  );
  return rows[0].dias;
}

async function findTopModelos(desde, hasta, limite) {
  const [rows] = await pool.query(
    `SELECT TRIM(l.modelo) AS modelo, COUNT(*) AS total
       FROM linea l
      WHERE ${BASE_REPARACION} AND ${MODELO_VALIDO}
      GROUP BY TRIM(l.modelo)
      ORDER BY total DESC, modelo ASC
      LIMIT ?`,
    [desde, hasta, limite]
  );
  return rows;
}

async function findPiezasDeModelos(desde, hasta, modelos) {
  if (!modelos.length) return [];
  const [rows] = await pool.query(
    `SELECT l.id, TRIM(l.modelo) AS modelo,
            COALESCE(p.descripcion, l.problema_o_pieza) AS descripcion
       FROM linea l
       LEFT JOIN linea_pieza p ON p.linea_id = l.id
      WHERE ${BASE_REPARACION} AND TRIM(l.modelo) IN (?)`,
    [desde, hasta, modelos]
  );
  return rows;
}

async function findPorMes(desdeMeses, hasta) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(l.fecha_entrada, '%Y-%m') AS mes, l.flujo, COUNT(*) AS n
       FROM linea l
      WHERE l.fecha_entrada BETWEEN ? AND ? AND l.fase <> 'cancelado'
      GROUP BY mes, l.flujo`,
    [desdeMeses, hasta]
  );
  return rows;
}

async function findPorDiaSemana(desde, hasta) {
  const [rows] = await pool.query(
    `SELECT WEEKDAY(l.fecha_entrada) AS dia, COUNT(*) AS n
       FROM linea l
      WHERE l.fecha_entrada BETWEEN ? AND ? AND l.fase <> 'cancelado'
      GROUP BY dia`,
    [desde, hasta]
  );
  return rows;
}

async function findPorSemanaMes(desde, hasta) {
  const [rows] = await pool.query(
    `SELECT LEAST(CEIL(DAY(l.fecha_entrada) / 7), 5) AS semana, COUNT(*) AS n
       FROM linea l
      WHERE l.fecha_entrada BETWEEN ? AND ? AND l.fase <> 'cancelado'
      GROUP BY semana`,
    [desde, hasta]
  );
  return rows;
}

const NO_IMPORTACION = (alias) =>
  `${alias}.fecha NOT IN (SELECT i.fecha FROM (${SQL_TS_IMPORTACION}) i)`;

async function findTallerEnvios(desde, hasta) {
  const [rows] = await pool.query(
    `SELECT e.linea_id, e.taller,
            TIMESTAMPDIFF(HOUR, e.ts, (
              SELECT s.fecha FROM linea_historial s
               WHERE s.linea_id = e.linea_id AND s.fecha > e.ts AND s.fase <> 'en_taller'
               ORDER BY s.fecha, s.id LIMIT 1
            )) AS horas_taller,
            (SELECT s.fase FROM linea_historial s
              WHERE s.linea_id = e.linea_id AND s.fecha > e.ts AND s.fase <> 'en_taller'
              ORDER BY s.fecha, s.id LIMIT 1) AS fase_siguiente,
            TIMESTAMPDIFF(SECOND, (
              SELECT MIN(p.fecha) FROM linea_historial p
               WHERE p.linea_id = e.linea_id AND p.fase = 'por_enviar_taller' AND p.fecha < e.ts
                 AND ${NO_IMPORTACION('p')}
                 AND p.fecha > COALESCE((
                   SELECT MAX(o.fecha) FROM linea_historial o
                    WHERE o.linea_id = e.linea_id AND o.fecha < e.ts
                      AND o.fase NOT IN ('por_enviar_taller', 'en_taller')
                 ), '1970-01-01')
            ), e.ts) AS segundos_envio
       FROM (
         SELECT h.linea_id, h.fecha AS ts, h.taller,
                ROW_NUMBER() OVER (PARTITION BY h.linea_id ORDER BY h.fecha, h.id) AS rn
           FROM linea_historial h
          WHERE h.fase = 'en_taller' AND ${NO_IMPORTACION('h')}
       ) e
      WHERE e.rn = 1 AND e.taller IS NOT NULL AND DATE(e.ts) BETWEEN ? AND ?`,
    [desde, hasta]
  );
  return rows;
}

async function findEnTallerAhora() {
  const [rows] = await pool.query(
    `SELECT l.id, l.taller,
            TIMESTAMPDIFF(HOUR, (
              SELECT MIN(h.fecha) FROM linea_historial h
               WHERE h.linea_id = l.id AND h.fase = 'en_taller'
                 AND h.fecha > COALESCE((
                   SELECT MAX(o.fecha) FROM linea_historial o
                    WHERE o.linea_id = l.id AND o.fase <> 'en_taller'
                 ), '1970-01-01')
            ), NOW()) AS horas
       FROM linea l
      WHERE l.fase = 'en_taller' AND l.taller IS NOT NULL`
  );
  return rows;
}

const BASE_COMPRAVENTA =
  "l.flujo = 'venta' AND l.subtipo IN ('venta','compra') AND l.fase <> 'cancelado'";

async function findCompraventaPorMes(desdeMeses, hasta) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(l.fecha_entrada, '%Y-%m') AS mes, l.subtipo, COUNT(*) AS n
       FROM linea l
      WHERE l.fecha_entrada BETWEEN ? AND ? AND ${BASE_COMPRAVENTA}
      GROUP BY mes, l.subtipo`,
    [desdeMeses, hasta]
  );
  return rows;
}

async function findCompraventaTotales(desde, hasta) {
  const [rows] = await pool.query(
    `SELECT l.subtipo, COUNT(*) AS n,
            SUM(CASE WHEN l.importe > 0 THEN l.importe END) AS importe
       FROM linea l
      WHERE l.fecha_entrada BETWEEN ? AND ? AND ${BASE_COMPRAVENTA}
      GROUP BY l.subtipo`,
    [desde, hasta]
  );
  return rows;
}

async function findTopCompraventa(desde, hasta, subtipo, limite) {
  const [rows] = await pool.query(
    `SELECT TRIM(l.modelo) AS modelo, COUNT(*) AS total
       FROM linea l
      WHERE l.fecha_entrada BETWEEN ? AND ? AND ${BASE_COMPRAVENTA}
        AND l.subtipo = ? AND l.modelo IS NOT NULL AND TRIM(l.modelo) <> ''
      GROUP BY TRIM(l.modelo)
      ORDER BY total DESC, modelo ASC
      LIMIT ?`,
    [desde, hasta, subtipo, limite]
  );
  return rows;
}

module.exports = {
  findTallerEnvios,
  findEnTallerAhora,
  findTiempoProveedor,
  findCompraventaPorMes,
  findCompraventaTotales,
  findTopCompraventa,
  findRango,
  findLineasReparacion,
  findDiasMediosEntrega,
  findTopModelos,
  findPiezasDeModelos,
  findPorMes,
  findPorDiaSemana,
  findPorSemanaMes,
};

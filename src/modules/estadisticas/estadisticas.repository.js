const pool = require('../../config/db');
const { SQL_TS_IMPORTACION } = require('../pedidos/pedidos.repository');

const BASE_REPARACION =
  "l.fecha_entrada BETWEEN ? AND ? AND l.flujo IN ('reparacion','pieza') AND l.fase <> 'cancelado'";

const MODELO_VALIDO =
  "l.modelo IS NOT NULL AND TRIM(l.modelo) NOT IN ('', 'Universal', 'Material tienda', 'Otros')";

async function findRango(meses) {
  const [rows] = await pool.query(
    `SELECT DATE_FORMAT(CURDATE() - INTERVAL ? MONTH, '%Y-%m-%d') AS desde,
            DATE_FORMAT(CURDATE(), '%Y-%m-%d') AS hasta,
            DATEDIFF(CURDATE(), CURDATE() - INTERVAL ? MONTH) AS dias,
            DATE_FORMAT(CURDATE() - INTERVAL 11 MONTH, '%Y-%m-01') AS desde_meses`,
    [meses, meses]
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

module.exports = {
  findRango,
  findLineasReparacion,
  findDiasMediosEntrega,
  findTopModelos,
  findPiezasDeModelos,
  findPorMes,
  findPorDiaSemana,
  findPorSemanaMes,
};

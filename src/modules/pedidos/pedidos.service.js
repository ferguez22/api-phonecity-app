const pool = require('../../config/db');
const AppError = require('../../utils/AppError');

const PROV_WEPHONE = 1;
const PROV_APOKIN = 2;
const TIENDA = '319';

const GRUPOS = {
  wephone: {
    titulo: `Pedido Wephone Infotec ${TIENDA}`,
    where: `l.fase = 'por_pedir' AND l.flujo = 'accesorio' AND l.proveedor_id = ?`,
    params: [PROV_WEPHONE],
  },
  apokin: {
    titulo: `Pedido Apokin ${TIENDA}`,
    where: `l.fase = 'por_pedir' AND l.flujo = 'accesorio' AND l.proveedor_id = ?`,
    params: [PROV_APOKIN],
  },
  piezas: {
    titulo: `Pedido ${TIENDA}`,
    where: `l.fase = 'por_pedir' AND l.flujo = 'pieza'`,
    params: [],
  },
};

const ORDEN_GRUPOS = ['wephone', 'apokin', 'piezas'];

function descripcion(r) {
  const item = (r.problema_o_pieza || '').trim();
  const modelo = (r.modelo || '').trim();
  return [item, modelo].filter(Boolean).join(' - ');
}

function agrupar(rows) {
  const map = {};
  for (const r of rows) {
    const desc = descripcion(r);
    if (!desc) continue;
    map[desc] = (map[desc] || 0) + 1;
  }
  return map;
}

function construirTexto(titulo, map) {
  const lineas = Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([k, v]) => `• ${k}${v > 1 ? ` x${v}` : ''}`);
  const cuerpo = lineas.length ? lineas.join('\n') : 'NO HAY PEDIDOS PARA HOY';
  return `${titulo}\n${cuerpo}`;
}

async function pendientes() {
  const bloques = {};
  const conteos = {};

  for (const g of ORDEN_GRUPOS) {
    const { titulo, where, params } = GRUPOS[g];
    const [rows] = await pool.query(
      `SELECT l.modelo, l.problema_o_pieza
         FROM linea l
        WHERE ${where}
        ORDER BY l.id ASC`,
      params
    );
    bloques[g] = construirTexto(titulo, agrupar(rows));
    conteos[g] = rows.length;
  }

  return { bloques, conteos };
}

async function marcarGrupo(conn, grupo) {
  const { where, params } = GRUPOS[grupo];

  await conn.query(
    `INSERT INTO linea_historial
       (linea_id, fase, avisado, movil_en_tienda, flujo, subtipo, taller, proveedor_nombre)
     SELECT l.id, 'pedido', l.avisado, l.movil_en_tienda, l.flujo, l.subtipo, l.taller, p.nombre
       FROM linea l
       LEFT JOIN proveedor p ON p.id = l.proveedor_id
      WHERE ${where}`,
    params
  );

  await conn.query(
    `INSERT IGNORE INTO linea_flujos (linea_id, flujo, fase)
     SELECT l.id, l.flujo, 'pedido'
       FROM linea l
      WHERE ${where}`,
    params
  );

  const [res] = await conn.query(
    `UPDATE linea l
        SET l.fase = 'pedido',
            l.fecha_pedido = COALESCE(l.fecha_pedido, CURDATE())
      WHERE ${where}`,
    params
  );

  return res.affectedRows;
}

async function marcarPedido(grupo) {
  const g = String(grupo || '').toLowerCase();
  const objetivo = g === 'todos' ? ORDEN_GRUPOS : [g];

  if (!objetivo.every((x) => GRUPOS[x])) {
    throw new AppError(
      `grupo no valido. Permitidos: ${[...ORDEN_GRUPOS, 'todos'].join(', ')}`,
      400
    );
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const detalle = {};
    let actualizadas = 0;
    for (const x of objetivo) {
      const n = await marcarGrupo(conn, x);
      detalle[x] = n;
      actualizadas += n;
    }

    await conn.commit();
    return { grupo: g, actualizadas, detalle };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pendientes, marcarPedido };
const pool = require('../../config/db');
const AppError = require('../../utils/AppError');
const repo = require('./pedidos.repository');

const PROV_WEPHONE = 1;
const PROV_APOKIN = 2;
const TIENDA = '319';

function grupo(titulo, clasif, params, clasifHistorial) {
  return { titulo, clasif, params, clasifHistorial, where: `l.fase = 'por_pedir' AND ${clasif}` };
}

const GRUPOS = {
  wephone: grupo(
    `Pedido Wephone Infotec ${TIENDA}`,
    `l.flujo = 'accesorio' AND l.proveedor_id = ?`,
    [PROV_WEPHONE],
    `e.flujo = 'accesorio' AND e.proveedor_id = ?`
  ),
  apokin: grupo(
    `Pedido Apokin ${TIENDA}`,
    `l.flujo = 'accesorio' AND l.proveedor_id = ?`,
    [PROV_APOKIN],
    `e.flujo = 'accesorio' AND e.proveedor_id = ?`
  ),
  piezas: grupo(`Pedido ${TIENDA}`, `l.flujo = 'pieza'`, [], `e.flujo = 'pieza'`),
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
    if (!map[desc]) map[desc] = { cantidad: 0, ids: [] };
    map[desc].cantidad += 1;
    if (!map[desc].ids.includes(r.id)) map[desc].ids.push(r.id);
  }
  return map;
}

function ordenar(map) {
  return Object.entries(map).sort((a, b) => a[0].localeCompare(b[0], 'es'));
}

function construirTexto(titulo, map) {
  const lineas = ordenar(map)
    .map(([k, v]) => `• ${k}${v.cantidad > 1 ? ` x${v.cantidad}` : ''}`);
  const cuerpo = lineas.length ? lineas.join('\n') : 'NO HAY PEDIDOS PARA HOY';
  return `${titulo}\n${cuerpo}`;
}

async function pendientes() {
  const bloques = {};
  const conteos = {};

  for (const g of ORDEN_GRUPOS) {
    const { titulo, where, params } = GRUPOS[g];
    const [rows] = await pool.query(
      `SELECT l.id, l.modelo, p.descripcion AS problema_o_pieza
         FROM linea l
         LEFT JOIN linea_pieza p ON p.linea_id = l.id
        WHERE ${where}
        ORDER BY l.id ASC, p.orden ASC, p.id ASC`,
      params
    );
    bloques[g] = construirTexto(titulo, agrupar(rows));
    conteos[g] = new Set(rows.map((r) => r.id)).size;
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

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

function validarFecha(valor, nombre) {
  const s = String(valor);
  const d = new Date(`${s}T00:00:00Z`);
  if (!RE_FECHA.test(s) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) {
    throw new AppError(`${nombre} no valida. Formato: YYYY-MM-DD`, 400);
  }
  return s;
}

function unidades(map) {
  return Object.values(map).reduce((s, v) => s + v.cantidad, 0);
}

async function historialDias(query = {}) {
  const desde = query.desde ? validarFecha(query.desde, 'desde') : null;
  const hasta = query.hasta ? validarFecha(query.hasta, 'hasta') : null;
  if (desde && hasta && desde > hasta) {
    throw new AppError('desde no puede ser posterior a hasta', 400);
  }

  const dias = {};
  for (const g of ORDEN_GRUPOS) {
    const { clasifHistorial, params } = GRUPOS[g];
    const rows = await repo.findPedidosEnRango(clasifHistorial, params, desde, hasta);

    const porFecha = {};
    for (const r of rows) (porFecha[r.fecha] ||= []).push(r);

    for (const [fecha, filas] of Object.entries(porFecha)) {
      const n = unidades(agrupar(filas));
      if (!n) continue;
      if (!dias[fecha]) {
        dias[fecha] = { fecha, ...Object.fromEntries(ORDEN_GRUPOS.map((x) => [x, 0])) };
      }
      dias[fecha][g] = n;
    }
  }

  return Object.values(dias).sort((a, b) => b.fecha.localeCompare(a.fecha));
}

async function historialDia(fecha) {
  const dia = validarFecha(fecha, 'fecha');
  const bloques = {};
  const filas = {};

  for (const g of ORDEN_GRUPOS) {
    const { titulo, clasifHistorial, params } = GRUPOS[g];
    const map = agrupar(await repo.findPedidosEnRango(clasifHistorial, params, dia, dia));
    filas[g] = ordenar(map).map(([descripcion, v]) => ({
      descripcion,
      cantidad: v.cantidad,
      ids: v.ids,
    }));
    bloques[g] = filas[g].length ? construirTexto(titulo, map) : '';
  }

  return { fecha: dia, bloques, filas };
}

module.exports = { pendientes, marcarPedido, historialDias, historialDia, GRUPOS };
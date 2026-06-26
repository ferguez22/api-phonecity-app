const pool = require('../../config/db');

const PROV_WEPHONE = 1;
const PROV_APOKIN = 2;
const TIENDA = '319';

// por_pedir → pedido (conserva movil/proveedor/flujo)
function descripcion(r) {
  const item = (r.problema_o_pieza || '').trim();
  const modelo = (r.modelo || '').trim();
  return [item, modelo].filter(Boolean).join(' - ');
}

function agrupar(rows) {
  const map = {};
  const ids = [];
  for (const r of rows) {
    const desc = descripcion(r);
    if (!desc) continue; // línea rota (sin pieza ni modelo) → saltar
    ids.push(r.id);
    map[desc] = (map[desc] || 0) + 1;
  }
  return { map, ids };
}

function construirTexto(titulo, map) {
  const lineas = Object.entries(map)
    .sort((a, b) => a[0].localeCompare(b[0], 'es'))
    .map(([k, v]) => `• ${k}${v > 1 ? ` x${v}` : ''}`);
  const cuerpo = lineas.length ? lineas.join('\n') : 'NO HAY PEDIDOS PARA HOY';
  return `${titulo}\n${cuerpo}`;
}

async function pendientes() {
  const [rows] = await pool.query(
    `SELECT id, flujo, proveedor_id, modelo, problema_o_pieza
       FROM linea
      WHERE fase = 'por_pedir'
      ORDER BY id ASC`
  );

  const wephoneRows = rows.filter((r) => r.flujo === 'accesorio' && r.proveedor_id === PROV_WEPHONE);
  const apokinRows = rows.filter((r) => r.flujo === 'accesorio' && r.proveedor_id === PROV_APOKIN);
  const piezaRows = rows.filter((r) => r.flujo === 'pieza');

  const wephone = agrupar(wephoneRows);
  const apokin = agrupar(apokinRows);
  const piezas = agrupar(piezaRows);

  return {
    bloques: {
      wephone: construirTexto(`Pedido Wephone Infotec ${TIENDA}`, wephone.map),
      apokin: construirTexto(`Pedido Apokin ${TIENDA}`, apokin.map),
      piezas: construirTexto(`Pedido ${TIENDA}`, piezas.map),
    },
    ids: {
      wephone: wephone.ids,
      apokin: apokin.ids,
      piezas: piezas.ids,
    },
  };
}

async function marcarPedido(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { actualizadas: 0 };
  const limpios = ids.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (limpios.length === 0) return { actualizadas: 0 };

  const placeholders = limpios.map(() => '?').join(',');
  const [res] = await pool.query(
    `UPDATE linea
        SET fase = 'pedido'
      WHERE fase = 'por_pedir'
        AND id IN (${placeholders})`,
    limpios
  );

  // Historial de cada línea transicionada
  const historialRepo = require('../historial/historial.repository');
  const [filas] = await pool.query(
    `SELECT id, fase, avisado, movil_en_tienda FROM linea WHERE id IN (${placeholders})`,
    limpios
  );
  for (const f of filas) {
    await historialRepo.log(f.id, { fase: f.fase, avisado: f.avisado, movil_en_tienda: f.movil_en_tienda });
  }

  return { actualizadas: res.affectedRows };
}

module.exports = { pendientes, marcarPedido };
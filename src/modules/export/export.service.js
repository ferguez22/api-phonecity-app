const pool = require('../../config/db');

const SHEET_HEADERS = ['Estado', 'Fecha', 'Modelo', 'Nombre', 'Teléfono', 'Precio', 'Pieza', 'Notas'];

const ESTADO_MAP = {
  'pieza|por_pedir|0|1': 'Pedir Pieza - Móvil en tienda',
  'pieza|pedido|0|1': 'Pieza pedida - Móvil en tienda',
  'pieza|por_pedir|0|0': 'Pedir pieza',
  'pieza|pedido|0|0': 'Pieza pedida',
  'pieza|en_tienda|1|0': 'Pieza en tienda - Avisado',
  'accesorio|por_pedir|0|0': 'Pedir Accesorio',
  'accesorio|pedido|0|0': 'Accesorio Pedido',
  'accesorio|en_tienda|1|0': 'Accesorio en tienda - Avisado',
  'reparacion|por_reparar|0|0': 'Reparar',
  'reparacion|reparado|1|0': 'Reparado - Avisado',
  'reparacion|por_enviar_taller|0|0': 'Enviar a taller',
  'reparacion|en_taller|0|0': 'Enviado a taller',
  'reparacion|cancelado|0|0': 'Cancelado',
  'reparacion|no_reparable|0|0': 'No se puede reparar',
  'reparacion|no_reparable|1|0': 'No se puede reparar - Entregado',
  'reparacion|entregado|0|0': 'Finalizado',
};

function estadoLabel(row) {
  if (row.flujo === 'venta') {
    return row.subtipo === 'compra' ? 'Compra de Dispositivo' : 'Venta de Dispositivo';
  }
  const key = `${row.flujo}|${row.fase}|${row.avisado}|${row.movil_en_tienda}`;
  return ESTADO_MAP[key] || '';
}

function precioValue(row) {
  if (row.tipo_cobro === 'garantia') return 'G';
  if (row.importe === null || row.importe === undefined) return '';
  return Number(row.importe);
}

async function getSheetExport() {
  const [rows] = await pool.query(
    `SELECT
       l.id,
       l.flujo, l.fase, l.avisado, l.movil_en_tienda, l.subtipo,
       DATE_FORMAT(l.fecha_entrada, '%d/%m/%Y') AS fecha,
       l.modelo, l.problema_o_pieza, l.notas,
       l.importe, l.tipo_cobro,
       c.nombre AS cliente_nombre,
       c.telefono AS cliente_telefono
     FROM linea l
     LEFT JOIN cliente c ON c.id = l.cliente_id
     ORDER BY l.id ASC`
  );

  let maxId = 0;
  const lineas = rows.map((r) => {
    if (r.id > maxId) maxId = r.id;
    return {
      id: r.id,
      cols: [
        estadoLabel(r),
        r.fecha || '',
        r.modelo || '',
        r.cliente_nombre || '',
        r.cliente_telefono || '',
        precioValue(r),
        r.problema_o_pieza || '',
        r.notas || '',
      ],
    };
  });

  return { headers: SHEET_HEADERS, maxId, lineas };
}

module.exports = { getSheetExport };

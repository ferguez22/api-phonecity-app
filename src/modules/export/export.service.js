const pool = require('../../config/db');

const SHEET_HEADERS = ['Estado', 'Fecha', 'Modelo', 'Nombre', 'Teléfono', 'Precio', 'Pieza', 'Notas'];

function provLabel(nombre) {
  if (!nombre) return null;
  return String(nombre).toUpperCase();
}

function tallerLabel(taller) {
  if (!taller) return null;
  const t = String(taller).toLowerCase();
  if (t === 'phonestorm') return 'PhoneStorm';
  if (t === 'infotec') return 'Infotec';
  return String(taller);
}

function estadoLabel(row) {
  const flujo = row.flujo;
  const f = row.fase;
  const movil = Number(row.movil_en_tienda) === 1;

  if (flujo === 'venta' && f === 'entregado') {
    return row.subtipo === 'compra' ? 'Compra de Dispositivo' : 'Venta de Dispositivo';
  }
  if (f === 'entregado') return 'Finalizado';
  if (f === 'cancelado') return 'Cancelado';

  if (flujo === 'accesorio') {
    const prov = provLabel(row.proveedor_nombre);
    if (f === 'por_pedir') return prov ? `Pedir accesorio ${prov}` : 'Pedir Accesorio';
    if (f === 'pedido') return prov ? `Accesorio Pedido ${prov}` : 'Accesorio Pedido';
    if (f === 'en_tienda') return prov ? `Accesorio en tienda Avisado ${prov}` : 'Accesorio en tienda - Avisado';
    return '';
  }

  if (flujo === 'pieza') {
    if (f === 'por_pedir') return movil ? 'Pedir Pieza Movil en tienda' : 'Pedir Pieza';
    if (f === 'pedido') return movil ? 'Pieza pedida - Movil en tienda' : 'Pieza pedida';
    if (f === 'en_tienda') return 'Pieza en tienda - avisado';
    return '';
  }

  if (flujo === 'reparacion') {
    if (f === 'por_reparar') return 'Reparar';
    if (f === 'reparado') return 'Reparado - Avisado';
    if (f === 'no_reparable') return movil ? 'No se puede reparar - avisado' : 'No se puede Reparar - Entregado';
    if (f === 'por_enviar_taller') {
      const t = tallerLabel(row.taller);
      return t ? `Enviar a taller - ${t}` : 'Enviar a taller';
    }
    if (f === 'en_taller') {
      const t = tallerLabel(row.taller);
      return t ? `Enviado a taller - ${t}` : 'Enviado a taller';
    }
    return '';
  }
  return '';
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
       l.flujo, l.fase, l.avisado, l.movil_en_tienda, l.subtipo, l.taller,
       DATE_FORMAT(l.fecha_entrada, '%d/%m/%Y') AS fecha,
       l.modelo, l.problema_o_pieza, l.notas,
       l.importe, l.tipo_cobro,
       c.nombre AS cliente_nombre,
       c.telefono AS cliente_telefono,
       p.nombre AS proveedor_nombre
     FROM linea l
     LEFT JOIN cliente c ON c.id = l.cliente_id
     LEFT JOIN proveedor p ON p.id = l.proveedor_id
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
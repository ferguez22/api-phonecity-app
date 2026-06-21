function _n(s) {
  return (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
}

const ESTADO_MAP_RAW = {
  'Finalizado': ['reparacion', 'entregado', false, false, null],
  'Reparar': ['reparacion', 'por_reparar', false, false, null],
  'Reparado - Avisado': ['reparacion', 'reparado', true, false, null],
  'Enviar a taller': ['reparacion', 'por_enviar_taller', false, false, null],
  'Enviado a taller': ['reparacion', 'en_taller', false, false, null],
  'No se puede reparar': ['reparacion', 'no_reparable', false, false, null],
  'No se puede reparar - Entregado': ['reparacion', 'no_reparable', true, false, null],
  'Cancelado': ['reparacion', 'cancelado', false, false, null],
  'Pedir pieza': ['pieza', 'por_pedir', false, false, null],
  'Pedir Pieza - Movil en tienda': ['pieza', 'por_pedir', false, true, null],
  'Pieza pedida': ['pieza', 'pedido', false, false, null],
  'Pieza pedida - Movil en tienda': ['pieza', 'pedido', false, true, null],
  'Pieza en tienda - Avisado': ['pieza', 'en_tienda', true, false, null],
  'Pedir Accesorio': ['accesorio', 'por_pedir', false, false, null],
  'Accesorio Pedido': ['accesorio', 'pedido', false, false, null],
  'Accesorio en tienda - Avisado': ['accesorio', 'en_tienda', true, false, null],
  'Venta de Dispositivo': ['venta', 'entregado', false, false, 'venta'],
  'Compra de Dispositivo': ['venta', 'entregado', false, false, 'compra'],
  'Venta de Movil': ['venta', 'entregado', false, false, 'venta'],
  'Venta de Movi': ['venta', 'entregado', false, false, 'venta'],
  'Venta de Tablet': ['venta', 'entregado', false, false, 'venta'],
  'Venta de Accesorio': ['venta', 'entregado', false, false, 'venta'],
  'Venta de Bici': ['venta', 'entregado', false, false, 'venta'],
  'Compra de Movil': ['venta', 'entregado', false, false, 'compra'],
};

const ESTADO_MAP = {};
for (const [label, tuple] of Object.entries(ESTADO_MAP_RAW)) {
  ESTADO_MAP[_n(label)] = tuple;
}

const RE_DIA = /^(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)/i;
const RE_SEP = /^\d{1,2}\/\d{1,2}\/\d{4}\s*\|/;
const RE_RANGO = /^(\d+[.,]?\d*)\s*[-–]\s*(\d+[.,]?\d*)/;
const RE_PREFIX = /^(\+34|0034)/;

function esSeparador(estado) {
  const s = (estado || '').trim();
  return RE_DIA.test(s) || RE_SEP.test(s);
}

function mapEstado(estado) {
  const e = (estado || '').trim();
  if (!e) {
    return { flujo: 'reparacion', fase: 'cancelado', avisado: false, movil_en_tienda: false, subtipo: null, fallback: true };
  }
  const t = ESTADO_MAP[_n(e)];
  if (!t) {
    return { flujo: 'reparacion', fase: 'cancelado', avisado: false, movil_en_tienda: false, subtipo: null, fallback: true };
  }
  return { flujo: t[0], fase: t[1], avisado: t[2], movil_en_tienda: t[3], subtipo: t[4] || null, fallback: false };
}

function parseFecha(raw) {
  const s = (raw || '').trim();
  if (!s) return null;
  const parts = s.split('/');
  if (parts.length !== 3) return null;
  let d = parseInt(parts[0], 10);
  let m = parseInt(parts[1], 10);
  let y = parseInt(parts[2], 10);
  if ([d, m, y].some((n) => Number.isNaN(n))) return null;
  if (y < 100) y += 2000;
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(m)}-${pad(d)}`;
}

function parsePrecio(raw) {
  const s = (raw || '').trim();
  if (!s) return { importe: null, tipoCobro: 'normal' };
  if (s.toUpperCase() === 'G') return { importe: null, tipoCobro: 'garantia' };
  if (['tienda', 'avisado', 'revisar', 'pedir accesorio'].includes(_n(s))) {
    return { importe: null, tipoCobro: 'normal' };
  }
  const m = s.match(RE_RANGO);
  if (m) {
    const val = Math.min(
      parseFloat(m[1].replace(',', '.')),
      parseFloat(m[2].replace(',', '.'))
    );
    return { importe: Math.round(val * 100) / 100, tipoCobro: 'normal' };
  }
  const clean = s.replace(/[€\s]/g, '').replace(',', '.');
  const num = Number(clean);
  if (clean !== '' && !Number.isNaN(num)) {
    return { importe: Math.round(num * 100) / 100, tipoCobro: 'normal' };
  }
  return { importe: null, tipoCobro: 'normal' };
}

function parseTel(raw) {
  let s = (raw || '').trim();
  if (!s || ['tienda', 'pedir accesorio'].includes(_n(s))) return null;
  s = s.replace(RE_PREFIX, '');
  s = s.replace(/[\s\-.]/g, '');
  if (!/^\d+$/.test(s) || s === '0' || s.length < 6) return null;
  return s;
}

module.exports = { _n, esSeparador, mapEstado, parseFecha, parsePrecio, parseTel };

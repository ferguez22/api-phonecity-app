const AppError = require('../../utils/AppError');
const repo = require('./estadisticas.repository');
const pedidosRepo = require('../pedidos/pedidos.repository');

const MESES_VALIDOS = [3, 6, 12];
const FLUJOS = ['reparacion', 'pieza', 'accesorio', 'venta'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const TOP = 10;
const RECOMENDACIONES_POR_TIPO = 2;
const UMBRAL_DIA = 0.2;
const RE_G = /(?<![\p{L}\p{N}_])G(?![\p{L}\p{N}_])/u;
const RE_CANTIDAD = /^(.*\S)\s+([xX])\s?(\d+)$/;

const TIPOS_PIEZA = {
  pantalla: 'Pantalla',
  bateria: 'Batería',
  cristal: 'Cristal',
  tapa: 'Tapa',
  conector: 'Conector',
  camara: 'Cámara',
  lente: 'Lente',
  flex: 'Flex',
  subplaca: 'Subplaca',
  auricular: 'Auricular',
  altavoz: 'Altavoz',
  boton: 'Botón',
  laminado: 'Laminado',
};

const NOTA =
  'Cifras aproximadas calculadas a partir de lo registrado en la app. ' +
  'No incluyen descuentos, garantías ni cobros fuera de la app.';

function validarMeses(valor) {
  const n = Number(valor ?? 6);
  if (!MESES_VALIDOS.includes(n)) {
    throw new AppError(`meses no valido. Permitidos: ${MESES_VALIDOS.join(', ')}`, 400);
  }
  return n;
}

function num(v) {
  return v === null || v === undefined ? null : Number(v);
}

function fmt(n) {
  return n.toFixed(1).replace('.', ',');
}

function sinTildes(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function esGarantia(linea) {
  return (
    linea.tipo_cobro === 'garantia' ||
    RE_G.test(linea.texto) ||
    sinTildes(linea.texto).includes('garantia')
  );
}

function lineasConTexto(filas) {
  const lineas = new Map();
  for (const f of filas) {
    if (!lineas.has(f.id)) {
      lineas.set(f.id, { ...f, textos: [f.problema_o_pieza || ''] });
    }
    if (f.descripcion) lineas.get(f.id).textos.push(f.descripcion);
  }
  return [...lineas.values()].map((l) => ({ ...l, texto: l.textos.join(' | ') }));
}

function separarCantidad(texto) {
  const limpio = String(texto || '').trim();
  const m = limpio.match(RE_CANTIDAD);
  if (!m) return { texto: limpio, cantidad: null };
  const [, resto, x, n] = m;
  if (x === 'X' && resto.split(/\s+/).length < 2) return { texto: limpio, cantidad: null };
  return { texto: resto.trim(), cantidad: Number(n) };
}

function tipoPieza(descripcion) {
  const palabra = String(descripcion || '').trim().split(/\s+/)[0] || '';
  const clave = palabra
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  return TIPOS_PIEZA[clave] || null;
}

function kpis(filas, diasEntrega) {
  const lineas = lineasConTexto(filas);
  const cobradas = lineas
    .filter((l) => Number(l.importe) > 0 && l.fase !== 'no_reparable' && !esGarantia(l))
    .map((l) => Number(l.importe));
  const ingresos = cobradas.reduce((s, v) => s + v, 0);
  const dias = num(diasEntrega);
  return {
    reparaciones: lineas.length,
    ingresosEstimados: Math.round(ingresos / 10) * 10,
    ticketMedio: cobradas.length ? Math.round(ingresos / cobradas.length) : 0,
    diasMediosEntrega: dias === null ? null : Math.round(dias * 10) / 10,
  };
}

function topModelos(modelos, piezas) {
  const tiposPorModelo = {};
  const vistos = new Set();
  for (const p of piezas) {
    const tipo = tipoPieza(p.descripcion);
    if (!tipo) continue;
    const clave = `${p.id}|${tipo}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const m = (tiposPorModelo[p.modelo.toLowerCase()] ||= {});
    m[tipo] = (m[tipo] || 0) + 1;
  }

  return modelos.map((r) => {
    const tipos = Object.entries(tiposPorModelo[r.modelo.toLowerCase()] || {})
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es'))
      .slice(0, 2)
      .map(([tipo, total]) => ({ tipo, total }));
    return { modelo: r.modelo, total: Number(r.total), tipos };
  });
}

function porMes(desdeMeses, filas) {
  const [anio, mes] = desdeMeses.split('-').map(Number);
  const meses = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(anio, mes - 1 + i, 1));
    const clave = d.toISOString().slice(0, 7);
    meses.push({ mes: clave, ...Object.fromEntries(FLUJOS.map((f) => [f, 0])), total: 0 });
  }
  const indice = Object.fromEntries(meses.map((m) => [m.mes, m]));
  for (const r of filas) {
    const m = indice[r.mes];
    if (!m || !FLUJOS.includes(r.flujo)) continue;
    m[r.flujo] += Number(r.n);
    m.total += Number(r.n);
  }
  return meses;
}

function porDiaSemana(filas) {
  const totales = Object.fromEntries(filas.map((r) => [Number(r.dia), Number(r.n)]));
  return DIAS.map((dia, i) => ({ dia, total: totales[i] || 0 }));
}

function porSemanaMes(filas) {
  const totales = Object.fromEntries(filas.map((r) => [Number(r.semana), Number(r.n)]));
  return [1, 2, 3, 4, 5].map((semana) => ({ semana, total: totales[semana] || 0 }));
}

function topAccesorios(filas) {
  const articulos = new Map();
  for (const r of filas) {
    const item = separarCantidad(r.problema_o_pieza);
    if (!item.texto) continue;
    const modelo = separarCantidad(r.modelo);
    const unidades = item.cantidad ?? modelo.cantidad ?? 1;
    const clave = item.texto.toLowerCase();
    if (!articulos.has(clave)) {
      articulos.set(clave, { articulo: item.texto, unidades: 0, ids: new Set(), modelos: new Map() });
    }
    const a = articulos.get(clave);
    a.unidades += unidades;
    a.ids.add(r.id);
    if (modelo.texto) a.modelos.set(modelo.texto, (a.modelos.get(modelo.texto) || 0) + unidades);
  }

  return [...articulos.values()]
    .sort((a, b) => b.unidades - a.unidades || a.articulo.localeCompare(b.articulo, 'es'))
    .slice(0, TOP)
    .map((a) => ({
      articulo: a.articulo,
      unidades: a.unidades,
      lineas: a.ids.size,
      modelos: [...a.modelos.entries()]
        .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'es'))
        .slice(0, 2)
        .map(([modelo, unidades]) => ({ modelo, unidades })),
    }));
}

function recomendacionesModelos(modelos, dias) {
  const semanas = dias / 7;
  return modelos.slice(0, RECOMENDACIONES_POR_TIPO).map((m) => {
    const porSemana = Math.round((m.total / semanas) * 10) / 10;
    const tipos = m.tipos.map((t) => t.tipo);
    const sobreTodo = tipos.length ? `, sobre todo ${tipos.join(' y ')}` : '';
    return {
      tipo: 'modelo',
      titulo: m.modelo,
      texto: `~${m.total} reparaciones en ${dias} días (~${fmt(porSemana)}/semana)${sobreTodo}. Mantén stock rotante.`,
    };
  });
}

function recomendacionesAccesorios(accesorios, dias) {
  return accesorios.slice(0, RECOMENDACIONES_POR_TIPO).map((a) => ({
    tipo: 'accesorio',
    titulo: a.articulo,
    texto: `~${a.unidades} uds pedidas en ${dias} días. Stock fijo.`,
  }));
}

function recomendacionesDias(semana) {
  const activos = semana.filter((d) => d.total > 0);
  if (activos.length < 2) return [];
  const media = activos.reduce((s, d) => s + d.total, 0) / activos.length;
  const flojo = activos.reduce((a, b) => (b.total < a.total ? b : a));
  const fuerte = activos.reduce((a, b) => (b.total > a.total ? b : a));
  const recs = [];

  const difFlojo = (media - flojo.total) / media;
  if (difFlojo >= UMBRAL_DIA) {
    recs.push({
      tipo: 'dia',
      titulo: `${flojo.dia}, el día más flojo`,
      texto: `~${Math.round(difFlojo * 100)}% por debajo de la media (~${flojo.total} entradas frente a ~${Math.round(media)}).`,
    });
  }

  const difFuerte = (fuerte.total - media) / media;
  if (difFuerte >= UMBRAL_DIA) {
    recs.push({
      tipo: 'dia',
      titulo: `${fuerte.dia}, el día más fuerte`,
      texto: `~${Math.round(difFuerte * 100)}% por encima de la media (~${fuerte.total} entradas frente a ~${Math.round(media)}).`,
    });
  }

  return recs;
}

async function obtener(mesesQuery) {
  const meses = validarMeses(mesesQuery);
  const rango = await repo.findRango(meses);
  const { desde, hasta, desde_meses: desdeMeses } = rango;
  const dias = Number(rango.dias);

  const [filasReparacion, diasEntrega, modelos, filasMes, filasDia, filasSemana, filasAccesorios] =
    await Promise.all([
      repo.findLineasReparacion(desde, hasta),
      repo.findDiasMediosEntrega(desde, hasta),
      repo.findTopModelos(desde, hasta, TOP),
      repo.findPorMes(desdeMeses, hasta),
      repo.findPorDiaSemana(desde, hasta),
      repo.findPorSemanaMes(desde, hasta),
      pedidosRepo.findPedidosEnRango("e.flujo = 'accesorio'", [], desde, hasta),
    ]);

  const piezas = await repo.findPiezasDeModelos(desde, hasta, modelos.map((m) => m.modelo));

  const top = topModelos(modelos, piezas);
  const accesorios = topAccesorios(filasAccesorios);
  const semana = porDiaSemana(filasDia);

  const recomendaciones = [
    ...recomendacionesModelos(top, dias),
    ...recomendacionesAccesorios(accesorios, dias),
    ...recomendacionesDias(semana),
  ];

  return {
    periodo: { meses, desde, hasta, dias },
    kpis: kpis(filasReparacion, diasEntrega),
    topModelos: top,
    porMes: porMes(desdeMeses, filasMes),
    porDiaSemana: semana,
    porSemanaMes: porSemanaMes(filasSemana),
    topAccesorios: accesorios,
    recomendaciones,
    aproximado: true,
    nota: NOTA,
  };
}

module.exports = { obtener };

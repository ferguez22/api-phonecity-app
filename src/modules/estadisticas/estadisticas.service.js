const AppError = require('../../utils/AppError');
const repo = require('./estadisticas.repository');
const pedidosRepo = require('../pedidos/pedidos.repository');
const { GRUPOS } = require('../pedidos/pedidos.service');
const lineaRepo = require('../linea/linea.repository');

const MESES_VALIDOS = [3, 6, 12];
const FLUJOS = ['reparacion', 'pieza', 'accesorio', 'venta'];
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const TOP = 20;
const TOP_COMPRAVENTA = 20;
const PROVEEDORES_ACCESORIO = ['wephone', 'apokin'];
const GRUPOS_TIEMPO = ['wephone', 'apokin', 'piezas'];
const FASES_OLVIDADO = ['reparado', 'no_reparable'];
const FASES_EXITO_TALLER = ['reparado', 'entregado'];
const DIAS_ALERTA_TALLER = 15;
const MIN_SEGUNDOS_ENVIO = 60;

const TIPOS_ACCESORIO = [
  ['Cargador', ['cargador', 'qi2']],
  ['Cable', ['cable']],
  ['Lámina', ['lamina', 'hidrogel']],
  ['Funda', ['funda']],
  ['Cristal/Protector', ['cristal', 'protector', 'templado', 'lente']],
  ['Correa', ['correa', 'pulsera', 'strap']],
  ['Audio', ['auricular', 'bluetooth', 'open ear', 'cascos']],
];
const TIPO_OTROS = 'Otros';
const RECOMENDACIONES_POR_TIPO = 2;
const UMBRAL_DIA = 0.2;
const UMBRAL_COMPARABLE = 0.5;
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

function unDecimal(v) {
  return v === null ? null : Math.round(v * 10) / 10;
}

function kpisBrutos(filas, diasEntrega) {
  const lineas = lineasConTexto(filas);
  const cobradas = lineas
    .filter((l) => Number(l.importe) > 0 && l.fase !== 'no_reparable' && !esGarantia(l))
    .map((l) => Number(l.importe));
  const ingresos = cobradas.reduce((s, v) => s + v, 0);
  return {
    reparaciones: lineas.length,
    noReparables: lineas.filter((l) => l.fase === 'no_reparable').length,
    ingresosEstimados: ingresos,
    ticketMedio: cobradas.length ? ingresos / cobradas.length : null,
    diasMediosEntrega: num(diasEntrega),
  };
}

function kpis(b) {
  return {
    reparaciones: b.reparaciones,
    ingresosEstimados: Math.round(b.ingresosEstimados / 10) * 10,
    ticketMedio: b.ticketMedio === null ? 0 : Math.round(b.ticketMedio),
    diasMediosEntrega: unDecimal(b.diasMediosEntrega),
  };
}

function porcentajeCambio(a, b) {
  return a === null || b === null || b === 0 ? null : unDecimal(((a - b) / b) * 100);
}

function variacion(actual, anterior, diasActual, diasAnterior) {
  return {
    reparaciones: porcentajeCambio(
      actual.reparaciones / diasActual,
      anterior.reparaciones / diasAnterior
    ),
    ingresosEstimados: porcentajeCambio(
      actual.ingresosEstimados / diasActual,
      anterior.ingresosEstimados / diasAnterior
    ),
    ticketMedio: porcentajeCambio(actual.ticketMedio, anterior.ticketMedio),
    diasMediosEntrega: porcentajeCambio(actual.diasMediosEntrega, anterior.diasMediosEntrega),
  };
}

function mediaDias(horas) {
  const validas = horas.filter((h) => h !== null && h !== undefined).map(Number);
  return validas.length ? unDecimal(validas.reduce((s, h) => s + h, 0) / validas.length / 24) : null;
}

function taller(envios, ahora) {
  const porTaller = new Map();
  for (const e of envios) {
    if (!porTaller.has(e.taller)) porTaller.set(e.taller, []);
    porTaller.get(e.taller).push(e);
  }

  const resumen = [...porTaller.entries()].map(([nombre, filas]) => {
    const reparados = filas.filter((f) => FASES_EXITO_TALLER.includes(f.fase_siguiente)).length;
    const noReparables = filas.filter((f) => f.fase_siguiente === 'no_reparable').length;
    const cerrados = reparados + noReparables;
    return {
      taller: nombre,
      envios: filas.length,
      diasMedios: mediaDias(filas.map((f) => f.horas_taller)),
      reparados,
      noReparables,
      exito: cerrados ? unDecimal((reparados / cerrados) * 100) : null,
    };
  });

  const actuales = new Map();
  for (const a of ahora) {
    if (!actuales.has(a.taller)) actuales.set(a.taller, { taller: a.taller, total: 0, mas15: 0 });
    const t = actuales.get(a.taller);
    t.total += 1;
    if (a.horas !== null && Number(a.horas) / 24 > DIAS_ALERTA_TALLER) t.mas15 += 1;
  }

  const porNombre = (a, b) => b.total - a.total || a.taller.localeCompare(b.taller, 'es');
  return {
    porTaller: resumen.sort(
      (a, b) => b.envios - a.envios || a.taller.localeCompare(b.taller, 'es')
    ),
    diasHastaEnvio: mediaDias(
      envios
        .filter((e) => e.segundos_envio !== null && Number(e.segundos_envio) >= MIN_SEGUNDOS_ENVIO)
        .map((e) => Number(e.segundos_envio) / 3600)
    ),
    enTallerAhora: [...actuales.values()].sort(porNombre),
  };
}

function diasEntre(desde, hasta) {
  return Math.max(0, (Date.parse(hasta) - Date.parse(desde)) / 86400000 + 1);
}

function posterior(fecha, minimo) {
  return minimo && minimo > fecha ? minimo : fecha;
}

function tasaNoReparable(b) {
  return b.reparaciones ? unDecimal((b.noReparables / b.reparaciones) * 100) : null;
}

function olvidados(moviles) {
  const ahora = Date.now();
  const dias = moviles
    .filter((m) => FASES_OLVIDADO.includes(m.fase) && Number(m.avisado) === 1 && m.fecha_primer_aviso)
    .map((m) => (ahora - new Date(m.fecha_primer_aviso).getTime()) / 86400000);
  return {
    total: dias.filter((d) => d > 30).length,
    mas60: dias.filter((d) => d > 60).length,
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

function listaMeses(desdeMeses) {
  const [anio, mes] = desdeMeses.split('-').map(Number);
  return Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(anio, mes - 1 + i, 1)).toISOString().slice(0, 7)
  );
}

function porMes(desdeMeses, filas) {
  const meses = listaMeses(desdeMeses).map((clave) => ({
    mes: clave,
    ...Object.fromEntries(FLUJOS.map((f) => [f, 0])),
    total: 0,
  }));
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

function partesFila(r) {
  const item = separarCantidad(r.problema_o_pieza);
  const modelo = separarCantidad(r.modelo);
  return { item, modelo, unidades: item.cantidad ?? modelo.cantidad ?? 1 };
}

function tipoAccesorio(item, modelo) {
  for (const texto of [item, modelo]) {
    const t = sinTildes(texto || '');
    const tipo = TIPOS_ACCESORIO.find(([, claves]) => claves.some((c) => t.includes(c)));
    if (tipo) return tipo[0];
  }
  return TIPO_OTROS;
}

function accesoriosPorTipo(filasPorProveedor) {
  const tipos = [...TIPOS_ACCESORIO.map(([t]) => t), TIPO_OTROS].map((tipo) => ({
    tipo,
    ...Object.fromEntries(PROVEEDORES_ACCESORIO.map((p) => [p, 0])),
    total: 0,
  }));
  const indice = Object.fromEntries(tipos.map((t) => [t.tipo, t]));
  for (const [proveedor, filas] of Object.entries(filasPorProveedor)) {
    for (const r of filas) {
      const { item, modelo, unidades } = partesFila(r);
      const t = indice[tipoAccesorio(item.texto, modelo.texto)];
      t[proveedor] += unidades;
      t.total += unidades;
    }
  }
  return tipos;
}

function compraventa(desdeMeses, filasMes, totales, vendidos, comprados) {
  const meses = listaMeses(desdeMeses).map((mes) => ({ mes, ventas: 0, compras: 0 }));
  const indice = Object.fromEntries(meses.map((m) => [m.mes, m]));
  for (const r of filasMes) {
    const m = indice[r.mes];
    if (!m) continue;
    m[r.subtipo === 'venta' ? 'ventas' : 'compras'] += Number(r.n);
  }
  const t = Object.fromEntries(totales.map((r) => [r.subtipo, r]));
  const decenas = (v) => Math.round(Number(v || 0) / 10) * 10;
  const top = (rows) => rows.map((r) => ({ modelo: r.modelo, total: Number(r.total) }));
  return {
    porMes: meses,
    totales: {
      ventas: Number(t.venta?.n || 0),
      compras: Number(t.compra?.n || 0),
      ingresoVentas: decenas(t.venta?.importe),
      gastoCompras: decenas(t.compra?.importe),
    },
    topVendidos: top(vendidos),
    topComprados: top(comprados),
  };
}

function topAccesorios(filas) {
  const articulos = new Map();
  for (const r of filas) {
    const { item, modelo, unidades } = partesFila(r);
    if (!item.texto) continue;
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
  const { desde_ant: desdeAnt, hasta_ant: hastaAnt, fiable_desde: fiableDesde } = rango;
  const desdeAntEfectivo = posterior(desdeAnt, fiableDesde);
  const diasActual = diasEntre(desde, hasta);
  const diasAnterior = diasEntre(desdeAntEfectivo, hastaAnt);
  const comparable = diasAnterior > 0 && diasAnterior >= diasEntre(desdeAnt, hastaAnt) * UMBRAL_COMPARABLE;

  const [filasReparacion, diasEntrega, modelos, filasMes, filasDia, filasSemana, filasAccesorios] =
    await Promise.all([
      repo.findLineasReparacion(desde, hasta),
      repo.findDiasMediosEntrega(posterior(desde, fiableDesde), hasta),
      repo.findTopModelos(desde, hasta, TOP),
      repo.findPorMes(desdeMeses, hasta),
      repo.findPorDiaSemana(desde, hasta),
      repo.findPorSemanaMes(desde, hasta),
      pedidosRepo.findPedidosEnRango("e.flujo = 'accesorio'", [], desde, hasta),
    ]);

  const [piezas, filasCvMes, filasCvTotales, vendidos, comprados, ...filasProveedor] =
    await Promise.all([
      repo.findPiezasDeModelos(desde, hasta, modelos.map((m) => m.modelo)),
      repo.findCompraventaPorMes(desdeMeses, hasta),
      repo.findCompraventaTotales(desde, hasta),
      repo.findTopCompraventa(desde, hasta, 'venta', TOP_COMPRAVENTA),
      repo.findTopCompraventa(desde, hasta, 'compra', TOP_COMPRAVENTA),
      ...PROVEEDORES_ACCESORIO.map((p) =>
        pedidosRepo.findPedidosEnRango(GRUPOS[p].clasifHistorial, GRUPOS[p].params, desde, hasta)
      ),
    ]);

  const [filasReparacionAnt, diasEntregaAnt, moviles, enviosTaller, enTallerAhora, ...tiempos] =
    await Promise.all([
      comparable ? repo.findLineasReparacion(desdeAntEfectivo, hastaAnt) : null,
      comparable ? repo.findDiasMediosEntrega(desdeAntEfectivo, hastaAnt) : null,
      lineaRepo.findMovilesEnTienda(),
      repo.findTallerEnvios(posterior(desde, fiableDesde), hasta),
      repo.findEnTallerAhora(),
      ...GRUPOS_TIEMPO.map((g) =>
        repo.findTiempoProveedor(GRUPOS[g].clasifHistorial, GRUPOS[g].params, desde, hasta)
      ),
    ]);

  const brutos = kpisBrutos(filasReparacion, diasEntrega);
  const brutosAnt = comparable ? kpisBrutos(filasReparacionAnt, diasEntregaAnt) : null;
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
    kpis: kpis(brutos),
    kpisAnterior: comparable ? kpis(brutosAnt) : null,
    periodoAnterior: {
      desde: desdeAnt,
      hasta: hastaAnt,
      desdeEfectivo: diasAnterior > 0 ? desdeAntEfectivo : null,
      diasEfectivos: diasAnterior,
      fiableDesde,
    },
    variacion: comparable ? variacion(brutos, brutosAnt, diasActual, diasAnterior) : null,
    tasaNoReparable: tasaNoReparable(brutos),
    olvidados: olvidados(moviles),
    tiempoProveedor: Object.fromEntries(
      GRUPOS_TIEMPO.map((g, i) => [g, unDecimal(num(tiempos[i].dias))])
    ),
    taller: taller(enviosTaller, enTallerAhora),
    topModelos: top,
    porMes: porMes(desdeMeses, filasMes),
    porDiaSemana: semana,
    porSemanaMes: porSemanaMes(filasSemana),
    topAccesorios: accesorios,
    accesoriosPorTipo: accesoriosPorTipo(
      Object.fromEntries(PROVEEDORES_ACCESORIO.map((p, i) => [p, filasProveedor[i]]))
    ),
    compraventa: compraventa(desdeMeses, filasCvMes, filasCvTotales, vendidos, comprados),
    recomendaciones,
    aproximado: true,
    nota: NOTA,
  };
}

module.exports = { obtener };

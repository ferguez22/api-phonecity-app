const { parse } = require('csv-parse/sync');
const pool = require('../../config/db');
const {
  _n, esSeparador, mapEstado, etiquetaEstado, parseFecha, parsePrecio, precioInterpretable, parseTel,
} = require('./import.parser');
const importRepository = require('./import.repository');

const TIENDA_ID = 1;

function parseCsv(buffer) {
  return parse(buffer, {
    bom: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_empty_lines: false,
  });
}

async function processRows(records, opts) {
  const dryRun = opts.dryRun;
  const conn = opts.conn;

  const stats = { ok: 0, separador: 0, fallback: 0, vacia: 0, err: 0 };
  const fallbackLog = [];

  const telCache = {};
  const nombreCache = {};
  let fakeSeq = 0;

  const provMap = {};
  if (!dryRun) {
    const [provs] = await conn.execute('SELECT id, nombre FROM proveedor');
    for (const p of provs) provMap[p.nombre.toLowerCase()] = p.id;
  }

  async function upsertCliente(nombreRaw, telRaw) {
    const nombre = (nombreRaw || '').trim();
    if (!nombre || nombre.toUpperCase() === 'TIENDA') return null;
    const tel = parseTel(telRaw);

    if (tel && telCache[tel] !== undefined) return telCache[tel];
    const nk = nombre.toLowerCase();
    if (nombreCache[nk] !== undefined) {
      const cid = nombreCache[nk];
      if (tel) telCache[tel] = cid;
      return cid;
    }

    let cid;
    if (dryRun) {
      fakeSeq -= 1;
      cid = fakeSeq;
    } else {
      try {
        const [r] = await conn.execute('INSERT INTO cliente (nombre, telefono) VALUES (?, ?)', [nombre, tel]);
        cid = r.insertId;
      } catch (e) {
        const [rows] = await conn.execute('SELECT id FROM cliente WHERE telefono = ?', [tel]);
        cid = rows.length ? rows[0].id : null;
      }
    }

    if (cid) {
      nombreCache[nk] = cid;
      if (tel) telCache[tel] = cid;
    }
    return cid;
  }

  for (let i = 0; i < records.length; i++) {
    const lineNum = i + 1;
    if (lineNum === 1) continue;

    const row = records[i].slice();
    while (row.length < 8) row.push('');
    const estadoRaw = row[0];
    const fechaRaw = row[1];
    const modeloRaw = row[2];
    const nombreRaw = row[3];
    const telRaw = row[4];
    const precioRaw = row[5];
    const piezaRaw = row[6];
    let notasRaw = row[7];

    const estado = (estadoRaw || '').trim();

    if (esSeparador(estado)) {
      stats.separador += 1;
      continue;
    }

    const vacia = !estado
      && !(modeloRaw || '').trim()
      && !(nombreRaw || '').trim()
      && !(piezaRaw || '').trim()
      && !(precioRaw || '').trim();
    if (vacia) {
      stats.vacia += 1;
      continue;
    }

    const m = mapEstado(estado);
    const { flujo, fase, avisado, movil_en_tienda, subtipo, taller, proveedor } = m;
    const proveedorId = proveedor ? (provMap[proveedor.toLowerCase()] ?? null) : null;    let notas = (notasRaw || '').trim();
    if (m.fallback) {
      const prefijo = estado ? `[ESTADO DESCONOCIDO: ${estado}] ` : '[SIN ESTADO EN CSV] ';
      notas = prefijo + notas;
      stats.fallback += 1;
      fallbackLog.push(`L-${String(lineNum).padStart(4, '0')} estado="${estado.slice(0, 40)}" modelo="${(modeloRaw || '').trim().slice(0, 30)}"`);
    }

    const fechaEntrada = parseFecha(fechaRaw);
    const { importe, tipoCobro } = parsePrecio(precioRaw);
    const modelo = (modeloRaw || '').trim() || null;
    const problema = (piezaRaw || '').trim() || null;
    const notasFinal = notas.trim() || null;

    let clienteId;
    try {
      clienteId = await upsertCliente(nombreRaw, telRaw);
    } catch (e) {
      stats.err += 1;
      continue;
    }

    if (!dryRun) {
      try {
        await conn.execute(
          `INSERT INTO linea
             (id, tienda_id, flujo, fase, avisado, movil_en_tienda,
              modelo, problema_o_pieza, notas, importe, tipo_cobro,
              fecha_entrada, cliente_id, subtipo, taller, proveedor_id)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            lineNum, TIENDA_ID, flujo, fase, avisado ? 1 : 0, movil_en_tienda ? 1 : 0,
            modelo, problema, notasFinal, importe, tipoCobro,
            fechaEntrada, clienteId, subtipo, taller, proveedorId,
          ]
        );
        await conn.execute(
          `INSERT INTO linea_historial (linea_id, fase, avisado, movil_en_tienda)
           VALUES (?,?,?,?)`,
          [lineNum, fase, avisado ? 1 : 0, movil_en_tienda ? 1 : 0]
        );
      } catch (e) {
        stats.err += 1;
        continue;
      }
    }

    stats.ok += 1;
  }

  return { stats, fallbackLog: fallbackLog.slice(0, 200) };
}

async function analyze(records) {
  return processRows(records, { dryRun: true, conn: null });
}

const MAX_ERRORES = 500;

function esTelefonoVacio(raw) {
  const s = (raw || '').trim();
  return !s || ['tienda', 'pedir accesorio'].includes(_n(s));
}

async function analizarDetalle(records) {
  const resumen = { filas: 0, validas: 0, conError: 0, vacias: 0, separadores: 0, errores: 0 };
  const errores = [];
  const reconocidos = {};
  const noReconocidos = new Map();
  const modelos = new Map();
  const telefonos = new Map();
  const sinTelefono = new Set();

  function addError(fila, motivo, valor) {
    resumen.errores += 1;
    if (errores.length < MAX_ERRORES) errores.push({ fila, motivo, valor });
  }

  for (let i = 1; i < records.length; i++) {
    const fila = i + 1;
    resumen.filas += 1;

    const row = records[i].slice();
    while (row.length < 8) row.push('');
    const [estadoRaw, fechaRaw, modeloRaw, nombreRaw, telRaw, precioRaw, piezaRaw] = row;
    const estado = (estadoRaw || '').trim();

    if (esSeparador(estado)) {
      resumen.separadores += 1;
      continue;
    }

    const vacia = !estado
      && !(modeloRaw || '').trim()
      && !(nombreRaw || '').trim()
      && !(piezaRaw || '').trim()
      && !(precioRaw || '').trim();
    if (vacia) {
      resumen.vacias += 1;
      continue;
    }

    let conError = false;

    if (mapEstado(estado).fallback) {
      conError = true;
      addError(fila, 'Estado no reconocido', estado);
      noReconocidos.set(estado, (noReconocidos.get(estado) || 0) + 1);
    } else {
      const etiqueta = etiquetaEstado(estado);
      reconocidos[etiqueta] = (reconocidos[etiqueta] || 0) + 1;
    }

    const tel = parseTel(telRaw);
    if (!tel && !esTelefonoVacio(telRaw)) {
      conError = true;
      addError(fila, 'Teléfono no válido', (telRaw || '').trim());
    }

    if ((fechaRaw || '').trim() && !parseFecha(fechaRaw)) {
      conError = true;
      addError(fila, 'Fecha no válida', fechaRaw.trim());
    }

    if (!precioInterpretable(precioRaw)) {
      conError = true;
      addError(fila, 'Precio no interpretable', precioRaw.trim());
    }

    if (conError) resumen.conError += 1;
    else resumen.validas += 1;

    const modelo = (modeloRaw || '').trim();
    if (modelo) modelos.set(modelo, (modelos.get(modelo) || 0) + 1);

    const nombre = (nombreRaw || '').trim();
    if (nombre && nombre.toUpperCase() !== 'TIENDA') {
      if (tel) {
        if (!telefonos.has(tel)) telefonos.set(tel, new Map());
        const nombres = telefonos.get(tel);
        const nk = _n(nombre);
        if (!nombres.has(nk)) nombres.set(nk, nombre);
      } else {
        sinTelefono.add(_n(nombre));
      }
    }
  }

  const telefonosBase = new Set();
  for (const t of await importRepository.findTelefonosClientes()) {
    const norm = parseTel(t);
    if (norm) telefonosBase.add(norm);
  }

  let nuevos = 0;
  let existentes = 0;
  const duplicados = [];
  for (const [telefono, nombres] of telefonos) {
    if (telefonosBase.has(telefono)) existentes += 1;
    else nuevos += 1;
    if (nombres.size > 1) duplicados.push({ telefono, nombres: [...nombres.values()] });
  }

  return {
    resumen,
    errores,
    estados: {
      reconocidos,
      noReconocidos: [...noReconocidos].map(([estado, filas]) => ({ estado, filas })),
    },
    modelos: [...modelos]
      .map(([modelo, lineas]) => ({ modelo, lineas }))
      .sort((a, b) => a.modelo.localeCompare(b.modelo, 'es')),
    clientes: { nuevos, existentes, sinTelefono: sinTelefono.size, duplicados },
  };
}

async function previewCompleto(records) {
  const base = await analyze(records);
  const detalle = await analizarDetalle(records);
  return { ...base, ...detalle };
}

async function conteo() {
  return importRepository.contarLineasYClientes();
}

async function backupCurrent() {
  const tablas = ['linea_historial', 'linea', 'cliente'];
  for (const t of tablas) {
    await pool.query(`DROP TABLE IF EXISTS \`${t}_backup\``);
    await pool.query(`CREATE TABLE \`${t}_backup\` AS SELECT * FROM \`${t}\``);
  }
}

async function executeImport(records) {
  await backupCurrent();

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query('DELETE FROM linea_historial');
    await conn.query('DELETE FROM linea');
    await conn.query('DELETE FROM cliente');

    const result = await processRows(records, { dryRun: false, conn });

    const [maxRows] = await conn.query('SELECT MAX(id) AS mx FROM linea');
    const maxId = maxRows[0].mx || 0;

    await conn.commit();

    const nextAutoIncrement = maxId + 1;
    await pool.query(`ALTER TABLE linea AUTO_INCREMENT = ${nextAutoIncrement}`);

    return { ...result, maxId, nextAutoIncrement, backup: true };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { parseCsv, analyze, previewCompleto, conteo, executeImport };

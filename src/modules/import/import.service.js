const { parse } = require('csv-parse/sync');
const pool = require('../../config/db');
const { esSeparador, mapEstado, parseFecha, parsePrecio, parseTel } = require('./import.parser');

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
    const { flujo, fase, avisado, movil_en_tienda, subtipo, taller } = m;
    let notas = (notasRaw || '').trim();
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
              fecha_entrada, cliente_id, subtipo, taller)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [
            lineNum, TIENDA_ID, flujo, fase, avisado ? 1 : 0, movil_en_tienda ? 1 : 0,
            modelo, problema, notasFinal, importe, tipoCobro,
            fechaEntrada, clienteId, subtipo, taller,
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

module.exports = { parseCsv, analyze, executeImport };

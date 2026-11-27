const pool = require('../../config/db');
const AppError = require('../../utils/AppError');
const repo = require('./modelo.repository');

const MODELO_MAX = 120;
const CAMBIOS_MAX = 500;

function tiendaDe(usuario) {
  const tiendaId = Number(usuario && usuario.tienda_id);
  if (!Number.isInteger(tiendaId) || tiendaId <= 0) {
    throw new AppError('El usuario no tiene tienda asignada', 403);
  }
  return tiendaId;
}

function validarCambios(cambios) {
  if (!Array.isArray(cambios) || cambios.length === 0) {
    throw new AppError('cambios debe ser una lista no vacia', 400);
  }
  if (cambios.length > CAMBIOS_MAX) {
    throw new AppError(`Maximo ${CAMBIOS_MAX} cambios por lote`, 400);
  }

  const vistos = new Set();
  const limpios = cambios.map((c, i) => {
    const pos = `cambios[${i}]`;
    if (!c || typeof c !== 'object') throw new AppError(`${pos}: formato no valido`, 400);
    const { de, a } = c;
    if (typeof de !== 'string') throw new AppError(`${pos}: "de" debe ser texto`, 400);
    if (typeof a !== 'string' || a.trim() === '') {
      throw new AppError(`${pos}: "a" es obligatorio`, 400);
    }
    if (a !== a.trim().replace(/\s+/g, ' ')) {
      throw new AppError(`${pos}: "a" tiene espacios sobrantes`, 400);
    }
    if ([...a].length > MODELO_MAX) {
      throw new AppError(`${pos}: "a" supera ${MODELO_MAX} caracteres`, 400);
    }
    if (de === a) throw new AppError(`${pos}: "de" y "a" son iguales`, 400);
    if (vistos.has(de)) throw new AppError(`${pos}: "de" repetido ("${de}")`, 400);
    vistos.add(de);
    return { de, a };
  });

  limpios.forEach(({ a }, i) => {
    if (vistos.has(a)) {
      throw new AppError(`cambios[${i}]: "a" ("${a}") es tambien un "de" del mismo lote`, 400);
    }
  });

  return limpios;
}

function validarLote(lote) {
  const id = Number(lote);
  if (!Number.isInteger(id) || id <= 0) throw new AppError('Lote no valido', 400);
  return id;
}

async function distintos(usuario) {
  return repo.findDistintos(tiendaDe(usuario));
}

async function normalizar(usuario, payload = {}) {
  const tiendaId = tiendaDe(usuario);
  const cambios = validarCambios(payload.cambios);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const lote = await repo.createLote(conn, tiendaId, usuario.id);
    let lineas = 0;
    for (const { de, a } of cambios) {
      const n = await repo.lockLineasByModelo(conn, tiendaId, de);
      if (n === 0) continue;
      await repo.insertCambios(conn, lote, tiendaId, de, a);
      lineas += await repo.updateModelo(conn, tiendaId, de, a);
    }

    if (lineas === 0) {
      throw new AppError('Ningun cambio afecta a lineas existentes', 400);
    }

    await conn.commit();
    return { lote, lineas };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

function toLote(row) {
  return { ...row, deshecho: Boolean(row.deshecho) };
}

async function lotes(usuario) {
  const rows = await repo.findLotes(tiendaDe(usuario));
  return rows.map(toLote);
}

async function lote(usuario, loteParam) {
  const tiendaId = tiendaDe(usuario);
  const loteId = validarLote(loteParam);
  const row = await repo.findLote(loteId, tiendaId);
  if (!row) throw new AppError(`Lote ${loteId} no encontrado`, 404);
  const cambios = await repo.findCambiosDeLote(loteId);
  return { ...toLote(row), cambios };
}

async function deshacer(usuario, loteParam) {
  const tiendaId = tiendaDe(usuario);
  const loteId = validarLote(loteParam);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const lote = await repo.lockLote(conn, loteId, tiendaId);
    if (!lote) throw new AppError(`Lote ${loteId} no encontrado`, 404);
    if (lote.deshecho_en) throw new AppError(`El lote ${loteId} ya esta deshecho`, 409);

    await repo.lockLineasDeLote(conn, loteId, tiendaId);
    const total = await repo.countCambios(conn, loteId);
    const restauradas = await repo.marcarRestaurables(conn, loteId, tiendaId);
    await repo.restaurarLineas(conn, loteId, tiendaId);

    const marcado = await repo.marcarDeshecho(conn, loteId, usuario.id);
    if (marcado === 0) throw new AppError(`El lote ${loteId} ya esta deshecho`, 409);

    await conn.commit();
    return { lote: loteId, restauradas, omitidas: total - restauradas };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { distintos, normalizar, lotes, lote, deshacer };

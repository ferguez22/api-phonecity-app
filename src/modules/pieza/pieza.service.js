const pool = require('../../config/db');
const AppError = require('../../utils/AppError');
const repo = require('./pieza.repository');

const MAX_DESC = 255;
const MAX_PIEZAS = 20;
const SEPARADOR = ' + ';

function limpiar(piezas) {
  if (!Array.isArray(piezas)) {
    throw new AppError('piezas debe ser una lista', 400);
  }
  if (piezas.length > MAX_PIEZAS) {
    throw new AppError(`Maximo ${MAX_PIEZAS} piezas por linea`, 400);
  }

  const out = [];
  for (const p of piezas) {
    const descripcion = String(p?.descripcion ?? '').trim();
    if (!descripcion) continue;

    let importe = null;
    if (p?.importe !== undefined && p.importe !== null && p.importe !== '') {
      const n = Number(p.importe);
      if (!Number.isFinite(n)) {
        throw new AppError(`Importe no valido en la pieza "${descripcion}"`, 400);
      }
      importe = n;
    }

    out.push({ descripcion: descripcion.slice(0, MAX_DESC), importe });
  }
  return out;
}

function resumen(piezas) {
  if (piezas.length === 0) return null;
  const texto = piezas.map((p) => p.descripcion).join(SEPARADOR);
  return texto.slice(0, MAX_DESC);
}

function total(piezas) {
  const conImporte = piezas.filter((p) => p.importe !== null);
  if (conImporte.length === 0) return null;
  const suma = conImporte.reduce((acc, p) => acc + p.importe, 0);
  return Math.round(suma * 100) / 100;
}

async function reemplazar(lineaId, piezas, conn = pool) {
  const limpias = limpiar(piezas);
  await repo.replaceAll(lineaId, limpias, conn);
  return {
    problema_o_pieza: resumen(limpias),
    importe: total(limpias),
  };
}

function desdeCamposAntiguos(problema_o_pieza, importe) {
  const descripcion = String(problema_o_pieza ?? '').trim();
  if (!descripcion) return [];
  return [{ descripcion: descripcion.slice(0, MAX_DESC), importe: importe ?? null }];
}

module.exports = {
  reemplazar,
  desdeCamposAntiguos,
  listar: repo.findByLinea,
  listarVarias: repo.findByLineas,
};
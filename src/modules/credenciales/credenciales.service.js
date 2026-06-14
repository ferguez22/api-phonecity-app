const AppError = require('../../utils/AppError');
const repo = require('./credenciales.repository');
const lineaRepo = require('../linea/linea.repository');

const ALLOWED_FIELDS = [
  'pin_sim',
  'codigo_desbloqueo',
  'correos_google',
  'password_recuperacion',
];

function pick(payload) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (payload[key] !== undefined) out[key] = payload[key];
  }
  return out;
}

// La linea padre debe existir antes de tocar sus credenciales
async function ensureLinea(lineaId) {
  const linea = await lineaRepo.findById(lineaId);
  if (!linea) throw new AppError(`Linea ${lineaId} no encontrada`, 404);
}

async function get(lineaId) {
  await ensureLinea(lineaId);
  const cred = await repo.findByLineaId(lineaId);
  if (!cred) throw new AppError('Esta linea no tiene credenciales', 404);
  return cred;
}

async function upsert(lineaId, payload) {
  await ensureLinea(lineaId);
  const data = pick(payload);
  if (Object.keys(data).length === 0) {
    throw new AppError('No hay campos de credenciales para guardar', 400);
  }
  await repo.upsert(lineaId, data);
  return repo.findByLineaId(lineaId);
}

async function remove(lineaId) {
  await ensureLinea(lineaId);
  const cred = await repo.findByLineaId(lineaId);
  if (!cred) throw new AppError('Esta linea no tiene credenciales', 404);
  await repo.remove(lineaId);
}

module.exports = { get, upsert, remove };

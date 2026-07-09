const AppError = require('../../utils/AppError');
const repo = require('./nota.repository');

async function list(query = {}) {
  const tiendaId = Number(query.tienda_id) || 1;
  const incluirResueltas = query.incluir_resueltas === 'true' || query.incluir_resueltas === '1';
  return repo.findAll(tiendaId, incluirResueltas);
}

async function get(id) {
  const nota = await repo.findById(id);
  if (!nota) throw new AppError(`Nota ${id} no encontrada`, 404);
  return nota;
}

async function create(payload) {
  const texto = String(payload.texto || '').trim();
  if (!texto) throw new AppError('El texto de la nota es obligatorio', 400);
  const tiendaId = Number(payload.tienda_id) || 1;
  const id = await repo.create({ tienda_id: tiendaId, texto });
  return get(id);
}

async function update(id, payload) {
  await get(id);
  const data = {};
  if (payload.texto !== undefined) {
    const texto = String(payload.texto).trim();
    if (!texto) throw new AppError('El texto no puede quedar vacio', 400);
    data.texto = texto;
  }
  if (payload.resuelto !== undefined) {
    const resuelto = payload.resuelto === true || payload.resuelto === 1 || payload.resuelto === '1';
    data.resuelto = resuelto ? 1 : 0;
    data.resuelto_en = resuelto ? new Date() : null;
  }
  if (Object.keys(data).length === 0) throw new AppError('No hay campos validos para actualizar', 400);
  await repo.update(id, data);
  return get(id);
}

module.exports = { list, get, create, update };
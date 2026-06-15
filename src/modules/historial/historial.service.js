const AppError = require('../../utils/AppError');
const repo = require('./historial.repository');
const lineaRepo = require('../linea/linea.repository');

async function getByLinea(lineaId) {
  const linea = await lineaRepo.findById(lineaId);
  if (!linea) throw new AppError(`Linea ${lineaId} no encontrada`, 404);
  return repo.findByLineaId(lineaId);
}

module.exports = { getByLinea };

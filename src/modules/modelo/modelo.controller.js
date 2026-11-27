const asyncHandler = require('../../utils/asyncHandler');
const service = require('./modelo.service');

const distintos = asyncHandler(async (req, res) => {
  const data = await service.distintos(req.usuario);
  res.json({ success: true, data, error: null });
});

const normalizar = asyncHandler(async (req, res) => {
  const data = await service.normalizar(req.usuario, req.body);
  res.status(201).json({ success: true, data, error: null });
});

const lotes = asyncHandler(async (req, res) => {
  const data = await service.lotes(req.usuario);
  res.json({ success: true, data, error: null });
});

const lote = asyncHandler(async (req, res) => {
  const data = await service.lote(req.usuario, req.params.lote);
  res.json({ success: true, data, error: null });
});

const deshacer = asyncHandler(async (req, res) => {
  const data = await service.deshacer(req.usuario, req.params.lote);
  res.json({ success: true, data, error: null });
});

module.exports = { distintos, normalizar, lotes, lote, deshacer };

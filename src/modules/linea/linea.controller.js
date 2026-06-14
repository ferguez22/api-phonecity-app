const asyncHandler = require('../../utils/asyncHandler');
const service = require('./linea.service');

// Solo traduce HTTP <-> service. Sin logica ni SQL.

const list = asyncHandler(async (req, res) => {
  const lineas = await service.list(req.query);
  res.json({ success: true, data: lineas, error: null });
});

const get = asyncHandler(async (req, res) => {
  const linea = await service.get(Number(req.params.id));
  res.json({ success: true, data: linea, error: null });
});

const create = asyncHandler(async (req, res) => {
  const linea = await service.create(req.body);
  res.status(201).json({ success: true, data: linea, error: null });
});

const update = asyncHandler(async (req, res) => {
  const linea = await service.update(Number(req.params.id), req.body);
  res.json({ success: true, data: linea, error: null });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(Number(req.params.id));
  res.status(204).send();
});

module.exports = { list, get, create, update, remove };

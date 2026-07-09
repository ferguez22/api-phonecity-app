const asyncHandler = require('../../utils/asyncHandler');
const service = require('./nota.service');

const list = asyncHandler(async (req, res) => {
  const notas = await service.list(req.query);
  res.json({ success: true, data: notas, error: null });
});

const create = asyncHandler(async (req, res) => {
  const nota = await service.create(req.body);
  res.status(201).json({ success: true, data: nota, error: null });
});

const update = asyncHandler(async (req, res) => {
  const nota = await service.update(Number(req.params.id), req.body);
  res.json({ success: true, data: nota, error: null });
});

module.exports = { list, create, update };
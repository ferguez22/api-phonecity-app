const asyncHandler = require('../../utils/asyncHandler');
const service = require('./cliente.service');

const list = asyncHandler(async (req, res) => {
  const clientes = await service.list(req.query);
  res.json({ success: true, data: clientes, error: null });
});

const get = asyncHandler(async (req, res) => {
  const cliente = await service.get(Number(req.params.id));
  res.json({ success: true, data: cliente, error: null });
});

const create = asyncHandler(async (req, res) => {
  const cliente = await service.create(req.body);
  res.status(201).json({ success: true, data: cliente, error: null });
});

const update = asyncHandler(async (req, res) => {
  const cliente = await service.update(Number(req.params.id), req.body);
  res.json({ success: true, data: cliente, error: null });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(Number(req.params.id));
  res.status(204).send();
});

module.exports = { list, get, create, update, remove };

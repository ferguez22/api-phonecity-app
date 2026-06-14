const asyncHandler = require('../../utils/asyncHandler');
const service = require('./credenciales.service');

const get = asyncHandler(async (req, res) => {
  const cred = await service.get(Number(req.params.id));
  res.json({ success: true, data: cred, error: null });
});

const upsert = asyncHandler(async (req, res) => {
  const cred = await service.upsert(Number(req.params.id), req.body);
  res.json({ success: true, data: cred, error: null });
});

const remove = asyncHandler(async (req, res) => {
  await service.remove(Number(req.params.id));
  res.status(204).send();
});

module.exports = { get, upsert, remove };

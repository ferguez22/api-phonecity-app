const asyncHandler = require('../../utils/asyncHandler');
const service = require('./pedidos.service');

const pendientes = asyncHandler(async (req, res) => {
  const data = await service.pendientes();
  res.json({ success: true, data, error: null });
});

const marcarPedido = asyncHandler(async (req, res) => {
  const data = await service.marcarPedido(req.body?.ids);
  res.json({ success: true, data, error: null });
});

module.exports = { pendientes, marcarPedido };
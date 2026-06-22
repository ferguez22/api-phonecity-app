const asyncHandler = require('../../utils/asyncHandler');
const repo = require('./proveedor.repository');

const list = asyncHandler(async (req, res) => {
  const proveedores = await repo.findAll();
  res.json({ success: true, data: proveedores, error: null });
});

module.exports = { list };

const asyncHandler = require('../../utils/asyncHandler');
const service = require('./taller.service');

const consulta = asyncHandler(async (req, res) => {
  const data = await service.consulta();
  res.json({ success: true, data, error: null });
});

module.exports = { consulta };
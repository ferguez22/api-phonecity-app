const asyncHandler = require('../../utils/asyncHandler');
const service = require('./historial.service');

const get = asyncHandler(async (req, res) => {
  const historial = await service.getByLinea(Number(req.params.id));
  res.json({ success: true, data: historial, error: null });
});

module.exports = { get };

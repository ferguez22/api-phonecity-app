const asyncHandler = require('../../utils/asyncHandler');
const service = require('./estadisticas.service');

const obtener = asyncHandler(async (req, res) => {
  const data = await service.obtener(req.query.meses);
  res.json({ success: true, data, error: null });
});

module.exports = { obtener };

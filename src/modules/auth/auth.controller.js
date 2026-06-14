const asyncHandler = require('../../utils/asyncHandler');
const service = require('./auth.service');

const login = asyncHandler(async (req, res) => {
  const { nombre_usuario, password } = req.body;
  const result = await service.login(nombre_usuario, password);
  res.json({ success: true, data: result, error: null });
});

module.exports = { login };

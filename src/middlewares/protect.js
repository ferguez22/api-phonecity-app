const jwt = require('jsonwebtoken');
const AppError = require('../utils/AppError');
const { jwt: jwtConfig } = require('../config/env');

// Exige cabecera "Authorization: Bearer <token>" valida.
const protect = (req, res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return next(new AppError('Token no proporcionado', 401));
  }

  try {
    const payload = jwt.verify(token, jwtConfig.secret);
    req.usuario = payload; // queda disponible en los controllers
    next();
  } catch (_err) {
    next(new AppError('Token invalido o expirado', 401));
  }
};

module.exports = protect;

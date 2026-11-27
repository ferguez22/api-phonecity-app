const AppError = require('../utils/AppError');

const requireRole = (...roles) => (req, res, next) => {
  if (!req.usuario) {
    return next(new AppError('Token no proporcionado', 401));
  }
  if (!roles.includes(req.usuario.rol)) {
    return next(new AppError('No tienes permiso para esta accion', 403));
  }
  next();
};

module.exports = requireRole;

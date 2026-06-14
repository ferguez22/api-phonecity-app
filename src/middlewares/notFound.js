const AppError = require('../utils/AppError');

// Cualquier ruta no definida cae aqui -> 404
const notFound = (req, res, next) => {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404));
};

module.exports = notFound;

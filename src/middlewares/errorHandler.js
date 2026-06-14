const { nodeEnv } = require('../config/env');

// Manejador central de errores. Formato de respuesta consistente.
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  // Errores no operacionales (bugs) no exponen su mensaje real al cliente
  const message = err.isOperational ? err.message : 'Error interno del servidor';

  if (!err.isOperational) {
    console.error(err);
  }

  res.status(statusCode).json({
    success: false,
    data: null,
    error: {
      message,
      ...(nodeEnv === 'development' && { stack: err.stack }),
    },
  });
};

module.exports = errorHandler;

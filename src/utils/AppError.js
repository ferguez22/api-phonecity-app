// Error operacional con codigo HTTP. Lo lanza la capa service.
class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // distingue errores esperados de bugs
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;

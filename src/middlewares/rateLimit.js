const rateLimit = require('express-rate-limit');

const cfKey = (req) => req.headers['cf-connecting-ip'] || req.ip;

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: cfKey,
  message: {
    success: false,
    data: null,
    error: { message: 'Demasiadas peticiones. Espera un momento.' },
  },
});

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: cfKey,
  message: {
    success: false,
    data: null,
    error: { message: 'Demasiados intentos de login. Inténtalo en unos minutos.' },
  },
});

module.exports = { generalLimiter, loginLimiter };
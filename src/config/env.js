const dotenv = require('dotenv');

dotenv.config();

// Variables obligatorias: si falta alguna, la app NO arranca (fallo temprano)
const required = ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_NAME', 'PORT', 'JWT_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(`Faltan variables de entorno: ${missing.join(', ')}`);
}

module.exports = {
  port: Number(process.env.PORT),
  nodeEnv: process.env.NODE_ENV || 'development',
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
};

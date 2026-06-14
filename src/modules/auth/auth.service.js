const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const AppError = require('../../utils/AppError');
const { jwt: jwtConfig } = require('../../config/env');
const repo = require('./auth.repository');

// Firma un JWT con los datos minimos del usuario
function signToken(usuario) {
  return jwt.sign(
    {
      id: usuario.id,
      nombre_usuario: usuario.nombre_usuario,
      rol: usuario.rol,
      tienda_id: usuario.tienda_id,
    },
    jwtConfig.secret,
    { expiresIn: jwtConfig.expiresIn },
  );
}

async function login(nombreUsuario, password) {
  if (!nombreUsuario || !password) {
    throw new AppError('Usuario y contrasena son obligatorios', 400);
  }

  const usuario = await repo.findByUsuario(nombreUsuario);
  // Mensaje generico: no revelar si el usuario existe o no
  if (!usuario) throw new AppError('Credenciales invalidas', 401);

  const passwordOk = await bcrypt.compare(password, usuario.password_hash);
  if (!passwordOk) throw new AppError('Credenciales invalidas', 401);

  return {
    token: signToken(usuario),
    usuario: {
      id: usuario.id,
      nombre_usuario: usuario.nombre_usuario,
      rol: usuario.rol,
      tienda_id: usuario.tienda_id,
    },
  };
}

module.exports = { login };

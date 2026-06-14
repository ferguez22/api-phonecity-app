const pool = require('../../config/db');

// SOLO SQL de la tabla usuario.

async function findByUsuario(nombreUsuario) {
  const [rows] = await pool.query(
    'SELECT * FROM usuario WHERE nombre_usuario = ?',
    [nombreUsuario],
  );
  return rows[0] || null;
}

module.exports = { findByUsuario };

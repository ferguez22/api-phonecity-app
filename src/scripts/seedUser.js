require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('../config/db');

// Crea (o actualiza) el usuario admin a partir de las variables del .env:
//   SEED_ADMIN_USUARIO, SEED_ADMIN_PASSWORD
// Ejecutar una sola vez:  npm run seed:user
async function seed() {
  const usuario = process.env.SEED_ADMIN_USUARIO;
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!usuario || !password) {
    console.error('ERROR - Define SEED_ADMIN_USUARIO y SEED_ADMIN_PASSWORD en .env');
    process.exit(1);
  }

  try {
    // Tienda destino: la primera (PhoneCity)
    const [tiendas] = await pool.query('SELECT id FROM tienda ORDER BY id LIMIT 1');
    if (tiendas.length === 0) {
      console.error('ERROR - No hay tiendas. Aplica el seed 0.2 primero.');
      process.exit(1);
    }
    const tiendaId = tiendas[0].id;

    const passwordHash = await bcrypt.hash(password, 10);

    await pool.query(
      `INSERT INTO usuario (nombre_usuario, password_hash, rol, tienda_id)
       VALUES (?, ?, 'admin', ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
      [usuario, passwordHash, tiendaId],
    );

    console.log(`OK - Usuario '${usuario}' creado/actualizado (tienda_id=${tiendaId})`);
    console.log('AVISO - Borra SEED_ADMIN_PASSWORD del .env ahora.');
    process.exit(0);
  } catch (err) {
    console.error('ERROR -', err.message);
    process.exit(1);
  }
}

seed();

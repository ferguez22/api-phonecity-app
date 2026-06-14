const app = require('./app');
const { port } = require('./config/env');
const pool = require('./config/db');

async function start() {
  try {
    // Verifica la conexion a MariaDB ANTES de escuchar
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    console.log('OK - Conectado a MariaDB');

    app.listen(port, () => {
      console.log(`OK - API escuchando en http://localhost:${port}`);
    });
  } catch (err) {
    console.error('ERROR - No se pudo iniciar:', err.message);
    process.exit(1);
  }
}

start();

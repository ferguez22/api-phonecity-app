require('dotenv').config();
const mysql = require('mysql2/promise');

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const [hist] = await conn.query(
    'SELECT DISTINCT linea_id, flujo, fase FROM linea_historial WHERE flujo IS NOT NULL'
  );
  const [actuales] = await conn.query('SELECT id AS linea_id, flujo, fase FROM linea');

  const filas = [...hist, ...actuales].map((r) => [r.linea_id, r.flujo, r.fase]);

  if (filas.length === 0) {
    console.log('Sin filas para insertar.');
    await conn.end();
    return;
  }

  const [result] = await conn.query(
    'INSERT IGNORE INTO linea_flujos (linea_id, flujo, fase) VALUES ?',
    [filas]
  );

  console.log(`Candidatas: ${filas.length}`);
  console.log(`Insertadas: ${result.affectedRows}`);

  const [[{ total }]] = await conn.query('SELECT COUNT(*) AS total FROM linea_flujos');
  console.log(`Total en linea_flujos: ${total}`);

  await conn.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
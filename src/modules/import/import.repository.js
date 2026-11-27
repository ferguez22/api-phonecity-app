const pool = require('../../config/db');

async function contarLineasYClientes() {
  const [rows] = await pool.query(
    'SELECT (SELECT COUNT(*) FROM linea) AS lineas, (SELECT COUNT(*) FROM cliente) AS clientes',
  );
  return { lineas: Number(rows[0].lineas), clientes: Number(rows[0].clientes) };
}

async function findTelefonosClientes() {
  const [rows] = await pool.query('SELECT telefono FROM cliente WHERE telefono IS NOT NULL');
  return rows.map((r) => r.telefono);
}

module.exports = { contarLineasYClientes, findTelefonosClientes };

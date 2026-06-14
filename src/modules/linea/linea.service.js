const AppError = require('../../utils/AppError');
const repo = require('./linea.repository');

// Whitelist: solo estos campos pueden escribirse desde la API.
// Protege contra inyeccion de columnas via "SET ?".
const ALLOWED_FIELDS = [
  'tienda_id',
  'flujo',
  'fase',
  'avisado',
  'movil_en_tienda',
  'modelo',
  'problema_o_pieza',
  'notas',
  'telefono_alternativo',
  'codigo_dispositivo',
  'importe',
  'tipo_cobro',
  'fecha_entrada',
  'fecha_pedido',
  'fecha_recogida_prevista',
  'proveedor_id',
  'taller',
  'fecha_envio_taller',
  'fecha_retorno_taller',
  'cliente_id',
  'linea_origen_id',
];

const REQUIRED_ON_CREATE = ['tienda_id', 'flujo', 'fase'];

// Filtra el payload dejando solo campos permitidos
function pick(payload) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (payload[key] !== undefined) out[key] = payload[key];
  }
  return out;
}

async function list() {
  return repo.findAll();
}

async function get(id) {
  const linea = await repo.findById(id);
  if (!linea) throw new AppError(`Linea ${id} no encontrada`, 404);
  return linea;
}

async function create(payload) {
  const data = pick(payload);
  const missing = REQUIRED_ON_CREATE.filter(
    (f) => data[f] === undefined || data[f] === null,
  );
  if (missing.length > 0) {
    throw new AppError(`Campos obligatorios: ${missing.join(', ')}`, 400);
  }
  const id = await repo.create(data);
  return repo.findById(id);
}

async function update(id, payload) {
  await get(id); // lanza 404 si no existe
  const data = pick(payload);
  if (Object.keys(data).length === 0) {
    throw new AppError('No hay campos validos para actualizar', 400);
  }
  await repo.update(id, data);
  return repo.findById(id);
}

async function remove(id) {
  await get(id); // lanza 404 si no existe
  await repo.remove(id);
}

module.exports = { list, get, create, update, remove };

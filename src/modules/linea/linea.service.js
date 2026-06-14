const AppError = require('../../utils/AppError');
const repo = require('./linea.repository');

// Whitelist de ESCRITURA: solo estos campos pueden guardarse desde la API.
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

// Whitelist de FILTROS (?campo=valor)
const FILTERABLE = [
  'fase',
  'flujo',
  'cliente_id',
  'proveedor_id',
  'tienda_id',
  'taller',
  'tipo_cobro',
  'movil_en_tienda',
  'avisado',
];

const BOOLEAN_FILTERS = ['movil_en_tienda', 'avisado'];

// Whitelist de ORDEN (?orderBy=clave). Mapea a una expresion SQL segura.
const SORT_EXPRESSIONS = {
  id: 'l.id',
  fecha_entrada: 'l.fecha_entrada',
  fecha_recogida_prevista: 'l.fecha_recogida_prevista',
  dias_reparacion: 'DATEDIFF(CURDATE(), l.fecha_entrada)',
};

function pick(payload) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (payload[key] !== undefined) out[key] = payload[key];
  }
  return out;
}

// Construye el objeto de filtros desde req.query (solo claves permitidas)
function buildFilters(query) {
  const filters = {};
  for (const key of FILTERABLE) {
    const value = query[key];
    if (value === undefined || value === '') continue;

    if (BOOLEAN_FILTERS.includes(key)) {
      filters[key] = value === 'true' || value === '1' ? 1 : 0;
    } else {
      filters[key] = value;
    }
  }
  return filters;
}

async function list(query = {}) {
  const filters = buildFilters(query);

  // orderBy: si no es valido, error claro (no se adivina)
  let orderByExpr = SORT_EXPRESSIONS.id;
  if (query.orderBy !== undefined) {
    if (!SORT_EXPRESSIONS[query.orderBy]) {
      throw new AppError(
        `orderBy no valido. Permitidos: ${Object.keys(SORT_EXPRESSIONS).join(', ')}`,
        400,
      );
    }
    orderByExpr = SORT_EXPRESSIONS[query.orderBy];
  }

  const orderDir = String(query.order).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  return repo.findAll(filters, orderByExpr, orderDir);
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

const AppError = require('../../utils/AppError');
const repo = require('./linea.repository');
const historialRepo    = require('../historial/historial.repository');

const ALLOWED_FIELDS = [
  'tienda_id','flujo','fase','avisado','movil_en_tienda','modelo',
  'problema_o_pieza','notas','telefono_alternativo','codigo_dispositivo',
  'importe','tipo_cobro','fecha_entrada','fecha_pedido','fecha_recogida_prevista',
  'proveedor_id','taller','fecha_envio_taller','fecha_retorno_taller',
  'cliente_id','linea_origen_id','subtipo',
];

const REQUIRED_ON_CREATE = ['tienda_id','flujo','fase'];

const FILTERABLE = [
  'fase','flujo','cliente_id','proveedor_id','tienda_id','taller',
  'tipo_cobro','movil_en_tienda','avisado','subtipo',
];

const BOOLEAN_FILTERS = ['movil_en_tienda','avisado'];

const SORT_EXPRESSIONS = {
  id:                      'l.id',
  fecha_entrada:           'l.fecha_entrada',
  fecha_recogida_prevista: 'l.fecha_recogida_prevista',
  dias_reparacion:         'DATEDIFF(CURDATE(), l.fecha_entrada)',
};

function pick(payload) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (payload[key] !== undefined) out[key] = payload[key];
  }
  return out;
}

function buildFilters(query) {
  const filters = {};
  for (const key of FILTERABLE) {
    const value = query[key];
    if (value === undefined || value === '') continue;
    if (BOOLEAN_FILTERS.includes(key)) {
      filters[key] = value === 'true' || value === '1' ? 1 : 0;
    } else if (value === 'null') {
      filters[key] = null;
    } else {
      filters[key] = value;
    }
  }
  return filters;
}

function handleFkError(err) {
  if (err.code === 'ER_NO_REFERENCED_ROW_2' || err.code === 'ER_NO_REFERENCED_ROW') {
    const msg = String(err.sqlMessage || '');
    if (msg.includes('fk_linea_cliente'))   return new AppError('El cliente indicado no existe', 400);
    if (msg.includes('fk_linea_proveedor')) return new AppError('El proveedor indicado no existe', 400);
    if (msg.includes('fk_linea_origen'))    return new AppError('La linea de origen no existe', 400);
    if (msg.includes('fk_linea_tienda'))    return new AppError('La tienda indicada no existe', 400);
    return new AppError('Referencia invalida (clave foranea)', 400);
  }
  return err;
}

async function list(query = {}) {
  let orderByExpr = SORT_EXPRESSIONS.id;
  if (query.orderBy !== undefined) {
    if (!SORT_EXPRESSIONS[query.orderBy]) {
      throw new AppError(`orderBy no valido. Permitidos: ${Object.keys(SORT_EXPRESSIONS).join(', ')}`, 400);
    }
    orderByExpr = SORT_EXPRESSIONS[query.orderBy];
  }
  const orderDir = String(query.order || '').toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  if (query.vista === 'moviles_en_tienda') {
    return repo.findMovilesEnTienda(orderByExpr, orderDir);
  }

  const filters = buildFilters(query);
  return repo.findAll(filters, orderByExpr, orderDir);
}

async function get(id) {
  const linea = await repo.findById(id);
  if (!linea) throw new AppError(`Linea ${id} no encontrada`, 404);
  return linea;
}

async function create(payload) {
  const data    = pick(payload);
  const missing = REQUIRED_ON_CREATE.filter(f => data[f] === undefined || data[f] === null);
  if (missing.length > 0) throw new AppError(`Campos obligatorios: ${missing.join(', ')}`, 400);
  let id;
  try { id = await repo.create(data); } catch (err) { throw handleFkError(err); }
  const linea = await repo.findById(id);
  await historialRepo.log(id, { fase: linea.fase, avisado: linea.avisado, movil_en_tienda: linea.movil_en_tienda });
  return linea;
}

async function update(id, payload) {
  const previa = await get(id);
  const data   = pick(payload);
  if (Object.keys(data).length === 0) throw new AppError('No hay campos validos para actualizar', 400);
  try { await repo.update(id, data); } catch (err) { throw handleFkError(err); }

  const linea = await repo.findById(id);
  const cambio = linea.fase !== previa.fase || linea.avisado !== previa.avisado || linea.movil_en_tienda !== previa.movil_en_tienda;
  if (cambio) {
    await historialRepo.log(id, { fase: linea.fase, avisado: linea.avisado, movil_en_tienda: linea.movil_en_tienda });
  }
  return { ...linea};
}

async function remove(id) {
  await get(id);
  await repo.remove(id);
}

module.exports = { list, get, create, update, remove };

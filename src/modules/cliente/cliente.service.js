const AppError = require('../../utils/AppError');
const repo = require('./cliente.repository');

const ALLOWED_FIELDS = ['nombre', 'telefono'];
const REQUIRED_ON_CREATE = ['nombre'];

function pick(payload) {
  const out = {};
  for (const key of ALLOWED_FIELDS) {
    if (payload[key] !== undefined) out[key] = payload[key];
  }
  return out;
}

// Traduce el error de telefono duplicado de MariaDB a un 409 claro
function handleDuplicate(err, telefono) {
  if (err.code === 'ER_DUP_ENTRY') {
    return new AppError(`Ya existe un cliente con el telefono ${telefono}`, 409);
  }
  return err;
}

async function list(query = {}) {
  const search =
    query.q && String(query.q).trim() !== '' ? String(query.q).trim() : null;
  return repo.findAll(search);
}

async function get(id) {
  const cliente = await repo.findById(id);
  if (!cliente) throw new AppError(`Cliente ${id} no encontrado`, 404);
  return cliente;
}

async function create(payload) {
  const data = pick(payload);
  const missing = REQUIRED_ON_CREATE.filter((f) => !data[f]);
  if (missing.length > 0) {
    throw new AppError(`Campos obligatorios: ${missing.join(', ')}`, 400);
  }
  try {
    const id = await repo.create(data);
    return repo.findById(id);
  } catch (err) {
    throw handleDuplicate(err, data.telefono);
  }
}

async function update(id, payload) {
  await get(id); // 404 si no existe
  const data = pick(payload);
  if (Object.keys(data).length === 0) {
    throw new AppError('No hay campos validos para actualizar', 400);
  }
  try {
    await repo.update(id, data);
    return repo.findById(id);
  } catch (err) {
    throw handleDuplicate(err, data.telefono);
  }
}

async function remove(id) {
  await get(id); // 404 si no existe
  const total = await repo.countLineas(id);
  if (total > 0) {
    throw new AppError(
      `No se puede borrar: el cliente tiene ${total} reparacion(es) asociada(s)`,
      409,
    );
  }
  await repo.remove(id);
}

module.exports = { list, get, create, update, remove };

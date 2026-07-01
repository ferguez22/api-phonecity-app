const repo = require('./taller.repository');

async function consulta() {
  return repo.findConsulta();
}

module.exports = { consulta };
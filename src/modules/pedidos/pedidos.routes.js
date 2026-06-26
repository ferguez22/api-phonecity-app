const express = require('express');
const controller = require('./pedidos.controller');

const router = express.Router();

router.get('/pendientes', controller.pendientes);
router.post('/marcar-pedido', controller.marcarPedido);

module.exports = router;
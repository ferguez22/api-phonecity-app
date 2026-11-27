const express = require('express');
const controller = require('./pedidos.controller');

const router = express.Router();

router.get('/pendientes', controller.pendientes);
router.post('/marcar-pedido', controller.marcarPedido);
router.get('/historial/dias', controller.historialDias);
router.get('/historial/:fecha', controller.historialDia);

module.exports = router;
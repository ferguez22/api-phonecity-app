const express = require('express');
const controller = require('./linea.controller');
const credencialesRoutes = require('../credenciales/credenciales.routes');

const router = express.Router();

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

// Credenciales anidadas bajo la linea (1:1)
router.use('/:id/credenciales', credencialesRoutes);

module.exports = router;

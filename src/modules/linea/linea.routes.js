const express = require('express');
const controller = require('./linea.controller');
const credencialesRoutes = require('../credenciales/credenciales.routes');
const historialRoutes = require('../historial/historial.routes');

const router = express.Router();

router.get('/', controller.list);
router.get('/:id', controller.get);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.remove);

// Sub-recursos anidados bajo la linea
router.use('/:id/credenciales', credencialesRoutes);
router.use('/:id/historial', historialRoutes);

module.exports = router;

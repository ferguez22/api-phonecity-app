const express = require('express');
const controller = require('./historial.controller');

// mergeParams: acceso a :id de la linea padre (/api/lineas/:id/historial)
const router = express.Router({ mergeParams: true });

router.get('/', controller.get);

module.exports = router;

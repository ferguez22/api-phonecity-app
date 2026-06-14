const express = require('express');
const controller = require('./credenciales.controller');

// mergeParams: true -> acceso a :id de la linea padre (/api/lineas/:id/credenciales)
const router = express.Router({ mergeParams: true });

router.get('/', controller.get);
router.put('/', controller.upsert); // upsert (crea o actualiza)
router.delete('/', controller.remove);

module.exports = router;

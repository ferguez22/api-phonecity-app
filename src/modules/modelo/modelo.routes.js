const express = require('express');
const controller = require('./modelo.controller');

const router = express.Router();

router.get('/distintos', controller.distintos);
router.post('/normalizar', controller.normalizar);
router.get('/lotes', controller.lotes);
router.get('/lotes/:lote', controller.lote);
router.post('/lotes/:lote/deshacer', controller.deshacer);

module.exports = router;

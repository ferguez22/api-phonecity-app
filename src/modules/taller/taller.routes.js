const express = require('express');
const controller = require('./taller.controller');

const router = express.Router();

router.get('/consulta', controller.consulta);

module.exports = router;
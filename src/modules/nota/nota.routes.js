const express = require('express');
const controller = require('./nota.controller');

const router = express.Router();

router.get('/', controller.list);
router.post('/', controller.create);
router.put('/:id', controller.update);

module.exports = router;
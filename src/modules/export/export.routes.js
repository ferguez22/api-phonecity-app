const express = require('express');
const controller = require('./export.controller');

const router = express.Router();

function checkExportToken(req, res, next) {
  const token = req.headers['x-export-token'];
  if (!process.env.EXPORT_TOKEN || token !== process.env.EXPORT_TOKEN) {
    return res.status(401).json({
      success: false,
      data: null,
      error: { message: 'No autorizado' },
    });
  }
  next();
}

router.get('/sheet', checkExportToken, controller.exportSheet);

module.exports = router;

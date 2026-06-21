const express = require('express');
const multer = require('multer');
const protect = require('../../middlewares/protect');
const controller = require('./import.controller');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const okMime = file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';
    const okExt = file.originalname.toLowerCase().endsWith('.csv');
    if (okMime || okExt) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos .csv'));
    }
  },
});

const router = express.Router();

router.post('/csv/preview', protect, upload.single('file'), controller.preview);
router.post('/csv/execute', protect, upload.single('file'), controller.execute);

module.exports = router;

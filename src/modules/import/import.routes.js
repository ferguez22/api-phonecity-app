const express = require('express');
const multer = require('multer');
const protect = require('../../middlewares/protect');
const requireRole = require('../../middlewares/requireRole');
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

router.use(protect, requireRole('admin'));

router.get('/conteo', controller.conteo);
router.post('/csv/preview', upload.single('file'), controller.preview);
router.post('/csv/execute', upload.single('file'), controller.execute);

module.exports = router;

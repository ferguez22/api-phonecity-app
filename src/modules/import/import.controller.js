const { parseCsv, analyze, executeImport } = require('./import.service');

async function preview(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, data: null, error: { message: 'Falta el archivo CSV' } });
    }
    const records = parseCsv(req.file.buffer);
    const data = await analyze(records);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

async function execute(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, data: null, error: { message: 'Falta el archivo CSV' } });
    }
    const records = parseCsv(req.file.buffer);
    const data = await executeImport(records);
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { preview, execute };

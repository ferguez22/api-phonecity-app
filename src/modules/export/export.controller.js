const { getSheetExport } = require('./export.service');

async function exportSheet(req, res, next) {
  try {
    const data = await getSheetExport();
    res.json({ success: true, data, error: null });
  } catch (err) {
    next(err);
  }
}

module.exports = { exportSheet };

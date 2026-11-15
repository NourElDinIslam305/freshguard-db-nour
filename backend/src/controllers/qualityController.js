const queries = require('../db/queries');
const {
  AppError, boundedLimit, boundedOffset, dateText, optionalText, positiveId
} = require('../middleware/validate');

function listDefects(req, res) {
  const from = dateText(req.query.from, 'from', true);
  const to = dateText(req.query.to, 'to', true);
  const productType = optionalText(req.query.product_type, 'product_type');
  const defects = queries.getDefects({
    from, to, productType, limit: boundedLimit(req.query.limit, 100, 1000)
  }).map((row) => ({
    ...row,
    image_url: row.image_path
      ? `${req.protocol}://${req.get('host')}${row.image_path}`
      : null
  }));
  res.json({ defects });
}

function listAlerts(req, res) {
  res.json({ alerts: queries.getAlerts({ unread: false }) });
}

function listNeedsReview(req, res) {
  const inspections = queries.getNeedsReview({
    limit: boundedLimit(req.query.limit, 100, 1000),
    offset: boundedOffset(req.query.offset)
  }).map((row) => ({
    ...row,
    image_url: row.image_path
      ? `${req.protocol}://${req.get('host')}${row.image_path}`
      : null
  }));
  res.json({ inspections });
}

function readAlert(req, res) {
  const id = positiveId(req.params.id, 'id');
  if (!queries.markAlertRead(id)) throw new AppError(404, 'Alert not found');
  res.json({ id, is_read: true });
}

function defectsByType(req, res) {
  const from = dateText(req.query.from, 'from', true);
  const to = dateText(req.query.to, 'to', true);
  res.json({ defects_by_type: queries.getDefectsByType({ from, to }) });
}

function getInspection(req, res) {
  const id = positiveId(req.params.id, 'id');
  const inspection = queries.getInspection(id);
  if (!inspection) throw new AppError(404, 'Inspection not found');
  res.json({
    inspection: {
      ...inspection,
      image_url: inspection.image_path
        ? `${req.protocol}://${req.get('host')}${inspection.image_path}`
        : null
    }
  });
}

module.exports = {
  listDefects, listAlerts, listNeedsReview, readAlert, defectsByType, getInspection
};

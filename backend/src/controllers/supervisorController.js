const queries = require('../db/queries');
const { AppError, boundedLimit, positiveInteger } = require('../middleware/validate');

function listInspections(req, res) {
  const lineId = positiveInteger(req.query.line_id, 'line_id', true);
  const inspections = queries.getLatestInspections({
    limit: boundedLimit(req.query.limit),
    lineId
  });
  res.json({ inspections });
}

function currentBatch(req, res) {
  const lineId = positiveInteger(req.query.line_id, 'line_id', true);
  const batch = queries.getOpenBatch(lineId);
  if (!batch) return res.json({ batch: null, total: 0, good: 0, defective: 0, defect_rate: 0 });
  const stats = queries.getBatchInspectionStats(batch.id);
  res.json({
    batch,
    total: stats.total,
    good: stats.good || 0,
    defective: stats.defective || 0,
    defect_rate: stats.total ? (stats.defective || 0) / stats.total : 0
  });
}

function listAlerts(req, res) {
  if (req.query.unread !== undefined && !['true', 'false'].includes(req.query.unread)) {
    throw new AppError(400, 'unread must be true or false');
  }
  res.json({ alerts: queries.getAlerts({ unread: req.query.unread === 'true' }) });
}

module.exports = { listInspections, currentBatch, listAlerts };

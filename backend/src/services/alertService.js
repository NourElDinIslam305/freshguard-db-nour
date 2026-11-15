const queries = require('../db/queries');

const MINIMUM_INSPECTIONS = 50;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

function checkNeedsReview(inspectionId, inspection) {
  if (!inspection.needs_review ||
      queries.hasNeedsReviewAlert(inspectionId, inspection.product_type)) {
    return null;
  }
  return queries.createAlert({
    batchId: inspection.batch_id,
    type: 'needs_review',
    message: `Inspection #${inspectionId} (${inspection.product_type}) requires review.`,
    defectRate: null,
    createdAt: new Date().toISOString()
  });
}

function checkBatch(batchId) {
  const stats = queries.getBatchInspectionStats(batchId);
  if (stats.total < MINIMUM_INSPECTIONS) return null;

  const defectRate = stats.defective / stats.total;
  const threshold = Number(process.env.DEFECT_RATE_THRESHOLD ?? 0.2);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    throw new Error('DEFECT_RATE_THRESHOLD must be a number between 0 and 1');
  }
  if (defectRate <= threshold) return null;

  const now = new Date();
  const since = new Date(now.getTime() - DUPLICATE_WINDOW_MS).toISOString();
  if (queries.hasRecentBatchAlert(batchId, since)) return null;

  return queries.createAlert({
    batchId,
    type: 'defect_rate',
    message: `Batch ${batchId} defect rate is ${(defectRate * 100).toFixed(1)}%.`,
    defectRate,
    createdAt: now.toISOString()
  });
}

module.exports = { checkBatch, checkNeedsReview };

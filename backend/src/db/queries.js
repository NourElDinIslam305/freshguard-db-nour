const db = require('./connection');

const TABLES = [
  'batches',
  'inspections',
  'alerts',
  'production_records',
  'waste_records',
  'costs',
  'revenue',
  'agent_logs'
];

function mapInspection(row) {
  if (!row) return row;
  return { ...row, needs_review: Boolean(row.needs_review) };
}

function mapInspections(rows) {
  return rows.map(mapInspection);
}

function getMissingTables() {
  const exists = db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?"
  );
  return TABLES.filter((table) => !exists.get(table));
}

function getHealth() {
  return db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM batches) AS batches,
      (SELECT COUNT(*) FROM inspections) AS inspections,
      (SELECT COUNT(*) FROM alerts) AS alerts,
      (SELECT COUNT(*) FROM production_records) AS production_records,
      (SELECT COUNT(*) FROM waste_records) AS waste_records,
      (SELECT COUNT(*) FROM costs) AS costs,
      (SELECT COUNT(*) FROM revenue) AS revenue,
      (SELECT COUNT(*) FROM agent_logs) AS agent_logs
  `).get();
}

function getOpenBatch(lineId) {
  return db.prepare(`
    SELECT * FROM batches
    WHERE status = 'open' AND (? IS NULL OR line_id = ?)
    ORDER BY started_at DESC LIMIT 1
  `).get(lineId ?? null, lineId ?? null);
}

function createBatch({ name, productType, lineId, startedAt }) {
  const result = db.prepare(`
    INSERT INTO batches (name, product_type, line_id, started_at, status)
    VALUES (?, ?, ?, ?, 'open')
  `).run(name, productType, lineId, startedAt);
  return Number(result.lastInsertRowid);
}

function getBatchById(id) {
  return db.prepare('SELECT * FROM batches WHERE id = ?').get(id);
}

function insertInspection(inspection) {
  const result = db.prepare(`
    INSERT INTO inspections
      (batch_id, product_type, status, confidence, defect_type, line_id, image_path, captured_at,
       size_category, needs_review, model_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    inspection.batch_id,
    inspection.product_type,
    inspection.status,
    inspection.confidence,
    inspection.defect_type || null,
    inspection.line_id,
    inspection.image_path || null,
    inspection.captured_at,
    inspection.size_category,
    inspection.needs_review,
    inspection.model_version
  );
  return Number(result.lastInsertRowid);
}

function insertInspectionBatch(items) {
  const insert = db.transaction((rows) => rows.map((row) => insertInspection(row)));
  return insert(items);
}

function getBatchInspectionStats(batchId) {
  return db.prepare(`
    SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'good' THEN 1 ELSE 0 END) AS good,
      SUM(CASE WHEN status = 'defective' THEN 1 ELSE 0 END) AS defective
    FROM inspections WHERE batch_id = ?
  `).get(batchId);
}

function hasRecentBatchAlert(batchId, since) {
  return Boolean(db.prepare(`
    SELECT 1 FROM alerts
    WHERE batch_id = ? AND type = 'defect_rate' AND created_at >= ?
    LIMIT 1
  `).get(batchId, since));
}

function createAlert({ batchId, type, message, defectRate, createdAt }) {
  const result = db.prepare(`
    INSERT INTO alerts (batch_id, type, message, defect_rate, is_read, created_at)
    VALUES (?, ?, ?, ?, 0, ?)
  `).run(batchId, type, message, defectRate, createdAt);
  return Number(result.lastInsertRowid);
}

function hasNeedsReviewAlert(inspectionId, productType) {
  return Boolean(db.prepare(`
    SELECT 1 FROM alerts
    WHERE type = 'needs_review' AND message = ?
    LIMIT 1
  `).get(`Inspection #${inspectionId} (${productType}) requires review.`));
}

function getLatestInspections({ limit, lineId }) {
  return mapInspections(db.prepare(`
    SELECT * FROM inspections
    WHERE (? IS NULL OR line_id = ?)
    ORDER BY captured_at DESC LIMIT ?
  `).all(lineId ?? null, lineId ?? null, limit));
}

function getAlerts({ unread }) {
  return db.prepare(`
    SELECT * FROM alerts
    WHERE (? = 0 OR is_read = 0)
    ORDER BY created_at DESC
  `).all(unread ? 1 : 0);
}

function markAlertRead(id) {
  return db.prepare('UPDATE alerts SET is_read = 1 WHERE id = ?').run(id).changes;
}

function getDefects({ from, to, productType, limit }) {
  return mapInspections(db.prepare(`
    SELECT * FROM inspections
    WHERE status = 'defective'
      AND (? IS NULL OR captured_at >= ?)
      AND (? IS NULL OR captured_at <= ?)
      AND (? IS NULL OR product_type = ?)
    ORDER BY captured_at DESC LIMIT ?
  `).all(from || null, from || null, to || null, to || null,
    productType || null, productType || null, limit));
}

function getNeedsReview({ limit, offset }) {
  return mapInspections(db.prepare(`
    SELECT * FROM inspections
    WHERE needs_review = 1
    ORDER BY captured_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset));
}

function getDefectsByType({ from, to }) {
  return db.prepare(`
    SELECT defect_type, COUNT(*) AS count
    FROM inspections
    WHERE status = 'defective'
      AND (? IS NULL OR captured_at >= ?)
      AND (? IS NULL OR captured_at <= ?)
    GROUP BY defect_type ORDER BY count DESC
  `).all(from || null, from || null, to || null, to || null);
}

function getInspection(id) {
  return mapInspection(db.prepare('SELECT * FROM inspections WHERE id = ?').get(id));
}

function getSummary({ from, to }) {
  const statement = db.prepare(`
    SELECT
      (SELECT COALESCE(SUM(quantity), 0) FROM production_records
        WHERE (? IS NULL OR recorded_at >= ?) AND (? IS NULL OR recorded_at <= ?)) AS production,
      (SELECT COALESCE(SUM(quantity), 0) FROM waste_records
        WHERE (? IS NULL OR recorded_at >= ?) AND (? IS NULL OR recorded_at <= ?)) AS waste,
      (SELECT COALESCE(SUM(amount), 0) FROM costs
        WHERE (? IS NULL OR recorded_at >= ?) AND (? IS NULL OR recorded_at <= ?)) AS costs,
      (SELECT COALESCE(SUM(amount), 0) FROM revenue
        WHERE (? IS NULL OR recorded_at >= ?) AND (? IS NULL OR recorded_at <= ?)) AS revenue
  `);
  const args = [from || null, from || null, to || null, to || null];
  return statement.get(...args, ...args, ...args, ...args);
}

function getDailyProduction(date) {
  return db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS production FROM production_records
    WHERE date(recorded_at) = date(?)
  `).get(date).production;
}

function getDailyWaste(date) {
  return db.prepare(`
    SELECT COALESCE(SUM(quantity), 0) AS waste FROM waste_records
    WHERE date(recorded_at) = date(?)
  `).get(date).waste;
}

function getDailyCosts(date) {
  return db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS costs FROM costs
    WHERE date(recorded_at) = date(?)
  `).get(date).costs;
}

function getDailyRevenue(date) {
  return db.prepare(`
    SELECT COALESCE(SUM(amount), 0) AS revenue FROM revenue
    WHERE date(recorded_at) = date(?)
  `).get(date).revenue;
}

function getProductionTrend(from) {
  return db.prepare(`
    SELECT date(recorded_at) AS date, SUM(quantity) AS production
    FROM production_records WHERE date(recorded_at) >= date(?)
    GROUP BY date(recorded_at)
  `).all(from);
}

function getWasteTrend(from) {
  return db.prepare(`
    SELECT date(recorded_at) AS date, SUM(quantity) AS waste
    FROM waste_records WHERE date(recorded_at) >= date(?)
    GROUP BY date(recorded_at)
  `).all(from);
}

function getFinancialTrend(from) {
  return db.prepare(`
    SELECT dates.date,
      COALESCE(rev.amount, 0) - COALESCE(cost.amount, 0) AS profit
    FROM (
      SELECT date(recorded_at) AS date FROM revenue WHERE date(recorded_at) >= date(?)
      UNION
      SELECT date(recorded_at) AS date FROM costs WHERE date(recorded_at) >= date(?)
    ) AS dates
    LEFT JOIN (
      SELECT date(recorded_at) AS date, SUM(amount) AS amount
      FROM revenue WHERE date(recorded_at) >= date(?) GROUP BY date(recorded_at)
    ) AS rev ON rev.date = dates.date
    LEFT JOIN (
      SELECT date(recorded_at) AS date, SUM(amount) AS amount
      FROM costs WHERE date(recorded_at) >= date(?) GROUP BY date(recorded_at)
    ) AS cost ON cost.date = dates.date
    ORDER BY dates.date
  `).all(from, from, from, from);
}

function insertProduction({ batchId, quantity, recordedAt }) {
  return Number(db.prepare(`
    INSERT INTO production_records (batch_id, quantity, recorded_at) VALUES (?, ?, ?)
  `).run(batchId, quantity, recordedAt).lastInsertRowid);
}

function insertWaste({ batchId, quantity, reason, recordedAt }) {
  return Number(db.prepare(`
    INSERT INTO waste_records (batch_id, quantity, reason, recorded_at) VALUES (?, ?, ?, ?)
  `).run(batchId, quantity, reason, recordedAt).lastInsertRowid);
}

function insertCost({ batchId, amount, category, recordedAt }) {
  return Number(db.prepare(`
    INSERT INTO costs (batch_id, amount, category, recorded_at) VALUES (?, ?, ?, ?)
  `).run(batchId, amount, category, recordedAt).lastInsertRowid);
}

function insertRevenue({ batchId, amount, recordedAt }) {
  return Number(db.prepare(`
    INSERT INTO revenue (batch_id, amount, recorded_at) VALUES (?, ?, ?)
  `).run(batchId, amount, recordedAt).lastInsertRowid);
}

function getInspectionOverviewStats() {
  return db.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status = 'defective' THEN 1 ELSE 0 END), 0) AS defective
    FROM inspections
  `).get();
}

function getLatestAlerts() {
  return db.prepare(`
    SELECT id, type, message, defect_rate, created_at FROM alerts
    ORDER BY created_at DESC LIMIT 5
  `).all();
}

function getOverview() {
  return {
    counts: getHealth(),
    inspections: getInspectionOverviewStats(),
    latest_alerts: getLatestAlerts(),
    open_batch: getOpenBatch(null) || null
  };
}

function queryInspections({ from, to, productType, lineId, limit }) {
  return mapInspections(db.prepare(`
    SELECT * FROM inspections
    WHERE (? IS NULL OR captured_at >= ?)
      AND (? IS NULL OR captured_at <= ?)
      AND (? IS NULL OR product_type = ?)
      AND (? IS NULL OR line_id = ?)
    ORDER BY captured_at DESC LIMIT ?
  `).all(from || null, from || null, to || null, to || null,
    productType || null, productType || null, lineId ?? null, lineId ?? null, limit));
}

function queryStats({ from, to, productType, lineId }) {
  return db.prepare(`
    SELECT COUNT(*) AS total,
      COALESCE(SUM(CASE WHEN status = 'good' THEN 1 ELSE 0 END), 0) AS good,
      COALESCE(SUM(CASE WHEN status = 'defective' THEN 1 ELSE 0 END), 0) AS defective,
      AVG(confidence) AS average_confidence
    FROM inspections
    WHERE (? IS NULL OR captured_at >= ?)
      AND (? IS NULL OR captured_at <= ?)
      AND (? IS NULL OR product_type = ?)
      AND (? IS NULL OR line_id = ?)
  `).get(from || null, from || null, to || null, to || null,
    productType || null, productType || null, lineId ?? null, lineId ?? null);
}

function insertAgentLog({ question, answer, createdAt }) {
  return Number(db.prepare(`
    INSERT INTO agent_logs (question, answer, created_at) VALUES (?, ?, ?)
  `).run(question, answer, createdAt).lastInsertRowid);
}

function getAgentLogs(limit) {
  return db.prepare('SELECT * FROM agent_logs ORDER BY created_at DESC LIMIT ?').all(limit);
}

function getTestDataCleanupInfo(modelVersion) {
  const inspections = db.prepare(`
    SELECT id, image_path, product_type
    FROM inspections
    WHERE model_version = ?
  `).all(modelVersion);
  const findAlert = db.prepare(`
    SELECT id FROM alerts
    WHERE type = 'needs_review' AND message = ?
  `);
  const alerts = inspections.flatMap((inspection) =>
    findAlert.all(`Inspection #${inspection.id} (${inspection.product_type}) requires review.`)
  );
  return { inspections, alerts };
}

function deleteTestData(modelVersion) {
  const { inspections, alerts } = getTestDataCleanupInfo(modelVersion);
  const deleteRows = db.transaction(() => {
    const deleteAlert = db.prepare('DELETE FROM alerts WHERE id = ?');
    const deleteInspection = db.prepare('DELETE FROM inspections WHERE id = ?');
    for (const alert of alerts) deleteAlert.run(alert.id);
    for (const inspection of inspections) deleteInspection.run(inspection.id);
  });
  deleteRows();
  return {
    inspectionsRemoved: inspections.length,
    alertsRemoved: alerts.length,
    imagePaths: inspections.map((inspection) => inspection.image_path).filter(Boolean)
  };
}

function closeDatabase() {
  db.close();
}

module.exports = {
  getMissingTables, getHealth, getOpenBatch, createBatch, getBatchById,
  insertInspection, insertInspectionBatch, getBatchInspectionStats,
  hasRecentBatchAlert, createAlert, hasNeedsReviewAlert, getLatestInspections,
  getAlerts, markAlertRead, getDefects, getNeedsReview,
  getDefectsByType, getInspection, getSummary,
  getDailyProduction, getDailyWaste, getDailyCosts, getDailyRevenue,
  getProductionTrend, getWasteTrend, getFinancialTrend, insertProduction,
  insertWaste, insertCost, insertRevenue, getOverview, queryInspections,
  queryStats, insertAgentLog, getAgentLogs, getTestDataCleanupInfo,
  deleteTestData, closeDatabase
};

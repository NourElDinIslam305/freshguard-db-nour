const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const queries = require('../db/queries');
const alertService = require('../services/alertService');
const { AppError, inspectionInput } = require('../middleware/validate');

function resolveBatch(inspection) {
  if (inspection.batch_id) {
    if (!queries.getBatchById(inspection.batch_id)) {
      throw new AppError(400, `batch_id ${inspection.batch_id} does not exist`);
    }
    return inspection.batch_id;
  }
  const openBatch = queries.getOpenBatch(inspection.line_id);
  if (openBatch) return openBatch.id;
  return queries.createBatch({
    name: `Line ${inspection.line_id} ${inspection.captured_at}`,
    productType: inspection.product_type,
    lineId: inspection.line_id,
    startedAt: inspection.captured_at
  });
}

function saveImage(file) {
  if (!file) return null;
  const extension = path.extname(file.originalname).toLowerCase();
  const fileName = `${randomUUID()}${extension}`;
  const uploadDirectory = path.resolve(process.cwd(), 'uploads');
  fs.mkdirSync(uploadDirectory, { recursive: true });
  fs.writeFileSync(path.join(uploadDirectory, fileName), file.buffer);
  return `/uploads/${fileName}`;
}

function createInspection(req, res) {
  const inspection = inspectionInput(req.body);
  inspection.batch_id = resolveBatch(inspection);
  inspection.image_path = saveImage(req.file);
  const id = queries.insertInspection(inspection);
  alertService.checkNeedsReview(id, inspection);
  alertService.checkBatch(inspection.batch_id);
  res.status(201).json({ id });
}

function createInspectionBatch(req, res) {
  const items = Array.isArray(req.body) ? req.body : req.body && req.body.inspections;
  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError(400, 'inspections must be a non-empty array');
  }
  const inspections = items.map((item) => inspectionInput(item));
  for (const inspection of inspections) inspection.batch_id = resolveBatch(inspection);
  const ids = queries.insertInspectionBatch(inspections);
  for (let index = 0; index < inspections.length; index++) {
    alertService.checkNeedsReview(ids[index], inspections[index]);
    alertService.checkBatch(inspections[index].batch_id);
  }
  res.status(201).json({ ids, count: ids.length });
}

module.exports = { createInspection, createInspectionBatch };

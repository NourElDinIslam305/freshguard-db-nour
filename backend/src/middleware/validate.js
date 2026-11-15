class AppError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(400, `${label} must be an object`);
  }
}

function requiredText(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new AppError(400, `${field} is required and must be text`);
  }
  return value.trim();
}

function optionalText(value, field) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new AppError(400, `${field} must be text`);
  return value.trim() || null;
}

function positiveId(value, field) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(400, `${field} must be a positive integer`);
  }
  return parsed;
}

function positiveInteger(value, field, optional = false) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  const isIntegerString = typeof value === 'string' && /^\d+$/.test(value);
  if ((typeof value !== 'number' && !isIntegerString) ||
      !Number.isSafeInteger(Number(value)) || Number(value) < 1) {
    throw new AppError(400, `${field} must be a positive integer`);
  }
  return Number(value);
}

function needsReviewValue(value) {
  if (value === undefined) return 0;
  if (value === true || value === 'true' || value === '1') return 1;
  if (value === false || value === 'false' || value === '0') return 0;
  throw new AppError(400, "needs_review must be true, false, '1', or '0'");
}

function sizeCategoryValue(value) {
  if (value === undefined || value === null) return null;
  if (!['small', 'medium', 'large'].includes(value)) {
    throw new AppError(400, "size_category must be 'small', 'medium', or 'large'");
  }
  return value;
}

function modelVersionValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new AppError(400, 'model_version must be text');
  }
  const version = value.trim();
  if (version.length > 50) {
    throw new AppError(400, 'model_version must be 50 characters or fewer');
  }
  return version || null;
}

function finiteNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  if (typeof value !== 'number' && typeof value !== 'string') {
    throw new AppError(400, `${field} must be a number between ${min} and ${max}`);
  }
  const parsed = Number(value);
  if (value === undefined || value === null || value === '' ||
      !Number.isFinite(parsed) || parsed < min || parsed > max) {
    throw new AppError(400, `${field} must be a number between ${min} and ${max}`);
  }
  return parsed;
}

function dateText(value, field, optional = false) {
  if ((value === undefined || value === null || value === '') && optional) return null;
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new AppError(400, `${field} must be a valid date/time`);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) && (field === 'from' || field === 'to')) {
    return `${value}T${field === 'from' ? '00:00:00.000' : '23:59:59.999'}Z`;
  }
  return value;
}

function inspectionInput(input, imagePath = null) {
  requireObject(input, 'Inspection');
  const status = requiredText(input.status, 'status');
  if (!['good', 'defective'].includes(status)) {
    throw new AppError(400, "status must be 'good' or 'defective'");
  }
  const defectType = optionalText(input.defect_type, 'defect_type');
  if (status === 'defective' && !defectType) {
    throw new AppError(400, 'defect_type is required for defective inspections');
  }
  return {
    product_type: requiredText(input.product_type, 'product_type'),
    status,
    confidence: finiteNumber(input.confidence, 'confidence', { min: 0, max: 1 }),
    defect_type: defectType,
    line_id: positiveInteger(input.line_id, 'line_id'),
    captured_at: dateText(input.captured_at, 'captured_at'),
    batch_id: positiveId(input.batch_id, 'batch_id'),
    image_path: imagePath,
    size_category: sizeCategoryValue(input.size_category),
    needs_review: needsReviewValue(input.needs_review),
    model_version: modelVersionValue(input.model_version)
  };
}

function entryInput(input, kind) {
  requireObject(input, 'Request body');
  const result = {
    batch_id: positiveId(input.batch_id, 'batch_id'),
    quantity: undefined,
    amount: undefined,
    recordedAt: dateText(input.recorded_at || new Date().toISOString(), 'recorded_at')
  };
  if (kind === 'production' || kind === 'waste') {
    result.quantity = finiteNumber(input.quantity, 'quantity', { min: 0 });
    if (kind === 'waste') result.reason = requiredText(input.reason, 'reason');
  } else {
    result.amount = finiteNumber(input.amount, 'amount', { min: 0 });
    if (kind === 'costs') result.category = requiredText(input.category, 'category');
  }
  return result;
}

function queryFilters(query) {
  return {
    from: dateText(query.from, 'from', true),
    to: dateText(query.to, 'to', true),
    productType: optionalText(query.product_type, 'product_type'),
    lineId: positiveInteger(query.line_id, 'line_id', true)
  };
}

function boundedLimit(value, fallback = 100, max = 500) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new AppError(400, `limit must be an integer between 1 and ${max}`);
  }
  return parsed;
}

function boundedOffset(value, fallback = 0) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new AppError(400, 'offset must be a non-negative integer');
  }
  return parsed;
}

module.exports = {
  AppError, asyncHandler, requireObject, requiredText, optionalText,
  positiveId, positiveInteger, needsReviewValue, sizeCategoryValue,
  modelVersionValue, finiteNumber, dateText, inspectionInput, entryInput,
  queryFilters, boundedLimit, boundedOffset
};

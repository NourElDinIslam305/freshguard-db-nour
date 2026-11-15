const queries = require('../db/queries');
const statsService = require('../services/statsService');
const {
  AppError, dateText, entryInput
} = require('../middleware/validate');

function summary(req, res) {
  const from = dateText(req.query.from, 'from', true);
  const to = dateText(req.query.to, 'to', true);
  res.json(statsService.totals({ from, to }));
}

function dailyReport(req, res) {
  const date = dateText(req.query.date, 'date');
  res.json(statsService.dailyReport(date.slice(0, 10)));
}

function trends(req, res) {
  const days = req.query.days === undefined ? 7 : Number(req.query.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) {
    throw new AppError(400, 'days must be an integer between 1 and 365');
  }
  res.json({ trends: statsService.trends(days) });
}

function saveEntry(kind) {
  return (req, res) => {
    const input = entryInput(req.body, kind);
    if (input.batch_id && !queries.getBatchById(input.batch_id)) {
      throw new AppError(400, `batch_id ${input.batch_id} does not exist`);
    }
    const record = { ...input, batchId: input.batch_id };
    let id;
    if (kind === 'production') id = queries.insertProduction(record);
    if (kind === 'waste') id = queries.insertWaste(record);
    if (kind === 'costs') id = queries.insertCost(record);
    if (kind === 'revenue') id = queries.insertRevenue(record);
    res.status(201).json({ id });
  };
}

module.exports = { summary, dailyReport, trends, saveEntry };

const queries = require('../db/queries');
const {
  AppError, boundedLimit, dateText, queryFilters, requiredText, requireObject
} = require('../middleware/validate');

function overview(req, res) {
  res.json(queries.getOverview());
}

function inspections(req, res) {
  res.json({
    inspections: queries.queryInspections({
      ...queryFilters(req.query),
      limit: boundedLimit(req.query.limit)
    })
  });
}

function stats(req, res) {
  res.json(queries.queryStats(queryFilters(req.query)));
}

function logAgent(req, res) {
  requireObject(req.body, 'Request body');
  const question = requiredText(req.body.question, 'question');
  const answer = requiredText(req.body.answer, 'answer');
  const id = queries.insertAgentLog({ question, answer, createdAt: new Date().toISOString() });
  res.status(201).json({ id });
}

function agentLogs(req, res) {
  res.json({ logs: queries.getAgentLogs(boundedLimit(req.query.limit, 100, 500)) });
}

module.exports = { overview, inspections, stats, logAgent, agentLogs };

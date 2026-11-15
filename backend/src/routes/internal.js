const express = require('express');
const controller = require('../controllers/internalController');

const router = express.Router();
router.get('/overview', controller.overview);
router.get('/query/inspections', controller.inspections);
router.get('/query/stats', controller.stats);
router.post('/agent/log', controller.logAgent);
router.get('/agent/logs', controller.agentLogs);

module.exports = router;

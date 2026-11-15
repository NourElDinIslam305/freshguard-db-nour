const express = require('express');
const controller = require('../controllers/managerController');

const router = express.Router();
router.get('/summary', controller.summary);
router.get('/daily-report', controller.dailyReport);
router.get('/trends', controller.trends);
router.post('/production', controller.saveEntry('production'));
router.post('/waste', controller.saveEntry('waste'));
router.post('/costs', controller.saveEntry('costs'));
router.post('/revenue', controller.saveEntry('revenue'));

module.exports = router;

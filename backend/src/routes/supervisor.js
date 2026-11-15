const express = require('express');
const controller = require('../controllers/supervisorController');

const router = express.Router();
router.get('/inspections', controller.listInspections);
router.get('/current-batch', controller.currentBatch);
router.get('/alerts', controller.listAlerts);

module.exports = router;

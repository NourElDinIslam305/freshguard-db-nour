const express = require('express');
const controller = require('../controllers/qualityController');

const router = express.Router();
router.get('/defects', controller.listDefects);
router.get('/needs-review', controller.listNeedsReview);
router.get('/alerts', controller.listAlerts);
router.patch('/alerts/:id/read', controller.readAlert);
router.get('/stats/defects-by-type', controller.defectsByType);
router.get('/inspections/:id', controller.getInspection);

module.exports = router;

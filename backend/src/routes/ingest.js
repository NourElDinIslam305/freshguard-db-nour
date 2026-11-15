const express = require('express');
const multer = require('multer');
const path = require('path');
const { AppError } = require('../middleware/validate');
const controller = require('../controllers/ingestController');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter(req, file, callback) {
    const extension = path.extname(file.originalname).toLowerCase();
    const valid = ['.jpg', '.jpeg', '.png'].includes(extension) &&
      ['image/jpeg', 'image/png'].includes(file.mimetype);
    if (!valid) return callback(new AppError(400, 'Only JPG and PNG images are allowed'));
    callback(null, true);
  }
});

router.post('/inspection', upload.single('image'), controller.createInspection);
router.post('/inspections/batch', controller.createInspectionBatch);

module.exports = router;

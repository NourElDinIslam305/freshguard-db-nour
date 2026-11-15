const multer = require('multer');
const { AppError } = require('./validate');

function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  let status = error.status || 500;
  let message = error.message || 'Internal server error';
  if (error instanceof multer.MulterError) {
    status = 400;
    message = error.code === 'LIMIT_FILE_SIZE'
      ? 'Image must be 5MB or smaller'
      : 'Invalid image upload';
  } else if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    status = 400;
    message = 'Invalid JSON body';
  } else if (!(error instanceof AppError) && !error.status) {
    console.error(error);
    status = 500;
    message = 'Internal server error';
  }

  res.status(status).json({ error: message });
}

module.exports = errorHandler;

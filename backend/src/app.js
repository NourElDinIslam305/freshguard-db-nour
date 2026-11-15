const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const swaggerUi = require('swagger-ui-express');
const YAML = require('yaml');
const errorHandler = require('./middleware/errorHandler');
const { AppError } = require('./middleware/validate');

const app = express();
const swaggerPath = path.resolve(__dirname, '../docs/swagger.yaml');
const swaggerDocument = YAML.parse(fs.readFileSync(swaggerPath, 'utf8'));

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false }));
app.use('/uploads', express.static(path.resolve(process.cwd(), 'uploads')));

app.get('/health', require('./controllers/healthController').health);
app.use('/api/ingest', require('./routes/ingest'));
app.use('/api/supervisor', require('./routes/supervisor'));
app.use('/api/quality', require('./routes/quality'));
app.use('/api/manager', require('./routes/manager'));
app.use('/api/internal', require('./routes/internal'));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.use((req, res, next) => next(new AppError(404, 'Endpoint not found')));
app.use(errorHandler);

module.exports = app;

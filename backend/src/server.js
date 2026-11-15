require('dotenv').config();
const os = require('os');
const app = require('./app');
const db = require('./db/connection');
const queries = require('./db/queries');

const missingTables = queries.getMissingTables();
if (missingTables.length > 0) {
  console.error(
    `Database schema is incomplete. Missing tables: ${missingTables.join(', ')}. ` +
    'Create the required tables, then restart FreshGuard AI.'
  );
  db.close();
  process.exitCode = 1;
} else {
  const port = Number(process.env.PORT || 3000);
  const server = app.listen(port, '0.0.0.0', () => {
    const addresses = Object.values(os.networkInterfaces())
      .flat()
      .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
      .map((entry) => entry.address);
    console.log(`FreshGuard AI API listening on http://0.0.0.0:${port}`);
    console.log(`Swagger docs: http://localhost:${port}/docs`);
    console.log(`Local network IP${addresses.length === 1 ? '' : 's'}: ${
      addresses.length ? addresses.map((address) => `http://${address}:${port}`).join(', ') : 'not found'
    }`);
  });

  function shutdown() {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

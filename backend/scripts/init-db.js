require('dotenv').config();

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dataDir = path.join(root, 'data');
const schemaPath = path.join(root, 'src', 'db', 'schema.sql');

if (!fs.existsSync(schemaPath)) {
  console.error('schema.sql not found at:', schemaPath);
  process.exit(1);
}

const dbPath = path.resolve(
  process.cwd(),
  process.env.DB_PATH || path.join(dataDir, 'freshguard.db')
);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.exec(fs.readFileSync(schemaPath, 'utf8'));

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
  .all()
  .map((t) => t.name);

console.log('DB path:', dbPath);
console.log('Tables (' + tables.length + '):', tables.join(', '));
db.close();
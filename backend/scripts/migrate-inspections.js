
const db = require('../src/db/connection');

try {
  const migrate = db.transaction(() => {
    const columns = db
      .prepare('PRAGMA table_info(inspections)')
      .all()
      .map(column => column.name);

    const migrations = [
      {
        name: 'size_category',
        sql: "ALTER TABLE inspections ADD COLUMN size_category TEXT CHECK (size_category IN ('small','medium','large'))"
      },
      {
        name: 'needs_review',
        sql: 'ALTER TABLE inspections ADD COLUMN needs_review INTEGER NOT NULL DEFAULT 0 CHECK (needs_review IN (0,1))'
      },
      {
        name: 'model_version',
        sql: 'ALTER TABLE inspections ADD COLUMN model_version TEXT'
      }
    ];

    for (const migration of migrations) {
      if (!columns.includes(migration.name)) {
        db.exec(migration.sql);
        console.log('Added:', migration.name);
      } else {
        console.log('Already exists:', migration.name);
      }
    }
  });

  migrate();

  console.log('Integrity:', db.pragma('integrity_check'));
  console.log('Migration completed successfully.');
} catch (error) {
  console.error('Migration failed:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
}

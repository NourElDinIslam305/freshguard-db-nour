
const Database = require('better-sqlite3');
const { performance } = require('perf_hooks');

const db = new Database(':memory:');

try {
  db.exec(`
    CREATE TABLE batches (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    );

    CREATE TABLE inspections (
      id INTEGER PRIMARY KEY,
      batch_id INTEGER NOT NULL,
      status TEXT NOT NULL,
      captured_at TEXT NOT NULL,
      defect_type TEXT,
      FOREIGN KEY (batch_id) REFERENCES batches(id)
    );
  `);

  db.pragma('foreign_keys = ON');

  db.prepare('INSERT INTO batches (id, name) VALUES (?, ?)').run(1, 'Performance Test Batch');

  console.log('Generating 100,000 inspections...');

  const insert = db.prepare(`
    INSERT INTO inspections
    (batch_id, status, captured_at, defect_type)
    VALUES (?, ?, ?, ?)
  `);

  const insertMany = db.transaction(() => {
    for (let i = 0; i < 100000; i++) {
      const defective = i % 10 === 0;

      insert.run(
        1,
        defective ? 'defective' : 'good',
        `2026-11-${String((i % 14) + 1).padStart(2, '0')} 12:00:00`,
        defective ? 'Crack' : null
      );
    }
  });

  insertMany();

  console.log('Inserted:', db.prepare('SELECT COUNT(*) AS total FROM inspections').get().total);

  db.exec(`
    CREATE INDEX idx_test_captured_status
    ON inspections(captured_at, status);
  `);

  console.log('\nEXPLAIN QUERY PLAN:');

  const plan = db.prepare(`
    EXPLAIN QUERY PLAN
    SELECT COUNT(*)
    FROM inspections
    WHERE captured_at >= '2026-11-05'
      AND status = 'defective'
  `).all();

  console.table(plan);

  const start = performance.now();

  const result = db.prepare(`
    SELECT COUNT(*) AS total
    FROM inspections
    WHERE captured_at >= '2026-11-05'
      AND status = 'defective'
  `).get();

  const elapsed = performance.now() - start;

  console.log('\nQuery result:', result.total);
  console.log('Execution time:', elapsed.toFixed(2), 'ms');

  console.log('\nPerformance test completed successfully.');

} catch (error) {
  console.error('Performance test failed:', error.message);
  process.exitCode = 1;

} finally {
  db.close();
}

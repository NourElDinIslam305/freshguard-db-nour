
const db = require('../src/db/connection');

const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_insp_captured_status
   ON inspections(captured_at, status)`,

  `CREATE INDEX IF NOT EXISTS idx_insp_defect_type
   ON inspections(defect_type)
   WHERE status = 'defective'`,

  `CREATE INDEX IF NOT EXISTS idx_alerts_batch
   ON alerts(batch_id)`,

  `CREATE INDEX IF NOT EXISTS idx_production_batch
   ON production_records(batch_id)`,

  `CREATE INDEX IF NOT EXISTS idx_waste_batch
   ON waste_records(batch_id)`,

  `CREATE INDEX IF NOT EXISTS idx_costs_batch
   ON costs(batch_id)`,

  `CREATE INDEX IF NOT EXISTS idx_revenue_batch
   ON revenue(batch_id)`,
];

try {
  const applyIndexes = db.transaction(() => {
    for (const sql of indexes) {
      db.exec(sql);
    }
  });

  applyIndexes();

  console.log('Performance indexes applied successfully.');

  const result = db.prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'index'
      AND name LIKE 'idx_%'
    ORDER BY name
  `).all();

  console.table(result);

} catch (error) {
  console.error('Failed to apply indexes:', error.message);
  process.exitCode = 1;
} finally {
  db.close();
}

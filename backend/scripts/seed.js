
const db = require('../src/db/connection');

const seedName = 'FreshGuard Demo Batch 001';

const existing = db
  .prepare('SELECT id FROM batches WHERE name = ?')
  .get(seedName);

if (existing) {
  console.log('Demo data already exists. No new data inserted.');
  db.close();
  process.exit(0);
}

const seed = db.transaction(() => {
  // 1. Insert demo batch
  const batch = db.prepare(`
    INSERT INTO batches (name, product_type, line_id, status)
    VALUES (?, ?, ?, ?)
  `).run(seedName, 'Tomato', 1, 'closed');

  const batchId = batch.lastInsertRowid;

  // 2. Insert inspections
  const inspection = db.prepare(`
    INSERT INTO inspections
    (batch_id, product_type, status, confidence, defect_type, line_id)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  inspection.run(batchId, 'Tomato', 'good', 0.98, null, 1);
  inspection.run(batchId, 'Tomato', 'defective', 0.91, 'Bruise', 1);
  inspection.run(batchId, 'Tomato', 'good', 0.96, null, 1);

  // 3. Insert alert
  db.prepare(`
    INSERT INTO alerts (batch_id, type, message, defect_rate)
    VALUES (?, ?, ?, ?)
  `).run(
    batchId,
    'quality',
    'Defect detected in production batch',
    0.33
  );

  // 4. Insert production record
  db.prepare(`
    INSERT INTO production_records (batch_id, quantity)
    VALUES (?, ?)
  `).run(batchId, 100);

  // 5. Insert waste record
  db.prepare(`
    INSERT INTO waste_records (batch_id, quantity, reason)
    VALUES (?, ?, ?)
  `).run(batchId, 10, 'Damaged products');

  // 6. Insert cost
  db.prepare(`
    INSERT INTO costs (batch_id, amount, category)
    VALUES (?, ?, ?)
  `).run(batchId, 500, 'Raw materials');

  // 7. Insert revenue
  db.prepare(`
    INSERT INTO revenue (batch_id, amount)
    VALUES (?, ?)
  `).run(batchId, 900);

  // 8. Insert agent log
  db.prepare(`
    INSERT INTO agent_logs (question, answer)
    VALUES (?, ?)
  `).run(
    'What is the batch defect rate?',
    '1 out of 3 inspections is defective.'
  );

  return batchId;
});

try {
  const batchId = seed();

  console.log('Seed completed successfully.');
  console.log('Demo batch ID:', batchId);

} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;

} finally {
  db.close();
}


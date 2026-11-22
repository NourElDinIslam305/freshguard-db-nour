
const db = require('../src/db/connection');

const BATCHES = [
  { name: 'FreshGuard Demo Batch 001', product: 'Tomato', line: 1, count: 167, defects: 20 },
  { name: 'FreshGuard Demo Batch 002', product: 'Potato', line: 2, count: 167, defects: 20 },
  { name: 'FreshGuard Demo Batch 003', product: 'Cucumber', line: 3, count: 166, defects: 20 },
];

const defectTypes = ['Bruise', 'Rot', 'Crack', 'Discoloration'];
const sizes = ['small', 'medium', 'large'];
const modelVersion = 'freshguard-v1';

function formatDate(date) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function createInspectionDates(count, start, end) {
  const dates = [];

  for (let i = 0; i < count; i++) {
    const timestamp = randomBetween(start.getTime(), end.getTime());
    dates.push(formatDate(new Date(timestamp)));
  }

  return dates;
}

const seed = db.transaction(() => {
  // Remove only previous FreshGuard demo batches and their related records.
  const oldBatches = db.prepare(`
    SELECT id FROM batches
    WHERE name LIKE 'FreshGuard Demo Batch %'
  `).all();

  for (const batch of oldBatches) {
    const id = batch.id;

    db.prepare('DELETE FROM inspections WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM alerts WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM production_records WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM waste_records WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM costs WHERE batch_id = ?').run(id);
    db.prepare('DELETE FROM revenue WHERE batch_id = ?').run(id);
  }

  db.prepare(`
    DELETE FROM batches
    WHERE name LIKE 'FreshGuard Demo Batch %'
  `).run();

  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

  const insertBatch = db.prepare(`
    INSERT INTO batches
    (name, product_type, line_id, started_at, ended_at, status)
    VALUES (?, ?, ?, ?, ?, 'closed')
  `);

  const insertInspection = db.prepare(`
    INSERT INTO inspections
    (
      batch_id, product_type, status, confidence,
      defect_type, line_id, captured_at,
      size_category, needs_review, model_version
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertAlert = db.prepare(`
    INSERT INTO alerts (batch_id, type, message, defect_rate)
    VALUES (?, ?, ?, ?)
  `);

  const insertProduction = db.prepare(`
    INSERT INTO production_records (batch_id, quantity)
    VALUES (?, ?)
  `);

  const insertWaste = db.prepare(`
    INSERT INTO waste_records (batch_id, quantity, reason)
    VALUES (?, ?, ?)
  `);

  const insertCost = db.prepare(`
    INSERT INTO costs (batch_id, amount, category)
    VALUES (?, ?, ?)
  `);

  const insertRevenue = db.prepare(`
    INSERT INTO revenue (batch_id, amount)
    VALUES (?, ?)
  `);

  let totalInspections = 0;
  let totalDefects = 0;

  BATCHES.forEach((config, index) => {
    const periodStart = new Date(
      fourteenDaysAgo.getTime() +
      (14 * 24 * 60 * 60 * 1000 * index) / 3
    );

    const periodEnd = new Date(
      fourteenDaysAgo.getTime() +
      (14 * 24 * 60 * 60 * 1000 * (index + 1)) / 3
    );

    if (index === BATCHES.length - 1) {
      periodEnd.setTime(now.getTime());
    }

    const batchResult = insertBatch.run(
      config.name,
      config.product,
      config.line,
      formatDate(periodStart),
      formatDate(periodEnd)
    );

    const batchId = batchResult.lastInsertRowid;

    // Create exactly the required number of defective inspections.
    const statuses = [
      ...Array(config.defects).fill('defective'),
      ...Array(config.count - config.defects).fill('good'),
    ];

    // Shuffle inspection statuses.
    for (let i = statuses.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [statuses[i], statuses[j]] = [statuses[j], statuses[i]];
    }

    const dates = createInspectionDates(
      config.count,
      periodStart,
      periodEnd
    );

    for (let i = 0; i < config.count; i++) {
      const status = statuses[i];
      const defective = status === 'defective';

      insertInspection.run(
        batchId,
        config.product,
        status,
        defective ? randomBetween(0.80, 0.95) : randomBetween(0.95, 0.999),
        defective ? randomItem(defectTypes) : null,
        config.line,
        dates[i],
        randomItem(sizes),
        defective && Math.random() < 0.5 ? 1 : 0,
        modelVersion
      );
    }

    const defectRate = config.defects / config.count;
    const goodProducts = config.count - config.defects;

    insertAlert.run(
      batchId,
      'quality',
      `Quality alert: ${config.defects} defective products detected in ${config.name}`,
      defectRate
    );

    insertProduction.run(batchId, config.count);

    insertWaste.run(
      batchId,
      config.defects,
      'Damaged or defective products'
    );

    insertCost.run(
      batchId,
      config.count * 4.5,
      'Raw materials'
    );

    insertCost.run(
      batchId,
      config.count * 1.5,
      'Operations'
    );

    insertRevenue.run(
      batchId,
      goodProducts * 10
    );

    totalInspections += config.count;
    totalDefects += config.defects;
  });

  return {
    batches: BATCHES.length,
    inspections: totalInspections,
    defective: totalDefects,
    defectRate: (totalDefects / totalInspections) * 100,
  };
});

try {
  const result = seed();

  console.log('Seed completed successfully.');
  console.log('Batches:', result.batches);
  console.log('Total inspections:', result.inspections);
  console.log('Defective inspections:', result.defective);
  console.log('Defect rate:', result.defectRate.toFixed(2) + '%');

} catch (error) {
  console.error('Seed failed:', error.message);
  process.exitCode = 1;

} finally {
  db.close();
}

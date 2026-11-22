
const db = require('../src/db/connection');

function checkIntegrity() {
  const checks = [
    {
      name: 'Inspections without a valid batch',
      sql: `
        SELECT COUNT(*) AS count
        FROM inspections i
        LEFT JOIN batches b ON b.id = i.batch_id
        WHERE b.id IS NULL
      `,
    },
    {
      name: 'Negative production quantities',
      sql: `
        SELECT COUNT(*) AS count
        FROM production_records
        WHERE quantity < 0
      `,
    },
    {
      name: 'Negative waste quantities',
      sql: `
        SELECT COUNT(*) AS count
        FROM waste_records
        WHERE quantity < 0
      `,
    },
    {
      name: 'Negative costs',
      sql: `
        SELECT COUNT(*) AS count
        FROM costs
        WHERE amount < 0
      `,
    },
    {
      name: 'Negative revenue',
      sql: `
        SELECT COUNT(*) AS count
        FROM revenue
        WHERE amount < 0
      `,
    },
  ];

  let hasErrors = false;

  try {
    console.log('Starting database integrity checks...\n');

    for (const check of checks) {
      const result = db.prepare(check.sql).get();
      const passed = result.count === 0;

      console.log(
        `${passed ? 'PASS' : 'FAIL'}: ${check.name} (${result.count} issues)`
      );

      if (!passed) {
        hasErrors = true;
      }
    }

    const foreignKeyErrors = db.pragma('foreign_key_check');

    console.log(
      `${foreignKeyErrors.length === 0 ? 'PASS' : 'FAIL'}: Foreign key check (${foreignKeyErrors.length} issues)`
    );

    if (foreignKeyErrors.length > 0) {
      hasErrors = true;
      console.table(foreignKeyErrors);
    }

    if (hasErrors) {
      console.log('\nIntegrity check completed with errors.');
      process.exitCode = 1;
    } else {
      console.log('\nAll database integrity checks passed.');
    }

  } catch (error) {
    console.error('Integrity check failed:', error.message);
    process.exitCode = 1;

  } finally {
    db.close();
  }
}

checkIntegrity();

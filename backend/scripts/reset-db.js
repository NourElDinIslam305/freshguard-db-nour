
const db = require('../src/db/connection');

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('WARNING: This will delete all application data.');
console.log('Database structure and tables will remain intact.');

rl.question('Are you sure you want to reset the database? (yes/no): ', (answer) => {
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log('Reset cancelled. No data was deleted.');
    db.close();
    rl.close();
    return;
  }

  try {
    const reset = db.transaction(() => {
      const tables = [
        'agent_logs',
        'revenue',
        'costs',
        'waste_records',
        'production_records',
        'alerts',
        'inspections',
        'batches',
      ];

      for (const table of tables) {
        db.prepare(`DELETE FROM ${table}`).run();
      }

      db.pragma('foreign_key_check');
    });

    reset();

    console.log('Database reset completed successfully.');
    console.log('All application records have been deleted.');
    console.log('Database tables and indexes were preserved.');

  } catch (error) {
    console.error('Database reset failed:', error.message);
    process.exitCode = 1;

  } finally {
    db.close();
    rl.close();
  }
});

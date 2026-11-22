
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function createBackup() {
  const sourcePath = path.resolve(__dirname, '../data/freshguard.db');
  const backupDir = path.resolve(__dirname, '../data/backups');

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Database not found: ${sourcePath}`);
  }

  fs.mkdirSync(backupDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = path.join(
    backupDir,
    `freshguard-backup-${timestamp}.db`
  );

  const db = new Database(sourcePath, { readonly: true });

  try {
    await db.backup(backupPath);
  } finally {
    db.close();
  }

  const backupDb = new Database(backupPath, { readonly: true });

  try {
    const result = backupDb.pragma('integrity_check');

    if (result[0].integrity_check !== 'ok') {
      throw new Error('Backup integrity check failed.');
    }
  } finally {
    backupDb.close();
  }

  console.log('Backup created successfully.');
  console.log('Location:', backupPath);
  console.log('Integrity check: OK');
}

createBackup().catch((error) => {
  console.error('Backup failed:', error.message);
  process.exitCode = 1;
});

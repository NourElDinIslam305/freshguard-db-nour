require('dotenv').config();

const fs = require('fs');
const path = require('path');

const dbPath = path.resolve(process.cwd(), process.env.DB_PATH || './data/freshguard.db');
console.log(`Database: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error('Database file does not exist; refusing to create or clean a new database.');
  process.exitCode = 1;
} else {
  const queries = require('../src/db/queries');
  const uploadDirectory = path.resolve(process.cwd(), 'uploads');
  const confirmation = process.argv.includes('--yes');

  function getImageFiles(imagePaths) {
    const files = new Set();
    for (const imagePath of imagePaths) {
      if (typeof imagePath !== 'string' || !imagePath.startsWith('/uploads/')) continue;
      const fileName = path.basename(imagePath);
      if (!fileName || fileName === '.' || fileName === '..' ||
          imagePath !== `/uploads/${fileName}`) continue;
      const fullPath = path.resolve(uploadDirectory, fileName);
      if (fullPath.startsWith(`${uploadDirectory}${path.sep}`) && fs.existsSync(fullPath)) {
        files.add(fullPath);
      }
    }
    return [...files];
  }

  try {
    const plan = queries.getTestDataCleanupInfo('verify-script');
    const imageFiles = getImageFiles(plan.inspections.map((inspection) => inspection.image_path));

    if (!confirmation) {
      console.log(
        `Would delete ${plan.inspections.length} inspection rows, ` +
        `${plan.alerts.length} needs_review alerts, and ${imageFiles.length} image files.`
      );
    } else {
      const result = queries.deleteTestData('verify-script');
      let filesRemoved = 0;
      for (const file of getImageFiles(result.imagePaths)) {
        fs.unlinkSync(file);
        filesRemoved++;
      }
      console.log(
        `Removed ${result.inspectionsRemoved} inspection rows, ` +
        `${result.alertsRemoved} needs_review alerts, and ${filesRemoved} image files.`
      );
    }
  } finally {
    queries.closeDatabase();
  }
}

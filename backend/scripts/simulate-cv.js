require('dotenv').config();

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
const productTypes = ['tomato', 'apple', 'orange', 'potato'];
const defectTypes = ['rotten', 'bruised', 'mold'];
const sizeCategories = ['small', 'medium', 'large'];

async function sendInspection() {
  const defective = Math.random() < 0.15;
  const needsReview = Math.random() < 0.08;
  const inspection = {
    product_type: productTypes[Math.floor(Math.random() * productTypes.length)],
    status: defective ? 'defective' : 'good',
    confidence: Number((0.7 + Math.random() * 0.3).toFixed(3)),
    defect_type: defective ? defectTypes[Math.floor(Math.random() * defectTypes.length)] : null,
    line_id: 1,
    captured_at: new Date().toISOString(),
    size_category: sizeCategories[Math.floor(Math.random() * sizeCategories.length)],
    needs_review: needsReview,
    model_version: 'v1.0'
  };
  const response = await fetch(`${baseUrl}/api/ingest/inspection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inspection)
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  console.log('Inspection created:', result.id);
}

console.log(`Sending simulated inspections to ${baseUrl}`);
setInterval(() => {
  sendInspection().catch((error) => console.error('CV simulator error:', error.message));
}, 1500);

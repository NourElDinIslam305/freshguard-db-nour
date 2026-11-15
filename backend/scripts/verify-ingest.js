require('dotenv').config();

const Database = require('better-sqlite3');
const path = require('path');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const DB_PATH = path.resolve(process.cwd(), process.env.DB_PATH || './data/freshguard.db');

const sample = {
  product_type: 'tomato',
  status: 'defective',
  confidence: 0.91,
  defect_type: 'rotten',
  size_category: 'medium',
  needs_review: false,
  line_id: 1,
  captured_at: '2026-11-15T10:15:30Z',
  model_version: 'verify-script',
};

// صورة صغيرة جدا للاختبار
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

let bad = 0;

function normalize(key, value) {
  if (key === 'needs_review') return value ? 1 : 0;
  return value;
}

function compare(row) {
  console.log('\nمقارنة الحقول:');
  for (const key of Object.keys(sample)) {
    if (!(key in row)) {
      console.log(`❌ ${key}: العمود مش موجود في الجدول`);
      bad++;
      continue;
    }
    const expected = normalize(key, sample[key]);
    const actual = row[key];
    const same = String(expected) === String(actual);
    if (!same) bad++;
    console.log(`${same ? '✅' : '❌'} ${key}: اتبعت [${expected}] اتخزن [${actual}]`);
  }
}

async function postInspection(inspection) {
  const response = await fetch(`${BASE}/api/ingest/inspection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inspection)
  });
  const body = await response.json();
  console.log('JSON ->', response.status, body);
  if (response.status !== 201) {
    console.log('❌ الطلب اترفض');
    bad++;
    return null;
  }
  return body.id;
}

async function main() {
  console.log(`Reading database: ${DB_PATH}`);
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  try {
    const inspectionId = await postInspection(sample);
    if (inspectionId) {
      const row = db.prepare('SELECT * FROM inspections WHERE id = ?').get(inspectionId);
      if (!row) {
        console.log('❌ الصف مش موجود في القاعدة');
        bad++;
      } else {
        compare(row);
        const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(row.batch_id);
        console.log(batch ? `✅ الفحص مربوط بدفعة رقم ${row.batch_id}` : '❌ الفحص من غير دفعة صحيحة');
        if (!batch) bad++;
      }
    }

    const reviewSample = {
      ...sample,
      product_type: 'review-test',
      needs_review: true,
      captured_at: new Date().toISOString()
    };
    const reviewId = await postInspection(reviewSample);
    if (reviewId) {
      const alert = db.prepare(`
        SELECT 1 FROM alerts
        WHERE type = 'needs_review'
          AND message = ?
        LIMIT 1
      `).get(`Inspection #${reviewId} (${reviewSample.product_type}) requires review.`);
      console.log(alert
        ? `✅ تنبيه needs_review موجود للفحص ${reviewId}`
        : `❌ تنبيه needs_review غير موجود للفحص ${reviewId}`);
      if (!alert) bad++;
    }

    const form = new FormData();
    for (const [key, value] of Object.entries(sample)) form.append(key, String(value));
    form.append('image', new Blob([Buffer.from(PNG_B64, 'base64')], { type: 'image/png' }), 'test.png');
    const imageResponse = await fetch(`${BASE}/api/ingest/inspection`, { method: 'POST', body: form });
    const imageBody = await imageResponse.json();
    console.log('\nمع صورة ->', imageResponse.status, imageBody);
    if (imageResponse.status !== 201) {
      console.log('❌ طلب الصورة اترفض');
      bad++;
    } else {
      const row = db.prepare('SELECT * FROM inspections WHERE id = ?').get(imageBody.id);
      if (!row || !row.image_path) {
        console.log('❌ مسار الصورة مش متخزن');
        bad++;
      } else {
        const url = `${BASE}/uploads/${path.basename(row.image_path)}`;
        const image = await fetch(url);
        console.log(`${image.status === 200 ? '✅' : '❌'} الصورة بتتفتح من ${url} (${image.status})`);
        if (image.status !== 200) bad++;
      }
    }
  } finally {
    db.close();
  }

  console.log(bad ? `\n❌ فيه ${bad} مشكلة` : '\n✅ كل حاجة اتخزنت صح');
  process.exitCode = bad ? 1 : 0;
}

main().catch((error) => {
  console.error('Ingest verification failed:', error);
  process.exitCode = 1;
});
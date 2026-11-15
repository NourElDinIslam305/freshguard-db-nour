// scripts/test-all.js
const BASE = process.env.BASE_URL || 'http://localhost:3000';
let passed = 0, failed = 0;

// 1x1 PNG صغيرة لاختبار رفع الصور
const PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const list = (d) =>
  Array.isArray(d) ? d : d?.data || d?.items || d?.alerts || d?.defects || d?.inspections || d?.logs || [];

function check(name, condition) {
  condition ? passed++ : failed++;
  console.log(`${condition ? '✅' : '❌'} ${name}`);
}

async function call(name, method, path, body, { form = false, quiet = false, expect } = {}) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    if (form) opts.body = body;
    else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  let res, data;
  try {
    res = await fetch(BASE + path, opts);
    const text = await res.text();
    try { data = JSON.parse(text); } catch { data = text; }
  } catch (e) {
    failed++;
    console.log(`❌ ${name} -> cannot connect (${e.message})`);
    return { ok: false, data: null };
  }
  const ok = expect === undefined
    ? res.status >= 200 && res.status < 300
    : res.status === expect;
  ok ? passed++ : failed++;
  if (!quiet || !ok) {
    const expected = expect === undefined ? '' : ` (expected ${expect})`;
    console.log(`${ok ? '✅' : '❌'} ${name} -> ${res.status}${expected}`);
    if (!ok) console.log('   body:', JSON.stringify(data).slice(0, 400));
  }
  return { ok, status: res.status, data };
}

(async () => {
  console.log(`Testing ${BASE}\n`);

  // 1) Health
  await call('Health', 'GET', '/health');

  // 2) الموديل يبعت فحص واحد
  await call('CV: single inspection (JSON)', 'POST', '/api/ingest/inspection', {
    product_type: 'tomato', status: 'defective', confidence: 0.91,
    defect_type: 'rotten', line_id: 1, captured_at: new Date().toISOString(),
  });

  // 3) الموديل يبعت فحص مع صورة
  const form = new FormData();
  form.append('product_type', 'apple');
  form.append('status', 'defective');
  form.append('confidence', '0.88');
  form.append('defect_type', 'bruised');
  form.append('line_id', 1);
  form.append('captured_at', new Date().toISOString());
  form.append('size_category', 'medium');
  form.append('needs_review', '1');
  form.append('model_version', 'multipart-v1');
  form.append('image', new Blob([Buffer.from(PNG_B64, 'base64')], { type: 'image/png' }), 'test.png');
  const multipartInspection = await call('CV: inspection with image and optional fields (multipart)',
    'POST', '/api/ingest/inspection', form, { form: true });
  const multipartDetail = await call('Quality: multipart fields', 'GET',
    `/api/quality/inspections/${multipartInspection.data?.id}`);
  check('CV: multipart fields parsed and returned',
    multipartDetail.data?.inspection?.size_category === 'medium' &&
    multipartDetail.data?.inspection?.needs_review === true &&
    multipartDetail.data?.inspection?.model_version === 'multipart-v1');

  // 4) Validation لازم يرفض بيانات غلط
  await call('CV: invalid status returns 400', 'POST', '/api/ingest/inspection',
    { product_type: 'tomato', status: 'banana' }, { expect: 400 });
  await call('CV: invalid size_category returns 400', 'POST', '/api/ingest/inspection', {
    product_type: 'tomato', status: 'good', confidence: 0.9,
    line_id: 1, captured_at: new Date().toISOString(), size_category: 'extra-large',
  }, { expect: 400 });
  await call('CV: invalid needs_review returns 400', 'POST', '/api/ingest/inspection', {
    product_type: 'tomato', status: 'good', confidence: 0.9,
    line_id: 1, captured_at: new Date().toISOString(), needs_review: 'sometimes',
  }, { expect: 400 });
  await call('CV: numeric needs_review returns 400', 'POST', '/api/ingest/inspection', {
    product_type: 'tomato', status: 'good', confidence: 0.9,
    line_id: 1, captured_at: new Date().toISOString(), needs_review: 1,
  }, { expect: 400 });
  await call('CV: fractional line_id returns 400', 'POST', '/api/ingest/inspection', {
    product_type: 'tomato', status: 'good', confidence: 0.9,
    line_id: 1.5, captured_at: new Date().toISOString(),
  }, { expect: 400 });
  await call('Supervisor: fractional line_id filter returns 400', 'GET',
    '/api/supervisor/current-batch?line_id=1.5', undefined, { expect: 400 });
  await call('Internal: non-integer line_id filter returns 400', 'GET',
    '/api/internal/query/inspections?line_id=abc', undefined, { expect: 400 });

  const flaggedInspection = {
    product_type: 'pear',
    status: 'defective',
    defect_type: 'surface-mark',
    confidence: 0.97,
    line_id: 1,
    captured_at: new Date().toISOString(),
    size_category: 'large',
    needs_review: true,
    model_version: 'test-all-v1'
  };
  const flagged = await call('CV: inspection with review fields', 'POST',
    '/api/ingest/inspection', flaggedInspection);
  check('CV: flagged inspection created', Number.isInteger(flagged.data?.id));

  const noOptionalFields = await call('CV: inspection without optional fields', 'POST',
    '/api/ingest/inspection', {
      product_type: 'plum',
      status: 'good',
      confidence: 0.93,
      line_id: 1,
      captured_at: new Date().toISOString()
    });
  check('CV: legacy inspection created', Number.isInteger(noOptionalFields.data?.id));

  const qualityReview = await call('Quality: needs-review queue', 'GET',
    '/api/quality/needs-review?limit=10&offset=0');
  const queuedInspection = list(qualityReview.data)
    .find((inspection) => inspection.id === flagged.data?.id);
  check('Quality: queue includes flagged inspection', Boolean(queuedInspection));
  check('Quality: needs_review is boolean in queue',
    typeof queuedInspection?.needs_review === 'boolean' && queuedInspection.needs_review);
  check('Quality: new fields returned by needs-review queue',
    queuedInspection?.size_category === 'large' &&
    queuedInspection?.model_version === 'test-all-v1');

  const supervisorInspections = await call('Supervisor: inspection fields', 'GET',
    '/api/supervisor/inspections?limit=100');
  const supervisorFlagged = list(supervisorInspections.data)
    .find((inspection) => inspection.id === flagged.data?.id);
  check('Supervisor: new fields returned',
    supervisorFlagged?.size_category === 'large' &&
    supervisorFlagged?.needs_review === true &&
    supervisorFlagged?.model_version === 'test-all-v1');

  const qualityInspection = await call('Quality: inspect flagged item', 'GET',
    `/api/quality/inspections/${flagged.data?.id}`);
  check('Quality: new fields returned by inspection detail',
    qualityInspection.data?.inspection?.size_category === 'large' &&
    qualityInspection.data?.inspection?.needs_review === true &&
    qualityInspection.data?.inspection?.model_version === 'test-all-v1');

  const qualityDefects = await call('Quality: defect inspection fields', 'GET',
    '/api/quality/defects?limit=1000');
  const qualityFlaggedDefect = list(qualityDefects.data)
    .find((inspection) => inspection.id === flagged.data?.id);
  check('Quality: new fields returned by defects list',
    qualityFlaggedDefect?.size_category === 'large' &&
    qualityFlaggedDefect?.needs_review === true &&
    qualityFlaggedDefect?.model_version === 'test-all-v1');

  const internalInspections = await call('Internal: inspection fields', 'GET',
    '/api/internal/query/inspections?line_id=1&limit=100');
  const internalFlagged = list(internalInspections.data)
    .find((inspection) => inspection.id === flagged.data?.id);
  check('Internal: new fields returned',
    internalFlagged?.size_category === 'large' &&
    internalFlagged?.needs_review === true &&
    internalFlagged?.model_version === 'test-all-v1');

  const reviewAlerts = await call('Quality: review alert', 'GET', '/api/quality/alerts');
  check('Alert: needs_review alert identifies inspection and product',
    list(reviewAlerts.data).some((alert) =>
      alert.type === 'needs_review' &&
      alert.message.includes(String(flagged.data?.id)) &&
      alert.message.includes(flaggedInspection.product_type)));

  const legacyDetail = await call('Quality: legacy inspection detail', 'GET',
    `/api/quality/inspections/${noOptionalFields.data?.id}`);
  check('CV: omitted fields default compatibly',
    legacyDetail.data?.inspection?.size_category === null &&
    legacyDetail.data?.inspection?.needs_review === false &&
    legacyDetail.data?.inspection?.model_version === null);

  // Batch endpoint
  const arr = [];
  arr.push({
    product_type: 'kiwi',
    status: 'good',
    confidence: 0.95,
    line_id: 1,
    captured_at: new Date().toISOString(),
    size_category: 'small',
    needs_review: true,
    model_version: 'batch-test-v1'
  });
  for (let i = 0; i < 4; i++) {
    arr.push({
      product_type: 'orange', status: 'good', confidence: 0.95,
      line_id: 1, captured_at: new Date().toISOString()
    });
  }
  const batchIngest = await call('CV: batch ingest with optional fields', 'POST',
    '/api/ingest/inspections/batch', arr);
  const batchFlaggedId = batchIngest.data?.ids?.[0];
  const batchQuality = await call('Quality: batch inspection fields', 'GET',
    `/api/quality/inspections/${batchFlaggedId}`);
  check('CV: batch fields stored and returned',
    batchQuality.data?.inspection?.size_category === 'small' &&
    batchQuality.data?.inspection?.needs_review === true &&
    batchQuality.data?.inspection?.model_version === 'batch-test-v1');

  // 6) 70 فحص (حوالي 33% تالف) عشان التنبيه يشتغل
  let okCount = 0;
  for (let i = 0; i < 70; i++) {
    const defective = i % 3 === 0;
    const r = await call('loop', 'POST', '/api/ingest/inspection', {
      product_type: ['tomato', 'apple', 'potato'][i % 3],
      status: defective ? 'defective' : 'good',
      confidence: 0.8,
      defect_type: defective ? 'mold' : null,
      line_id: 1,
      captured_at: new Date().toISOString(),
    }, { quiet: true });
    if (r.ok) okCount++;
  }
  console.log(`✅ Sent 70 inspections, accepted: ${okCount}`);

  // 7) نجيب batch_id الحقيقي
  const insp = await call('Supervisor: latest inspections', 'GET', '/api/supervisor/inspections?limit=100');
  const batchId = list(insp.data)[0]?.batch_id || 1;
  console.log('   using batch_id =', batchId);

  await call('Supervisor: current batch', 'GET', '/api/supervisor/current-batch');

  // 8) التنبيهات
  const alerts = await call('Quality: alerts', 'GET', '/api/quality/alerts');
  const n = list(alerts.data).length;
  console.log(n > 0 ? `✅ Alerts generated: ${n}` : '⚠️ No alerts generated (check threshold / minimum 50 inspections)');
  await call('Supervisor: unread alerts', 'GET', '/api/supervisor/alerts?unread=true');
  const firstAlert = list(alerts.data)[0];
  if (firstAlert) await call('Quality: mark alert read', 'PATCH', `/api/quality/alerts/${firstAlert.id}/read`, {});

  await call('Quality: defects', 'GET', '/api/quality/defects');
  await call('Quality: defects by type', 'GET', '/api/quality/stats/defects-by-type');
  await call('Quality: inspection by id', 'GET', '/api/quality/inspections/1');

  // 9) بيانات الإدارة (7 أيام)
  for (let d = 6; d >= 0; d--) {
    const day = new Date(Date.now() - d * 86400000).toISOString();
    await call('Manager: production', 'POST', '/api/manager/production', { batch_id: batchId, quantity: 1000 + d * 20, recorded_at: day }, { quiet: true });
    await call('Manager: waste', 'POST', '/api/manager/waste', { batch_id: batchId, quantity: 100 + d * 3, reason: 'rotten', recorded_at: day }, { quiet: true });
    await call('Manager: costs', 'POST', '/api/manager/costs', { batch_id: batchId, amount: 5000 + d * 50, category: 'labor', recorded_at: day }, { quiet: true });
    await call('Manager: revenue', 'POST', '/api/manager/revenue', { batch_id: batchId, amount: 9000 + d * 80, recorded_at: day }, { quiet: true });
  }
  console.log('✅ Business data posted (7 days)');

  const today = new Date().toISOString().slice(0, 10);
  await call('Manager: summary', 'GET', '/api/manager/summary');
  await call('Manager: daily report', 'GET', `/api/manager/daily-report?date=${today}`);
  await call('Manager: trends', 'GET', '/api/manager/trends?days=7');

  // 10) الـ AI Agent
  await call('Agent: overview', 'GET', '/api/internal/overview');
  await call('Agent: query inspections', 'GET', `/api/internal/query/inspections?from=${today}`);
  await call('Agent: query stats', 'GET', `/api/internal/query/stats?from=${today}`);
  await call('Agent: log', 'POST', '/api/internal/agent/log', { question: 'كام نسبة التالف؟', answer: 'اختبار' });
  await call('Agent: logs', 'GET', '/api/internal/agent/logs');

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===`);
  process.exit(failed ? 1 : 0);
})();
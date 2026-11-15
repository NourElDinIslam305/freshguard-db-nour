// scripts/simulate-mobile.js
// الاستخدام: npm run simulate:mobile -- supervisor   (أو quality أو manager)
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const role = process.argv[2] || 'supervisor';

const endpoints = {
  supervisor: [
    '/api/supervisor/current-batch',
    '/api/supervisor/inspections?limit=5',
    '/api/supervisor/alerts?unread=true',
  ],
  quality: [
    '/api/quality/defects',
    '/api/quality/alerts',
    '/api/quality/stats/defects-by-type',
  ],
  manager: ['/api/manager/summary', '/api/manager/trends?days=7'],
};

async function poll() {
  console.clear();
  console.log(`📱 Mobile app (${role}) - ${new Date().toLocaleTimeString()}`);
  for (const p of endpoints[role] || []) {
    try {
      const r = await fetch(BASE + p);
      const j = await r.json().catch(() => null);
      console.log(`\n${p} -> ${r.status}`);
      console.log(JSON.stringify(j, null, 1).slice(0, 600));
    } catch (e) {
      console.log(`\n${p} -> ERROR ${e.message}`);
    }
  }
}

poll();
setInterval(poll, 3000);
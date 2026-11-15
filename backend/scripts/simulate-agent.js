require('dotenv').config();

const baseUrl = process.env.BASE_URL || 'http://localhost:3000';

async function request(path, options) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  console.log(`${path}:`, JSON.stringify(data, null, 2));
  return data;
}

async function run() {
  await request('/api/internal/overview');
  const today = new Date().toISOString().slice(0, 10);
  await request(`/api/internal/query/stats?from=${today}`);
  await request('/api/internal/agent/log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      question: 'What is the current quality status?',
      answer: 'The current summary is available from the FreshGuard overview endpoint.'
    })
  });
}

run().catch((error) => {
  console.error('Agent simulator error:', error.message);
  process.exitCode = 1;
});

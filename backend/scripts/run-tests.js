const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');

const root = path.join(__dirname, '..');
const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function runNode(script, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: 'inherit', ...options });
    child.once('error', reject);
    child.once('close', (code, signal) => resolve({ code, signal }));
  });
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const listener = net.createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const { port } = listener.address();
      listener.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(server, url) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Test server exited with code ${server.exitCode}`);
    }
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      await wait(250);
    }
  }
  throw new Error('Timed out waiting for the test server to become healthy');
}

async function stopServer(server) {
  if (!server || server.exitCode !== null) return;
  const closed = new Promise((resolve) => server.once('close', resolve));
  server.kill();
  await Promise.race([closed, wait(5000)]);
  if (server.exitCode === null) {
    server.kill();
    await closed;
  }
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'freshguard-test-'));
  const port = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    DB_PATH: './data/test.db',
    PORT: String(port),
    BASE_URL: baseUrl
  };
  let server;
  let exitCode = 1;

  try {
    const initialized = await runNode(path.join(__dirname, 'init-db.js'), {
      cwd: tempDir,
      env
    });
    if (initialized.code !== 0) {
      throw new Error(`Test database initialization failed (${initialized.code ?? initialized.signal})`);
    }

    server = spawn(process.execPath, [path.join(root, 'src', 'server.js')], {
      cwd: tempDir,
      env,
      stdio: 'inherit'
    });
    await waitForServer(server, baseUrl);

    const result = await runNode(path.join(__dirname, 'test-all.js'), {
      cwd: tempDir,
      env
    });
    exitCode = result.code ?? 1;
  } catch (error) {
    console.error('Full test run failed:', error.message);
  } finally {
    await stopServer(server);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  process.exitCode = exitCode;
}

main();

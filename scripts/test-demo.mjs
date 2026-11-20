/**
 * Vérifie la démonstration publique (/demo) : accessible sans connexion,
 * strictement en lecture seule, et totalement isolée du volume de production.
 * Usage : node scripts/test-demo.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const check = (label, ok) => {
  console.log(`  ${ok ? 'ok' : 'KO'}  ${label}`);
  if (!ok) failures++;
};

function startServer(port, env) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'flowboard-demo-'));
  const child = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(port),
      HOST: '127.0.0.1',
      KANBAN_DATA_DIR: dataDir,
      KANBAN_SEED: 'empty',
      ...env,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  return { child, dataDir, get log() { return log; } };
}

async function waitForServer(base, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(120);
  }
  throw new Error('Le serveur de test ne répond pas.');
}

async function stopServer(instance) {
  instance.child.kill();
  await sleep(250);
  fs.rmSync(instance.dataDir, { recursive: true, force: true });
}

async function request(base, method, route, { auth, body } = {}) {
  const headers = {};
  if (auth) headers.Authorization = `Basic ${Buffer.from(auth).toString('base64')}`;
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${base}${route}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, body: data, headers: res.headers, text };
}

/* ------------------- 1. Demo publique en mode basic ------------------- */
console.log('mode basic');
const PORT1 = 5700 + Math.floor(Math.random() * 120);
const BASE1 = `http://127.0.0.1:${PORT1}`;
const basic = startServer(PORT1, {
  KANBAN_AUTH_MODE: 'basic',
  KANBAN_BASIC_USERS: 'marie@studio.fr:motdepasse1',
  KANBAN_AUTH_DOMAINS: 'studio.fr',
});

try {
  await waitForServer(BASE1);

  const page = await request(BASE1, 'GET', '/demo');
  check('GET /demo accessible sans connexion', page.status === 200);
  check('GET /demo sert l’interface', /<div class="app">/.test(String(page.body)));
  check('GET /demo annonce la démonstration', /demo-banner/.test(String(page.body)));

  const asset = await request(BASE1, 'GET', '/app.js');
  check('GET /app.js public', asset.status === 200 && /javascript/.test(asset.headers.get('content-type') || ''));
  const css = await request(BASE1, 'GET', '/styles.css');
  check('GET /styles.css public', css.status === 200);
  const icon = await request(BASE1, 'GET', '/favicon.svg');
  check('GET /favicon.svg public', icon.status === 200);

  const demoState = await request(BASE1, 'GET', '/api/demo/state');
  check('GET /api/demo/state accessible sans connexion', demoState.status === 200);
  check('démo marquée lecture seule', demoState.body?.meta?.readOnly === true);
  check('démo sans utilisateur', demoState.body?.meta?.auth?.user === null);
  check('démo contient des user stories factices', Array.isArray(demoState.body?.stories) && demoState.body.stories.length > 0);
  check('démo contient une équipe factice', Array.isArray(demoState.body?.members) && demoState.body.members.length > 0);

  const demoPost = await request(BASE1, 'POST', '/api/demo/state', { body: {} });
  check('écriture refusée sur la démo (405)', demoPost.status === 405);
  const demoUnknown = await request(BASE1, 'GET', '/api/demo/stories');
  check('route de démo inconnue (404)', demoUnknown.status === 404);

  const gated = await request(BASE1, 'GET', '/');
  check('application réelle protégée (401)', gated.status === 401);
  const gatedApi = await request(BASE1, 'GET', '/api/state');
  check('API réelle protégée (401)', gatedApi.status === 401);
  const gatedWrite = await request(BASE1, 'POST', '/api/ideas', { body: { title: 'Test' } });
  check('écriture réelle protégée (401)', gatedWrite.status === 401);

  // Les données réelles ne doivent jamais apparaître dans la démo.
  const before = (await request(BASE1, 'GET', '/api/demo/state')).body.stories.length;
  const created = await request(BASE1, 'POST', '/api/stories', {
    auth: 'marie@studio.fr:motdepasse1',
    body: { title: 'US confidentielle de production' },
  });
  check('création réelle possible une fois connecté', created.status === 201);
  const after = await request(BASE1, 'GET', '/api/demo/state');
  check('la démo ignore les données réelles', after.body.stories.length === before);
  check(
    'aucune fuite de la US réelle dans la démo',
    !JSON.stringify(after.body).includes('US confidentielle de production')
  );
} catch (err) {
  failures++;
  console.error('  KO  erreur inattendue :', err.message);
  if (basic.log) console.error(basic.log.slice(-2000));
} finally {
  await stopServer(basic);
}

/* ------------------ 2. Demo publique sans SSO configuré ---------------- */
console.log('mode google incomplet');
const PORT2 = 5900 + Math.floor(Math.random() * 120);
const BASE2 = `http://127.0.0.1:${PORT2}`;
const google = startServer(PORT2, {
  KANBAN_AUTH_MODE: 'google',
  GOOGLE_CLIENT_ID: '',
  GOOGLE_CLIENT_SECRET: '',
});

try {
  await waitForServer(BASE2);
  const demo = await request(BASE2, 'GET', '/demo');
  check('démo accessible même si le SSO est incomplet', demo.status === 200);
  const state = await request(BASE2, 'GET', '/api/demo/state');
  check('état de démo servi malgré le SSO incomplet', state.status === 200);
  const app = await request(BASE2, 'GET', '/');
  check('application verrouillée (503)', app.status === 503);
  const api = await request(BASE2, 'GET', '/api/state');
  check('API réelle verrouillée (503)', api.status === 503);
} catch (err) {
  failures++;
  console.error('  KO  erreur inattendue :', err.message);
  if (google.log) console.error(google.log.slice(-2000));
} finally {
  await stopServer(google);
}

if (failures) {
  console.error(`\n${failures} test(s) en échec.`);
  process.exit(1);
}
console.log('\nOK — démonstration publique, lecture seule et isolée.');

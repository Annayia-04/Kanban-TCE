/**
 * Vérifie le mode d'authentification « basic » (secours sans proxy SSO) :
 * 401 avec challenge, identité = email, domaines autorisés, droits d'auteur.
 * Usage : node scripts/test-basic.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'flowboard-basic-'));
const PORT = 5400 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;

const MARIE = ['marie@studio.fr', 'motdepasse1'];
const THOMAS = ['thomas@studio.fr', 'motdepasse2'];
const OUTSIDER = ['x@autre.fr', 'motdepasse3'];

let failures = 0;
const check = (label, ok) => {
  console.log(`  ${ok ? 'ok' : 'KO'}  ${label}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    KANBAN_DATA_DIR: DATA,
    KANBAN_SEED: 'demo',
    KANBAN_AUTH_MODE: 'basic',
    KANBAN_BASIC_USERS: [MARIE, THOMAS, OUTSIDER].map(([email, password]) => `${email}:${password}`).join(','),
    KANBAN_AUTH_DOMAINS: 'studio.fr',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let log = '';
server.stdout.on('data', (d) => (log += d));
server.stderr.on('data', (d) => (log += d));

const basic = ([email, password]) => `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`;

async function waitForServer(timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(120);
  }
  throw new Error('Le serveur de test ne répond pas.');
}

async function call(method, p, { auth, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) headers.Authorization = auth;
  const res = await fetch(`${BASE}/api${p}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, headers: res.headers, body: await res.json().catch(() => ({})) };
}

try {
  await waitForServer();

  check('santé publique sans identifiants', (await fetch(`${BASE}/healthz`)).ok);

  const anon = await call('GET', '/state');
  check('sans identifiants → 401', anon.status === 401);
  check('challenge Basic envoyé', /^Basic realm="Flowboard"/.test(anon.headers.get('www-authenticate') || ''));

  const wrong = await call('GET', '/state', { auth: basic([MARIE[0], 'mauvais']) });
  check('mauvais mot de passe → 401', wrong.status === 401);

  const unknown = await call('GET', '/state', { auth: basic(['inconnu@studio.fr', 'motdepasse1']) });
  check('compte inconnu → 401', unknown.status === 401);

  const outsider = await call('GET', '/state', { auth: basic(OUTSIDER) });
  check('domaine non autorisé → 403', outsider.status === 403);

  const marie = await call('GET', '/state', { auth: basic(MARIE) });
  check('identifiants valides → 200', marie.status === 200);
  check('identité = email', marie.body.meta?.auth?.user === MARIE[0]);
  check('mode basic exposé dans meta', marie.body.meta?.auth?.mode === 'basic');

  // L'identité basic doit alimenter les mêmes règles que le SSO.
  const sug = await call('POST', '/stories/us_15/suggestions', {
    auth: basic(MARIE),
    body: { text: 'Suggestion déposée en basic auth.' },
  });
  check('suggestion signée avec l’email', sug.status === 201 && sug.body.author === MARIE[0]);

  const idea = await call('POST', '/ideas', { auth: basic(MARIE), body: { title: 'Idée en basic auth' } });
  check('idée signée avec l’email', idea.status === 201 && idea.body.author === MARIE[0]);

  const otherDelete = await call('DELETE', `/ideas/${idea.body.id}`, { auth: basic(THOMAS) });
  check('un autre ne peut pas supprimer l’idée', otherDelete.status === 403);

  const ownDelete = await call('DELETE', `/ideas/${idea.body.id}`, { auth: basic(MARIE) });
  check('l’auteur supprime son idée', ownDelete.status === 200);
} catch (err) {
  failures++;
  console.error('  KO  erreur inattendue :', err.message);
  if (log) console.error(log.slice(-2000));
} finally {
  server.kill();
  await sleep(300);
  fs.rmSync(DATA, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} test(s) en échec.`);
  process.exit(1);
}
console.log('\nOK — authentification basic, domaines et droits conformes.');

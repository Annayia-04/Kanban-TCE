/**
 * Vérifie le mode production : KANBAN_SEED=empty démarre sans données de démo,
 * refuse la réinitialisation de la démo et conserve les données au redémarrage.
 * Usage : node scripts/test-empty.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'flowboard-empty-'));
const PORT = 5100 + Math.floor(Math.random() * 300);
const BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
const check = (label, ok) => {
  console.log(`  ${ok ? 'ok' : 'KO'}  ${label}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let server = null;
let log = '';

function start() {
  server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOST: '127.0.0.1',
      KANBAN_DATA_DIR: DATA,
      KANBAN_SEED: 'empty',
      KANBAN_AUTH_MODE: 'none',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  server.stdout.on('data', (d) => (log += d));
  server.stderr.on('data', (d) => (log += d));
}

async function waitForServer(timeout = 15000) {
  const startAt = Date.now();
  while (Date.now() - startAt < timeout) {
    try {
      if ((await fetch(`${BASE}/healthz`)).ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(120);
  }
  throw new Error('Le serveur de test ne répond pas.');
}

async function stop() {
  if (!server) return;
  server.kill();
  server = null;
  await sleep(400);
}

async function call(method, p, body) {
  const res = await fetch(`${BASE}/api${p}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

try {
  start();
  await waitForServer();

  const state = await call('GET', '/state');
  check('l’instance démarre sans données de démo', state.status === 200);
  check('aucune user story', state.body.stories.length === 0);
  check('aucun membre', state.body.members.length === 0);
  check('aucune version', state.body.versions.length === 0);
  check('aucune idée', (state.body.ideas || []).length === 0);
  check('aucun compte rendu', state.body.reports.length === 0);
  check('meta.seed = empty', state.body.meta?.seed === 'empty');
  check('meta.demo = false', state.body.meta?.demo === false);

  check('réinitialisation de la démo refusée → 403', (await call('POST', '/reset')).status === 403);
  check('compte rendu d’exemple absent → 404', (await call('GET', '/demo-cr')).status === 404);

  const created = await call('POST', '/stories', { title: 'Première US de production' });
  check('création d’une US sur une instance vide', created.status === 201 && created.body.key === 'US-1');
  check('le compteur de clés démarre à 1', created.body.key === 'US-1');

  const after = await call('GET', '/state');
  check('l’US est bien enregistrée', after.body.stories.length === 1);
  check('réinitialisation toujours refusée après écriture', (await call('POST', '/reset')).status === 403);

  // Redémarrage : les données doivent survivre (db.json écrit dans le volume).
  await stop();
  start();
  await waitForServer();
  const reloaded = await call('GET', '/state');
  check('les données survivent au redémarrage', reloaded.body.stories.length === 1);
  check('le titre est conservé', reloaded.body.stories[0].title === 'Première US de production');
} catch (err) {
  failures++;
  console.error('  KO  erreur inattendue :', err.message);
  if (log) console.error(log.slice(-2000));
} finally {
  await stop();
  fs.rmSync(DATA, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} test(s) en échec.`);
  process.exit(1);
}
console.log('\nOK — mode production vide, reset verrouillé et données persistantes.');

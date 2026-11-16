/**
 * Test de l'API de vote d'équipe (US sans version).
 * Démarre un serveur temporaire sur un dossier de données jetable.
 * Usage : node scripts/test-vote.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'flowboard-vote-'));
const PORT = 4400 + Math.floor(Math.random() * 400);
const URL_BASE = `http://127.0.0.1:${PORT}`;

let failures = 0;
const check = (label, ok) => {
  console.log(`  ${ok ? 'ok' : 'KO'}  ${label}`);
  if (!ok) failures++;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForServer(timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const res = await fetch(`${URL_BASE}/healthz`);
      if (res.ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(120);
  }
  throw new Error('Le serveur de test ne répond pas.');
}

const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', KANBAN_DATA_DIR: DATA, KANBAN_AUTH_MODE: 'none' },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

const api = (p) =>
  fetch(`${URL_BASE}/api${p}`).then(async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) }));
const post = (p, body) =>
  fetch(`${URL_BASE}/api${p}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) }));
const patch = (p, body) =>
  fetch(`${URL_BASE}/api${p}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.json().catch(() => ({})) }));

try {
  await waitForServer();

  const state = await api('/state');
  check('GET /state répond 200', state.status === 200);

  const pool = state.body.stories.filter((s) => !s.versionId);
  console.log(`  (${pool.length} US sans version dans la démo)`);
  check('la démo contient des US sans version', pool.length > 0);

  const story = pool[0];
  const before = { up: Number(story.votes?.up) || 0, down: Number(story.votes?.down) || 0 };

  const plus = await post(`/stories/${story.id}/vote`, { value: 1 });
  check('vote +1 accepté', plus.status === 200 && plus.body.votes.up === before.up + 1);
  check('le compteur « contre » ne bouge pas', plus.body.votes.down === before.down);

  const minus = await post(`/stories/${story.id}/vote`, { value: -1 });
  check('vote −1 accepté', minus.status === 200 && minus.body.votes.down === before.down + 1);
  check('le score est pour − contre', minus.body.score?.score === before.up + 1 - (before.down + 1));

  const persisted = await api('/state');
  const saved = persisted.body.stories.find((s) => s.id === story.id);
  check('les votes sont persistés', saved?.votes.up === before.up + 1 && saved?.votes.down === before.down + 1);

  const bad = await post(`/stories/${story.id}/vote`, { value: 7 });
  check('un vote hors 1 / −1 / 0 est refusé (400)', bad.status === 400);

  const reset = await post(`/stories/${story.id}/vote`, { value: 0 });
  check('la remise à zéro fonctionne', reset.status === 200 && reset.body.votes.up === 0 && reset.body.votes.down === 0);

  const versionId = state.body.versions[0].id;
  const qualified = await patch(`/stories/${story.id}`, { versionId });
  check('une US peut être qualifiée (version attribuée)', qualified.status === 200 && qualified.body.versionId === versionId);

  const closed = await post(`/stories/${story.id}/vote`, { value: 1 });
  check('le vote est clos une fois la version attribuée (409)', closed.status === 409);

  const missing = await post('/stories/us_inexistante/vote', { value: 1 });
  check('US inconnue → 404', missing.status === 404);

  const negative = await post(`/stories/${pool[1]?.id || story.id}/vote`, { value: -1 });
  check('le compteur ne peut pas devenir négatif', negative.status === 200 && negative.body.votes.down >= 0);
} catch (err) {
  failures++;
  console.error('  KO  erreur inattendue :', err.message);
  if (serverLog) console.error(serverLog.slice(-2000));
} finally {
  server.kill();
  await sleep(300);
  fs.rmSync(DATA, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} test(s) de vote en échec.`);
  process.exit(1);
}
console.log('\nOK — API de vote conforme.');

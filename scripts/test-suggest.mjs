/**
 * Test des suggestions signées, de la boîte à idées et des droits de suppression.
 * Démarre un serveur en mode SSO proxy (en-tête email) sur un dossier jetable.
 * Usage : node scripts/test-suggest.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = fs.mkdtempSync(path.join(os.tmpdir(), 'flowboard-sug-'));
const PORT = 4800 + Math.floor(Math.random() * 300);
const URL_BASE = `http://127.0.0.1:${PORT}`;
const HDR = 'x-auth-request-email';
const ALICE = 'alice@studio.fr';
const BOB = 'bob@studio.fr';

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
      if ((await fetch(`${URL_BASE}/healthz`)).ok) return true;
    } catch {
      /* pas encore prêt */
    }
    await sleep(120);
  }
  throw new Error('Le serveur de test ne répond pas.');
}

const server = spawn(process.execPath, ['server.js'], {
  cwd: ROOT,
  env: {
    ...process.env,
    PORT: String(PORT),
    HOST: '127.0.0.1',
    KANBAN_DATA_DIR: DATA,
    KANBAN_AUTH_MODE: 'proxy',
    KANBAN_AUTH_HEADER: HDR,
    KANBAN_AUTH_DOMAINS: 'studio.fr',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  windowsHide: true,
});
let serverLog = '';
server.stdout.on('data', (d) => (serverLog += d));
server.stderr.on('data', (d) => (serverLog += d));

async function call(method, p, { body, as } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (as) headers[HDR] = as;
  const res = await fetch(`${URL_BASE}/api${p}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}
const get = (p, as) => call('GET', p, { as });
const post = (p, body, as) => call('POST', p, { body, as });
const patch = (p, body, as) => call('PATCH', p, { body, as });
const del = (p, as) => call('DELETE', p, { as });

try {
  await waitForServer();

  check('sans en-tête SSO → 401', (await get('/state')).status === 401);
  check('domaine non autorisé → 403', (await get('/state', 'x@autre.fr')).status === 403);
  check('en-tête SSO valide → 200', (await get('/state', ALICE)).status === 200);

  // --- Suggestions signées ---
  const anonSug = await post('/stories/us_16/suggestions', { text: 'Test sans SSO' });
  check('suggestion sans SSO → 401', anonSug.status === 401);

  const sug = await post('/stories/us_16/suggestions', { text: 'Prévoir un thème système automatique.' }, ALICE);
  check('suggestion signée créée', sug.status === 201 && sug.body.author === ALICE);

  const short = await post('/stories/us_16/suggestions', { text: 'a' }, ALICE);
  check('suggestion trop courte → 400', short.status === 400);

  const state1 = await get('/state', BOB);
  const us16 = state1.body.stories.find((s) => s.id === 'us_16');
  check('la suggestion apparaît dans l’état', (us16.suggestions || []).some((s) => s.id === sug.body.id));

  const badDel = await del(`/stories/us_16/suggestions/${sug.body.id}`, BOB);
  check('supprimer la suggestion d’un autre → 403', badDel.status === 403);

  const ownDel = await del(`/stories/us_16/suggestions/${sug.body.id}`, ALICE);
  check('l’auteur supprime sa suggestion', ownDel.status === 200);

  // --- Boîte à idées ---
  const anonIdea = await post('/ideas', { title: 'Idée anonyme' });
  check('idée sans SSO → 401', anonIdea.status === 401);

  const idea = await post('/ideas', { title: 'Alerte de paiement refusé', text: 'Prévenir par email.' }, ALICE);
  check('idée créée et signée', idea.status === 201 && idea.body.author === ALICE);

  const ideaVote = await post(`/ideas/${idea.body.id}/vote`, { value: 1 }, BOB);
  check('vote sur une idée', ideaVote.status === 200 && ideaVote.body.votes.up === 1);

  const badIdeaDel = await del(`/ideas/${idea.body.id}`, BOB);
  check('supprimer l’idée d’un autre → 403', badIdeaDel.status === 403);

  // --- Promotion en US ---
  const promoted = await post(`/ideas/${idea.body.id}/promote`, {}, BOB);
  check('idée promue en US', promoted.status === 201 && promoted.body.story.versionId === null);
  check('l’US garde l’auteur de l’idée', promoted.body.story.createdBy === ALICE);

  const again = await post(`/ideas/${idea.body.id}/promote`, {}, BOB);
  check('une idée ne peut être promue deux fois → 409', again.status === 409);

  const ideaVoteClosed = await post(`/ideas/${idea.body.id}/vote`, { value: 1 }, BOB);
  check('le vote d’une idée promue est clos → 409', ideaVoteClosed.status === 409);

  // --- Droits de suppression des US ---
  const storyId = promoted.body.story.id;
  const bobDelete = await del(`/stories/${storyId}`, BOB);
  check('supprimer l’US d’un autre → 403', bobDelete.status === 403);

  const aliceDelete = await del(`/stories/${storyId}`, ALICE);
  check('l’auteur supprime son US', aliceDelete.status === 200);

  const legacyDelete = await del('/stories/us_1', BOB);
  check('une US sans auteur reste supprimable par tous', legacyDelete.status === 200);

  const mine = await post('/stories', { title: 'US créée par Alice' }, ALICE);
  check('une US créée via le SSO porte son auteur', mine.status === 201 && mine.body.createdBy === ALICE);
  check('un autre ne peut pas la supprimer', (await del(`/stories/${mine.body.id}`, BOB)).status === 403);
  check('son auteur peut la supprimer', (await del(`/stories/${mine.body.id}`, ALICE)).status === 200);

  const ownIdeaDel = await del(`/ideas/${idea.body.id}`, ALICE);
  check('l’auteur supprime son idée', ownIdeaDel.status === 200);

  const patched = await patch('/stories/us_13', { title: 'Titre modifié' }, BOB);
  check('la modification reste ouverte à l’équipe', patched.status === 200 && patched.body.title === 'Titre modifié');
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
  console.error(`\n${failures} test(s) en échec.`);
  process.exit(1);
}
console.log('\nOK — suggestions, idées et droits de suppression conformes.');

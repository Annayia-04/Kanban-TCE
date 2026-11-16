/**
 * Test d'interface automatise via le protocole DevTools (Chrome headless).
 * Usage : node scripts/ui-test.mjs [url]
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const APP = process.argv[2] || 'http://127.0.0.1:4321/';
const PORT = 9333;
const OUT = path.join(os.tmpdir(), 'flowboard-ui');

if (typeof WebSocket === 'undefined') {
  console.error('Node 22 ou plus est requis (WebSocket global absent).');
  process.exit(1);
}
fs.mkdirSync(OUT, { recursive: true });
const profile = path.join(OUT, `profile-${Date.now()}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeout = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      if (await fn()) return true;
    } catch {
      /* retry */
    }
    await sleep(150);
  }
  throw new Error('Timeout');
}

const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--window-size=1440,950',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    // Sur les runners CI, le sandbox de Chrome n'est pas disponible.
    ...(process.env.CI ? ['--no-sandbox', '--disable-dev-shm-usage'] : []),
    'about:blank',
  ],
  { stdio: 'ignore' }
);

try {
  await waitFor(async () => (await fetch(`http://127.0.0.1:${PORT}/json/version`)).ok);
  const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
  const target = list.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let seq = 0;
  const waiting = new Map();
  const problems = [];

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      problems.push(`EXCEPTION: ${d.exception?.description || d.text}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      problems.push(`CONSOLE: ${msg.params.args.map((a) => a.value ?? a.description ?? '').join(' ')}`);
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      problems.push(`LOG: ${msg.params.entry.text}`);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      waiting.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');

  const evaluate = async (expression) => {
    const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
    }
    return res.result.value;
  };

  const shot = async (name) => {
    const res = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    fs.writeFileSync(path.join(OUT, name), Buffer.from(res.data, 'base64'));
    console.log('  screenshot:', name);
  };

  await send('Page.navigate', { url: APP });
  await sleep(1800);
  await shot('01-board.png');

  console.log('drawer');
  await evaluate(`document.querySelector('.card').click()`);
  await sleep(600);
  await shot('02-drawer.png');
  const drawerTitle = await evaluate(`document.querySelector('#drawer .title-input')?.value`);
  console.log('  drawer title:', drawerTitle);

  // modifie le titre pour tester l'enregistrement
  await evaluate(`(() => {
    const el = document.querySelector('#drawer .title-input');
    el.value = el.value + ' (test)';
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(900);
  const savedTitle = await evaluate(
    `fetch('/api/state').then(r=>r.json()).then(s=>s.stories.find(x=>x.title.includes('(test)'))?.title || null)`
  );
  console.log('  sauvegarde auto:', savedTitle);
  await evaluate(`document.querySelector('[data-act="close-drawer"]').click()`);
  await sleep(400);

  console.log('backlog');
  await evaluate(`document.querySelector('[data-view="backlog"]').click()`);
  await sleep(700);
  await shot('03-backlog.png');

  console.log('reports');
  await evaluate(`document.querySelector('[data-view="reports"]').click()`);
  await sleep(700);
  await shot('04-reports.png');

  console.log('analyse');
  await evaluate(`document.querySelector('[data-act="load-demo"]').click()`);
  await sleep(700);
  await evaluate(`document.querySelector('[data-act="analyze-text"]').click()`);
  await sleep(1500);
  await shot('05-review.png');
  const cands = await evaluate(`document.querySelectorAll('.candidate').length`);
  console.log('  candidats affichés:', cands);
  if (!cands) problems.push('Aucun candidat affiché après analyse');

  console.log('diagnostic');
  await evaluate(`document.querySelector('[data-act="diagnose"]').click()`);
  await sleep(900);
  await shot('05b-diagnostic.png');
  const diagRows = await evaluate(`document.querySelectorAll('.diag-row').length`);
  const diagKept = await evaluate(`document.querySelectorAll('.diag-row.kept').length`);
  console.log('  lignes analysées:', diagRows, '· retenues:', diagKept);
  if (!diagRows) problems.push('Diagnostic vide');
  await evaluate(`document.querySelector('#modal [data-act="modal-close"]').click()`);
  await sleep(400);

  console.log('team');
  await evaluate(`document.querySelector('[data-view="team"]').click()`);
  await sleep(600);
  await shot('06-team.png');

  console.log('qualification (vote)');
  await evaluate(`document.querySelector('[data-view="votes"]').click()`);
  await sleep(700);
  await shot('07-votes.png');
  const voteRows = await evaluate(`document.querySelectorAll('.vote-row').length`);
  const beforeVotes = await evaluate(`document.querySelector('.vote-row .vote-counts')?.textContent || ''`);
  await evaluate(`document.querySelector('.vote-row .vote-btn.for')?.click()`);
  await sleep(800);
  const afterVotes = await evaluate(`document.querySelector('.vote-row .vote-counts')?.textContent || ''`);
  console.log('  US à qualifier:', voteRows, '· compteur:', beforeVotes, '→', afterVotes);
  if (!voteRows) problems.push('Aucune US dans la vue Qualification');
  if (voteRows && beforeVotes === afterVotes) problems.push('Le vote ne met pas à jour le compteur');

  console.log('boîte à idées');
  await evaluate(`document.querySelector('[data-view="ideas"]').click()`);
  await sleep(700);
  await shot('07b-ideas.png');
  const ideaCards = await evaluate(`document.querySelectorAll('.idea-card').length`);
  const ideaAuthors = await evaluate(`[...document.querySelectorAll('.idea-card .person')].length`);
  const ideaBefore = await evaluate(`document.querySelector('.idea-card .vote-counts')?.textContent || ''`);
  await evaluate(`document.querySelector('.idea-card .vote-btn.for')?.click()`);
  await sleep(800);
  const ideaAfter = await evaluate(`document.querySelector('.idea-card .vote-counts')?.textContent || ''`);
  const ideaCreateDisabled = await evaluate(`document.querySelector('[data-act="new-idea"]')?.disabled === true`);
  console.log('  idées:', ideaCards, '· signées:', ideaAuthors, '· compteur:', ideaBefore, '→', ideaAfter);
  if (!ideaCards) problems.push('Aucune idée dans la boîte à idées');
  if (ideaCards && ideaAuthors !== ideaCards) problems.push('Une idée n’affiche pas son auteur');
  if (ideaCards && ideaBefore === ideaAfter) problems.push('Le vote d’une idée ne met pas à jour le compteur');
  if (!ideaCreateDisabled) problems.push('Le mode local devrait désactiver « Proposer une idée »');

  console.log('dark mode');
  await evaluate(`document.querySelector('[data-act="toggle-theme"]').click()`);
  await evaluate(`document.querySelector('[data-view="board"]').click()`);
  await sleep(600);
  await shot('08-dark.png');

  console.log('mobile');
  await send('Emulation.setDeviceMetricsOverride', { width: 420, height: 860, deviceScaleFactor: 1, mobile: true });
  await sleep(500);
  await shot('09-mobile.png');

  if (problems.length) {
    console.log('\nPROBLEMES JS :');
    for (const p of [...new Set(problems)]) console.log(' -', p);
    process.exitCode = 1;
  } else {
    console.log('\nAucune erreur JS.');
  }
} finally {
  chrome.kill();
  await sleep(300);
  fs.rmSync(profile, { recursive: true, force: true });
}

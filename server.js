import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  db,
  saveDb,
  createStory,
  updateStory,
  createReport,
  publicState,
  publicReport,
  replaceDb,
  uid,
  ensureShape,
  STATUSES,
  PRIORITIES,
} from './lib/store.js';
import { makeSeed, MEMBER_COLORS } from './lib/seed.js';
import { extractFromText, analyzeText, findParticipants } from './lib/extract.js';
import { extractTextFromFile } from './lib/office.js';
import { llmExtract, llmInfo } from './lib/llm.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY = 40 * 1024 * 1024;

/* --- Authentification derriere un SSO (reverse proxy) --------------- */
// KANBAN_AUTH_MODE=proxy : l'app fait confiance a un en-tete pose par le
// proxy d'authentification (oauth2-proxy, Cloudflare Access, traefik-forward-auth,
// Authelia, en-tete maison...). Sans cet en-tete, acces refuse.
const AUTH_MODE = String(process.env.KANBAN_AUTH_MODE || 'none').toLowerCase();
const AUTH_HEADER = String(process.env.KANBAN_AUTH_HEADER || 'x-auth-request-email').toLowerCase();
const AUTH_DOMAINS = String(process.env.KANBAN_AUTH_DOMAINS || '')
  .split(',')
  .map((d) => d.trim().toLowerCase())
  .filter(Boolean);

function checkAuth(req) {
  if (AUTH_MODE !== 'proxy') return { ok: true, user: null };
  const raw = req.headers[AUTH_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const user = String(value || '').trim();
  if (!user) return { ok: false, status: 401, message: 'Authentification requise (SSO).' };
  if (AUTH_DOMAINS.length) {
    const lower = user.toLowerCase();
    if (!AUTH_DOMAINS.some((d) => lower === d || lower.endsWith(`@${d}`))) {
      return { ok: false, status: 403, message: "Ce compte n'est pas autorisé à accéder à ce kanban." };
    }
  }
  return { ok: true, user };
}

function currentUser(req) {
  const gate = checkAuth(req);
  return gate.ok ? gate.user : null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function fail(res, status, message) {
  json(res, status, { error: message });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Fichier trop volumineux (40 Mo maximum).'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('Corps de requête JSON invalide.'));
      }
    });
    req.on('error', reject);
  });
}

/* ------------------------------------------------------------------ */
/* Analyse d'un compte rendu                                           */
/* ------------------------------------------------------------------ */

async function analyzeReport({ text, filename, fileBase64 }) {
  let content = typeof text === 'string' ? text : '';
  let name = filename || 'Compte rendu collé';

  if (fileBase64) {
    let buffer;
    try {
      buffer = Buffer.from(String(fileBase64).replace(/^data:[^,]+,/, ''), 'base64');
    } catch {
      throw new Error('Fichier illisible.');
    }
    content = extractTextFromFile(buffer, filename);
  }

  content = String(content || '').trim();
  if (content.length < 30) {
    throw new Error('Le contenu est trop court pour être analysé (30 caractères minimum).');
  }

  const members = db.members;
  const versions = db.versions;
  const participants = findParticipants(content, members);
  const info = llmInfo();

  let engine = 'heuristique';
  let warning = null;
  let candidates = [];

  if (info.enabled) {
    try {
      candidates = await llmExtract(content, { members, versions });
      engine = 'ia';
    } catch (err) {
      warning = `IA indisponible (${err.message.slice(0, 140)}). Analyse locale utilisée.`;
    }
  }

  if (!candidates.length) {
    candidates = extractFromText(content, { members, versions, existing: db.stories });
    engine = 'heuristique';
  }

  const report = createReport({ name, text: content, participants: participants.map((p) => p.id), engine });
  saveDb();

  return {
    report: publicReport(report, true),
    candidates,
    participants,
    engine,
    warning,
    llm: info,
  };
}

/* ------------------------------------------------------------------ */
/* Routeur API                                                         */
/* ------------------------------------------------------------------ */

async function handleApi(req, res, url) {
  const pathname = url.pathname.replace(/^\/api/, '') || '/';
  const parts = pathname.split('/').filter(Boolean);
  const method = req.method;

  // --- Etat complet ---
  if (pathname === '/state' && method === 'GET') {
    return json(res, 200, {
      ...publicState(),
      meta: {
        llm: llmInfo(),
        statuses: STATUSES,
        priorities: PRIORITIES,
        auth: { mode: AUTH_MODE, user: currentUser(req) },
      },
    });
  }

  if (pathname === '/project' && method === 'PATCH') {
    const body = await readBody(req);
    for (const key of ['name', 'description', 'sprint']) {
      if (typeof body[key] === 'string') db.project[key] = body[key].slice(0, 300);
    }
    saveDb();
    return json(res, 200, db.project);
  }

  // --- Membres ---
  if (parts[0] === 'members') {
    if (method === 'POST' && parts.length === 1) {
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      if (!name) return fail(res, 400, 'Le nom est obligatoire.');
      const member = {
        id: uid('mem'),
        name: name.slice(0, 80),
        email: String(body.email || '').trim().slice(0, 120),
        role: String(body.role || '').trim().slice(0, 80),
        aliases: String(body.aliases || '').trim().slice(0, 200),
        color: body.color || MEMBER_COLORS[db.members.length % MEMBER_COLORS.length],
      };
      db.members.push(member);
      saveDb();
      return json(res, 201, member);
    }
    if (method === 'PATCH' && parts[1]) {
      const member = db.members.find((m) => m.id === parts[1]);
      if (!member) return fail(res, 404, 'Membre introuvable.');
      const body = await readBody(req);
      for (const key of ['name', 'email', 'role', 'aliases', 'color']) {
        if (typeof body[key] === 'string' && body[key].trim()) member[key] = body[key].trim().slice(0, 200);
      }
      saveDb();
      return json(res, 200, member);
    }
    if (method === 'DELETE' && parts[1]) {
      const idx = db.members.findIndex((m) => m.id === parts[1]);
      if (idx < 0) return fail(res, 404, 'Membre introuvable.');
      db.members.splice(idx, 1);
      for (const story of db.stories) {
        story.assigneeIds = (story.assigneeIds || []).filter((id) => id !== parts[1]);
      }
      for (const report of db.reports) {
        report.participants = (report.participants || []).filter((id) => id !== parts[1]);
      }
      saveDb();
      return json(res, 200, { ok: true });
    }
  }

  // --- Versions ---
  if (parts[0] === 'versions') {
    if (method === 'POST' && parts.length === 1) {
      const body = await readBody(req);
      const name = String(body.name || '').trim();
      if (!name) return fail(res, 400, 'Le nom de version est obligatoire.');
      if (db.versions.some((v) => v.name.toLowerCase() === name.toLowerCase())) {
        return fail(res, 409, 'Cette version existe déjà.');
      }
      const version = {
        id: uid('ver'),
        name: name.slice(0, 40),
        description: String(body.description || '').trim().slice(0, 200),
        color: body.color || MEMBER_COLORS[db.versions.length % MEMBER_COLORS.length],
      };
      db.versions.push(version);
      saveDb();
      return json(res, 201, version);
    }
    if (method === 'DELETE' && parts[1]) {
      const idx = db.versions.findIndex((v) => v.id === parts[1]);
      if (idx < 0) return fail(res, 404, 'Version introuvable.');
      db.versions.splice(idx, 1);
      for (const story of db.stories) if (story.versionId === parts[1]) story.versionId = null;
      saveDb();
      return json(res, 200, { ok: true });
    }
  }

  // --- Stories ---
  if (parts[0] === 'stories') {
    if (method === 'POST' && parts[1] === 'reorder') {
      const body = await readBody(req);
      if (!STATUSES.includes(body.status) || !Array.isArray(body.ids)) {
        return fail(res, 400, 'Réordonnancement invalide.');
      }
      body.ids.forEach((id, index) => {
        const story = db.stories.find((s) => s.id === id);
        if (story) {
          story.status = body.status;
          story.order = index;
          story.updatedAt = Date.now();
        }
      });
      saveDb();
      return json(res, 200, { ok: true });
    }
    if (method === 'POST' && parts.length === 1) {
      const body = await readBody(req);
      if (!String(body.title || '').trim()) return fail(res, 400, 'Le titre est obligatoire.');
      const story = createStory(body);
      saveDb();
      return json(res, 201, story);
    }
    if (method === 'PATCH' && parts[1]) {
      const body = await readBody(req);
      const story = updateStory(parts[1], body);
      if (!story) return fail(res, 404, 'User story introuvable.');
      saveDb();
      return json(res, 200, story);
    }
    if (method === 'DELETE' && parts[1]) {
      const idx = db.stories.findIndex((s) => s.id === parts[1]);
      if (idx < 0) return fail(res, 404, 'User story introuvable.');
      const [removed] = db.stories.splice(idx, 1);
      for (const report of db.reports) {
        report.storyIds = (report.storyIds || []).filter((id) => id !== removed.id);
      }
      saveDb();
      return json(res, 200, { ok: true });
    }
  }

  // --- Comptes rendus ---
  if (pathname === '/analyze' && method === 'POST') {
    const body = await readBody(req);
    try {
      const result = await analyzeReport(body);
      return json(res, 200, result);
    } catch (err) {
      return fail(res, 400, err.message || "Impossible d'analyser ce compte rendu.");
    }
  }

  if (pathsMatch(parts, ['reports', ':id', 'import']) && method === 'POST') {
    const report = db.reports.find((r) => r.id === parts[1]);
    if (!report) return fail(res, 404, 'Compte rendu introuvable.');
    const body = await readBody(req);
    const rows = Array.isArray(body.candidates) ? body.candidates : [];
    if (!rows.length) return fail(res, 400, 'Aucune user story à importer.');
    const created = [];
    for (const row of rows.slice(0, 100)) {
      const story = createStory({
        ...row,
        reportId: report.id,
        status: STATUSES.includes(row.status) ? row.status : 'todo',
        source: row.source || { line: 0, section: '', excerpt: String(row.description || '').slice(0, 220) },
      });
      created.push(story);
      report.storyIds.push(story.id);
    }
    saveDb();
    return json(res, 201, { created, report: publicReport(report) });
  }

  if (pathsMatch(parts, ['reports', ':id', 'diagnose']) && method === 'GET') {
    const report = db.reports.find((r) => r.id === parts[1]);
    if (!report) return fail(res, 404, 'Compte rendu introuvable.');
    const result = analyzeText(report.text || '', {
      members: db.members,
      versions: db.versions,
      existing: db.stories,
    });
    const buckets = new Map();
    for (const entry of result.debug) {
      const key = entry.kept ? 'retenues' : entry.reason || 'ignorée';
      buckets.set(key, (buckets.get(key) || 0) + 1);
    }
    return json(res, 200, {
      reportId: report.id,
      reportName: report.name,
      engine: report.engine || 'heuristique',
      characters: String(report.text || '').length,
      candidates: result.candidates.map((c) => ({
        title: c.title,
        assigneeNames: c.assigneeNames,
        versionName: c.versionName,
        due: c.due,
        confidence: c.confidence,
        line: c.source?.line || 0,
        section: c.source?.section || '',
      })),
      debug: result.debug,
      stats: [...buckets.entries()].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
    });
  }

  if (parts[0] === 'reports' && parts[1]) {
    const idx = db.reports.findIndex((r) => r.id === parts[1]);
    if (idx < 0) return fail(res, 404, 'Compte rendu introuvable.');
    if (method === 'GET') return json(res, 200, publicReport(db.reports[idx], true));
    if (method === 'DELETE') {
      db.reports.splice(idx, 1);
      for (const story of db.stories) if (story.reportId === parts[1]) story.reportId = null;
      saveDb();
      return json(res, 200, { ok: true });
    }
  }

  // --- Sauvegarde / restauration ---
  if (pathname === '/export' && method === 'GET') {
    const payload = JSON.stringify({ exportedAt: new Date().toISOString(), ...publicState() }, null, 2);
    res.writeHead(200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="flowboard-${new Date().toISOString().slice(0, 10)}.json"`,
    });
    return res.end(payload);
  }

  if (pathname === '/import' && method === 'POST') {
    const body = await readBody(req);
    try {
      replaceDb(body.data || body);
      return json(res, 200, publicState());
    } catch (err) {
      return fail(res, 400, err.message);
    }
  }

  if (pathname === '/reset' && method === 'POST') {
    replaceDb(makeSeed());
    return json(res, 200, publicState());
  }

  if (pathname === '/demo-cr' && method === 'GET') {
    const demo = db.reports.find((r) => r.id === 'rep_demo');
    return json(res, 200, { text: demo?.text || makeSeed().reports[0].text });
  }

  return fail(res, 404, 'Route inconnue.');
}

function pathsMatch(parts, pattern) {
  if (parts.length !== pattern.length) return false;
  return pattern.every((p, i) => (p.startsWith(':') ? Boolean(parts[i]) : p === parts[i]));
}

/* ------------------------------------------------------------------ */
/* Fichiers statiques                                                  */
/* ------------------------------------------------------------------ */

async function serveStatic(req, res, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return fail(res, 400, 'Chemin invalide.');
  }
  if (pathname === '/') pathname = '/index.html';

  const filePath = path.join(PUBLIC_DIR, path.normalize(pathname).replace(/^([/\\])+/, ''));
  if (!filePath.startsWith(PUBLIC_DIR)) return fail(res, 403, 'Accès refusé.');

  try {
    const stat = await fsp.stat(filePath);
    if (stat.isDirectory()) throw new Error('dir');
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    fs.createReadStream(filePath).pipe(res);
  } catch {
    if (pathname === '/index.html') return fail(res, 404, 'Interface introuvable.');
    try {
      const html = await fsp.readFile(path.join(PUBLIC_DIR, 'index.html'));
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-cache' });
      res.end(html);
    } catch {
      fail(res, 404, 'Fichier introuvable.');
    }
  }
}

/* ------------------------------------------------------------------ */
/* Serveur                                                             */
/* ------------------------------------------------------------------ */

ensureShape();
saveDb();

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Sonde de sante : toujours accessible (utile pour le proxy / l'orchestrateur)
  if (url.pathname === '/healthz') return json(res, 200, { ok: true, mode: AUTH_MODE });

  const gate = checkAuth(req);
  if (!gate.ok) {
    if (url.pathname.startsWith('/api/')) return fail(res, gate.status, gate.message);
    res.writeHead(gate.status, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(
      `<!doctype html><meta charset="utf-8"><title>Accès refusé</title><body style="font-family:system-ui;padding:48px;max-width:560px;margin:auto"><h1>Accès refusé</h1><p>${gate.message}</p></body>`
    );
  }

  if (url.pathname.startsWith('/api/')) {
    try {
      await handleApi(req, res, url);
    } catch (err) {
      console.error('[api]', err);
      if (!res.headersSent) fail(res, 500, err.message || 'Erreur interne.');
    }
    return;
  }

  await serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Flowboard — Kanban d\u2019équipe');
  console.log(`  http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log('');
  console.log(`  Données : ${path.join(ROOT, 'data', 'db.json')}`);
  console.log(`  Moteur  : ${llmInfo().enabled ? `IA (${llmInfo().model})` : 'extraction locale (heuristique)'}`);
  console.log(
    `  Accès   : ${AUTH_MODE === 'proxy' ? `SSO via en-tête ${AUTH_HEADER}${AUTH_DOMAINS.length ? ` (domaines : ${AUTH_DOMAINS.join(', ')})` : ''}` : 'libre (aucune authentification)'}`
  );
  console.log('');
});

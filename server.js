import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
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
  normalizeVotes,
  normalizeIdea,
  voteScore,
  seedState,
  SEED_MODE,
  DATA_DIR,
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

// Mode « basic » : secours sans proxy SSO. Les comptes sont de la forme
// email:mot_de_passe, séparés par des virgules. L'email sert d'identité
// (suggestions, propriété des US), comme avec le SSO.
const BASIC_USERS = String(process.env.KANBAN_BASIC_USERS || '')
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean)
  .map((entry) => {
    const i = entry.indexOf(':');
    if (i <= 0) return null;
    return { email: entry.slice(0, i).trim().toLowerCase(), password: entry.slice(i + 1) };
  })
  .filter((u) => u && u.email);

const BASIC_REALM = 'Basic realm="Flowboard", charset="UTF-8"';

function sameSecret(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

function domainAllowed(user) {
  if (!AUTH_DOMAINS.length) return true;
  const lower = user.toLowerCase();
  return AUTH_DOMAINS.some((d) => lower === d || lower.endsWith(`@${d}`));
}

function checkAuth(req) {
  if (AUTH_MODE === 'none') return { ok: true, user: null };

  if (AUTH_MODE === 'basic') {
    if (!BASIC_USERS.length) {
      return { ok: false, status: 503, message: 'Aucun compte configuré (KANBAN_BASIC_USERS).' };
    }
    const [scheme, payload] = String(req.headers.authorization || '').split(' ');
    if (!/^basic$/i.test(scheme || '') || !payload) {
      return { ok: false, status: 401, message: 'Authentification requise.', challenge: true };
    }
    let decoded = '';
    try {
      decoded = Buffer.from(payload, 'base64').toString('utf8');
    } catch {
      /* base64 invalide */
    }
    const sep = decoded.indexOf(':');
    const email = (sep >= 0 ? decoded.slice(0, sep) : '').trim().toLowerCase();
    const password = sep >= 0 ? decoded.slice(sep + 1) : '';
    const account = BASIC_USERS.find((u) => u.email === email);
    if (!account || !sameSecret(account.password, password)) {
      return { ok: false, status: 401, message: 'Identifiants invalides.', challenge: true };
    }
    if (!domainAllowed(email)) {
      return { ok: false, status: 403, message: "Ce compte n'est pas autorisé à accéder à ce kanban." };
    }
    return { ok: true, user: email };
  }

  const raw = req.headers[AUTH_HEADER];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const user = String(value || '').trim();
  if (!user) return { ok: false, status: 401, message: 'Authentification requise (SSO).' };
  if (!domainAllowed(user)) {
    return { ok: false, status: 403, message: "Ce compte n'est pas autorisé à accéder à ce kanban." };
  }
  return { ok: true, user };
}

function currentUser(req) {
  const gate = checkAuth(req);
  return gate.ok ? gate.user : null;
}

/** Identité normalisée de l'appelant (email SSO, minuscules), ou '' si anonyme. */
function identityOf(req) {
  return String(currentUser(req) || '')
    .trim()
    .toLowerCase();
}

/** Refuse la requête (401) si aucune identité SSO n'est disponible. */
function requireIdentity(req, res, message) {
  const user = identityOf(req);
  if (!user) {
    fail(res, 401, message || 'Authentification SSO requise pour cette action.');
    return null;
  }
  return user;
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

function json(res, status, payload, headers = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  });
  res.end(body);
}

function fail(res, status, message, headers) {
  json(res, status, { error: message }, headers);
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
        demo: SEED_MODE === 'demo',
        seed: SEED_MODE,
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
      const story = createStory({ createdBy: identityOf(req) || null, ...body });
      saveDb();
      return json(res, 201, story);
    }
    // Vote d'équipe anonyme : uniquement tant que la US n'a pas de version.
    if (method === 'POST' && parts[1] && parts[2] === 'vote' && parts.length === 3) {
      const story = db.stories.find((s) => s.id === parts[1]);
      if (!story) return fail(res, 404, 'User story introuvable.');
      if (story.versionId) return fail(res, 409, 'Cette US a déjà une version : le vote est clos.');
      const body = await readBody(req);
      const value = Number(body.value);
      if (![1, -1, 0].includes(value)) return fail(res, 400, 'Vote invalide (1 = pour, -1 = contre, 0 = remise à zéro).');
      story.votes = normalizeVotes(story.votes);
      if (value === 1) story.votes.up += 1;
      else if (value === -1) story.votes.down += 1;
      else story.votes = { up: 0, down: 0 };
      story.updatedAt = Date.now();
      saveDb();
      return json(res, 200, { ...story, score: voteScore(story.votes) });
    }
    // Suggestions signées sur une US (auteur = identité SSO).
    if (method === 'POST' && parts[2] === 'suggestions' && parts.length === 3) {
      const story = db.stories.find((s) => s.id === parts[1]);
      if (!story) return fail(res, 404, 'User story introuvable.');
      const author = requireIdentity(req, res, 'Connecte-toi via le SSO pour proposer une suggestion.');
      if (!author) return;
      const body = await readBody(req);
      const text = String(body.text || '').trim();
      if (text.length < 3) return fail(res, 400, 'La suggestion est trop courte (3 caractères minimum).');
      story.suggestions = Array.isArray(story.suggestions) ? story.suggestions : [];
      if (story.suggestions.length >= 50) return fail(res, 400, 'Trop de suggestions sur cette user story.');
      const suggestion = { id: uid('sug'), author, text: text.slice(0, 1000), createdAt: Date.now() };
      story.suggestions.push(suggestion);
      story.updatedAt = Date.now();
      saveDb();
      return json(res, 201, suggestion);
    }
    if (method === 'DELETE' && parts[2] === 'suggestions' && parts[3] && parts.length === 4) {
      const story = db.stories.find((s) => s.id === parts[1]);
      if (!story) return fail(res, 404, 'User story introuvable.');
      const suggestion = (story.suggestions || []).find((x) => x.id === parts[3]);
      if (!suggestion) return fail(res, 404, 'Suggestion introuvable.');
      const author = requireIdentity(req, res, 'Connecte-toi via le SSO pour supprimer cette suggestion.');
      if (!author) return;
      if (suggestion.author && suggestion.author !== author) {
        return fail(res, 403, 'Seul l’auteur de la suggestion peut la supprimer.');
      }
      story.suggestions = story.suggestions.filter((x) => x.id !== suggestion.id);
      story.updatedAt = Date.now();
      saveDb();
      return json(res, 200, { ok: true });
    }
    if (method === 'PATCH' && parts[1] && parts.length === 2) {
      const body = await readBody(req);
      const story = updateStory(parts[1], body);
      if (!story) return fail(res, 404, 'User story introuvable.');
      saveDb();
      return json(res, 200, story);
    }
    if (method === 'DELETE' && parts.length === 2) {
      const idx = db.stories.findIndex((s) => s.id === parts[1]);
      if (idx < 0) return fail(res, 404, 'User story introuvable.');
      const story = db.stories[idx];
      const author = identityOf(req);
      // Une US créée via le SSO n'est supprimable que par son auteur.
      // Les US sans auteur (démo, import de CR) restent supprimables par tous.
      if (story.createdBy && story.createdBy !== author) {
        return fail(res, 403, 'Seul l’auteur peut supprimer cette user story.');
      }
      const [removed] = db.stories.splice(idx, 1);
      for (const report of db.reports) {
        report.storyIds = (report.storyIds || []).filter((id) => id !== removed.id);
      }
      for (const idea of db.ideas || []) {
        if (idea.promotedStoryId === removed.id) idea.promotedStoryId = null;
      }
      saveDb();
      return json(res, 200, { ok: true });
    }
  }

  // --- Idées (boîte à suggestions signée) ---
  if (parts[0] === 'ideas') {
    if (method === 'POST' && parts.length === 1) {
      const author = requireIdentity(req, res, 'Connecte-toi via le SSO pour proposer une idée.');
      if (!author) return;
      const body = await readBody(req);
      const title = String(body.title || '').trim();
      if (!title) return fail(res, 400, 'Le titre de l’idée est obligatoire.');
      const idea = normalizeIdea({
        title: title.slice(0, 200),
        text: String(body.text || '').slice(0, 2000),
        author,
        votes: { up: 0, down: 0 },
      });
      db.ideas.unshift(idea);
      saveDb();
      return json(res, 201, idea);
    }
    const idea = parts[1] ? db.ideas.find((x) => x.id === parts[1]) : null;
    if (parts[1] && !idea && ['DELETE', 'POST'].includes(method)) return fail(res, 404, 'Idée introuvable.');

    if (method === 'POST' && parts[2] === 'vote' && parts.length === 3) {
      if (idea.promotedStoryId) return fail(res, 409, 'Cette idée a déjà été promue : le vote est clos.');
      const body = await readBody(req);
      const value = Number(body.value);
      if (![1, -1, 0].includes(value)) return fail(res, 400, 'Vote invalide (1 = pour, -1 = contre, 0 = remise à zéro).');
      idea.votes = normalizeVotes(idea.votes);
      if (value === 1) idea.votes.up += 1;
      else if (value === -1) idea.votes.down += 1;
      else idea.votes = { up: 0, down: 0 };
      saveDb();
      return json(res, 200, { ...idea, score: voteScore(idea.votes) });
    }

    if (method === 'POST' && parts[2] === 'promote' && parts.length === 3) {
      const author = requireIdentity(req, res, 'Connecte-toi via le SSO pour promouvoir une idée.');
      if (!author) return;
      if (idea.promotedStoryId) return fail(res, 409, 'Cette idée a déjà été promue.');
      const story = createStory({
        title: idea.title,
        description: idea.text,
        createdBy: idea.author || author,
        versionId: null,
        status: 'todo',
        tags: ['idée'],
        source: { line: 0, section: 'Boîte à idées', excerpt: String(idea.text || '').slice(0, 220) },
      });
      idea.promotedStoryId = story.id;
      idea.promotedAt = Date.now();
      saveDb();
      return json(res, 201, { idea, story });
    }

    if (method === 'DELETE' && parts.length === 2) {
      const author = requireIdentity(req, res, 'Connecte-toi via le SSO pour supprimer cette idée.');
      if (!author) return;
      if (idea.author && idea.author !== author) {
        return fail(res, 403, 'Seul l’auteur de l’idée peut la supprimer.');
      }
      const idx = db.ideas.findIndex((x) => x.id === idea.id);
      db.ideas.splice(idx, 1);
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
        createdBy: row.createdBy || identityOf(req) || null,
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
    if (SEED_MODE !== 'demo') {
      return fail(res, 403, 'Réinitialisation de la démo désactivée sur cette instance.');
    }
    replaceDb(seedState());
    return json(res, 200, publicState());
  }

  if (pathname === '/demo-cr' && method === 'GET') {
    const demo = db.reports.find((r) => r.id === 'rep_demo');
    if (!demo && SEED_MODE !== 'demo') {
      return fail(res, 404, 'Aucun compte rendu d’exemple sur cette instance.');
    }
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
    const headers = gate.challenge ? { 'WWW-Authenticate': BASIC_REALM } : {};
    if (url.pathname.startsWith('/api/')) return fail(res, gate.status, gate.message, headers);
    res.writeHead(gate.status, { 'Content-Type': 'text/html; charset=utf-8', ...headers });
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
  console.log(`  Données : ${path.join(DATA_DIR, 'db.json')}`);
  console.log(`  Moteur  : ${llmInfo().enabled ? `IA (${llmInfo().model})` : 'extraction locale (heuristique)'}`);
  console.log(
    `  Accès   : ${AUTH_MODE === 'proxy' ? `SSO via en-tête ${AUTH_HEADER}${AUTH_DOMAINS.length ? ` (domaines : ${AUTH_DOMAINS.join(', ')})` : ''}` : 'libre (aucune authentification)'}`
  );
  console.log('');
});

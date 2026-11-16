import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSeed, makeEmptySeed } from './seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.KANBAN_DATA_DIR ? path.resolve(process.env.KANBAN_DATA_DIR) : path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

/**
 * Données créées au premier lancement (aucun db.json) :
 * - `demo` (défaut) : équipe, versions, US et idées de démonstration ;
 * - `empty` : projet vide, pour la production.
 * KANBAN_SEED=empty est positionné dans l'image Docker de production.
 */
export const SEED_MODE = String(process.env.KANBAN_SEED || 'demo').trim().toLowerCase() === 'empty' ? 'empty' : 'demo';

export function seedState() {
  return SEED_MODE === 'empty' ? makeEmptySeed() : makeSeed();
}

export const STATUSES = ['todo', 'in_progress', 'review', 'done'];
export const PRIORITIES = ['low', 'medium', 'high'];

export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

function load() {
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.stories)) return parsed;
  } catch {
    /* premier lancement */
  }
  return seedState();
}

export const db = load();

export function ensureShape() {
  db.project ||= { name: 'Mon équipe', nextKey: 1, description: '', sprint: '' };
  db.members ||= [];
  db.versions ||= [];
  db.stories ||= [];
  db.reports ||= [];
  db.ideas ||= [];
  db.project.nextKey ||= db.stories.length + 1;
  for (const story of db.stories) {
    story.votes = normalizeVotes(story.votes);
    story.suggestions = Array.isArray(story.suggestions)
      ? story.suggestions.map((s) => normalizeSuggestion(s)).filter((s) => s.text)
      : [];
    story.createdBy = story.createdBy || null;
  }
  db.ideas = db.ideas.map((idea) => normalizeIdea(idea));
}

/* ------------------------------------------------------------------ */
/* Suggestions signées (auteur = identité SSO)                         */
/* ------------------------------------------------------------------ */

export function normalizeSuggestion(input = {}) {
  return {
    id: input.id || uid('sug'),
    author: String(input.author || '').trim().toLowerCase().slice(0, 160) || null,
    text: String(input.text || '').slice(0, 1000).trim(),
    createdAt: Number.isFinite(Number(input.createdAt)) ? Number(input.createdAt) : Date.now(),
  };
}

export function normalizeIdea(input = {}, base = null) {
  const src = { ...(base || {}), ...input };
  return {
    id: base?.id || input.id || uid('idea'),
    title: String(src.title || '').slice(0, 200).trim() || 'Sans titre',
    text: String(src.text || '').slice(0, 2000),
    author: String(src.author || '').trim().toLowerCase().slice(0, 160) || null,
    votes: normalizeVotes(src.votes, base?.votes),
    createdAt: base?.createdAt || Number(src.createdAt) || Date.now(),
    promotedStoryId: src.promotedStoryId || null,
    promotedAt: Number(src.promotedAt) || null,
  };
}

/* ------------------------------------------------------------------ */
/* Votes d'équipe (US sans version)                                    */
/* ------------------------------------------------------------------ */

/** Deux compteurs anonymes : pour / contre. */
export function normalizeVotes(value, base = null) {
  const src = value && typeof value === 'object' ? value : base;
  const count = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.min(9999, Math.max(0, Math.trunc(n))) : 0;
  };
  return { up: count(src?.up), down: count(src?.down) };
}

export function voteScore(votes) {
  const v = normalizeVotes(votes);
  return { up: v.up, down: v.down, score: v.up - v.down, total: v.up + v.down };
}

export function saveDb() {
  ensureShape();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(db, null, 2), 'utf8');
  fs.renameSync(tmp, DB_PATH);
}

export function replaceDb(next) {
  if (!next || !Array.isArray(next.stories)) throw new Error('Fichier de sauvegarde invalide.');
  for (const key of Object.keys(db)) delete db[key];
  Object.assign(db, next);
  ensureShape();
  saveDb();
}

/* ------------------------------------------------------------------ */
/* Normalisation                                                       */
/* ------------------------------------------------------------------ */

const str = (v, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : '');
const boolish = (v) => v === true;

export function normalizeStory(input, base = null) {
  const src = { ...(base || {}), ...input };
  const assigneeIds = Array.isArray(src.assigneeIds)
    ? src.assigneeIds.filter((id) => db.members.some((m) => m.id === id))
    : base?.assigneeIds || [];

  const versionId = src.versionId && db.versions.some((v) => v.id === src.versionId) ? src.versionId : null;
  const status = STATUSES.includes(src.status) ? src.status : 'todo';
  const tags = Array.isArray(src.tags)
    ? [...new Set(src.tags.map((t) => String(t).trim()).filter(Boolean))].slice(0, 8)
    : base?.tags || [];

  const points = src.points === null || src.points === '' || src.points === undefined ? null : Number(src.points);

  return {
    id: base?.id || uid('us'),
    key: base?.key || `US-${db.project.nextKey++}`,
    title: str(src.title, 200).trim() || 'Sans titre',
    asA: str(src.asA, 120).trim(),
    iWant: str(src.iWant, 400).trim(),
    soThat: str(src.soThat, 400).trim(),
    description: str(src.description, 4000),
    status,
    assigneeIds,
    versionId,
    priority: PRIORITIES.includes(src.priority) ? src.priority : 'medium',
    points: Number.isFinite(points) && points >= 0 ? Math.min(points, 100) : null,
    due: str(src.due, 60).trim(),
    tags,
    order: Number.isFinite(src.order) ? src.order : nextOrder(status),
    createdAt: base?.createdAt || Date.now(),
    updatedAt: Date.now(),
    reportId: src.reportId || base?.reportId || null,
    source: src.source || base?.source || null,
    votes: normalizeVotes(src.votes, base?.votes),
    createdBy: String(src.createdBy || '').trim().toLowerCase().slice(0, 160) || null,
    suggestions: Array.isArray(src.suggestions)
      ? src.suggestions.map((x) => normalizeSuggestion(x)).filter((x) => x.text).slice(0, 100)
      : [],
    archived: boolish(src.archived),
  };
}

export function nextOrder(status) {
  const list = db.stories.filter((s) => s.status === status);
  return list.length ? Math.max(...list.map((s) => s.order || 0)) + 1 : 0;
}

export function createStory(input) {
  const story = normalizeStory(input);
  db.stories.push(story);
  return story;
}

export function updateStory(id, patch) {
  const idx = db.stories.findIndex((s) => s.id === id);
  if (idx < 0) return null;
  const story = normalizeStory(patch, db.stories[idx]);
  db.stories[idx] = story;
  return story;
}

export function createReport({ name, text, participants = [], engine = 'heuristique' }) {
  const report = {
    id: uid('rep'),
    name: str(name, 200) || 'Compte rendu',
    createdAt: Date.now(),
    participants: participants.filter((id) => db.members.some((m) => m.id === id)),
    storyIds: [],
    engine,
    text: str(text, 60000),
  };
  db.reports.unshift(report);
  return report;
}

export function publicReport(r, withText = false) {
  const { text, ...rest } = r;
  return {
    ...rest,
    chars: text?.length || 0,
    excerpt: (text || '').replace(/\s+/g, ' ').slice(0, 180),
    ...(withText ? { text } : {}),
  };
}

export function publicState() {
  return {
    project: db.project,
    members: db.members,
    versions: db.versions,
    stories: db.stories,
    ideas: db.ideas,
    reports: db.reports.map((r) => publicReport(r)),
  };
}

ensureShape();

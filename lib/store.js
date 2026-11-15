import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeSeed } from './seed.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.KANBAN_DATA_DIR ? path.resolve(process.env.KANBAN_DATA_DIR) : path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

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
  return makeSeed();
}

export const db = load();

export function ensureShape() {
  db.project ||= { name: 'Mon équipe', nextKey: 1, description: '', sprint: '' };
  db.members ||= [];
  db.versions ||= [];
  db.stories ||= [];
  db.reports ||= [];
  db.project.nextKey ||= db.stories.length + 1;
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
    reports: db.reports.map((r) => publicReport(r)),
  };
}

ensureShape();

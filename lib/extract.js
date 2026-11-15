/**
 * Moteur d'extraction local (sans IA, sans reseau).
 * Analyse un compte rendu de reunion (francais ou anglais) et propose des user
 * stories avec responsable, version, priorite et echeance quand c'est possible.
 *
 * Gere : listes a puces, cases a cocher, tableaux (| ou Word), prose, formats
 * "Action / Responsable / Echeance" sur plusieurs lignes, et les user stories
 * deja redigees ("En tant que ... je veux ...").
 */

export const norm = (s = '') =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/* ------------------------------------------------------------------ */
/* Vocabulaire                                                         */
/* ------------------------------------------------------------------ */

const ER_VERBS = [
  'creer', 'ajouter', 'corriger', 'rediger', 'preparer', 'contacter', 'valider', 'tester',
  'migrer', 'developper', 'configurer', 'installer', 'verifier', 'analyser', 'recetter',
  'ecrire', 'implementer', 'finaliser', 'terminer', 'livrer', 'publier', 'notifier', 'gerer',
  'ameliorer', 'optimiser', 'remplacer', 'nettoyer', 'supprimer', 'renommer', 'traduire',
  'designer', 'prototyper', 'brancher', 'deployer', 'integrer', 'organiser', 'etudier',
  'cadrer', 'chiffrer', 'maquetter', 'planifier', 'documenter', 'prioriser', 'estimer',
  'automatiser', 'securiser', 'monitorer', 'penser', 'recruter', 'former', 'presenter',
  'envoyer', 'relancer', 'facturer', 'refactorer', 'synchroniser', 'exporter', 'importer',
  'afficher', 'filtrer', 'trier', 'mesurer', 'auditer', 'cartographier', 'benchmarker',
  'harmoniser', 'simplifier', 'moderniser', 'adapter', 'payer', 'connecter', 'authentifier',
  'rechercher', 'sauvegarder', 'restaurer', 'signaler', 'alerter', 'tracer', 'evaluer',
  'realiser', 'effectuer', 'traiter', 'piloter', 'coordonner', 'arbitrer', 'centraliser',
  'reduire', 'accelerer', 'stabiliser', 'regrouper', 'fusionner', 'extraire', 'archiver',
  'paginer', 'accompagner', 'internationaliser', 'localiser', 'personnaliser', 'instrumenter',
];

const OTHER_ACTIONS = [
  'doit', 'doivent', 'devra', 'devront', 'devrait', 'devraient', 'faut', 'faudrait', 'faudra',
  'mettre', 'mets', 'mis', 'revoir', 'revois', 'relire', 'relis', 'definir', 'definis',
  'refondre', 'refonte', 'tenir', 'prendre', 'faire', 'fais', 'ecrire', 'ecrit',
  "s occupe", "s'occupe", 'occupe', 'charge', 'charger', 'assurer', 'assure',
  'prevoir', 'prevoit', 'prevu', 'planifie', 'valide', 'corrige', 'finalise',
  'branche', 'deploie', 'integre', 'teste', 'redige', 'prepare', 'organise',
  'reste a', 'a faire', 'a realiser', 'a prevoir', 'a corriger', 'a valider',
  'a mettre', 'a livrer', 'a tester', 'a rediger', 'a cadrer', 'a chiffrer',
];

const EN_VERBS = [
  'create', 'add', 'fix', 'build', 'design', 'implement', 'migrate', 'test', 'review',
  'write', 'update', 'deploy', 'refactor', 'document', 'ship', 'wire', 'integrate',
  'remove', 'improve', 'prepare', 'send', 'contact', 'validate', 'verify', 'deliver',
  'launch', 'release', 'clean', 'rename', 'translate', 'configure', 'install', 'analyze',
  'monitor', 'secure', 'automate', 'export', 'import', 'filter', 'sort', 'measure',
  'audit', 'plan', 'finalize', 'handle', 'support', 'provide', 'define', 'schedule',
  'prioritize', 'estimate', 'set', 'upgrade', 'check', 'connect', 'book', 'collect',
];

function erForms(inf) {
  const stem = inf.endsWith('er') ? inf.slice(0, -2) : inf;
  return `${stem}(?:er|e|es|ent|ons|ez|ee?s?|ant|ait|aient|era|erez|eront|eras|erons|ais|iez)`;
}

function enForms(inf) {
  const stem = inf.endsWith('e') ? inf.slice(0, -1) : inf;
  return `${stem}(?:e|es|ed|d|ing|s)?`;
}

const ACTION_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${ER_VERBS.map(erForms).join('|')}|${OTHER_ACTIONS.map((v) =>
    v.replace(/ /g, '\\s+')
  ).join('|')})(?![\\p{L}\\p{N}])`,
  'iu'
);

const EN_ACTION_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${EN_VERBS.map(enForms).join('|')})(?![\\p{L}\\p{N}])`,
  'iu'
);

const EN_MODAL_RE = /(?<![\p{L}])(?:should|must|needs?\s+to|has\s+to|have\s+to|will|action\s+items?|todo|to\s+do|tasks?)(?![\p{L}])/iu;

const IMPERATIVE_EXTRA =
  /^(?:fais|faisons|prevois|revois|relis|definis|mets|ecris|envoie|verifie|valide|corrige|finalise|branche|deploie|integre|teste|redige|prepare|organise|contacte|ajoute|cree|creer|livre)\b/i;

const US_RE =
  /(?<![\p{L}])(?:en\s+tant\s+qu|\bas\s+an?\b[^.]{0,80}?\bi\s+(?:want|need|would\s+like)\b)/iu;

const BULLET_RE = /^\s*(?:[-*•‣·–—▪▫●○◦→➜]|\d{1,2}[.)]|[a-zA-Z][.)])\s+/;
const CHECKBOX_RE = /^\s*(?:[-*•‣]\s*)?(?:\[[ xX]?\]|[☐☑✅])\s*/;

const HEADER_HINT =
  /^(?:#{1,6}\s*)?(?:\*\*|__)?\s*(?:ordre du jour|decisions?|actions?(?:\s+(?:a\s+mener|men[ée]es?|retenues?))?|a\s+faire(?:\s+.{0,40})?|t[aâ]ches?|todo|points? (?:bloquants?|abordes?|divers|ouverts?)|prochaines? etapes?|participants?|presents?|absents?|excuses?|notes?|resume|compte[- ]rendu|sprint|objectifs?|risques?|questions?|divers|suivi|pour info|informations?|contexte|budget|planning|livrables?|retro(?:spective)?|projets?|sujets?|annonces?|users?\s+stor(?:y|ies)|us\s+define[ds]?)\s*:?\s*(?:\*\*|__)?$/i;

const IGNORED_SECTIONS =
  /^(participants?|presents?|absents?|excuses?|ordre du jour|resume|compte[- ]rendu|pour info|informations?|contexte|budget|planning)$/i;

const DECISION_SECTION = /^d[ée]cisions?$/i;

const SPEAKER_RE = /^([A-ZÀ-ÖØ-Þ][\p{L}'’-]{1,22})\s*:\s*(.{3,})$/u;

const PRIORITY_HIGH = /(?:urgent|urgente|critique|bloquant|bloquante|asap|prioritaire|imperatif|au plus vite|immediatement|\bhigh\b|\bcritical\b)/i;
const PRIORITY_LOW = /(?:nice to have|si possible|plus tard|pas urgent|bonus|optionnel|secondaire|eventuellement|\blow\b)/i;

const DUE_PATTERNS = [
  /\b(?:avant|d'ici|pour|au plus tard le|au plus tard)\s+(?:le\s+|la\s+)?(\d{1,2}\s*[\/.\-]\s*\d{1,2}(?:\s*[\/.\-]\s*\d{2,4})?)/i,
  /\b(?:avant|d'ici|pour)\s+((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)(?:\s+(?:prochain|prochaine|matin|soir))?)/i,
  /\b((?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\s+(?:prochain|prochaine))\b/i,
  /\b((?:d[ée]but|courant|fin)\s+(?:de\s+)?(?:semaine|mois|trimestre|sprint))/i,
  /\b(cette semaine|semaine prochaine|la semaine prochaine|le mois prochain|mois prochain)\b/i,
  /\b(sprint\s*\d+)\b/i,
  /\b(by\s+(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|the\s+end\s+of\s+the\s+week))\b/i,
  /\b(\d{1,2}\s*[\/.\-]\s*\d{1,2}(?:\s*[\/.\-]\s*\d{2,4})?)\b/,
  /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i,
  /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b/i,
];

const NOISE_RE =
  /^(?:bonjour|salut|merci|ok|c'est noté|noté|rien à signaler|ras|fin de r[ée]union|hello|thanks|thank you|no news)\b/i;

const MULTI_ACTION_RE =
  /[,;]\s+(?=(?:il faut|il faudra|il faudrait|on doit|on va|on devrait|penser [àa]|pr[ée]voir)\b)/i;

const PASSIVE_RE = /\b(?:est|sont|a été|ont été|sera|seront|was|were|is|are)\s+\p{L}{2,}(?:é|ée|és|ées)\b/iu;

const HINT_PATTERNS = [
  ['ownerHint', /^(?:responsables?|qui|assign[ée]e?s?(?:\s*[àa])?|owner|porteur|assigned\s*to|assignee)\s*[:\-–]\s*(.+)$/i],
  ['dueHint', /^(?:[ée]ch[ée]ance|quand|deadline|due(?:\s+date)?|pour\s+le)\s*[:\-–]\s*(.+)$/i],
  ['priorityHint', /^(?:priorit[ée]|priority|importance)\s*[:\-–]\s*(.+)$/i],
  ['versionHint', /^(?:version|release|lot)\s*[:\-–]\s*(.+)$/i],
];

const TABLE_HEADER_CELL =
  /^(?:actions?|t[âa]ches?|tasks?|description|sujet|responsables?|qui|owners?|assign[ée]e?s?|assignee|[ée]ch[ée]ance|date|quand|due(?:\s*date)?|priorit[ée]|priority|statut|status|version|points?|estim\.?|estimation|lot|ref)\b/i;

function stripAccentsLower(s) {
  return norm(s).replace(/[’']/g, "'");
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ */
/* Decoupage du texte en items                                         */
/* ------------------------------------------------------------------ */

function isHeader(line, raw) {
  const t = line.replace(/^#{1,6}\s*/, '').replace(/\*\*|__/g, '').trim();
  if (!t || t.length > 70) return false;
  if (/\d/.test(t) === false && t === t.toUpperCase() && /[A-ZÀ-Þ]/.test(t) && t.split(/\s+/).length <= 6) {
    return true;
  }
  if (t.endsWith(':') && t.split(/\s+/).length <= 8) return true;
  // Les titres sont souvent ecrits sans accent ("Decisions", "A faire")
  if (HEADER_HINT.test(t) || HEADER_HINT.test(stripAccentsLower(t))) return true;
  if (/^#{1,6}\s/.test(raw.trim())) return true;
  return false;
}

function cleanHeader(line) {
  return line
    .replace(/^#{1,6}\s*/, '')
    .replace(/\*\*|__/g, '')
    .replace(/:+\s*$/, '')
    .trim();
}

function parseTableRow(line) {
  let cells;
  if (/\|/.test(line)) {
    cells = line
      .replace(/^\s*\|/, '')
      .replace(/\|\s*$/, '')
      .split('|')
      .map((c) => c.trim());
  } else {
    // Tableau colle depuis Word / Excel : colonnes separees par des tabulations
    cells = line.split(/\t+/).map((c) => c.trim());
  }
  if (cells.length < 2) return null;
  if (cells.every((c) => !c || /^:?-{2,}:?$/.test(c))) return null;
  const nonEmpty = cells.filter(Boolean);
  if (nonEmpty.length < 2) return null;
  if (nonEmpty.every((c) => TABLE_HEADER_CELL.test(c))) return null;
  return nonEmpty;
}

function isTableLine(line) {
  if ((line.match(/\|/g) || []).length >= 2) return true;
  return line.includes('\t') && line.split('\t').filter((c) => c.trim()).length >= 2;
}

export function toItems(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
  const items = [];
  let section = '';
  let current = null;
  let last = null;

  const push = (item) => {
    items.push(item);
    last = item;
  };
  const flush = () => {
    if (current && current.text.trim()) push(current);
    current = null;
  };
  const attach = (key, value) => {
    if (current) current[key] = value;
    else if (last) last[key] = value;
    else if (current) current[key] = value;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (/^[-=_*]{3,}$/.test(line)) {
      flush();
      continue;
    }

    // Tableau (markdown, Word converti, copier-coller)
    if (isTableLine(line)) {
      const cells = parseTableRow(line);
      if (cells) {
        flush();
        push({ text: cells.join(' — '), line: i + 1, section, table: cells, bullet: true });
      } else {
        flush();
      }
      continue;
    }

    // Indices multi-lignes : Responsable / Echeance / Priorite / Version
    // (accepte aussi les puces : "- Responsable : Thomas" ou "[ ] Qui : Thomas")
    const hintSource = line.replace(CHECKBOX_RE, '').replace(BULLET_RE, '').trim();
    let hinted = false;
    for (const [key, re] of HINT_PATTERNS) {
      const m = hintSource.match(re);
      if (m) {
        attach(key, m[1].trim());
        hinted = true;
        break;
      }
    }
    if (hinted) continue;

    // Cases a cocher et puces
    const checkboxMatch = line.match(CHECKBOX_RE);
    if (checkboxMatch) {
      flush();
      const body = line.slice(checkboxMatch[0].length).trim();
      if (!body) continue;
      current = {
        text: body,
        line: i + 1,
        section,
        bullet: true,
        done: /[xX✅☑]/.test(checkboxMatch[0]),
      };
      continue;
    }
    if (BULLET_RE.test(line)) {
      flush();
      const body = line.replace(BULLET_RE, '').trim();
      const inline = body.match(SPEAKER_RE);
      if (inline) {
        push({ text: inline[2].trim(), line: i + 1, section, speaker: inline[1], bullet: true });
      } else {
        current = { text: body, line: i + 1, section, bullet: true };
      }
      continue;
    }

    // Titres de section
    if (isHeader(line, raw) && !SPEAKER_RE.test(line)) {
      flush();
      section = cleanHeader(line);
      continue;
    }

    // "Marie : faire ceci"
    const spk = line.match(SPEAKER_RE);
    if (spk) {
      flush();
      if (/^(?:participants?|pr[ée]sents?|absents?|excus[ée]s?|ordre du jour|d[ée]cisions?|attendees?)$/i.test(spk[1].trim())) {
        section = spk[1].trim();
        continue;
      }
      push({ text: spk[2].trim(), line: i + 1, section, speaker: spk[1] });
      continue;
    }

    if (current) {
      if (/[.!?;]\s*$/.test(current.text) || /[.!?]$/.test(line)) {
        flush();
        current = { text: line, line: i + 1, section };
      } else {
        current.text += ' ' + line;
      }
    } else {
      current = { text: line, line: i + 1, section };
    }
  }
  flush();
  return items;
}

function splitSentences(text) {
  const parts = String(text)
    .split(/(?<=[.!?])\s+(?=[A-ZÀ-Þ«"])|;\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : [String(text).trim()];
}

function splitUnits(raw) {
  // On decoupe systematiquement les phrases : une ligne de prose contient
  // souvent plusieurs actions distinctes.
  const base = /[.!?]\s+\S/.test(raw) ? splitSentences(raw) : [raw];
  return base
    .flatMap((p) => p.split(/\s*[•·]\s+/))
    .flatMap((p) => p.split(MULTI_ACTION_RE))
    .map((s) => s.trim())
    .filter(Boolean);
}

/* ------------------------------------------------------------------ */
/* Personnes                                                           */
/* ------------------------------------------------------------------ */

function memberTokens(member) {
  const out = new Set();
  const full = String(member.name || '').trim();
  if (!full) return [];
  out.add(stripAccentsLower(full));
  for (const part of full.split(/\s+/)) {
    if (part.length >= 3) out.add(stripAccentsLower(part));
  }
  if (member.email) out.add(stripAccentsLower(member.email.split('@')[0]));
  if (member.aliases) {
    for (const a of String(member.aliases).split(/[,;]/)) {
      if (a.trim().length >= 2) out.add(stripAccentsLower(a.trim()));
    }
  }
  return [...out].filter(Boolean);
}

function normalizeWords(text) {
  return ` ${stripAccentsLower(text)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')} `;
}

function memberNameMatch(text, member) {
  const n = normalizeWords(text);
  return memberTokens(member).some((tok) => tok.length >= 3 && n.includes(` ${tok} `));
}

export function findMembersInText(text, members) {
  const n = normalizeWords(text);
  return members.filter((m) => memberTokens(m).some((tok) => tok.length >= 3 && (n.includes(` ${tok} `) || n.includes(` @${tok} `))));
}

export function findParticipants(text, members) {
  const head = String(text).split(/\n/).slice(0, 14).join('\n');
  const explicit = /(?:pr[ée]sents?|participants?|attendees|autour de la table)\s*:?\s*(.+)/i.exec(head);
  const found = new Map();
  if (explicit) {
    for (const m of findMembersInText(explicit[1], members)) found.set(m.id, m);
  }
  for (const m of findMembersInText(head, members)) {
    if (!found.has(m.id)) found.set(m.id, m);
  }
  if (found.size === 0) {
    for (const m of findMembersInText(text, members)) found.set(m.id, m);
  }
  return [...found.values()];
}

/* ------------------------------------------------------------------ */
/* Analyse d'un item                                                   */
/* ------------------------------------------------------------------ */

function extractDue(text) {
  for (const re of DUE_PATTERNS) {
    const m = re.exec(text);
    if (m) return { label: m[1].trim().replace(/\s+/g, ' '), index: m.index, length: m[0].length };
  }
  return null;
}

function extractVersion(text, versions) {
  const v = /\bv\s?(\d+(?:\.\d+)?)\b/i.exec(text);
  if (v) {
    const wanted = `v${v[1]}`;
    const match = versions.find((x) => stripAccentsLower(x.name).replace(/\s+/g, '').includes(wanted));
    if (match) return match;
    const loose = versions.find((x) => new RegExp(`(?:^|\\D)${v[1].replace('.', '\\.')}(?:\\D|$)`).test(x.name));
    return loose || null;
  }
  if (/\bmvp\b/i.test(text)) return versions.find((x) => /\bmvp\b/i.test(x.name)) || null;
  const phase = /\bphase\s*(\d+)\b/i.exec(text);
  if (phase) return versions.find((x) => new RegExp(`phase\\s*${phase[1]}\\b`, 'i').test(x.name)) || null;
  return null;
}

function findVersionByName(hint, versions) {
  if (!hint) return null;
  const n = stripAccentsLower(hint).replace(/\s+/g, '');
  return versions.find((v) => stripAccentsLower(v.name).replace(/\s+/g, '') === n) || null;
}

function detectCues(text) {
  const t = stripAccentsLower(text);
  const cues = [];
  if (US_RE.test(text)) cues.push('us');
  if (BULLET_RE.test(text)) cues.push('puce');
  const first = t.replace(BULLET_RE, '').trim().split(/\s+/)[0] || '';
  if (ACTION_RE.test(first) || IMPERATIVE_EXTRA.test(first) || EN_ACTION_RE.test(first)) cues.push('imperatif');
  if (ACTION_RE.test(t)) cues.push('verbe');
  if (EN_ACTION_RE.test(t)) cues.push('verbe-en');
  if (/(?:doit|doivent|devra|devront|faudra|va|vont|vas)\s+\w+(?:er|ir|re)\b/.test(t)) cues.push('modal');
  if (EN_MODAL_RE.test(text)) cues.push('modal-en');
  if (/\b(?:il faut|il faudra|il faudrait|on doit|on va|a faire|action|todo|tache|task|s'occupe|se charge|en charge de|responsable de)\b/.test(t)) {
    cues.push('formule');
  }
  return cues;
}

const ACCENT_CLASS = {
  a: '[aàâä]', c: '[cç]', e: '[eéèêë]', i: '[iîï]', n: '[nñ]', o: '[oôö]', u: '[uùûü]', y: '[yÿ]',
};

function flexName(name) {
  return [...name]
    .map((ch) => {
      const base = ch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      if (ACCENT_CLASS[base]) return ACCENT_CLASS[base];
      if (ch === "'" || ch === '’') return "['’]";
      if (/\s/.test(ch)) return '\\s+';
      return escapeRe(ch);
    })
    .join('');
}

const MODAL_TAIL =
  "(?:doit|doivent|devra|devront|devrais|devraient|va|vont|vas|should|must|needs?\\s+to|has\\s+to|have\\s+to|will|is\\s+going\\s+to|s'occupe\\s+(?:de|du|des|d['’])|s’occupe\\s+(?:de|du|des|d['’])|se\\s+charge\\s+de|est\\s+en\\s+charge\\s+de|prend\\s+en\\s+charge|souhaite|veut|propose|[\\p{L}]+(?:ra|ront))";

function removeAssigneePrefix(text, members) {
  let out = text;
  const variants = [];
  for (const m of members) {
    variants.push([m.name, m]);
    const first = m.name.split(/\s+/)[0];
    if (first && first.length >= 2) variants.push([first, m]);
    if (m.aliases) {
      for (const a of String(m.aliases).split(/[,;]/)) {
        if (a.trim().length >= 2) variants.push([a.trim(), m]);
      }
    }
  }
  variants.sort((a, b) => b[0].length - a[0].length);
  for (const [variant] of variants) {
    const re = new RegExp(`^\\s*${flexName(variant)}\\s*(?:,\\s*)?${MODAL_TAIL}\\s*`, 'iu');
    if (re.test(out)) return out.replace(re, '');
  }
  return out;
}

const NON_NAME_PREFIXES =
  /^(?:note|bug|point|action|t[âa]che|todo|rappel|risque|question|id[ée]e|info|information|d[ée]cision|objectif|sujet|probl[èe]me|attention|exemple|us|user\s*story|version|sprint)$/i;

const RELAY_RE =
  /^[\p{L}'’-]+(?:\s+[\p{L}'’-]+)?\s+(?:a\s+|avait\s+)?(?:rappel[ée]|indiqu[ée]|pr[ée]cis[ée]|expliqu[ée]|confirm[ée]|annonc[ée]|signal[ée]|ajout[ée]|demand[ée])\s+qu[e']\s+(.{3,})$/iu;

function cleanActionText(text, members, due) {
  let t = text.replace(CHECKBOX_RE, '').replace(BULLET_RE, '').trim();

  // "US : ...", "US-3 — ..."
  t = t.replace(/^(?:user\s*stor(?:y|ies)|us)\s*[-#]?\s*\d*\s*[:.\-–—]\s*/i, '');
  t = t.replace(/^\[[^\]]{0,12}\]\s*/, '');
  t = t.replace(/^@\w+\s*/, '');

  // "Marie a rappelé que ...", "Thomas indique que ..."
  t = t.replace(
    /^[\p{L}'’-]+\s+(?:a\s+|avait\s+)?(?:rappel[ée]|indiqu[ée]|pr[ée]cis[ée]|expliqu[ée]|confirm[ée]|annonc[ée]|signal[ée]|dit|ajout[ée]|demand[ée])\s+qu[e']\s*/iu,
    ''
  );

  t = removeAssigneePrefix(t, members);

  // Prefixe "Nom : " restant
  const lead = /^([\p{L}'’.-]{2,24})\s*:\s+(?=\S)/u.exec(t);
  if (lead && !NON_NAME_PREFIXES.test(lead[1]) && !/^\d/.test(lead[1])) {
    t = t.slice(lead[0].length);
  }

  t = t.replace(
    /^(?:il faut|il faudra|il faudrait|il est n[ée]cessaire de|on doit|on devrait|on va|il reste [àa]|reste [àa]|action\s*:?|todo\s*:?|t[âa]che\s*:?|-\s*)\s*/i,
    ''
  );
  if (due) {
    t = t.replace(new RegExp(`\\s*(?:avant|d'ici|pour|au plus tard le|au plus tard|before|by)\\s+(?:le\\s+|la\\s+|the\\s+)?${escapeRe(due.label)}`, 'i'), '');
    t = t.replace(new RegExp(`\\s*\\(?${escapeRe(due.label)}\\)?\\s*`, 'i'), ' ');
  }
  t = t.replace(/\s*\([^()]{0,40}?(?:v\d+(?:\.\d+)?|mvp|prioritaire|urgent|nice to have|optionnel|si possible|bloquant)[^()]{0,40}?\)\s*/gi, ' ');
  t = t.replace(/\s+(?:en|pour la|pour)\s+v\d+(?:\.\d+)?\b/gi, '');
  t = t.replace(/(?:[,;]\s*)?(?:c'?est|ce sera)\s*(?:urgent|critique|bloquant|prioritaire|important)\b[^.]*[.!]*$/i, '');
  t = t.replace(/[,;]\s*(?:urgent|critique|bloquant|prioritaire)\b[^.]*[.!]*$/i, '');
  t = t.replace(/[,;]?\s*(?:nice to have|si possible|plus tard|pas urgent)[.!]*$/i, '');

  // Nom / version en fin de ligne : "— v1", "— Thomas", "(Thomas)"
  t = t.replace(/\s*[–—\-·]\s*$/, '');
  t = t.replace(/\s*[–—\-·]\s*v\d+(?:\.\d+)?\s*$/i, '');
  for (const m of members) {
    const parts = [m.name, m.name.split(/\s+/)[0], ...(m.aliases ? String(m.aliases).split(/[,;]/).map((a) => a.trim()) : [])];
    for (const p of parts) {
      if (!p || p.length < 2) continue;
      const tail = new RegExp(`\\s*[–—\\-·(]\\s*${flexName(p)}\\s*\\)?\\s*$`, 'iu');
      if (tail.test(t)) t = t.replace(tail, '');
      const paren = new RegExp(`\\s*\\(\\s*${flexName(p)}\\s*\\)\\s*$`, 'iu');
      if (paren.test(t)) t = t.replace(paren, '');
    }
  }
  t = t.replace(/\s*[–—\-·]\s*v\d+(?:\.\d+)?\s*$/i, '');
  t = t.replace(/\s*[–—\-·]\s*$/, '');

  t = t.replace(/\s+/g, ' ').replace(/\s*[,;:.]+\s*$/, '').trim();
  return t;
}

export function toTitle(actionText, max = 92) {
  let t = actionText.trim().replace(/[.!?]+$/, '');
  if (!t) return '';
  t = t.charAt(0).toUpperCase() + t.slice(1);
  if (t.length > max) {
    const cut = t.slice(0, max);
    const space = cut.lastIndexOf(' ');
    t = `${cut.slice(0, space > 40 ? space : max)}…`;
  }
  return t;
}

function guessRole(member) {
  if (!member) return 'l’équipe';
  if (member.role && member.role.trim()) return `un(e) ${member.role.trim().replace(/^(un|une)\s+/i, '')}`;
  return 'l’équipe';
}

function toBenefit(text) {
  const m = /\b(?:afin de|afin d'|pour|dans le but de|de mani[èe]re [àa]|so\s+that)\s+(.+)$/i.exec(text);
  if (!m) return '';
  const b = m[1].replace(/[.!?]+$/, '').trim();
  return b.length > 3 && b.length < 140 ? b : '';
}

function buildUserStory(action, ctx) {
  const fr = /en tant qu[e']?\s*([^,]+?),?\s*(?:je (?:veux|souhaite|dois|peux)|on (?:veut|souhaite)|il (?:faut|faudrait))\s+(.+)/i.exec(action);
  const en = /\bas an?\s+([^,]+?),\s*i\s+(?:want|need|would\s+like)\s+(?:to\s+)?(.+)/i.exec(action);
  const explicit = fr || en;
  if (explicit) {
    const rest = explicit[2];
    const cut = rest.split(/\b(?:afin de|dans le but de|so\s+that)\b/i)[0];
    return {
      title: toTitle(cut),
      asA: explicit[1].trim(),
      iWant: cut.replace(/[.!?]+$/, '').trim(),
      soThat: toBenefit(rest),
    };
  }
  const iWant = action.replace(/[.!?]+$/, '').trim();
  return {
    title: toTitle(action),
    asA: guessRole(ctx.member),
    iWant,
    soThat: toBenefit(action),
  };
}

function scoreItem(item, cues, text) {
  let score = 0;
  if (cues.includes('us')) score += 6;
  if (cues.includes('imperatif')) score += 3;
  if (cues.includes('verbe')) score += 2;
  if (cues.includes('verbe-en')) score += 2;
  if (cues.includes('formule')) score += 2;
  if (cues.includes('modal')) score += 1;
  if (cues.includes('modal-en')) score += 1;
  if (item.bullet) score += 1;
  if (item.table) score += 2;
  if (item.memberMentions?.length) score += 2;
  if (item.speaker) score += 1;
  if (item.due) score += 1;
  if (item.ownerHint || item.dueHint) score += 2;
  if (/\b(?:en tant que|je veux|afin de)\b/i.test(text)) score += 2;
  if (PASSIVE_RE.test(text)) score -= 3;
  if (/[?]$/.test(text.trim())) score -= 2;
  if (NOISE_RE.test(text.trim())) score -= 4;
  if (text.length < 12) score -= 2;
  if (text.length > 320) score -= 1;
  if (/^(?:on |nous |nous avons |le point |la question )/i.test(text.trim())) score -= 1;
  return score;
}

function similarity(a, b) {
  const ta = new Set(stripAccentsLower(a).split(/\W+/).filter((w) => w.length > 2));
  const tb = new Set(stripAccentsLower(b).split(/\W+/).filter((w) => w.length > 2));
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / Math.min(ta.size, tb.size);
}

function isNameList(s, members) {
  const parts = s.split(',').map((x) => x.trim()).filter(Boolean);
  if (parts.length < 2) return false;
  if (parts.every((p) => /^[\p{Lu}][\p{L}'’-]*(\s+[\p{Lu}][\p{L}'’-]*){0,2}$/u.test(p))) return true;
  return parts.every((p) => members.some((m) => memberNameMatch(p, m)));
}

function isMetaCell(cell, members) {
  const c = cell.trim();
  if (!c) return true;
  if (/^\d{1,2}\s*[\/.-]\s*\d{1,2}/.test(c)) return true;
  if (/^(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i.test(c)) return true;
  if (/^v\d+(?:\.\d+)?$/i.test(c)) return true;
  if (PRIORITY_HIGH.test(c) || PRIORITY_LOW.test(c)) return true;
  if (/^(?:haute?|moyenne?|basse?|high|medium|low|p[0-3])$/i.test(c)) return true;
  if (/^\d+(?:[.,]\d+)?$/.test(c)) return true;
  if (members.some((m) => memberNameMatch(c, m))) return true;
  return false;
}

function pickActionCell(cells, members) {
  const candidates = cells.filter((c) => c && !isMetaCell(c, members));
  const pool = candidates.length ? candidates : cells.filter(Boolean);
  return pool.sort((a, b) => b.length - a.length)[0] || '';
}

function normalizePriority(hint) {
  if (!hint) return null;
  if (PRIORITY_HIGH.test(hint) || /^(?:1|haute?|high|p0|p1)$/i.test(hint.trim())) return 'high';
  if (PRIORITY_LOW.test(hint) || /^(?:3|basse?|low|p3)$/i.test(hint.trim())) return 'low';
  return 'medium';
}

/* ------------------------------------------------------------------ */
/* API principale                                                      */
/* ------------------------------------------------------------------ */

/**
 * Analyse detaillee : retourne les candidats + un journal (debug) expliquant
 * pour chaque ligne/segment s'il a ete retenu ou non et pourquoi.
 */
export function analyzeText(text, options = {}) {
  const { members = [], versions = [], existing = [] } = options;
  const items = toItems(text);
  const candidates = [];
  const debug = [];

  for (const item of items) {
    const sectionTitle = cleanHeader(item.section || '');
    const sectionIgnored = Boolean(item.section && IGNORED_SECTIONS.test(sectionTitle));
    const isDecision = Boolean(item.section && DECISION_SECTION.test(sectionTitle));
    const raw = (item.text || '').replace(/\s+/g, ' ').trim();
    if (!raw) continue;

    const units = item.table ? [raw] : splitUnits(raw);
    let inheritIds = [];

    for (const [unitIndex, sentence] of units.entries()) {
      const rowText = sentence;
      const core = item.table ? pickActionCell(item.table, members) || rowText : rowText;
      const entry = {
        line: item.line,
        section: item.section || '',
        text: rowText.slice(0, 220),
        score: 0,
        cues: [],
        kept: false,
        reason: '',
      };
      debug.push(entry);

      if (!core || core.length < 8) {
        entry.reason = 'trop court';
        continue;
      }
      if (isNameList(core, members)) {
        entry.reason = 'liste de noms (pas une action)';
        continue;
      }
      if (NOISE_RE.test(core.trim())) {
        entry.reason = 'bruit / formule de politesse';
        continue;
      }

      const cues = detectCues(core);
      if (item.table) cues.push('tableau');
      // Pour un tableau, on lit toute la ligne (responsable / echeance / priorite).
      const scanText = item.table ? rowText : core;
      // "Marie a rappelé que Thomas devra ..." → le responsable est Thomas.
      const relay = RELAY_RE.exec(scanText);
      const ownerScan = relay ? relay[1] : scanText;
      const mentioned = findMembersInText(ownerScan, members);
      const speaker = item.speaker
        ? members.find((m) => memberTokens(m).includes(stripAccentsLower(item.speaker)))
        : null;
      const due = item.dueHint ? { label: item.dueHint } : extractDue(rowText) || extractDue(core);
      const version = item.versionHint ? findVersionByName(item.versionHint, versions) : extractVersion(scanText, versions);

      const hintedOwners = item.ownerHint ? findMembersInText(item.ownerHint, members) : [];
      const allMentioned = [...new Set([...hintedOwners, ...mentioned].map((m) => m.id))].map(
        (id) => members.find((m) => m.id === id)
      );

      let score = scoreItem(
        {
          ...item,
          bullet: item.bullet,
          memberMentions: allMentioned,
          due,
          speaker,
          ownerHint: item.ownerHint,
          dueHint: item.dueHint,
        },
        cues,
        core
      );
      entry.score = score;
      entry.cues = cues;

      if (isDecision && !allMentioned.length && !/\b(?:doit|doivent|devra|devront|faut|faudra|il faut)\b/i.test(core)) {
        entry.reason = 'décision sans action (ignorée)';
        continue;
      }
      if (sectionIgnored && !cues.includes('verbe') && !cues.includes('imperatif') && !cues.includes('us')) {
        entry.reason = `section « ${sectionTitle} » sans action`;
        continue;
      }
      if (score < 3) {
        // Ligne structuree sans verbe explicite : "Ecran d'inscription — Thomas — vendredi"
        const structured =
          item.ownerHint ||
          (allMentioned.length > 0 && (due || item.bullet || item.table || item.dueHint));
        if (structured) {
          score = 3;
        } else {
          entry.reason = `score insuffisant (${score}/3) — pas de verbe d'action identifiable`;
          continue;
        }
      }

      const action = cleanActionText(item.table ? core : core, members, due);
      if (!action || action.length < 6) {
        entry.reason = 'action vide après nettoyage';
        continue;
      }

      let assigneeIds = allMentioned.map((m) => m.id);
      if (!assigneeIds.length && speaker) assigneeIds = [speaker.id];
      if (!assigneeIds.length && unitIndex > 0 && inheritIds.length) assigneeIds = [...inheritIds];
      inheritIds = assigneeIds;
      const primary = members.find((m) => m.id === assigneeIds[0]) || null;

      const us = buildUserStory(action, { member: primary });
      if (!us.title || us.title.length < 5) {
        entry.reason = 'titre inexploitable';
        continue;
      }

      const priority = normalizePriority(item.priorityHint) || (PRIORITY_HIGH.test(rowText) ? 'high' : PRIORITY_LOW.test(rowText) ? 'low' : 'medium');
      const confidence = Math.max(0.3, Math.min(0.98, 0.34 + score * 0.075));

      const candidate = {
        title: us.title,
        asA: us.asA,
        iWant: us.iWant,
        soThat: us.soThat,
        description: rowText,
        assigneeIds,
        assigneeNames: assigneeIds.map((id) => members.find((m) => m.id === id)?.name).filter(Boolean),
        versionId: version?.id || null,
        versionName: version?.name || null,
        priority,
        due: due?.label || '',
        points: null,
        tags: [],
        status: item.done ? 'done' : 'todo',
        confidence: Number(confidence.toFixed(2)),
        cues,
        source: { line: item.line, section: item.section || '', excerpt: rowText.slice(0, 220) },
        _debug: entry,
      };
      entry.kept = true;
      entry.reason = 'retenue';
      candidates.push(candidate);
    }
  }

  // Deduplication (entre candidats + avec l'existant)
  const kept = [];
  for (const c of candidates.sort((a, b) => b.confidence - a.confidence)) {
    const twin = kept.find((k) => similarity(k.title, c.title) > 0.78);
    if (twin) {
      if (c._debug) {
        c._debug.kept = false;
        c._debug.reason = `doublon de « ${twin.title} »`;
      }
      continue;
    }
    const dupExisting = existing.find((s) => similarity(s.title, c.title) > 0.82);
    if (dupExisting) {
      c.duplicateOf = { id: dupExisting.id, key: dupExisting.key, title: dupExisting.title };
    }
    kept.push(c);
  }

  kept.sort((a, b) => (a.source.line || 0) - (b.source.line || 0));
  for (const k of kept) delete k._debug;
  for (const d of debug) if (!d.reason) d.reason = 'ignorée';
  return { candidates: kept, debug };
}

export function extractFromText(text, options = {}) {
  return analyzeText(text, options).candidates;
}

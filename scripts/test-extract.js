import { extractFromText, findParticipants, toItems } from '../lib/extract.js';
import { makeSeed } from '../lib/seed.js';

const seed = makeSeed();
const text = seed.reports[0].text;

console.log('--- ITEMS ---');
for (const it of toItems(text)) console.log(JSON.stringify({ l: it.line, s: it.section, t: it.text.slice(0, 80), spk: it.speaker }));

console.log('\n--- PARTICIPANTS ---', findParticipants(text, seed.members).map((m) => m.name));

console.log('\n--- CANDIDATES ---');
const cands = extractFromText(text, { members: seed.members, versions: seed.versions, existing: seed.stories });
for (const c of cands) {
  console.log(
    `${c.confidence.toFixed(2)} | ${c.title} | ${c.assigneeNames.join(',') || '-'} | ${c.versionName || '-'} | ${c.priority} | ${c.due || '-'} | ${c.cues.join(',')}`
  );
}
console.log('\ntotal:', cands.length);

/* --- Assertions (utilisees par la CI) --- */
const failures = [];
const titles = cands.map((c) => c.title);
const check = (label, ok) => {
  if (!ok) failures.push(label);
};

check('11 candidats attendus', cands.length === 11);
check('« Finaliser l’écran d’inscription » present', titles.some((t) => /finaliser l'ecran d'inscription/i.test(t)));
check('« Ajouter l’export CSV » present', titles.some((t) => /export csv/i.test(t)));
check('aucune décision transformée en US', !titles.some((t) => /demo client|budget/i.test(t)));

const thomas = cands.find((c) => /finaliser l'ecran d'inscription/i.test(c.title));
check('Thomas assigné à l’écran d’inscription', thomas?.assigneeNames?.includes('Thomas Bernard'));
check('échéance vendredi détectée', /vendredi/i.test(thomas?.due || ''));

const exportCsv = cands.find((c) => /export csv/i.test(c.title));
check('export CSV en v2', /v2/i.test(exportCsv?.versionName || ''));
check('export CSV en priorité basse', exportCsv?.priority === 'low');

const urgent = cands.find((c) => /bug d'affichage du header/i.test(c.title));
check('bug header en priorité haute', urgent?.priority === 'high');

const participants = findParticipants(text, seed.members).map((m) => m.name);
check('4 participants detectes', participants.length === 4);

if (failures.length) {
  console.error(`\n${failures.length} échec(s) :`);
  for (const f of failures) console.error(' -', f);
  process.exitCode = 1;
} else {
  console.log('OK — extraction conforme.');
}

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

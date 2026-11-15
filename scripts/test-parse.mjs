/** Verifie l'extraction de texte .docx (ZIP) et .pdf sans dependance. */
import zlib from 'node:zlib';
import { extractTextFromFile } from '../lib/office.js';

/* ---------- Fabrique un .docx minimal (ZIP "stored") ---------- */
function makeZip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const [name, content] of Object.entries(files)) {
    const nameBuf = Buffer.from(name, 'utf8');
    const data = Buffer.from(content, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8); // stored
    local.writeUInt32LE(0, 14); // crc (non verifie par notre lecteur)
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuf.length, 28);
    central.writeUInt32LE(offset, 42);

    locals.push(local, nameBuf, data);
    centrals.push(central, nameBuf);
    offset += local.length + nameBuf.length + data.length;
  }

  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(Object.keys(files).length, 8);
  eocd.writeUInt16LE(Object.keys(files).length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, eocd]);
}

const docx = makeZip({
  '[Content_Types].xml': '<?xml version="1.0"?><Types/>',
  'word/document.xml': `<w:document><w:body>
    <w:p><w:r><w:t>CR - Reunion du 12 novembre</w:t></w:r></w:p>
    <w:p><w:r><w:t>Thomas doit corriger le header mobile avant vendredi.</w:t></w:r></w:p>
    <w:p><w:r><w:t>Sofia va brancher Stripe en v1.</w:t></w:r></w:p>
  </w:body></w:document>`,
});
console.log('--- DOCX ---');
console.log(extractTextFromFile(docx, 'test.docx'));

/* ---------- Fabrique un PDF minimal non compresse ---------- */
const pdfBody = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /Contents 4 0 R >> endobj
4 0 obj << /Length 68 >>
stream
BT /F1 12 Tf 72 720 Td (Thomas doit corriger le header mobile avant vendredi prochain.) Tj ET
endstream
endobj
trailer << /Root 1 0 R >>
%%EOF`;

console.log('\n--- PDF ---');
console.log(extractTextFromFile(Buffer.from(pdfBody, 'latin1'), 'test.pdf'));

/* ---------- PDF compresse (FlateDecode) ---------- */
const compressed = zlib.deflateSync(
  Buffer.from('BT /F1 12 Tf 72 720 Td (Karim doit creer les maquettes en v1.) Tj ET', 'latin1')
);
const pdf2 = Buffer.concat([
  Buffer.from('%PDF-1.4\n4 0 obj << /Length ' + compressed.length + ' /Filter /FlateDecode >>\nstream\n', 'latin1'),
  compressed,
  Buffer.from('\nendstream\nendobj\ntrailer << /Root 1 0 R >>\n%%EOF', 'latin1'),
]);
console.log('\n--- PDF compresse ---');
console.log(extractTextFromFile(pdf2, 'test2.pdf'));

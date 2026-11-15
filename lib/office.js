import zlib from 'node:zlib';
import { readZipText } from './zip.js';

const ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&nbsp;': ' ',
  '&#8217;': '\u2019',
  '&#8211;': '\u2013',
};

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

function tidy(text) {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function docxToText(buf) {
  const xml = readZipText(buf, 'word/document.xml');
  if (!xml) throw new Error("Fichier .docx invalide : word/document.xml introuvable.");
  const text = xml
    .replace(/<w:tab[^>]*\/>/g, '\t')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<\/w:tc>/g, ' | ')
    .replace(/<w:numPr>[\s\S]*?<\/w:numPr>/g, '')
    .replace(/<[^>]+>/g, '');
  return tidy(decodeEntities(text).replace(/^[ \t]+/gm, ''));
}

function odtToText(buf) {
  const xml = readZipText(buf, 'content.xml');
  if (!xml) throw new Error('Fichier .odt invalide.');
  const text = xml
    .replace(/<text:tab[^>]*\/>/g, '\t')
    .replace(/<text:line-break[^>]*\/>/g, '\n')
    .replace(/<\/text:(p|h)>/g, '\n')
    .replace(/<\/table:table-cell>/g, ' | ')
    .replace(/<[^>]+>/g, '');
  return tidy(decodeEntities(text).replace(/^[ \t]+/gm, ''));
}

/** Extrait le texte d'un PDF simple (Flux FlateDecode / texte non compresse). */
export function pdfToText(buf) {
  const raw = buf.toString('latin1');
  const chunks = [];

  const streamRe = /stream\r?\n?/g;
  let m;
  while ((m = streamRe.exec(raw)) !== null) {
    const start = m.index + m[0].length;
    const end = raw.indexOf('endstream', start);
    if (end < 0) break;
    let slice = Buffer.from(raw.slice(start, end), 'latin1');
    let content = null;
    for (const fn of [zlib.inflateSync, zlib.inflateRawSync]) {
      try {
        content = fn(slice).toString('latin1');
        break;
      } catch {
        /* essaie le suivant */
      }
    }
    if (content === null) content = slice.toString('latin1');
    if (/(?:\bTj\b|\bTJ\b|\bBT\b)/.test(content)) chunks.push(content);
    streamRe.lastIndex = end + 9;
  }

  const pieces = [];
  for (const content of chunks) {
    const re = /\((?:\\[\s\S]|[^\\()])*\)|<[0-9A-Fa-f\s]+>|\bT[dD]\b|\bT\*\b|\bTJ\b|\bTj\b|\bET\b/g;
    let tok;
    while ((tok = re.exec(content)) !== null) {
      const t = tok[0];
      if (t.startsWith('(')) {
        pieces.push(decodePdfString(t.slice(1, -1)));
      } else if (t.startsWith('<')) {
        const hex = t.slice(1, -1).replace(/\s+/g, '');
        if (hex.length >= 2) {
          const bytes = Buffer.from(hex.length % 2 ? hex + '0' : hex, 'hex');
          pieces.push(decodePdfHex(bytes));
        }
      } else if (t === 'Td' || t === 'TD' || t === 'T*' || t === 'ET') {
        pieces.push('\n');
      } else if (t === 'TJ' || t === 'Tj') {
        pieces.push(' ');
      }
    }
  }

  let text = pieces.join('');
  text = text
    .replace(/\u0000/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Nettoyage : beaucoup de PDF n'exposent que des glyphes illisibles.
  const printable = text.replace(/[^\p{L}\p{N}\p{P}\p{Zs}\n]/gu, '');
  const ratio = text.length ? printable.length / text.length : 0;
  if (text.length < 20 || ratio < 0.6) {
    throw new Error(
      "Ce PDF ne contient pas de texte exploitable (scan ou polices encodees). Copie-colle le contenu dans l'onglet texte."
    );
  }
  return tidy(text);
}

function decodePdfString(s) {
  return s
    .replace(/\\([nrtbf])/g, (_, c) => ({ n: '\n', r: '\n', t: '\t', b: '', f: '' })[c] ?? '')
    .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)))
    .replace(/\\\n/g, '\n')
    .replace(/\\(.)/g, '$1');
}

function decodePdfHex(bytes) {
  if (bytes.length >= 2 && bytes.length % 2 === 0) {
    let utf16 = '';
    let ok = true;
    for (let i = 0; i + 1 < bytes.length; i += 2) {
      const code = (bytes[i] << 8) | bytes[i + 1];
      if (code === 0) {
        ok = false;
        break;
      }
      utf16 += String.fromCharCode(code);
    }
    if (ok) return utf16;
  }
  return bytes.toString('latin1');
}

export function extractTextFromFile(buffer, filename = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (['txt', 'md', 'markdown', 'csv', 'json', 'log'].includes(ext) || !ext) {
    return tidy(buffer.toString('utf8').replace(/^\uFEFF/, ''));
  }
  if (ext === 'docx') return docxToText(buffer);
  if (ext === 'odt') return odtToText(buffer);
  if (ext === 'pdf') return pdfToText(buffer);
  if (ext === 'doc' || ext === 'pages') {
    throw new Error('Format .doc non pris en charge : enregistre le document en .docx ou .pdf, ou colle le texte.');
  }
  throw new Error(`Format .${ext} non pris en charge. Utilise .txt, .md, .docx, .odt ou .pdf.`);
}

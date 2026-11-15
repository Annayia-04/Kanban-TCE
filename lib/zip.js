import zlib from 'node:zlib';

/**
 * Lecture d'une archive ZIP en memoire (sans dependance externe).
 * Suffisant pour les fichiers .docx / .odt (archives classiques non ZIP64).
 */
export function unzipEntries(buf) {
  let eocd = -1;
  const limit = Math.max(0, buf.length - 22 - 66000);
  for (let i = buf.length - 22; i >= limit; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('Archive ZIP invalide ou corrompue.');

  const count = buf.readUInt16LE(eocd + 10);
  const cdOffset = buf.readUInt32LE(eocd + 16);
  let p = cdOffset;
  const entries = [];

  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) break;
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);

    if (localOffset + 30 <= buf.length) {
      const lNameLen = buf.readUInt16LE(localOffset + 26);
      const lExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lNameLen + lExtraLen;
      const data = buf.subarray(start, start + compSize);
      entries.push({ name, method, data });
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

export function readZipText(buf, entryName) {
  const entry = unzipEntries(buf).find((e) => e.name === entryName);
  if (!entry) return null;
  if (entry.method === 0) return entry.data.toString('utf8');
  try {
    return zlib.inflateRawSync(entry.data).toString('utf8');
  } catch {
    return zlib.inflateSync(entry.data).toString('utf8');
  }
}

import JSZip from 'jszip';

const followerFile = /^(?:followers(?:_\d+)?|following(?:_\d+)?)\.json$/i;
const MAX_ZIP_BYTES = 100 * 1024 * 1024;
const MAX_JSON_BYTES = 25 * 1024 * 1024;

export async function expandInstagramSelection(files) {
  const expanded = [];
  for (const file of files) {
    if (!/\.zip$/i.test(file.name)) {
      expanded.push(file);
      continue;
    }
    if (file.size > MAX_ZIP_BYTES) throw new Error(`${file.name} is over the 100 MB ZIP limit.`);
    let archive;
    try { archive = await JSZip.loadAsync(file); }
    catch { throw new Error(`${file.name} is not a readable ZIP archive.`); }
    const entries = Object.values(archive.files).filter(entry => !entry.dir && followerFile.test(entry.name.split('/').pop()));
    if (entries.length > 100) throw new Error('Too many follower files in the ZIP archive.');
    if (!entries.length) throw new Error('No follower JSON files found in the ZIP. Request the Instagram export in JSON format.');
    for (const entry of entries) {
      if (entry._data?.uncompressedSize > MAX_JSON_BYTES) throw new Error(`${entry.name} is over the 25 MB JSON limit.`);
      const name = entry.name.split('/').pop();
      const content = await entry.async('string');
      if (new TextEncoder().encode(content).length > MAX_JSON_BYTES) throw new Error(`${entry.name} is over the 25 MB JSON limit.`);
      expanded.push({ name, text: async () => content });
    }
  }
  return expanded;
}

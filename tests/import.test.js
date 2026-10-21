import test from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { expandInstagramSelection } from '../src/lib/import.js';
import { parseInstagramFiles } from '../src/lib/data.js';

async function archive(entries) {
  const zip = new JSZip();
  for (const [name, value] of Object.entries(entries)) zip.file(name, value);
  const bytes = await zip.generateAsync({ type: 'uint8array' });
  bytes.name = 'instagram-export.zip';
  bytes.size = bytes.byteLength;
  return bytes;
}

test('extracts follower JSON from the nested Instagram ZIP', async () => {
  const zip = await archive({
    'instagram/relationships/followers_and_following/followers_1.json': JSON.stringify([{ string_list_data: [{ value: 'alice' }] }]),
    'instagram/relationships/followers_and_following/following.json': JSON.stringify({ relationships_following: [{ string_list_data: [{ value: 'alice' }] }] }),
    'instagram/profile/profile.json': '{}',
  });
  const files = await expandInstagramSelection([zip]);
  assert.deepEqual(files.map(file => file.name).sort(), ['followers_1.json', 'following.json']);
  const { data } = await parseInstagramFiles(files);
  assert.equal(data.people.length, 1);
  assert.equal(data.people[0].mutual, true);
});

test('reports non-JSON export archives clearly', async () => {
  const zip = await archive({ 'instagram/followers.html': '<html></html>' });
  await assert.rejects(expandInstagramSelection([zip]), /Request the Instagram export in JSON format/);
});

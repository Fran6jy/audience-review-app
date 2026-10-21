import test from 'node:test';
import assert from 'node:assert/strict';
import { applyEvidence, exportCsv, exportRows, getInstagramNames, migrate, normalizeProfile, parseEvidence, parseInstagramFiles, reviewCues } from '../src/lib/data.js';

const file = (name, data) => ({ name, text: async () => JSON.stringify(data) });

test('imports follower and following files, deduplicates, and preserves decisions', async () => {
  const previous = { mode: 'import', people: [{ username: 'alice', status: 'protected', note: 'Client', profile: null }] };
  const { data, errors } = await parseInstagramFiles([
    file('followers_1.json', [{ string_list_data: [{ value: 'alice' }] }, { string_list_data: [{ value: 'bob' }] }]),
    file('followers_2.json', [{ string_list_data: [{ value: 'alice' }] }]),
    file('following.json', { relationships_following: [{ string_list_data: [{ value: 'alice' }] }] }),
  ], previous);
  assert.deepEqual(errors, []);
  assert.equal(data.people.length, 2);
  assert.equal(data.people[0].status, 'protected');
  assert.equal(data.people[0].note, 'Client');
  assert.equal(data.people[0].mutual, true);
  assert.equal(data.people[1].mutual, false);
});

test('marks mutual status unavailable without following data', async () => {
  const { data } = await parseInstagramFiles([file('followers.json', [{ string_list_data: [{ value: 'alice' }] }])]);
  assert.equal(data.people[0].mutual, null);
  assert.equal(data.hasFollowing, false);
});

test('retains safe picture URLs and exposes them in exports', () => {
  const profile = normalizeProfile({ profile_picture_url: 'https://example.com/avatar.jpg' });
  assert.equal(profile.profile_picture_url, 'https://example.com/avatar.jpg');
  assert.equal(normalizeProfile({ profile_picture_url: 'javascript:alert(1)' }).profile_picture_url, null);
  const rows = exportRows({ people: [{ username: 'alice', mutual: null, status: 'unreviewed', note: '', profile }] });
  assert.equal(rows[1][rows[0].indexOf('profile_picture_url')], 'https://example.com/avatar.jpg');
});

test('rejects unsupported exports and malformed evidence', async () => {
  await assert.rejects(parseInstagramFiles([file('wrong.json', [])]), /unrecognised filename/);
  assert.throws(() => parseEvidence({ profiles: 'bad' }), /Expected a JSON array/);
  assert.deepEqual(getInstagramNames({ relationships_followers: [{ title: 'alice' }] }, 'followers'), ['alice']);
});

test('normalizes evidence and reports unmatched names', () => {
  const { profiles, invalid } = parseEvidence([{ username: 'Alice', posts_count: 0, bio: '' }, { username: 'unknown', posts_count: 3 }, { username: 'bad name', posts_count: 1 }]);
  const result = applyEvidence({ people: [{ username: 'alice', profile: null }] }, profiles, 'example.json');
  assert.equal(invalid, 1);
  assert.equal(result.matched, 1);
  assert.equal(result.unmatched, 1);
  assert.equal(result.data.people[0].profile.posts_count, 0);
  assert.equal(normalizeProfile({ posts_count: -1 }).posts_count, null);
});

test('review cues describe observations without bot labels', () => {
  const cues = reviewCues({ posts_count: 0, bio: '', followers_count: 10, following_count: 1200, last_post_date: '2022-01-01' }, new Date('2026-10-21'));
  assert.equal(cues.length, 4);
  assert.ok(cues.every(cue => !/bot|fake/i.test(cue)));
});

test('CSV filters candidates and escapes spreadsheet formulas', () => {
  const csv = exportCsv({ people: [{ username: 'alice', mutual: null, status: 'candidate', note: '=HYPERLINK("bad")', profile: null }, { username: 'bob', status: 'protected', profile: null }] }, true);
  assert.match(csv, /alice/);
  assert.doesNotMatch(csv, /bob/);
  assert.match(csv, /'=HYPERLINK/);
});

test('migrates older workspace decisions safely', () => {
  const result = migrate({ kind: 'import', people: [{ username: 'alice', decision: 'pending', note: 'Keep' }, { username: 'not valid!', decision: 'review' }] });
  assert.equal(result.mode, 'import');
  assert.equal(result.people.length, 1);
  assert.equal(result.people[0].status, 'unreviewed');
});

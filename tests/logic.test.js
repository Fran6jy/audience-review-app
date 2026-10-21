const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8').replace(/\nrender\(\);\s*$/, '');
const control = { addEventListener() {} };
const context = vm.createContext({
  document: { getElementById: () => control, querySelectorAll: () => [], addEventListener() {} },
  localStorage: { getItem: () => null },
});
vm.runInContext(source, context);

test('parses Instagram follower array and following object', () => {
  const followerJson = [{ string_list_data: [{ value: 'citystudio' }] }, { string_list_data: [{ value: 'made.by.mae' }] }];
  const followingJson = { relationships_following: [{ string_list_data: [{ value: 'citystudio' }] }] };
  assert.deepEqual(Array.from(context.instagramEntries(followerJson, 'followers')), ['citystudio', 'made.by.mae']);
  assert.deepEqual(Array.from(context.instagramEntries(followingJson, 'following')), ['citystudio']);
});

test('rejects unsupported data without inventing accounts', () => {
  assert.throws(() => context.instagramEntries({ wrong_key: [] }, 'followers'));
  assert.deepEqual(Array.from(context.instagramEntries([{ title: 'good_name' }, { title: '<script>' }], 'followers')), ['good_name']);
});

test('validates restored account records', () => {
  const person = { username: 'shop.alpha', mutual: null, decision: 'review', note: 'Check later' };
  assert.equal(context.validPerson(person), true);
  assert.equal(context.validPerson({ ...person, decision: 'bot' }), false);
  assert.equal(context.validPerson({ ...person, username: '../secret' }), false);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCount, parseProfileMetadata, validateApproval, nextJournal, recoverInterrupted, applyActionJournal, assertExecutionApproved } from '../src/lib/companion.js';

test('parses only visible public profile metadata', () => {
  assert.equal(parseCount('1.2K'), 1200);
  assert.equal(parseCount('not available'), null);
  const profile = parseProfileMetadata('alice', '1,240 Followers, 350 Following, 27 Posts', 'Alice Smith (@alice) • Instagram', '2026-10-21T15:00:00Z');
  assert.deepEqual([profile.followers_count, profile.following_count, profile.posts_count, profile.display_name], [1240, 350, 27, 'Alice Smith']);
  assert.equal(profile.is_private, undefined);
});

test('approval rejects owner, duplicates, and broad batches', () => {
  const packet = { version: 1, id: 'review-123', owner: 'fran6jy', approvedAt: '2026-10-21T15:00:00Z', targets: ['alice', 'bob'] };
  assert.deepEqual(validateApproval(packet, 'fran6jy'), ['alice', 'bob']);
  assert.throws(() => validateApproval({ ...packet, targets: ['fran6jy'] }, 'fran6jy'), /owner username/);
  assert.throws(() => validateApproval({ ...packet, targets: ['alice', 'Alice'] }, 'fran6jy'), /duplicate/);
  assert.throws(() => validateApproval({ ...packet, targets: ['a', 'b', 'c', 'd'] }, 'fran6jy'), /1-3/);
});

test('interrupted action becomes unconfirmed and is not retried', () => {
  let journal = { owner: 'fran6jy', targets: ['alice'], events: [], states: { alice: 'approved' } };
  journal = nextJournal(journal, { username: 'alice', status: 'click_started' });
  journal = recoverInterrupted(journal);
  assert.equal(journal.states.alice, 'unconfirmed');
  assert.match(journal.events.at(-1).detail, /never retry/);
});

test('journal import is bound to the exact approved owner and targets', () => {
  const job = { id: 'one', owner: 'fran6jy_flows', status: 'awaiting_manual_action', items: [{ username: 'alice', status: 'approved_pending' }] };
  const journal = { id: 'one', owner: 'fran6jy_flows', targets: ['alice'], events: [{ username: 'alice', status: 'ui_action_completed', at: '2026-10-21T16:00:00Z' }] };
  assert.equal(applyActionJournal(job, journal).items[0].status, 'ui_action_completed');
  assert.throws(() => applyActionJournal(job, { ...journal, owner: 'other' }), /does not match/);
  assert.throws(() => applyActionJournal(job, { ...journal, targets: ['bob'] }), /do not match/);
  const dryRun = applyActionJournal(job, { ...journal, events: [{ username: 'alice', status: 'dry_run_ready', at: '2026-10-21T16:00:00Z' }] });
  assert.equal(dryRun.status, 'awaiting_manual_action');
  assert.equal(dryRun.items[0].status, 'dry_run_ready');
});

test('execution checks current candidate and pending-plan protections', () => {
  const packet = { id: 'review-123', owner: 'fran6jy_flows', approvedAt: new Date(Date.now() - 2 * 60000).toISOString() };
  const workspace = { mode: 'import', savedAt: new Date().toISOString(), people: [{ username: 'alice', status: 'candidate' }], jobs: [{ id: packet.id, owner: packet.owner, status: 'awaiting_manual_action', items: [{ username: 'alice', status: 'approved_pending' }] }] };
  assert.equal(assertExecutionApproved(workspace, packet, 'alice'), true);
  assert.equal(assertExecutionApproved({ ...workspace, jobs: [{ ...workspace.jobs[0], items: [{ username: 'alice', status: 'dry_run_ready' }] }] }, packet, 'alice'), true);
  assert.throws(() => assertExecutionApproved({ ...workspace, savedAt: new Date(Date.now() - 11 * 60000).toISOString() }, packet, 'alice'), /new session backup/);
  assert.throws(() => assertExecutionApproved({ ...workspace, people: [{ username: 'alice', status: 'protected' }] }, packet, 'alice'), /no longer/);
  assert.throws(() => assertExecutionApproved({ ...workspace, jobs: [{ ...workspace.jobs[0], status: 'cancelled' }] }, packet, 'alice'), /not pending/);
});

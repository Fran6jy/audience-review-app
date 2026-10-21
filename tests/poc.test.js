import test from 'node:test';
import assert from 'node:assert/strict';
import { assessFollower, coverageReport, createReviewJob, cancelReviewJob, updateReviewItem } from '../src/lib/poc.js';

const person = (profile, status = 'unreviewed', username = 'alice') => ({ username, profile, status, mutual: false });

test('assessment does not treat private or non-mutual alone as spam', () => {
  assert.equal(assessFollower(person(null)).label, 'insufficient');
  assert.equal(assessFollower(person({ is_private: true, is_verified: false, bio: 'Hello' })).label, 'no_signals');
  assert.equal(assessFollower(person({ followers_count: 10, following_count: 1200, posts_count: 0, bio: '' })).label, 'potential_spam');
  assert.equal(assessFollower(person({ posts_count: 3, bio: 'Hello', last_post_date: '2020-01-01' }), new Date('2026-10-21')).label, 'potentially_inactive');
});

test('coverage reports observed fields only', () => {
  const coverage = coverageReport([person(null), person({ posts_count: 0, bio: '', is_private: false })]);
  assert.equal(coverage.total, 2);
  assert.equal(coverage.fields.posts_count, 1);
  assert.equal(coverage.fields.average_likes, 0);
});

test('manual plans only include approved candidates and prevent duplicates', () => {
  const people = [person(null, 'protected', 'safe'), person(null, 'candidate', 'review_me')];
  const job = createReviewJob(people, [], new Date('2026-10-21T10:00:00Z'));
  assert.deepEqual(job.items.map(item => item.username), ['review_me']);
  assert.throws(() => createReviewJob(people, [job]), /No new approved/);
  const updated = updateReviewItem(job, 'review_me', 'user_reported_done');
  assert.equal(updated.items[0].status, 'user_reported_done');
  assert.throws(() => updateReviewItem(updated, 'review_me', 'failed'), /not pending/);
  assert.equal(cancelReviewJob(job).items[0].status, 'cancelled');
});

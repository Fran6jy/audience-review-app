const evidenceFields = [
  'user_id', 'display_name', 'profile_picture_url',
  'followers_count', 'following_count', 'posts_count', 'bio',
  'is_private', 'is_verified', 'last_post_date',
  'average_likes', 'average_comments', 'sample_size',
];

export function coverageReport(people) {
  const fields = Object.fromEntries(evidenceFields.map(field => [field, 0]));
  for (const person of people) {
    for (const field of evidenceFields) if (person.profile?.[field] !== null && person.profile?.[field] !== undefined) fields[field]++;
  }
  return { total: people.length, enriched: people.filter(person => person.profile).length, fields };
}

export function assessFollower(person, today = new Date()) {
  const p = person.profile;
  if (!p) return { label: 'insufficient', score: null, confidence: 'none', reasons: [], available: 0, total: evidenceFields.length };
  const available = evidenceFields.filter(field => p[field] !== null && p[field] !== undefined).length;
  const signalFields = ['followers_count', 'following_count', 'posts_count', 'bio', 'is_private', 'is_verified', 'last_post_date', 'average_likes', 'average_comments', 'sample_size'];
  if (signalFields.filter(field => p[field] !== null && p[field] !== undefined).length < 3) return { label: 'insufficient', score: null, confidence: 'low', reasons: [], available, total: evidenceFields.length };

  let score = 0;
  const reasons = [];
  const followers = p.followers_count;
  const following = p.following_count;
  const followingImbalance = Number.isInteger(followers) && Number.isInteger(following) && following >= 1000 && followers <= 50;
  if (followingImbalance) {
    score += 45;
    reasons.push('High following count relative to supplied follower count');
  }
  if (p.posts_count === 0) { score += 15; reasons.push('No posts visible in supplied observations'); }
  if (p.bio === '') { score += 10; reasons.push('Empty bio in supplied observations'); }
  const lowSampledEngagement = Number.isInteger(p.sample_size) && p.sample_size >= 5 && Number.isFinite(p.average_likes) && Number.isFinite(p.average_comments) && p.average_likes + p.average_comments <= 1;
  if (lowSampledEngagement) {
    score += 25;
    reasons.push(`Low engagement across ${p.sample_size} supplied public posts`);
  }
  let oldPost = false;
  if (p.last_post_date) {
    const age = today.getTime() - new Date(`${p.last_post_date}T00:00:00Z`).getTime();
    if (Number.isFinite(age) && age > 365 * 86400000) {
      oldPost = true;
      score += 20;
      reasons.push(`Latest supplied public post: ${p.last_post_date}; this does not reveal last login`);
    }
  }
  score = Math.min(score, 100);
  let label = 'no_signals';
  if (followingImbalance && lowSampledEngagement && reasons.length >= 3 && score >= 70) label = 'potential_bot';
  else if (score >= 60 && reasons.length >= 2) label = 'potential_spam';
  else if (oldPost) label = 'potentially_inactive';
  const confidence = signalFields.filter(field => p[field] !== null && p[field] !== undefined).length >= 7 && p.sample_size >= 5 ? 'medium' : 'low';
  return { label, score, confidence, reasons, available, total: evidenceFields.length };
}

export function createReviewJob(people, existingJobs = [], now = new Date()) {
  const pending = new Set(existingJobs.filter(job => job.status !== 'cancelled').flatMap(job => job.items.filter(item => ['approved_pending', 'dry_run_ready'].includes(item.status)).map(item => item.username.toLowerCase())));
  const candidates = people.filter(person => person.status === 'candidate' && !pending.has(person.username.toLowerCase()));
  if (!candidates.length) throw new Error('No new approved candidates are available for a plan.');
  return {
    id: `review-${now.getTime()}`,
    createdAt: now.toISOString(),
    status: 'awaiting_manual_action',
    items: candidates.map(person => ({ username: person.username, status: 'approved_pending', updatedAt: now.toISOString() })),
  };
}

export function cancelReviewJob(job, now = new Date()) {
  return { ...job, status: 'cancelled', items: job.items.map(item => ['approved_pending', 'dry_run_ready'].includes(item.status) ? { ...item, status: 'cancelled', updatedAt: now.toISOString() } : item) };
}

export function updateReviewItem(job, username, status, now = new Date()) {
  if (!['user_reported_done', 'failed', 'unconfirmed'].includes(status)) throw new Error('Invalid action result.');
  if (job.status === 'cancelled' || !job.items.some(item => item.username.toLowerCase() === username.toLowerCase() && item.status === 'approved_pending')) throw new Error('This action is not pending.');
  const items = job.items.map(item => item.username.toLowerCase() === username.toLowerCase() ? { ...item, status, updatedAt: now.toISOString() } : item);
  return { ...job, items, status: items.every(item => item.status !== 'approved_pending') ? 'reviewed' : job.status };
}

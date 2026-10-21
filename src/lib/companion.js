const usernamePattern = /^[a-zA-Z0-9._]{1,30}$/;

export function parseCount(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().replaceAll(',', '').match(/^([\d.]+)\s*([KMB])?$/i);
  if (!match) return null;
  const number = Number(match[1]);
  const multiplier = { K: 1e3, M: 1e6, B: 1e9 }[match[2]?.toUpperCase()] || 1;
  return Number.isFinite(number) ? Math.round(number * multiplier) : null;
}

export function parseProfileMetadata(username, description, title, observedAt) {
  if (!usernamePattern.test(username)) throw new Error('Invalid username.');
  const text = typeof description === 'string' ? description : '';
  const result = { username, observed_at: observedAt, followers_count: null, following_count: null, posts_count: null, display_name: null };
  for (const [field, word] of [['followers_count', 'followers?'], ['following_count', 'following'], ['posts_count', 'posts?']]) {
    const match = text.match(new RegExp(`([\\d,.]+\\s*[KMB]?)\\s+${word}\\b`, 'i'));
    if (match) result[field] = parseCount(match[1]);
  }
  if (typeof title === 'string') {
    const match = title.match(/^(.+?)\s*\(@[^)]+\)/);
    if (match) result.display_name = match[1].slice(0, 100);
  }
  return result;
}

export function validateApproval(packet, owner, maxTargets = 3) {
  if (!packet || packet.version !== 1 || typeof owner !== 'string' || !usernamePattern.test(owner) || typeof packet.owner !== 'string' || packet.owner.toLowerCase() !== owner.toLowerCase()) throw new Error('Approval packet does not match this owner.');
  if (typeof packet.id !== 'string' || !/^review-\d+$/.test(packet.id)) throw new Error('Approval packet ID is invalid.');
  if (!Array.isArray(packet.targets) || packet.targets.length < 1 || packet.targets.length > maxTargets) throw new Error(`Approval must contain 1-${maxTargets} targets.`);
  const names = packet.targets.map(target => typeof target === 'string' ? target : target?.username);
  if (names.some(name => !usernamePattern.test(name) || name.toLowerCase() === owner.toLowerCase())) throw new Error('Approval contains an invalid or owner username.');
  if (new Set(names.map(name => name.toLowerCase())).size !== names.length) throw new Error('Approval contains duplicate usernames.');
  if (!packet.approvedAt || !Number.isFinite(Date.parse(packet.approvedAt))) throw new Error('Approval timestamp is missing.');
  return names;
}

export function nextJournal(journal, event) {
  const events = [...(journal?.events || []), { ...event, at: event.at || new Date().toISOString() }];
  const states = Object.fromEntries((journal?.targets || []).map(name => [name.toLowerCase(), 'approved']));
  for (const item of events) if (item.username && states[item.username.toLowerCase()]) states[item.username.toLowerCase()] = item.status;
  return { ...journal, events, states };
}

export function recoverInterrupted(journal) {
  let result = journal;
  for (const [username, status] of Object.entries(journal.states || {})) {
    if (status === 'click_started') result = nextJournal(result, { username, status: 'unconfirmed', detail: 'Interrupted after action began; never retry automatically.' });
  }
  return result;
}

export function applyActionJournal(job, journal) {
  if (!journal || journal.id !== job.id || typeof journal.owner !== 'string' || journal.owner.toLowerCase() !== job.owner?.toLowerCase() || !Array.isArray(journal.events) || !Array.isArray(journal.targets)) throw new Error('Journal does not match this approved plan.');
  const approved = new Set(job.items.map(item => item.username.toLowerCase()));
  if (journal.targets?.length !== approved.size || journal.targets.some(name => !approved.has(name.toLowerCase()))) throw new Error('Journal targets do not match approved accounts.');
  const allowed = new Set(['approved', 'dry_run_ready', 'not_found', 'cancelled', 'click_started', 'unconfirmed', 'ui_action_completed', 'absent_in_later_export', 'still_in_later_export']);
  if (journal.events.some(event => !approved.has(event.username?.toLowerCase()) || !allowed.has(event.status) || !Number.isFinite(Date.parse(event.at)))) throw new Error('Journal contains invalid events.');
  const items = job.items.map(item => {
    const events = journal.events.filter(event => event.username.toLowerCase() === item.username.toLowerCase());
    const latest = events.at(-1);
    return latest ? { ...item, status: latest.status, updatedAt: latest.at, events } : item;
  });
  return { ...job, items, status: items.every(item => item.status !== 'approved_pending' && item.status !== 'approved') ? 'reviewed' : job.status };
}

export function assertExecutionApproved(workspace, packet, username) {
  if (workspace?.mode !== 'import' || !Array.isArray(workspace.people) || !Array.isArray(workspace.jobs)) throw new Error('A current imported workspace backup is required.');
  const savedAt = Date.parse(workspace.savedAt);
  const approvedAt = Date.parse(packet.approvedAt);
  if (!Number.isFinite(savedAt) || !Number.isFinite(approvedAt) || savedAt < approvedAt || savedAt > Date.now() + 60000 || Date.now() - savedAt > 10 * 60000) throw new Error('Save a new session backup after approval, within 10 minutes of execution.');
  const job = workspace.jobs.find(item => item.id === packet.id && item.owner?.toLowerCase() === packet.owner.toLowerCase());
  if (!job || job.status === 'cancelled' || !job.items.some(item => item.username.toLowerCase() === username.toLowerCase() && item.status === 'approved_pending')) throw new Error(`@${username} is not pending in this workspace backup.`);
  if (!workspace.people.some(person => person.username.toLowerCase() === username.toLowerCase() && person.status === 'candidate')) throw new Error(`@${username} is no longer an approved candidate.`);
  return true;
}

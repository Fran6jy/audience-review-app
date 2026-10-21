const $ = id => document.getElementById(id);
const STORAGE_KEY = 'audience-review-workspace-v2';
const PAGE_SIZE = 30;
const decisions = ['pending', 'review', 'protected', 'cleared'];
const sample = [
  ['citystudio', true], ['fresh_tea', true], ['londonrunner', false],
  ['craft_market', false], ['gatherandgrow', true], ['northsidebooks', false],
  ['localtable', true], ['studioflora', false], ['madebymae', true],
  ['weekendarchive', false], ['goodformclub', true], ['formandfield', false]
].map(([username, mutual]) => ({ username, mutual, decision: 'pending', note: '' }));

let workspace = loadWorkspace();
let view = 'overview';
let page = 1;
let selected = null;
let selection = new Set();
let toastTimer;

function loadWorkspace() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.version === 2 && Array.isArray(saved.people) && saved.people.every(validPerson)) return saved;
  } catch { /* Browser storage may be disabled. */ }
  return { version: 2, kind: 'example', hasFollowing: true, importedAt: null, people: sample.map(person => ({ ...person })) };
}

function validUsername(value) { return typeof value === 'string' && /^[a-zA-Z0-9._]{1,30}$/.test(value); }
function validPerson(person) {
  return person && validUsername(person.username) && [true, false, null].includes(person.mutual)
    && decisions.includes(person.decision) && typeof person.note === 'string' && person.note.length <= 2000;
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); }
  catch { toast('Browser storage unavailable. Save a session file to keep your work.'); }
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 4000);
}
function setView(next) {
  view = next;
  document.querySelectorAll('.view').forEach(element => element.classList.toggle('active', element.id === `${next}-view`));
  document.querySelectorAll('.nav-item').forEach(element => element.classList.toggle('active', element.dataset.view === next));
  if (next === 'review') renderList();
  window.scrollTo(0, 0);
}
function currentPerson() { return workspace.people.find(person => person.username.toLowerCase() === selected); }
function filteredPeople() {
  const query = $('search').value.trim().toLowerCase();
  const filter = $('filter').value;
  return workspace.people.filter(person => {
    if (!person.username.toLowerCase().includes(query)) return false;
    if (filter === 'all') return true;
    if (filter === 'mutual') return person.mutual === true;
    if (filter === 'nonmutual') return person.mutual === false;
    return person.decision === filter;
  });
}
function relation(person) { return person.mutual === null ? 'Unknown' : person.mutual ? 'Mutual' : 'Not mutual'; }
function statusLabel(decision) { return ({ pending: 'Unreviewed', review: 'Needs review', protected: 'Protected', cleared: 'Cleared' })[decision]; }

function renderOverview() {
  const people = workspace.people;
  const reviewed = people.filter(person => person.decision !== 'pending').length;
  $('metric-followers').textContent = people.length.toLocaleString();
  $('metric-mutual').textContent = workspace.hasFollowing ? people.filter(person => person.mutual).length.toLocaleString() : '—';
  $('metric-review').textContent = people.filter(person => person.decision === 'review').length.toLocaleString();
  $('metric-protected').textContent = people.filter(person => person.decision === 'protected').length.toLocaleString();
  $('mutual-caption').textContent = workspace.hasFollowing ? 'From following export' : 'Following data needed';
  $('nav-count').textContent = people.length.toLocaleString();
  $('coverage-followers').textContent = people.length ? 'Available' : 'None';
  $('coverage-mutual').textContent = workspace.hasFollowing ? 'Available' : 'Unknown';
  const progress = people.length ? Math.round(reviewed / people.length * 100) : 0;
  $('progress-fill').style.width = `${progress}%`;
  $('progress-percent').textContent = `${progress}% reviewed`;
  $('progress-ratio').textContent = `${reviewed.toLocaleString()} of ${people.length.toLocaleString()} accounts`;
  const next = people.filter(person => person.decision === 'review').slice(0, 3);
  $('quick-list').innerHTML = next.length ? next.map(person => `<div class="quick-row"><span class="avatar">${escapeHtml(person.username[0].toUpperCase())}</span><div><strong>@${escapeHtml(person.username)}</strong><small>${relation(person)} · Needs review</small></div><button type="button" data-open="${escapeHtml(person.username)}" aria-label="Open ${escapeHtml(person.username)}">↗</button></div>`).join('') : '<div class="quick-row"><span class="avatar">✓</span><div><strong>No accounts waiting in your review queue</strong><small>Use the account list to mark one for review.</small></div></div>';
  $('source-state').textContent = workspace.kind === 'example' ? 'Example workspace' : `${people.length.toLocaleString()} followers imported`;
  $('source-followers').textContent = workspace.kind === 'example' ? 'Example data' : `${people.length.toLocaleString()} usernames imported`;
  $('source-following').textContent = workspace.hasFollowing ? (workspace.kind === 'example' ? 'Example data' : 'Imported') : 'Not provided';
  $('export-button').disabled = $('export-data').disabled = $('save-session').disabled = !people.length;
}

function renderList() {
  const all = filteredPeople();
  const pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
  page = Math.min(Math.max(page, 1), pages);
  const visible = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  $('account-rows').innerHTML = visible.map(person => {
    const name = escapeHtml(person.username);
    return `<tr class="${selected === person.username.toLowerCase() ? 'selected-row' : ''}"><td><label><input type="checkbox" class="row-check" data-name="${name}" ${selection.has(person.username.toLowerCase()) ? 'checked' : ''}> <span class="account-name">@${name}</span></label><div class="account-sub">From follower export</div></td><td><span class="tag">${relation(person)}</span></td><td><span class="tag ${person.decision}">${statusLabel(person.decision)}</span></td><td><button type="button" class="open-row" data-open="${name}" aria-label="Open ${name}">→</button></td></tr>`;
  }).join('');
  $('empty-list').hidden = all.length > 0;
  $('list-count').textContent = `${all.length.toLocaleString()} accounts`;
  $('page-label').textContent = `Page ${page} of ${pages}`;
  $('prev-page').disabled = page === 1;
  $('next-page').disabled = page === pages;
  $('selection-count').textContent = `${selection.size} selected`;
  $('select-page').checked = visible.length > 0 && visible.every(person => selection.has(person.username.toLowerCase()));
  document.querySelectorAll('[data-bulk]').forEach(button => button.disabled = selection.size === 0);
  renderDetail();
}

function renderDetail() {
  const person = currentPerson();
  if (!person) { $('detail-content').className = 'detail-empty'; $('detail-content').textContent = 'Select an account to review its available evidence.'; return; }
  const name = escapeHtml(person.username);
  $('detail-content').className = '';
  $('detail-content').innerHTML = `<div class="detail-top"><p class="section-kicker">ACCOUNT RECORD</p><button class="detail-close" type="button" aria-label="Close account details">×</button></div><div class="detail-avatar">${escapeHtml(person.username[0].toUpperCase())}</div><h2 class="detail-name">${name}</h2><p class="detail-handle">@${name}</p><div class="detail-section"><h3>AVAILABLE EVIDENCE</h3><div class="fact-row"><span>In follower export</span><strong>Yes</strong></div><div class="fact-row"><span>Relationship</span><strong>${relation(person)}</strong></div><div class="fact-row"><span>Profile signals</span><strong>Unavailable</strong></div><p>No bot or inactivity conclusion can be drawn from this export.</p></div><div class="detail-section"><h3>YOUR DECISION</h3><div class="decision-buttons">${decisions.map(choice => `<button type="button" data-decision="${choice}" class="${person.decision === choice ? 'active' : ''}">${statusLabel(choice)}</button>`).join('')}</div></div><div class="detail-section"><h3>PRIVATE NOTE</h3><textarea id="account-note" class="note-input" maxlength="2000" placeholder="Add context for your decision">${escapeHtml(person.note)}</textarea><a class="profile-link" href="https://www.instagram.com/${encodeURIComponent(person.username)}/" target="_blank" rel="noopener noreferrer">Open profile on Instagram ↗</a></div>`;
}

function render() { renderOverview(); renderList(); }
function updateDecision(choice, names) {
  if (!decisions.includes(choice)) return;
  const nameSet = new Set(names);
  workspace.people.forEach(person => { if (nameSet.has(person.username.toLowerCase())) person.decision = choice; });
  selection.clear(); persist(); render();
  toast(`Marked ${nameSet.size} account${nameSet.size === 1 ? '' : 's'} as ${statusLabel(choice).toLowerCase()}.`);
}
function instagramEntries(data, kind) {
  const list = Array.isArray(data) ? data : kind === 'following' ? data?.relationships_following : data?.relationships_followers;
  if (!Array.isArray(list)) throw new Error('Unexpected Instagram JSON structure');
  return list.map(item => item?.string_list_data?.[0]?.value || item?.username || item?.title).filter(validUsername);
}
async function importFiles(files) {
  const followers = [], following = [];
  const failures = [];
  let hasFollowing = false;
  for (const file of files) {
    const name = file.name.toLowerCase();
    const kind = /^followers(?:_\d+)?\.json$/.test(name) ? 'followers' : /^following(?:_\d+)?\.json$/.test(name) ? 'following' : null;
    if (!kind) { failures.push(`${file.name}: unrecognised filename`); continue; }
    try {
      const names = instagramEntries(JSON.parse(await file.text()), kind);
      if (kind === 'followers') followers.push(...names);
      else { following.push(...names); hasFollowing = true; }
    } catch { failures.push(`${file.name}: invalid or unsupported JSON`); }
  }
  if (!followers.length) { $('import-status').textContent = `No followers found. ${failures.join('; ')}`; toast('Import needs a valid followers file.'); return; }
  const followingSet = new Set(following.map(name => name.toLowerCase()));
  const prior = new Map((workspace.kind === 'import' ? workspace.people : []).map(person => [person.username.toLowerCase(), person]));
  const unique = new Map();
  for (const name of followers) {
    const key = name.toLowerCase();
    const old = prior.get(key);
    unique.set(key, { username: name, mutual: hasFollowing ? followingSet.has(key) : null, decision: old?.decision || 'pending', note: old?.note || '' });
  }
  workspace = { version: 2, kind: 'import', importedAt: new Date().toISOString(), hasFollowing, people: [...unique.values()].sort((a, b) => a.username.localeCompare(b.username)) };
  selected = null; selection.clear(); page = 1;
  persist(); render(); setView('overview');
  $('import-status').textContent = `${workspace.people.length.toLocaleString()} followers imported. ${hasFollowing ? 'Following data included.' : 'Relationship status is unknown without following.json.'} ${failures.join('; ')}`;
  toast('Data imported into this browser workspace.');
}
function download(name, data, mime) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function csv(value) { return `"${String(value).replaceAll('"', '""')}"`; }
function exportCsv() {
  if (!workspace.people.length) return;
  const rows = [['username', 'profile_url', 'mutual', 'decision', 'note'], ...workspace.people.map(person => [person.username, `https://www.instagram.com/${person.username}/`, person.mutual === null ? 'unknown' : person.mutual ? 'yes' : 'no', person.decision, person.note])];
  download('audience-review.csv', '\ufeff' + rows.map(row => row.map(csv).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
}

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.addEventListener('click', event => {
  const open = event.target.closest('[data-open]');
  if (open) { selected = open.dataset.open.toLowerCase(); setView('review'); renderList(); return; }
  if (event.target.closest('.detail-close')) { selected = null; renderList(); return; }
  const decision = event.target.closest('[data-decision]');
  if (decision && selected) { updateDecision(decision.dataset.decision, [selected]); return; }
  const bulk = event.target.closest('[data-bulk]');
  if (bulk) updateDecision(bulk.dataset.bulk, selection);
});
$('account-rows').addEventListener('change', event => {
  if (!event.target.matches('.row-check')) return;
  const key = event.target.dataset.name.toLowerCase();
  if (event.target.checked) selection.add(key); else selection.delete(key);
  renderList();
});
$('select-page').addEventListener('change', event => {
  filteredPeople().slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).forEach(person => {
    const key = person.username.toLowerCase();
    if (event.target.checked) selection.add(key); else selection.delete(key);
  }); renderList();
});
$('detail-content').addEventListener('input', event => {
  if (event.target.id !== 'account-note') return;
  const person = currentPerson(); if (!person) return;
  person.note = event.target.value; persist();
});
$('search').addEventListener('input', () => { page = 1; selection.clear(); renderList(); });
$('filter').addEventListener('change', () => { page = 1; selection.clear(); renderList(); });
$('prev-page').addEventListener('click', () => { page--; renderList(); });
$('next-page').addEventListener('click', () => { page++; renderList(); });
$('file-input').addEventListener('change', async event => { await importFiles([...event.target.files]); event.target.value = ''; });
$('session-input').addEventListener('change', async event => {
  const file = event.target.files[0]; if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    if (data.version !== 2 || !Array.isArray(data.people) || data.people.length > 500000 || !data.people.every(validPerson) || typeof data.hasFollowing !== 'boolean') throw new Error('Unsupported session');
    workspace = { version: 2, kind: data.kind === 'example' ? 'example' : 'import', importedAt: data.importedAt || null, hasFollowing: data.hasFollowing, people: data.people };
    selected = null; selection.clear(); page = 1; persist(); render(); setView('overview'); toast('Session restored.');
  } catch { toast('Could not restore that session file.'); }
  event.target.value = '';
});
$('export-button').addEventListener('click', exportCsv);
$('export-data').addEventListener('click', exportCsv);
$('save-session').addEventListener('click', () => download('audience-review-session.json', JSON.stringify(workspace, null, 2), 'application/json'));
$('clear-workspace').addEventListener('click', () => {
  if (!confirm('Clear this browser workspace and all saved decisions? Export a session first if you need a backup.')) return;
  localStorage.removeItem(STORAGE_KEY);
  workspace = { version: 2, kind: 'example', importedAt: null, hasFollowing: true, people: sample.map(person => ({ ...person })) };
  selected = null; selection.clear(); page = 1; render(); setView('overview'); toast('Local workspace cleared.');
});

render();

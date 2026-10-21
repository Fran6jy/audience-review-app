export const STORAGE_KEY = 'audience-review-workspace-v3';
export const OLD_STORAGE_KEY = 'audience-review-workspace-v2';
export const STATUSES = ['unreviewed', 'review', 'candidate', 'protected', 'cleared'];

const names = [
  'northline.studio', 'thegoodtable', 'mara.designs', 'studiojuniper', 'cityjournal',
  'sundayobjects', 'madebyluca', 'fernandform', 'hannahmakes', 'everydayatlas',
  'frameandfield', 'muse.market', 'goodearthclub', 'tallulahworks', 'londonstill',
  'smallhours.co', 'commonhouse', 'thelocaledit', 'olivearchive', 'kindredspace',
  'rowancreates', 'orbitatelier', 'citystitch', 'brightmatter', 'oldtownbooks',
  'northshorelife', 'freshframe', 'junohouse', 'mosaicworks', 'southbound',
  'lilacproject', 'cornergoods', 'seedandstone', 'circlecollective', 'plainworks',
  'nightmarket', 'studioalma', 'millstreet', 'solsticepaper', 'softform'
];

export function makeDemo() {
  const people = names.map((username, index) => ({
    username,
    mutual: index % 3 !== 1,
    status: index % 17 === 0 ? 'protected' : index % 11 === 0 ? 'review' : index % 19 === 0 ? 'candidate' : 'unreviewed',
    note: '',
    profile: index % 4 === 0 ? {
      followers_count: 110 + index * 27,
      following_count: index % 8 === 0 ? 1200 + index * 13 : 90 + index * 8,
      posts_count: index % 12 === 0 ? 0 : 12 + index,
      bio: index % 12 === 0 ? '' : 'Independent studio and everyday ideas',
      is_private: index % 8 === 0,
      is_verified: false,
      last_post_date: index % 12 === 0 ? '2024-02-12' : '2026-09-15',
    } : null,
  }));
  return { version: 3, mode: 'demo', importedAt: null, hasFollowing: true, evidenceSource: 'Synthetic sample', people };
}

export function validUsername(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9._]{1,30}$/.test(value);
}

export function getInstagramNames(data, kind) {
  const list = Array.isArray(data) ? data : kind === 'following' ? data?.relationships_following : data?.relationships_followers;
  if (!Array.isArray(list)) throw new Error('Unsupported Instagram export format');
  return list.map(item => item?.string_list_data?.[0]?.value || item?.username || item?.title).filter(validUsername);
}

export async function parseInstagramFiles(files, previous = null) {
  const followers = [];
  const following = [];
  const errors = [];
  let hasFollowing = false;
  for (const file of files) {
    const name = file.name.toLowerCase();
    const kind = /^followers(?:_\d+)?\.json$/.test(name) ? 'followers' : /^following(?:_\d+)?\.json$/.test(name) ? 'following' : null;
    if (!kind) { errors.push(`${file.name}: unrecognised filename`); continue; }
    try {
      const values = getInstagramNames(JSON.parse(await file.text()), kind);
      if (kind === 'followers') followers.push(...values);
      else { following.push(...values); hasFollowing = true; }
    } catch { errors.push(`${file.name}: invalid or unsupported JSON`); }
  }
  if (!followers.length) throw new Error(errors.length ? errors.join('; ') : 'No followers found. Select followers_1.json.');
  const followingSet = new Set(following.map(name => name.toLowerCase()));
  const old = new Map((previous?.mode === 'import' ? previous.people : []).map(person => [person.username.toLowerCase(), person]));
  const people = new Map();
  for (const username of followers) {
    const key = username.toLowerCase();
    const prior = old.get(key);
    people.set(key, {
      username,
      mutual: hasFollowing ? followingSet.has(key) : null,
      status: prior?.status || 'unreviewed',
      note: prior?.note || '',
      profile: prior?.profile || null,
    });
  }
  return {
    data: { version: 3, mode: 'import', importedAt: new Date().toISOString(), hasFollowing, evidenceSource: previous?.mode === 'import' ? previous.evidenceSource : null, people: [...people.values()].sort((a, b) => a.username.localeCompare(b.username)) },
    errors,
  };
}

const count = value => Number.isInteger(value) && value >= 0 && value <= 1000000000 ? value : null;
export function normalizeProfile(record) {
  return {
    followers_count: count(record.followers_count),
    following_count: count(record.following_count),
    posts_count: count(record.posts_count),
    bio: typeof record.bio === 'string' ? record.bio.slice(0, 300) : null,
    is_private: typeof record.is_private === 'boolean' ? record.is_private : null,
    is_verified: typeof record.is_verified === 'boolean' ? record.is_verified : null,
    last_post_date: typeof record.last_post_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.last_post_date) ? record.last_post_date : null,
  };
}

export function parseEvidence(data) {
  const rows = Array.isArray(data) ? data : data?.profiles;
  if (!Array.isArray(rows) || rows.length > 500000) throw new Error('Expected a JSON array of profiles');
  const profiles = rows.filter(row => row && typeof row === 'object' && validUsername(row.username))
    .map(row => ({ username: row.username, profile: normalizeProfile(row) }))
    .filter(row => Object.values(row.profile).some(value => value !== null));
  return { profiles, invalid: rows.length - profiles.length };
}

export function applyEvidence(workspace, profiles, source) {
  const lookup = new Map(profiles.map(item => [item.username.toLowerCase(), item.profile]));
  let matched = 0;
  const people = workspace.people.map(person => {
    const profile = lookup.get(person.username.toLowerCase());
    if (!profile) return person;
    matched++;
    return { ...person, profile };
  });
  return { data: { ...workspace, evidenceSource: matched ? source : workspace.evidenceSource, people }, matched, unmatched: lookup.size - matched };
}

export function reviewCues(profile, today = new Date()) {
  if (!profile) return [];
  const cues = [];
  if (profile.posts_count === 0) cues.push('No visible posts in supplied data');
  if (profile.bio === '') cues.push('Bio is empty in supplied data');
  if (profile.followers_count !== null && profile.following_count !== null && profile.followers_count < 50 && profile.following_count >= 1000)
    cues.push(`Following ${profile.following_count.toLocaleString()} accounts with ${profile.followers_count.toLocaleString()} followers`);
  if (profile.last_post_date) {
    const age = today.getTime() - new Date(`${profile.last_post_date}T00:00:00Z`).getTime();
    if (Number.isFinite(age) && age > 365 * 86400000) cues.push(`Last supplied post date: ${profile.last_post_date}`);
  }
  return cues;
}

function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function exportCsv(workspace, onlyCandidates = false) {
  const columns = ['username', 'profile_url', 'mutual', 'decision', 'note', 'followers_count', 'following_count', 'posts_count', 'bio', 'is_private', 'is_verified', 'last_post_date'];
  const people = onlyCandidates ? workspace.people.filter(person => person.status === 'candidate') : workspace.people;
  const rows = people.map(person => [
    person.username, `https://www.instagram.com/${person.username}/`, person.mutual === null ? 'unknown' : person.mutual ? 'yes' : 'no', person.status, person.note,
    ...columns.slice(5).map(key => person.profile?.[key] ?? ''),
  ]);
  return '\ufeff' + [columns, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
}

export function migrate(old) {
  if (!old || !Array.isArray(old.people)) return null;
  const people = old.people.filter(person => validUsername(person.username)).map(person => ({
    username: person.username,
    mutual: [true, false, null].includes(person.mutual) ? person.mutual : null,
    status: STATUSES.includes(person.status) ? person.status : person.decision === 'pending' ? 'unreviewed' : STATUSES.includes(person.decision) ? person.decision : 'unreviewed',
    note: typeof person.note === 'string' ? person.note.slice(0, 2000) : '',
    profile: person.profile && typeof person.profile === 'object' ? normalizeProfile(person.profile) : null,
  }));
  return { version: 3, mode: old.mode === 'import' || old.kind === 'import' ? 'import' : 'demo', importedAt: old.importedAt || null, hasFollowing: old.hasFollowing === true, evidenceSource: old.evidenceSource || null, people };
}

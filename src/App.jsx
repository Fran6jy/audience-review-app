import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, ArrowDownToLine, ArrowRight, ArrowUpRight, Check, ChevronLeft,
  ChevronRight, CircleHelp, Database, Download, FileJson, FileUp, Filter,
  LayoutDashboard, LockKeyhole, Menu, RotateCcw, Search, ShieldCheck,
  SlidersHorizontal, UsersRound, ScanSearch, ClipboardList, X,
} from 'lucide-react';
import {
  STORAGE_KEY, OLD_STORAGE_KEY, STATUSES, makeDemo, parseInstagramFiles,
  parseEvidence, applyEvidence, reviewCues, exportCsv, migrate,
} from './lib/data.js';
import { expandInstagramSelection } from './lib/import.js';
import PocView from './PocView.jsx';
import { createReviewJob, updateReviewItem, cancelReviewJob } from './lib/poc.js';
import { validateApproval, applyActionJournal } from './lib/companion.js';
import { exportExcel } from './lib/excel.js';
import AdminView from './AdminView.jsx';

const labels = {
  unreviewed: 'Unreviewed', review: 'Needs review', candidate: 'Removal candidate',
  protected: 'Protected', cleared: 'Cleared',
};
const nav = [
  ['overview', LayoutDashboard, 'Overview'],
  ['audience', UsersRound, 'Audience'],
  ['queue', Activity, 'Review queue'],
  ['analysis', ScanSearch, 'Analysis'],
  ['operations', ClipboardList, 'Action plans'],
  ['admin', ShieldCheck, 'Job monitor'],
  ['data', Database, 'Data sources'],
];
const PAGE_SIZE = 25;

function initialWorkspace() {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (current?.version === 3) return migrate(current) || makeDemo();
    const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
    return migrate(old) || makeDemo();
  } catch { return makeDemo(); }
}

function download(name, data, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function formatNumber(value) { return value.toLocaleString('en-GB'); }
function relation(person) { return person.mutual === null ? 'Unknown' : person.mutual ? 'Mutual' : 'Not mutual'; }

function Avatar({ name, size = 'normal' }) {
  return <span className={`avatar avatar-${size}`} aria-hidden="true">{name.slice(0, 1).toUpperCase()}</span>;
}

function Status({ value }) { return <span className={`status status-${value}`}>{labels[value]}</span>; }

function Metric({ label, value, detail }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>;
}

function Field({ label, value }) {
  return <div className="field-row"><span>{label}</span><strong>{value == null ? 'Unavailable' : String(value)}</strong></div>;
}

export default function App() {
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [view, setView] = useState('overview');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [relationFilter, setRelationFilter] = useState('all');
  const [sort, setSort] = useState('username');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [checked, setChecked] = useState(new Set());
  const [notice, setNotice] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const [locale, setLocale] = useState('en');
  const followersInput = useRef(null);
  const evidenceInput = useRef(null);
  const restoreInput = useRef(null);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace)); }
    catch { setNotice('Browser storage is unavailable. Export a session to keep your work.'); }
  }, [workspace]);
  useEffect(() => { setPage(1); setChecked(new Set()); }, [search, statusFilter, relationFilter, sort, view]);

  const people = workspace.people;
  const selectedPerson = people.find(person => person.username.toLowerCase() === selected);
  const reviewed = people.filter(person => person.status !== 'unreviewed').length;
  const counts = Object.fromEntries(STATUSES.map(key => [key, people.filter(person => person.status === key).length]));
  const enriched = people.filter(person => person.profile).length;
  const mutualCount = people.filter(person => person.mutual === true).length;

  const filtered = useMemo(() => people.filter(person => {
    if (!person.username.toLowerCase().includes(search.trim().toLowerCase())) return false;
    if (statusFilter !== 'all' && person.status !== statusFilter) return false;
    if (relationFilter === 'mutual' && person.mutual !== true) return false;
    if (relationFilter === 'nonmutual' && person.mutual !== false) return false;
    if (relationFilter === 'unknown' && person.mutual !== null) return false;
    return true;
  }).sort((a, b) => {
    if (sort === 'review') {
      const priority = { review: 0, candidate: 1, unreviewed: 2, protected: 3, cleared: 4 };
      return priority[a.status] - priority[b.status] || a.username.localeCompare(b.username);
    }
    if (sort === 'evidence') return Number(Boolean(b.profile)) - Number(Boolean(a.profile)) || a.username.localeCompare(b.username);
    return a.username.localeCompare(b.username);
  }), [people, search, statusFilter, relationFilter, sort]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allVisibleChecked = visible.length > 0 && visible.every(person => checked.has(person.username.toLowerCase()));

  function go(next) { setView(next); setMobileNav(false); setSelected(null); window.scrollTo(0, 0); }
  function changeStatus(usernames, status) {
    if (!STATUSES.includes(status)) return;
    const keys = new Set(usernames);
    setWorkspace(current => ({
      ...current,
      people: current.people.map(person => keys.has(person.username.toLowerCase()) ? { ...person, status } : person),
      jobs: status === 'protected' ? (current.jobs || []).map(job => {
        const items = job.items.map(item => keys.has(item.username.toLowerCase()) && ['approved_pending', 'dry_run_ready'].includes(item.status) ? { ...item, status: 'cancelled', updatedAt: new Date().toISOString() } : item);
        return { ...job, items, status: items.every(item => !['approved_pending', 'dry_run_ready'].includes(item.status)) ? 'reviewed' : job.status };
      }) : current.jobs,
    }));
    setChecked(new Set());
    setNotice(`${keys.size} account${keys.size === 1 ? '' : 's'} marked ${labels[status].toLowerCase()}.`);
  }
  function changeNote(username, note) {
    setWorkspace(current => ({ ...current, people: current.people.map(person => person.username === username ? { ...person, note: note.slice(0, 2000) } : person) }));
  }
  function toggleCheck(username) {
    setChecked(current => { const next = new Set(current); const key = username.toLowerCase(); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  }
  function toggleVisible() {
    setChecked(current => {
      const next = new Set(current);
      visible.forEach(person => { const key = person.username.toLowerCase(); if (allVisibleChecked) next.delete(key); else next.add(key); });
      return next;
    });
  }
  async function handleFollowers(files) {
    if (!files.length) return;
    try {
      if (files.length === 1 && files[0].name.toLowerCase().endsWith('.json') && !/^(followers|following)(?:_\d+)?\.json$/i.test(files[0].name)) {
        await importEvidence(files[0]);
        followersInput.current.value = '';
        return;
      }
      const expanded = await expandInstagramSelection(files);
      const { data, errors } = await parseInstagramFiles(expanded, workspace);
      const previousNames = new Set(workspace.mode === 'import' ? workspace.people.map(person => person.username.toLowerCase()) : []);
      const currentNames = new Set(data.people.map(person => person.username.toLowerCase()));
      const added = [...currentNames].filter(name => !previousNames.has(name)).length;
      const departed = [...previousNames].filter(name => !currentNames.has(name)).length;
      setWorkspace(data); setSelected(null); setChecked(new Set());
      go('overview');
      setNotice(`${formatNumber(data.people.length)} followers imported.${previousNames.size ? ` ${added} new, ${departed} no longer in this export.` : ''}${errors.length ? ` ${errors.join('; ')}` : ''}`);
    } catch (error) { setNotice(error.message); }
    followersInput.current.value = '';
  }
  async function importEvidence(file) {
    if (!file) return;
    if (workspace.mode !== 'import') { setNotice('Import your own follower export before adding profile observations.'); return; }
    if (file.size > 20000000) { setNotice('Profile file is over the 20 MB limit.'); return; }
    try {
      const { profiles, invalid } = parseEvidence(JSON.parse(await file.text()));
      const result = applyEvidence(workspace, profiles, file.name);
      if (!result.matched) throw new Error('No usable profiles matched the follower list.');
      setWorkspace(result.data);
      setNotice(`${result.matched} profiles matched; ${result.unmatched} unmatched; ${invalid} invalid or empty.`);
    } catch (error) { setNotice(error.message); }
  }
  async function handleEvidence(file) {
    await importEvidence(file);
    evidenceInput.current.value = '';
  }
  async function handleRestore(file) {
    if (!file) return;
    try {
      if (file.size > 20000000) throw new Error('Session is over the 20 MB limit.');
      const data = migrate(JSON.parse(await file.text()));
      if (!data || !data.people.length) throw new Error('Not a valid Audience Review session.');
      setWorkspace(data); go('overview'); setNotice('Session restored.');
    } catch (error) { setNotice(error.message); }
    restoreInput.current.value = '';
  }
  function exportAll(onlyCandidates = false) {
    download(onlyCandidates ? 'removal-candidates.csv' : 'audience-review.csv', exportCsv(workspace, onlyCandidates), 'text/csv;charset=utf-8');
  }
  async function exportWorkbook() {
    try {
      const bytes = await exportExcel(workspace);
      download('audience-review.xlsx', bytes, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    } catch (error) { setNotice(`Excel export failed: ${error.message}`); }
  }
  function clearWorkspace() {
    if (!window.confirm('Clear this browser workspace and its saved decisions? Export a session first if you need a backup.')) return;
    localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(OLD_STORAGE_KEY);
    setWorkspace(makeDemo()); go('overview'); setNotice('Local workspace cleared.');
  }
  function createPlan() {
    if (workspace.mode !== 'import') { setNotice('Import your own data before making an action plan.'); return; }
    try {
      const job = createReviewJob(workspace.people, workspace.jobs || []);
      setWorkspace(current => ({ ...current, jobs: [...(current.jobs || []), job] }));
      setNotice(`${job.items.length} accounts approved for manual review. No Instagram action was performed.`);
    } catch (error) { setNotice(error.message); }
  }
  function recordResult(jobId, username, status) {
    if (workspace.people.find(person => person.username.toLowerCase() === username.toLowerCase())?.status !== 'candidate') {
      setNotice('This account is no longer an approved candidate.'); return;
    }
    try {
      setWorkspace(current => ({ ...current, jobs: (current.jobs || []).map(job => job.id === jobId ? updateReviewItem(job, username, status) : job) }));
      setNotice('Manual result recorded. This app cannot verify the Instagram action.');
    } catch (error) { setNotice(error.message); }
  }
  function cancelPlan(jobId) {
    setWorkspace(current => ({ ...current, jobs: (current.jobs || []).map(job => job.id === jobId ? cancelReviewJob(job) : job) }));
    setNotice('Pending manual actions cancelled.');
  }
  function createApproval(owner, targets) {
    try {
      if (workspace.mode !== 'import') throw new Error('Import a real follower list first.');
      const selected = new Set(targets.map(name => name.toLowerCase()));
      const people = workspace.people.filter(person => selected.has(person.username.toLowerCase()) && person.status === 'candidate');
      if (people.length !== selected.size) throw new Error('Every target must be an explicitly selected removal candidate.');
      const job = { ...createReviewJob(people, workspace.jobs || []), owner };
      const packet = { version: 1, id: job.id, owner, approvedAt: job.createdAt, targets: job.items.map(item => item.username) };
      validateApproval(packet, owner);
      setWorkspace(current => ({ ...current, jobs: [...(current.jobs || []), job] }));
      download(`removal-approval-${job.id}.json`, JSON.stringify(packet, null, 2), 'application/json');
      setNotice(`Approval packet created for ${packet.targets.length} exact accounts. Nothing has been removed.`);
    } catch (error) { setNotice(error.message); }
  }
  async function importJournal(file) {
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error('Action journal is too large.');
      const journal = JSON.parse(await file.text());
      const job = (workspace.jobs || []).find(item => item.id === journal.id);
      if (!job) throw new Error('No matching approved plan exists in this workspace.');
      const updated = applyActionJournal(job, journal);
      setWorkspace(current => ({ ...current, jobs: (current.jobs || []).map(item => item.id === job.id ? updated : item) }));
      setNotice('Action journal imported. UI completion is not proof of follower removal; compare a later export.');
    } catch (error) { setNotice(error.message); }
  }

  return <div className="app">
    <header className="topbar">
      <div className="brand"><span className="brand-symbol">a.</span><span>Audience Review</span></div>
      <nav className={`topnav ${mobileNav ? 'topnav-open' : ''}`} aria-label="Main navigation">{nav.map(([key, Icon, label]) => <button key={key} className={`nav-link ${view === key ? 'active' : ''}`} onClick={() => go(key)}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{key === 'queue' && counts.review + counts.candidate > 0 && <em>{counts.review + counts.candidate}</em>}</button>)}</nav>
      <div className="topbar-actions"><button className="icon-button mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Toggle navigation" aria-expanded={mobileNav}><Menu size={22} /></button><button className="top-action" onClick={() => go('data')}><FileUp size={17} /> Import data</button></div>
    </header>
    <div className="layout">
      <main className="main">
        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}
        {workspace.mode === 'demo' && <div className="demo-banner"><span className="demo-pill">Sample workspace</span><span>These accounts are fictional. Import your own export to start reviewing.</span><button onClick={() => go('data')}>Use your data <ArrowRight size={15} /></button></div>}
        {view === 'overview' && <>
          <div className="page-title"><div><p className="eyebrow">AUDIENCE / OVERVIEW</p><h1>Audience overview</h1><p>Accounts, evidence coverage, and decisions in one place.</p></div><button className="secondary-button" onClick={() => exportAll()}><Download size={16} /> Export report</button></div>
          <div className="metrics"><Metric label="Followers" value={formatNumber(people.length)} detail="In current dataset" /><Metric label="Mutual" value={workspace.hasFollowing ? formatNumber(mutualCount) : '—'} detail={workspace.hasFollowing ? 'Follow each other' : 'Following file needed'} /><Metric label="Needs review" value={formatNumber(counts.review)} detail="Flagged by you" /><Metric label="Protected" value={formatNumber(counts.protected)} detail="Excluded from candidate list" /></div>
          <div className="overview-grid"><section className="surface progress-surface"><div className="surface-head"><div><h2>Review progress</h2></div><button className="link-button" onClick={() => go('audience')}>View audience <ArrowUpRight size={15} /></button></div><div className="progress-summary"><strong>{people.length ? Math.round(reviewed / people.length * 100) : 0}%</strong><span>{formatNumber(reviewed)} of {formatNumber(people.length)} accounts reviewed</span></div><div className="stacked-bar" role="img" aria-label="Distribution of review decisions">{['protected', 'cleared', 'candidate', 'review', 'unreviewed'].map(key => <span key={key} className={`bar-${key}`} style={{ width: `${people.length ? counts[key] / people.length * 100 : 0}%` }} />)}</div><div className="legend">{['unreviewed', 'review', 'candidate', 'protected', 'cleared'].map(key => <div key={key}><i className={`dot dot-${key}`} /><span>{labels[key]}</span><strong>{counts[key]}</strong></div>)}</div></section><section className="surface coverage-surface"><div className="surface-head"><div><h2>Available data</h2></div><button className="link-button" onClick={() => go('data')}>Sources <ArrowUpRight size={15} /></button></div><div className="coverage-item"><span>Follower usernames</span><strong>{formatNumber(people.length)} <Check size={15} /></strong></div><div className="coverage-item"><span>Mutual relationship</span><strong>{workspace.hasFollowing ? 'Available' : 'Unknown'}</strong></div><div className="coverage-item"><span>Profile observations</span><strong>{formatNumber(enriched)} / {formatNumber(people.length)}</strong></div><p className="coverage-note"><ShieldCheck size={17} /> Profile details come from your imports, not a live Instagram connection.</p></section></div>
          <section className="surface recent-surface"><div className="surface-head"><div><p className="eyebrow">WORK QUEUE</p><h2>Accounts needing attention</h2></div><button className="link-button" onClick={() => go('queue')}>Open queue <ArrowUpRight size={15} /></button></div>{people.filter(person => person.status === 'review' || person.status === 'candidate').slice(0, 4).map(person => <button className="recent-row" key={person.username} onClick={() => { go('audience'); setSelected(person.username.toLowerCase()); }}><Avatar name={person.username} /><span className="recent-name">@{person.username}<small>{relation(person)} · {person.profile ? `${reviewCues(person.profile).length} review cues` : 'No profile data'}</small></span><Status value={person.status} /><ChevronRight size={16} /></button>)}{!counts.review && !counts.candidate && <div className="empty-inline">Nothing in the review queue.</div>}</section>
        </>}
        {view === 'audience' && <>
          <div className="page-title"><div><p className="eyebrow">AUDIENCE / ACCOUNTS</p><h1>Audience</h1><p>Review accounts using only the evidence you have.</p></div><span className="count-label">{formatNumber(people.length)} total</span></div>
          <div className="table-shell"><div className="table-toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search usernames" aria-label="Search usernames" /></div><div className="toolbar-select"><Filter size={15} /><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter by decision"><option value="all">All decisions</option>{STATUSES.map(key => <option key={key} value={key}>{labels[key]}</option>)}</select></div><div className="toolbar-select"><SlidersHorizontal size={15} /><select value={relationFilter} onChange={event => setRelationFilter(event.target.value)} aria-label="Filter by relationship"><option value="all">All relationships</option><option value="mutual">Mutual</option><option value="nonmutual">Not mutual</option><option value="unknown">Unknown</option></select></div><div className="toolbar-select sort-select"><select value={sort} onChange={event => setSort(event.target.value)} aria-label="Sort accounts"><option value="username">Name A–Z</option><option value="review">Review first</option><option value="evidence">Evidence first</option></select></div></div>
            <div className="bulk-toolbar"><label><input type="checkbox" checked={allVisibleChecked} onChange={toggleVisible} /> Select visible</label><span>{checked.size} selected</span>{checked.size > 0 && <div className="bulk-controls"><button onClick={() => changeStatus(checked, 'review')}>Needs review</button><button onClick={() => changeStatus(checked, 'candidate')}>Candidate</button><button onClick={() => changeStatus(checked, 'protected')}>Protect</button><button onClick={() => setChecked(new Set())}>Clear selection</button></div>}</div>
            <div className="table-scroll"><table><thead><tr><th>ACCOUNT</th><th>RELATIONSHIP</th><th>EVIDENCE</th><th>DECISION</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{visible.map(person => <tr key={person.username} className={selected === person.username.toLowerCase() ? 'selected-row' : ''}><td data-label="Account"><div className="account-cell"><input type="checkbox" aria-label={`Select ${person.username}`} checked={checked.has(person.username.toLowerCase())} onChange={() => toggleCheck(person.username)} /><Avatar name={person.username} /><span><strong>@{person.username}</strong><small>Instagram account</small></span></div></td><td data-label="Relationship">{relation(person)}</td><td data-label="Evidence">{person.profile ? <span className="evidence-cell"><i /> {reviewCues(person.profile).length} cues · profile supplied</span> : <span className="text-muted">Export only</span>}</td><td data-label="Decision"><Status value={person.status} /></td><td className="mobile-open"><button className="row-open" aria-label={`Open ${person.username}`} onClick={() => setSelected(person.username.toLowerCase())}><ChevronRight size={17} /></button></td></tr>)}</tbody></table>{!filtered.length && <div className="empty-state">No accounts match these filters.</div>}</div><div className="table-footer"><span>Showing {filtered.length ? (page - 1) * PAGE_SIZE + 1 : 0}–{Math.min(page * PAGE_SIZE, filtered.length)} of {formatNumber(filtered.length)}</span><div><button disabled={page === 1} onClick={() => setPage(page - 1)} aria-label="Previous page"><ChevronLeft size={17} /></button><span>{page} / {pageCount}</span><button disabled={page === pageCount} onClick={() => setPage(page + 1)} aria-label="Next page"><ChevronRight size={17} /></button></div></div></div>
        </>}
        {view === 'queue' && <>
          <div className="page-title"><div><p className="eyebrow">AUDIENCE / REVIEW QUEUE</p><h1>Review queue</h1><p>Human decisions only. No account changes are made by this app.</p></div><button className="secondary-button" onClick={() => exportAll(true)} disabled={!counts.candidate}><ArrowDownToLine size={16} /> Export candidates</button></div>
          <div className="queue-stats"><div><strong>{counts.review}</strong><span>Needs review</span></div><div><strong>{counts.candidate}</strong><span>Removal candidates</span></div><div><strong>{counts.protected}</strong><span>Protected</span></div></div>
          <div className="surface queue-surface"><div className="surface-head"><div><p className="eyebrow">MANUAL REVIEW</p><h2>Current queue</h2></div><span className="text-muted">{counts.review + counts.candidate} accounts</span></div>{people.filter(person => ['review', 'candidate'].includes(person.status)).map(person => <div className="queue-row" key={person.username}><Avatar name={person.username} /><button className="queue-account" onClick={() => setSelected(person.username.toLowerCase())}><strong>@{person.username}</strong><small>{person.profile ? `${reviewCues(person.profile).length} observed cues` : 'No profile observations'}</small></button><Status value={person.status} /><button className="queue-open" onClick={() => setSelected(person.username.toLowerCase())} aria-label={`Review ${person.username}`}><ArrowRight size={16} /></button></div>)}{!counts.review && !counts.candidate && <div className="empty-inline">No accounts have been added to the queue.</div>}</div><p className="fine-print">A candidate is a decision for manual inspection, not proof of a fake account. This app never removes followers.</p>
        </>}
        {view === 'data' && <>
          <div className="page-title"><div><p className="eyebrow">WORKSPACE / DATA</p><h1>Data sources</h1><p>Imports stay in this browser unless you export them.</p></div></div>
          <div className="data-grid"><section className="surface data-main"><div className="surface-head"><div><p className="eyebrow">01 / INSTAGRAM EXPORT</p><h2>Follower lists</h2></div><FileJson size={21} strokeWidth={1.5} /></div><p className="data-description">Choose the downloaded Instagram ZIP, or select followers_1.json and following.json. The app extracts follower files locally and keeps your decisions on the next import.</p><input ref={followersInput} type="file" accept=".zip,application/zip,.json,application/json" multiple hidden onChange={event => handleFollowers([...event.target.files])} /><button className="upload-button" onClick={() => followersInput.current.click()}><FileUp size={17} /> Select Instagram ZIP or JSON <ArrowRight size={16} /></button><div className="source-summary"><Field label="Followers" value={formatNumber(people.length)} /><Field label="Following list" value={workspace.hasFollowing ? 'Included' : 'Not supplied'} /><Field label="Imported" value={workspace.importedAt ? new Date(workspace.importedAt).toLocaleString('en-GB') : 'Sample data'} /></div></section>
            <section className="surface data-main"><div className="surface-head"><div><p className="eyebrow">02 / OPTIONAL PROFILE DATA</p><h2>Profile observations</h2></div><SlidersHorizontal size={21} strokeWidth={1.5} /></div><p className="data-description">Import a JSON array of profile observations from a source you are authorised to use. Only usernames already in your follower list will be matched.</p><input ref={evidenceInput} type="file" accept=".json,application/json" hidden onChange={event => handleEvidence(event.target.files[0])} /><button className="upload-button" onClick={() => evidenceInput.current.click()}><FileUp size={17} /> Select profile JSON <ArrowRight size={16} /></button><button className="text-action" onClick={() => download('profile-example.json', JSON.stringify([{ username: 'sample_account', followers_count: 120, following_count: 95, posts_count: 14, bio: 'Example only', is_private: false, is_verified: false, last_post_date: '2026-10-01' }], null, 2), 'application/json')}>Download example format <ArrowUpRight size={15} /></button><div className="source-summary"><Field label="Matched accounts" value={`${formatNumber(enriched)} / ${formatNumber(people.length)}`} /><Field label="Source" value={workspace.evidenceSource || 'Not supplied'} /></div></section></div>
          <div className="data-grid lower"><section className="surface data-main"><div className="surface-head"><div><p className="eyebrow">03 / EXPORT</p><h2>Keep a copy</h2></div><Download size={21} strokeWidth={1.5} /></div><p className="data-description">CSV and Excel include decisions and supplied observations. Excel also includes the action log. A session JSON restores the full workspace later.</p><div className="export-actions"><button className="primary-button" onClick={() => exportAll()}><Download size={16} /> Export CSV</button><button className="secondary-button" onClick={exportWorkbook}><Download size={16} /> Export Excel</button><button className="secondary-button" onClick={() => download('audience-review-session.json', JSON.stringify({ ...workspace, savedAt: new Date().toISOString() }, null, 2), 'application/json')}><FileJson size={16} /> Save session</button><input ref={restoreInput} type="file" accept=".json,application/json" hidden onChange={event => handleRestore(event.target.files[0])} /><button className="secondary-button" onClick={() => restoreInput.current.click()}><RotateCcw size={16} /> Restore session</button></div></section><section className="surface data-main privacy-surface"><div className="surface-head"><div><p className="eyebrow">PRIVACY</p><h2>Local workspace</h2></div><LockKeyhole size={21} strokeWidth={1.5} /></div><p className="data-description">Your files and notes are stored in this browser profile. No account login, scraping, or automatic follower removal.</p><button className="danger-button" onClick={clearWorkspace}>Clear local workspace</button></section></div>
        </>}
        {(view === 'analysis' || view === 'operations') && <PocView mode={view} workspace={workspace} locale={locale} setLocale={setLocale} onSelect={setSelected} onPlan={createPlan} onResult={recordResult} onCancel={cancelPlan} onApproval={createApproval} onImportJournal={importJournal} />}
        {view === 'admin' && <AdminView workspace={workspace} />}
      </main>
    </div>
    {selectedPerson && <div className="drawer-backdrop" onClick={() => setSelected(null)}><aside className="drawer" role="dialog" aria-modal="true" aria-label={`Account ${selectedPerson.username}`} onClick={event => event.stopPropagation()}><div className="drawer-top"><span>ACCOUNT DETAILS</span><button onClick={() => setSelected(null)} aria-label="Close details"><X size={20} /></button></div><div className="drawer-person"><Avatar name={selectedPerson.username} size="large" /><div><h2>@{selectedPerson.username}</h2><span>Instagram account</span></div></div><div className="drawer-body"><div className="drawer-section"><h3>Relationship</h3><Field label="Follower export" value="Present" /><Field label="Follows you back" value={selectedPerson.mutual === null ? 'Unknown' : selectedPerson.mutual ? 'Yes' : 'No'} /></div><div className="drawer-section"><h3>Profile observations</h3>{selectedPerson.profile ? <><Field label="User ID" value={selectedPerson.profile.user_id} /><Field label="Display name" value={selectedPerson.profile.display_name} /><Field label="Profile picture URL" value={selectedPerson.profile.profile_picture_url} /><Field label="Followers" value={selectedPerson.profile.followers_count?.toLocaleString()} /><Field label="Following" value={selectedPerson.profile.following_count?.toLocaleString()} /><Field label="Posts" value={selectedPerson.profile.posts_count?.toLocaleString()} /><Field label="Bio" value={selectedPerson.profile.bio === '' ? 'Empty in supplied data' : selectedPerson.profile.bio} /><Field label="Private" value={selectedPerson.profile.is_private === null ? null : selectedPerson.profile.is_private ? 'Yes' : 'No'} /><Field label="Verified" value={selectedPerson.profile.is_verified === null ? null : selectedPerson.profile.is_verified ? 'Yes' : 'No'} /><Field label="Latest supplied post" value={selectedPerson.profile.last_post_date} /><Field label="Average likes" value={selectedPerson.profile.average_likes} /><Field label="Average comments" value={selectedPerson.profile.average_comments} /><Field label="Post sample size" value={selectedPerson.profile.sample_size} /><Field label="Observed at" value={selectedPerson.profile.observed_at} /><small>Source: {workspace.evidenceSource || 'Imported file'}</small></> : <p className="text-muted">No profile data supplied for this account.</p>}</div><div className="drawer-section"><h3>Review cues</h3>{reviewCues(selectedPerson.profile).length ? <ul className="cue-list">{reviewCues(selectedPerson.profile).map(cue => <li key={cue}>{cue}</li>)}</ul> : <p className="text-muted">No cues from available observations.</p>}<p className="caution"><CircleHelp size={15} /> These are context, not a fake-account verdict.</p></div><div className="drawer-section"><h3>Your decision</h3><div className="decision-grid">{STATUSES.map(status => <button key={status} className={selectedPerson.status === status ? 'selected' : ''} onClick={() => changeStatus([selectedPerson.username.toLowerCase()], status)}>{labels[status]}</button>)}</div></div><div className="drawer-section"><h3>Private note</h3><textarea value={selectedPerson.note} maxLength={2000} onChange={event => changeNote(selectedPerson.username, event.target.value)} placeholder="Add context for your decision" /></div></div><div className="drawer-bottom"><a href={`https://www.instagram.com/${encodeURIComponent(selectedPerson.username)}/`} target="_blank" rel="noopener noreferrer">Open on Instagram <ArrowUpRight size={16} /></a><span>Manual review only</span></div></aside></div>}
  </div>;
}

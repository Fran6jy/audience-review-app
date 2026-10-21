import React, { useMemo, useRef, useState } from 'react';
import { ArrowRight, Download, ExternalLink, FileUp, ShieldCheck, X } from 'lucide-react';
import { assessFollower, coverageReport } from './lib/poc.js';

const copy = {
  en: {
    analysis: 'Follower analysis', operations: 'Action plans',
    analysisIntro: 'Review transparent signals. A score is a triage aid, not a probability of fraud.',
    operationsIntro: 'Prepare exact targets here. The separate local companion can attempt approved actions; this browser app cannot verify them.',
    dataCoverage: 'Data coverage', source: 'Source', imported: 'Imported',
    account: 'Account', classification: 'Assessment', score: 'Score', confidence: 'Confidence', reason: 'Reason',
    all: 'All assessments', search: 'Search accounts', open: 'Review account',
    insufficient: 'Insufficient data', potential_bot: 'Potential bot', potential_spam: 'Potential spam', potentially_inactive: 'Potentially inactive', no_signals: 'No significant signals',
    none: 'None', low: 'Low', medium: 'Medium', noReason: 'No significant signals in supplied observations',
    fields: 'Fields available', noObservations: 'No profile observations supplied', coverageNote: 'Counts reflect imported observations, not live access. Private accounts and non-mutual follows are never suspicious by themselves.',
    proposed: 'Removal candidates', protected: 'Protected accounts', plan: 'Create manual action plan',
    planInfo: 'Manual plans record your decisions only. For a local removal test, select 1–3 candidates below and import the resulting action journal.',
    noCandidates: 'Mark accounts as removal candidates in Audience before creating a plan.',
    noJobs: 'No action plans yet.', job: 'Plan', cancel: 'Cancel pending actions',
    pending: 'Approved, not attempted', done: 'User reported done', failed: 'Failed', unconfirmed: 'Unconfirmed', cancelled: 'Cancelled',
    openProfile: 'Open Instagram profile', record: 'Record result',
    available: 'Available', missing: 'Missing', owner: 'Instagram account owner', localTest: 'Local removal test', selectTest: 'Select 1–3 approved followers. The packet authorises only these accounts; it performs no action by itself.', packet: 'Download approval packet', importJournal: 'Import action journal', completeness: 'List completeness unverified: the export does not state the expected live follower total.', observed: 'Profile observations',
  },
  ko: {
    analysis: '팔로워 분석', operations: '작업 계획',
    analysisIntro: '근거를 확인하세요. 점수는 검토 순서를 돕는 지표이며 가짜 계정일 확률이 아닙니다.',
    operationsIntro: '승인된 계정을 지정합니다. 별도의 로컬 도구로 작업을 시도할 수 있지만 이 웹 앱은 결과를 검증하지 않습니다.',
    dataCoverage: '데이터 범위', source: '출처', imported: '가져온 시각',
    account: '계정', classification: '평가', score: '점수', confidence: '신뢰도', reason: '근거',
    all: '모든 평가', search: '계정 검색', open: '계정 검토',
    insufficient: '데이터 부족', potential_bot: '봇 가능성', potential_spam: '스팸 가능성', potentially_inactive: '비활성 가능성', no_signals: '뚜렷한 의심 신호 없음',
    none: '없음', low: '낮음', medium: '보통', noReason: '제공된 관찰 자료에서 뚜렷한 신호 없음',
    fields: '사용 가능한 항목', noObservations: '프로필 관찰 자료가 제공되지 않았습니다', coverageNote: '수치는 실시간 접속이 아닌 가져온 자료를 기준으로 합니다. 비공개 계정이나 맞팔이 아닌 계정만으로 의심하지 않습니다.',
    proposed: '삭제 후보', protected: '보호된 계정', plan: '수동 작업 계획 만들기',
    planInfo: '수동 계획은 결정만 기록합니다. 로컬 삭제 테스트는 아래에서 후보 1~3명을 선택한 뒤 작업 기록을 가져오세요.',
    noCandidates: '계획을 만들기 전에 팔로워 목록에서 삭제 후보를 지정하세요.',
    noJobs: '작업 계획이 없습니다.', job: '계획', cancel: '대기 작업 취소',
    pending: '승인됨, 미실행', done: '사용자가 완료했다고 보고함', failed: '실패', unconfirmed: '미확인', cancelled: '취소됨',
    openProfile: 'Instagram 프로필 열기', record: '결과 기록',
    available: '있음', missing: '없음', owner: 'Instagram 계정 소유자', localTest: '로컬 삭제 테스트', selectTest: '승인된 팔로워 1~3명을 선택하세요. 승인 파일 자체는 작업을 실행하지 않습니다.', packet: '승인 파일 다운로드', importJournal: '작업 기록 가져오기', completeness: '목록 완전성 미확인: 내보내기 파일에는 실시간 팔로워 총수가 없습니다.', observed: '프로필 관찰 자료',
  },
};

const coverageLabels = {
  user_id: 'User ID', display_name: 'Display name', profile_picture_url: 'Profile picture URL',
  followers_count: 'Follower count', following_count: 'Following count', posts_count: 'Post count',
  bio: 'Bio', is_private: 'Private status', is_verified: 'Verification', last_post_date: 'Latest public post',
  average_likes: 'Average likes', average_comments: 'Average comments', sample_size: 'Post sample size',
};
const PAGE_SIZE = 30;
const journalLabels = {
  approved: 'Approved', dry_run_ready: 'Dry run ready', not_found: 'Not found',
  click_started: 'Action started', ui_action_completed: 'UI action completed, unverified',
  absent_in_later_export: 'Absent in later export', still_in_later_export: 'Still in later export',
};

export default function PocView({ mode, workspace, locale, setLocale, onSelect, onPlan, onResult, onCancel, onApproval, onImportJournal }) {
  const t = copy[locale];
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [owner, setOwner] = useState('');
  const [testTargets, setTestTargets] = useState(new Set());
  const journalInput = useRef(null);
  const coverage = useMemo(() => coverageReport(workspace.people), [workspace.people]);
  const assessments = useMemo(() => workspace.people.map(person => ({ person, result: assessFollower(person) })), [workspace.people]);
  const filtered = assessments.filter(({ person, result }) => person.username.toLowerCase().includes(query.trim().toLowerCase()) && (filter === 'all' || result.label === filter));
  const assessmentTypes = ['insufficient', 'potential_bot', 'potential_spam', 'potentially_inactive', 'no_signals'];
  const counts = Object.fromEntries(assessmentTypes.map(key => [key, assessments.filter(item => item.result.label === key).length]));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const candidates = workspace.people.filter(person => person.status === 'candidate');
  const protectedCount = workspace.people.filter(person => person.status === 'protected').length;

  return <div className="poc-page">
    <div className="page-title"><div><h1>{mode === 'analysis' ? t.analysis : t.operations}</h1><p>{mode === 'analysis' ? t.analysisIntro : t.operationsIntro}</p></div><div className="language-switch" role="group" aria-label="Language"><button className={locale === 'en' ? 'active' : ''} onClick={() => setLocale('en')}>EN</button><button className={locale === 'ko' ? 'active' : ''} onClick={() => setLocale('ko')}>한국어</button></div></div>
    {mode === 'analysis' ? <>
      <div className="analysis-counts">{assessmentTypes.map(key => <button key={key} className={filter === key ? 'active' : ''} onClick={() => { setFilter(filter === key ? 'all' : key); setPage(1); }}><strong>{counts[key]}</strong><span>{t[key]}</span></button>)}</div>
      <section className="analysis-coverage"><div><h2>{t.dataCoverage}</h2><p>{t.coverageNote}</p><p>{t.completeness}</p><span>{t.source}: {workspace.evidenceSource || (workspace.mode === 'demo' ? 'Synthetic sample' : 'Instagram export')} · {t.imported}: {workspace.importedAt ? new Date(workspace.importedAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-GB') : '—'}</span><span> · {t.observed}: {workspace.people.filter(person => person.profile?.observed_at).length}/{workspace.people.length}</span></div><div className="coverage-tags">{Object.entries(coverageLabels).map(([field, label]) => <span key={field}>{label} <strong>{coverage.fields[field]}/{coverage.total}</strong></span>)}</div></section>
      <div className="analysis-toolbar"><input value={query} onChange={event => { setQuery(event.target.value); setPage(1); }} placeholder={t.search} aria-label={t.search} /><select value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} aria-label={t.classification}><option value="all">{t.all}</option>{assessmentTypes.map(key => <option key={key} value={key}>{t[key]}</option>)}</select></div>
      <div className="analysis-table"><div className="analysis-head"><span>{t.account}</span><span>{t.classification}</span><span>{t.score}</span><span>{t.confidence}</span><span>{t.reason}</span></div>{visible.map(({ person, result }) => <button className="analysis-row" key={person.username} onClick={() => onSelect(person.username.toLowerCase())}><strong>@{person.username}{person.status === 'protected' && <ShieldCheck size={16} aria-label={t.protected} />}</strong><span className={`assessment assessment-${result.label}`}>{t[result.label]}</span><span>{result.score === null ? '—' : `${result.score}/100`}</span><span>{t[result.confidence]}</span><span>{result.reasons[0] || (result.label === 'insufficient' ? t.noObservations : t.noReason)}</span><ArrowRight size={17} /></button>)}{!visible.length && <p className="poc-empty">No accounts match these filters.</p>}</div>
      <div className="analysis-pager"><span>{filtered.length} {t.account.toLowerCase()} · {page}/{pageCount}</span><div><button disabled={page === 1} onClick={() => setPage(page - 1)}>{locale === 'ko' ? '이전' : 'Previous'}</button><button disabled={page === pageCount} onClick={() => setPage(page + 1)}>{locale === 'ko' ? '다음' : 'Next'}</button></div></div>
    </> : <>
      <div className="operations-summary"><div><strong>{candidates.length}</strong><span>{t.proposed}</span></div><div><strong>{protectedCount}</strong><span>{t.protected}</span></div><div><strong>{workspace.jobs?.length || 0}</strong><span>{t.job}</span></div></div>
      <div className="operations-lead"><p>{t.planInfo}</p><button className="primary-button" disabled={workspace.mode !== 'import' || !candidates.length} onClick={onPlan}>{t.plan} <ArrowRight size={16} /></button></div>
      {!candidates.length && <p className="poc-empty">{t.noCandidates}</p>}
      <section className="local-test"><div><h2>{t.localTest}</h2><p>{t.selectTest}</p></div><label>{t.owner}<input value={owner} onChange={event => setOwner(event.target.value.replace(/^@/, ''))} placeholder="account_username" autoComplete="off" /></label><div className="test-targets">{candidates.map(person => <label key={person.username}><input type="checkbox" checked={testTargets.has(person.username.toLowerCase())} onChange={() => setTestTargets(current => { const next = new Set(current); const key = person.username.toLowerCase(); if (next.has(key)) next.delete(key); else if (next.size < 3) next.add(key); return next; })} /> @{person.username}</label>)}</div><div className="test-actions"><button className="secondary-button" disabled={!owner || testTargets.size < 1 || testTargets.size > 3} onClick={() => onApproval(owner, [...testTargets])}><Download size={16} /> {t.packet}</button><input ref={journalInput} type="file" accept=".json,application/json" hidden onChange={event => { onImportJournal(event.target.files[0]); event.target.value = ''; }} /><button className="secondary-button" onClick={() => journalInput.current.click()}><FileUp size={16} /> {t.importJournal}</button></div></section>
      <div className="job-list">{(workspace.jobs || []).slice().reverse().map(job => <section className="job-panel" key={job.id}><div className="job-head"><div><h2>{t.job} · {new Date(job.createdAt).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-GB')}</h2><span>{job.items.length} {t.account.toLowerCase()}{job.owner ? ` · @${job.owner}` : ''}</span></div>{job.status !== 'cancelled' && job.items.some(item => item.status === 'approved_pending') && <button onClick={() => onCancel(job.id)}><X size={16} /> {t.cancel}</button>}</div>{job.items.map(item => <div className="job-item" key={item.username}><strong>@{item.username}</strong><span>{({ approved_pending: t.pending, user_reported_done: t.done, failed: t.failed, unconfirmed: t.unconfirmed, cancelled: t.cancelled })[item.status] || journalLabels[item.status] || item.status}</span><a href={`https://www.instagram.com/${encodeURIComponent(item.username)}/`} target="_blank" rel="noopener noreferrer">{t.openProfile} <ExternalLink size={14} /></a>{item.status === 'approved_pending' && <select defaultValue="" aria-label={`${t.record}: ${item.username}`} onChange={event => onResult(job.id, item.username, event.target.value)}><option value="" disabled>{t.record}</option><option value="user_reported_done">{t.done}</option><option value="failed">{t.failed}</option><option value="unconfirmed">{t.unconfirmed}</option></select>}{item.events?.length > 0 && <details className="job-events"><summary>Action log ({item.events.length})</summary>{item.events.map((event, index) => <p key={index}><time>{new Date(event.at).toLocaleString(locale === 'ko' ? 'ko-KR' : 'en-GB')}</time> · {journalLabels[event.status] || event.status}: {event.detail}</p>)}</details>}</div>)}</section>)}{!workspace.jobs?.length && <p className="poc-empty">{t.noJobs}</p>}</div>
    </>}
  </div>;
}

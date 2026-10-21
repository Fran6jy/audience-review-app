import React from 'react';

const attention = new Set(['failed', 'unconfirmed', 'not_found', 'still_in_later_export', 'click_started']);
const completed = new Set(['absent_in_later_export']);

export default function AdminView({ workspace }) {
  const jobs = workspace.jobs || [];
  const items = jobs.flatMap(job => (job.items || []).map(item => ({ ...item, jobId: job.id, owner: job.owner || 'Not recorded' })));
  const events = items.flatMap(item => (item.events || []).map(event => ({ ...event, jobId: item.jobId, username: item.username })));
  const needingAttention = items.filter(item => attention.has(item.status));
  const verified = items.filter(item => completed.has(item.status));
  const pending = items.filter(item => ['approved_pending', 'approved', 'dry_run_ready'].includes(item.status));

  return <div className="admin-page">
    <div className="page-title"><div><h1>Local job monitor</h1><p>Plans and action journals from this browser workspace. This is not a multi-customer admin service.</p></div></div>
    <div className="admin-metrics"><div><strong>{jobs.length}</strong><span>Plans</span></div><div><strong>{pending.length}</strong><span>Pending or dry run</span></div><div><strong>{needingAttention.length}</strong><span>Needs reconciliation</span></div><div><strong>{verified.length}</strong><span>Absent in later export</span></div></div>
    <section className="admin-section"><h2>Attention needed</h2>{needingAttention.length ? <div className="admin-list">{needingAttention.map(item => <div key={`${item.jobId}:${item.username}`}><strong>@{item.username}</strong><span>{item.status.replaceAll('_', ' ')}</span><small>{item.jobId} · @{item.owner}</small></div>)}</div> : <p>No imported action errors or uncertain results.</p>}</section>
    <section className="admin-section"><h2>Recent action events</h2>{events.length ? <div className="admin-list">{events.slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50).map((event, index) => <div key={`${event.jobId}:${event.username}:${event.at}:${index}`}><strong>@{event.username}</strong><span>{event.status.replaceAll('_', ' ')}</span><small>{new Date(event.at).toLocaleString('en-GB')} · {event.detail || 'No detail'}</small></div>)}</div> : <p>No action journal has been imported. A plan alone is not an action log.</p>}</section>
    <p className="admin-note">“UI action completed” is unverified. Only a later complete follower export can show that an approved target is absent, and even that comparison depends on export completeness.</p>
  </div>;
}

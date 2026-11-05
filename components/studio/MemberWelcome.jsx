'use client';
import { useState } from 'react';

// A full-page introduction avoids leaving interactive dashboard controls behind a modal.
export default function MemberWelcome({ children, sb, ctx, D, nav, set, reload, openMyQueue }) {
  const [manual, setManual] = useState(false);
  const [closed, setClosed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const eligible = ['editor', 'designer'].includes(ctx.role);
  const progress = D.myMembership;
  const automatic = eligible && progress?.onboarding_required && !progress.onboarding_completed_at && !progress.onboarding_dismissed_at && !closed;
  const open = eligible && (manual || automatic);
  const editor = ctx.role === 'editor';
  const can = (resource, action) => (ctx.perms || []).some(([r, a]) => r === resource && a === action);
  const assigned = D.rows.filter((r) => (editor ? r.editorId : r.designerId) === ctx.user_id).length;
  const button = { minHeight: 44, padding: '10px 18px', borderRadius: 10, border: '1px solid #ccc', cursor: 'pointer', background: '#fff', color: '#111' };
  async function finish(action, destination) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      // Supabase RPC builders are PromiseLike, not Promises: await them instead of calling .catch().
      const result = await sb.rpc('save_my_onboarding', { p_action: action });
      if (result.error) throw result.error;
      setClosed(true); setManual(false);
      if (destination === 'projects' && openMyQueue) openMyQueue();
      else if (destination) set({ nav: destination });
      await reload();
    } catch {
      setError('Could not save your welcome progress. Please try again.');
    } finally {
      setBusy(false);
    }
  }
  if (!open) return <>{eligible && nav === 'settings' ? <div style={{ padding: 16, background: '#fff', color: '#111' }}><button style={button} onClick={() => setManual(true)}>Getting started as {editor ? 'an editor' : 'a designer'}</button></div> : null}{children}</>;
  return <main aria-labelledby="member-welcome-title" style={{ minHeight: '100vh', padding: 24, display: 'grid', placeItems: 'center', background: '#f5f5f5', color: '#111', fontFamily: 'var(--font-main)' }}>
    <section style={{ width: '100%', maxWidth: 620, boxSizing: 'border-box', padding: 28, borderRadius: 20, background: '#fff' }}>
      <p>{ctx.workspace_name} · {editor ? 'Editor' : 'Designer'}</p>
      <h1 id="member-welcome-title">Welcome{ctx.profile?.full_name ? ', ' + ctx.profile.full_name : ''}</h1>
      <p>Your account is ready. {assigned ? `You have ${assigned} assigned ${editor ? 'edit' : 'design'}${assigned === 1 ? '' : 's'}.` : 'Your team will assign work here. Ask your studio administrator when your first assignment will be ready.'}</p>
      <ol style={{ paddingLeft: 24, lineHeight: 1.7 }}>
        <li>Open your {editor ? 'edit' : 'design'} queue to find assigned projects and due dates.</li>
        {can('assets', 'create') ? <li>Open a project to upload {editor ? 'a cut' : 'a thumbnail'} for your team.</li> : <li>Your current access does not include uploads. Ask your administrator how to deliver files.</li>}
        {can(editor ? 'edits' : 'thumbs', 'edit') ? <li>Update your {editor ? 'edit' : 'thumbnail'} status, submit for review, and return here for revisions.</li> : <li>Your current access is view-only for work status. Ask your administrator if you need editing access.</li>}
      </ol>
      <p>If your queue looks empty, check its filters. You can reopen this guide from Settings.</p>
      {!!D.brands?.length && <p>Brand resources are available from the Brand section of the dashboard.</p>}
      {error ? <p role="alert" style={{ color: '#a11' }}>{error}</p> : null}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <button disabled={busy} style={{ ...button, background: '#111', color: '#fff' }} onClick={() => finish('complete', 'projects')}>{busy ? 'Saving…' : 'Open my queue'}</button>
        {!!D.brands?.length && <button disabled={busy} style={button} onClick={() => finish('complete', 'brand')}>Open brand resources</button>}
        <button disabled={busy} style={button} onClick={() => finish('dismiss')}>Skip for now</button>
      </div>
    </section>
  </main>;
}

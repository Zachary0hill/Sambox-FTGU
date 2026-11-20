'use client';
// Approval detail (handoff Santos-Approval), at /admin/automations/approvals/<run id>: what a workflow is about to
// send, for a Super Admin to approve, edit or reject. The draft on the left (Preview or Edit), the project and the
// reason on the right, and a bar that stays in view with Reject and Approve and send. After a decision the page
// says what happened, then moves on to the next waiting approval; an empty queue reads "All clear".
import { useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { T, R, FONT, WF_CSS } from '@/lib/workflow/theme';
import { approvalsOf, span } from '@/lib/workflow/approvals';
import { Svg, ICON, MiniSeg, btn, useModal } from './ui';

export default function ApprovalDetail({ D, A, id, set }) {
  const root = useRef(null);
  useModal(root, 'button[data-back]');
  const queue = approvalsOf(D);
  const at = queue.findIndex((x) => x.id === id);
  const a = at >= 0 ? queue[at] : null;
  const [view, setView] = useState('preview');
  const [body, setBody] = useState(null); // the edited message; null until Edit changes it
  const [busy, setBusy] = useState('');
  const [said, setSaid] = useState(''); // the status line after a decision
  const [opened] = useState(() => Date.now());
  const back = () => set({ autoAppr: '', autoTab: 'approvals' });
  const text = body != null ? body : a && a.draft ? a.draft.body : '';

  const decide = async (decision) => {
    if (busy || !a) return;
    setBusy(decision);
    const next = queue[at + 1] || queue[at - 1] || null;
    const ok = await A.decideApproval(a.id, decision, decision === 'approve' && body != null ? body : undefined);
    setBusy('');
    if (!ok) return;
    setSaid(decision === 'approve' ? 'Approved. ' + a.workflow + ' continues.' : 'Rejected. The run stopped.');
    setBody(null); setView('preview');
    set({ autoAppr: next ? next.id : 'done' });
  };

  const frame = (children) => (
    <div ref={root} className="wf wf-page" role="dialog" aria-modal="true" aria-label="Approval" onKeyDown={(e) => { if (e.key === 'Escape' && !(e.target instanceof Element && e.target.closest('input, textarea, select'))) back(); }}
      style={css('position: fixed; inset: 0; z-index: 56; overflow-y: auto; background: ' + T.page + '; color: ' + T.ink + '; font-family: ' + FONT.body + '; padding: 14px;')}>
      <style>{WF_CSS + `
        .wf-two-a { display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px; align-items: start; }
        @media (max-width: 900px) { .wf-page { padding: 0 !important; } .wf-pad { border-radius: 0 !important; padding: 24px 16px 48px !important; } .wf-two-a { grid-template-columns: minmax(0, 1fr); } .wf-page button { min-height: 40px; } }
      `}</style>
      <div className="wf-pad" style={css('min-height: calc(100vh - 28px); background: ' + T.surface + '; border-radius: ' + R.frame + 'px; padding: 28px 32px 32px; display: flex; flex-direction: column; gap: 22px;')}>{children}</div>
    </div>
  );
  const backLink = <button type="button" data-back="" className="wf-h" onClick={back} style={css('height: 42px; display: flex; align-items: center; gap: 6px; padding: 0 12px 0 8px; border: 0; border-radius: 10px; background: transparent; color: ' + T.ink + '; font-weight: 600; font-size: 14px;')}><Svg d={ICON.back} size={16} />Automations</button>;
  const status = said ? <div role="status" aria-live="polite" style={css('padding: 12px 16px; border-radius: 12px; background: ' + T.liveBg + '; color: ' + T.live + '; font-size: 14px; font-weight: 600;')}>{said}</div> : null;

  if (!a) return frame(
    <>
      <div style={css('display: flex; align-items: center; gap: 10px;')}>{backLink}<span style={css('font-size: 14px; color: ' + T.sub + ';')}>Approvals</span></div>
      {status}
      <div style={css('border: 1.5px dashed ' + T.pillOn + '; border-radius: 16px; padding: 48px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 10px;')}>
        <h1 style={css('margin: 0; font-family: ' + FONT.display + '; font-weight: 900; font-size: 28px;')}>{queue.length ? 'This approval is done' : 'All clear'}</h1>
        <p style={css('margin: 0; font-size: 14px; color: ' + T.muted + ';')}>{queue.length ? 'It was already decided, or its run has moved on.' : 'Nothing is waiting on you. Approvals show here when a workflow pauses for sign off.'}</p>
        {queue.length ? <button type="button" className="wf-k" onClick={() => { setSaid(''); set({ autoAppr: queue[0].id }); }} style={css(btn('primary') + ' margin-top: 6px;')}>Review the next one</button>
          : <button type="button" className="wf-h" onClick={back} style={css(btn('ghost') + ' margin-top: 6px;')}>Back to Automations</button>}
      </div>
    </>
  );

  const now = opened;
  const left = a.expiresAt ? new Date(a.expiresAt) - now : 0;
  const kv = (list) => list.map((x, i) => <div key={i} style={css('display: flex; justify-content: space-between; gap: 12px; padding: 9px 0; border-bottom: 1px solid ' + T.line + '; font-size: 14px;')}><span style={css('flex: none; color: ' + T.muted + ';')}>{x[0]}</span><span style={css('font-weight: 600; text-align: right; overflow-wrap: anywhere;')}>{x[1]}</span></div>);
  const row = 'display: grid; grid-template-columns: 80px minmax(0, 1fr); gap: 12px; align-items: center; padding: 12px 0; border-bottom: 1px solid ' + T.line + '; font-size: 14px;';

  return frame(
    <>
      <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 10px;')}>
        {backLink}
        <span style={css('font-size: 14px; color: ' + T.sub + ';')}>Approvals</span>
        <span style={css('background: ' + T.count + '; border-radius: 999px; padding: 3px 10px; font-size: 13px; font-weight: 600; color: ' + T.ink2 + ';')}>{at + 1} of {queue.length} waiting</span>
        <span style={css('flex: 1;')} />
        <button type="button" className="wf-h" onClick={() => set({ autoAppr: '', autoRun: a.runId })} style={css(btn('ghost'))}>View run</button>
        <button type="button" className="wf-h" onClick={() => set({ autoAppr: '', flowOpen: a.workflowId })} style={css(btn('ghost'))}>Open workflow</button>
      </div>
      {status}
      <div style={css('display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 16px;')}>
        <div style={css('display: flex; flex-direction: column; gap: 10px; min-width: 0;')}>
          <div style={css('display: flex; align-items: center; gap: 10px; flex-wrap: wrap;')}>
            <span style={css('background: ' + T.warnBg + '; color: ' + T.warnInk + '; border-radius: 999px; padding: 4px 11px; font-size: 13px; font-weight: 600;')}>Waiting on you</span>
            <span style={css('font-size: 14px; color: ' + T.sub + ';')}>{a.workflow} · waiting {span(now - new Date(a.waitingSince))}{a.expiresAt ? ' · auto-rejects in ' + span(left) : ''}</span>
          </div>
          <h1 style={css('margin: 0; font-family: ' + FONT.display + '; font-weight: 900; font-size: 34px; line-height: 1.1; letter-spacing: -.02em; overflow-wrap: anywhere;')}>{a.title}</h1>
        </div>
        {a.draft ? <MiniSeg label="View" h={38} value={view} onChange={setView} options={[['preview', 'Preview'], ['edit', 'Edit']]} /> : null}
      </div>

      <div className="wf-two-a">
        <section aria-label="Draft" style={css('border: 1px solid ' + T.border + '; border-radius: 16px; overflow: hidden; min-width: 0;')}>
          <div style={css('display: flex; align-items: center; gap: 10px; padding: 14px 20px; border-bottom: 1px solid ' + T.line + '; flex-wrap: wrap;')}>
            <span style={css('display: flex; align-items: center; gap: 6px; background: ' + T.count + '; color: ' + T.ink2 + '; border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600;')}>From the workflow’s next step</span>
            {a.draft && body != null && body !== a.draft.body ? <span style={css('font-size: 12px; font-weight: 600; color: ' + T.warnInk + ';')}>Edited</span> : null}
          </div>
          {a.draft ? (
            <div style={css('padding: 4px 20px 20px;')}>
              <div style={css(row)}><span style={css('color: ' + T.muted + ';')}>To</span><span><span style={css('display: inline-flex; align-items: center; min-height: 28px; padding: 3px 11px; border-radius: 999px; background: ' + T.varBg + '; color: ' + T.varInk + '; font-weight: 600;')}>{a.draft.to || 'Set by the step'}</span></span></div>
              <div style={css(row)}><span style={css('color: ' + T.muted + ';')}>Subject</span><span style={css('font-weight: 600; overflow-wrap: anywhere;')}>{a.draft.subject}</span></div>
              {view === 'edit' ? (
                <div style={css('padding-top: 16px; display: flex; flex-direction: column; gap: 6px;')}>
                  <label htmlFor="wf-ap-body" style={css('font-size: 13px; font-weight: 600; color: ' + T.muted + ';')}>Message</label>
                  <textarea id="wf-ap-body" rows={8} value={text} onChange={(e) => setBody(e.target.value)} placeholder="Leave empty to send the step’s standard message"
                    style={css('width: 100%; padding: 12px; border-radius: 12px; background: ' + T.surface + '; border: 1.5px solid ' + T.chipLine + '; color: ' + T.ink + '; font-family: inherit; font-size: 16px; line-height: 1.6; resize: vertical;')} />
                </div>
              ) : <div style={css('padding: 18px 0 4px; font-size: 16px; line-height: 1.7; color: ' + T.ink2 + '; white-space: pre-line; overflow-wrap: anywhere;')}>{text || <span style={css('color: ' + T.muted + ';')}>The step sends its standard message.</span>}</div>}
            </div>
          ) : <div style={css('padding: 20px; font-size: 15px; line-height: 1.6; color: ' + T.ink2 + ';')}>Nothing is sent by the next step. Approving lets the workflow carry on.</div>}
        </section>
        <aside style={css('display: flex; flex-direction: column; gap: 16px; min-width: 0;')}>
          {a.context.length ? (
            <section style={css('border: 1px solid ' + T.border + '; border-radius: 16px; padding: 18px 20px;')}>
              <h2 style={css('margin: 0 0 6px; font-size: 15px; font-weight: 700;')}>The project</h2>
              {kv(a.context)}
            </section>
          ) : null}
          <section style={css('background: ' + T.ground2 + '; border-radius: 16px; padding: 18px 20px; display: flex; flex-direction: column; gap: 8px;')}>
            <h2 style={css('margin: 0; font-size: 15px; font-weight: 700;')}>Why this needs you</h2>
            <div style={css('font-size: 14px; line-height: 1.55; color: ' + T.ink2 + ';')}>{a.reason}</div>
            <div style={css('font-size: 13px; color: ' + T.sub + '; margin-top: 4px;')}>After you approve: {a.after}</div>
          </section>
        </aside>
      </div>

      <div style={css('position: sticky; bottom: 24px; display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 16px; background: ' + T.surface + '; border: 1px solid ' + T.border + '; box-shadow: 0 12px 32px rgba(0,0,0,.1); flex-wrap: wrap;')}>
        <span style={css('font-size: 14px; color: ' + T.sub + '; margin-left: 6px; margin-right: auto;')}>Nothing sends until you approve.</span>
        <button type="button" className="wf-h" disabled={!!busy} onClick={() => decide('reject')} style={css('height: 46px; padding: 0 18px; border-radius: 12px; background: ' + T.surface + '; border: 1px solid ' + T.errorLine + '; color: ' + T.error + '; font-weight: 600; font-size: 15px;')}>{busy === 'reject' ? 'Rejecting…' : 'Reject'}</button>
        <button type="button" className="wf-k" disabled={!!busy} onClick={() => decide('approve')} style={css('height: 46px; padding: 0 20px; border-radius: 12px; background: ' + T.accent + '; color: ' + T.accentInk + '; border: 0; font-weight: 600; font-size: 15px;')}>{busy === 'approve' ? 'Approving…' : a.draft ? 'Approve and send' : 'Approve'}</button>
      </div>
    </>
  );
}

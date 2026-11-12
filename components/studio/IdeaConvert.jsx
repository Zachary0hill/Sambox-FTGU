import { useEffect, useRef } from 'react';

const option = { display: 'grid', gap: 2, width: '100%', minHeight: 56, padding: '10px 14px', boxSizing: 'border-box', border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface-2)', color: 'var(--ink)', font: 'inherit', textAlign: 'left', cursor: 'pointer' };

// The Approve step: one click creates the chosen item and moves the idea to Approved.
export default function IdeaConvert({ title, options, close }) {
  const dialog = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    node.showModal();
    return () => node.close();
  }, []);
  return <dialog ref={dialog} aria-labelledby="idea-convert-title" onCancel={(event) => { event.preventDefault(); close(); }}
    style={{ width: 'min(460px, calc(100vw - 32px))', boxSizing: 'border-box', padding: 24, border: '1px solid var(--border)', borderRadius: 20, background: 'var(--surface)', color: 'var(--ink)' }}>
    <div style={{ display: 'grid', gap: 16 }}>
      <div>
        <h2 id="idea-convert-title" style={{ margin: 0, fontSize: 20 }}>Approve this idea</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--muted)' }}>Choose what “{title}” becomes. The idea stays here, linked to it.</p>
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {options.map((o) => <button key={o.label} type="button" style={option} onClick={o.pick}>
          <strong style={{ fontSize: 15 }}>{o.label}</strong>
          <span style={{ fontSize: 13, color: 'var(--muted)' }}>{o.help}</span>
        </button>)}
      </div>
      <button type="button" onClick={close} style={{ ...option, minHeight: 44, textAlign: 'center' }}>Cancel</button>
    </div>
  </dialog>;
}

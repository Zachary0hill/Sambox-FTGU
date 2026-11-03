'use client';
// app: Edit brand dialog (Super Admin). One pane per part of the kit, so the save bar and section list stay in view.
// The view model is br.edit in lib/studio/vals-pages.js; this file keeps only which pane is open and unsent tone text.
import { useEffect, useRef, useState } from 'react';
import { css } from '@/lib/studio/css';
import { Field, Chip, Icon, IC } from './Prims';
import { DragHandle, useOptionDrag } from './SelectPicker';
import Dropdown from './Dropdown';
import SocialIcon from './SocialIcon';

const PANES = [
  { id: 'identity', label: 'Identity', icon: 'M8 2.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 1 1 0-5zM3 13.5c.6-2.4 2.6-3.5 5-3.5s4.4 1.1 5 3.5' },
  { id: 'colors', label: 'Colors', icon: 'M8 2s4.5 4.6 4.5 7.5a4.5 4.5 0 0 1-9 0C3.5 6.6 8 2 8 2z' },
  { id: 'fonts', label: 'Typography', icon: 'M3 4V3h10v1M8 3v10M6 13h4' },
  { id: 'voice', label: 'Voice', icon: 'M2.5 3.5h11V11h-6l-3 2.5V11h-2z' },
  { id: 'social', label: 'Social links', icon: 'M6.5 9.5l3-3M7 4.5l1-1a2.8 2.8 0 0 1 4 4l-1 1M9 11.5l-1 1a2.8 2.8 0 0 1-4-4l1-1' },
  { id: 'rules', label: 'More rules', icon: 'M5.5 4h8M5.5 8h8M5.5 12h8M2.5 4h.01M2.5 8h.01M2.5 12h.01' }
];
const WEIGHTS = [['100', 'Thin'], ['200', 'Extra light'], ['300', 'Light'], ['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold'], ['900', 'Black']];
const RULE_IDEAS = ['Sponsor read rules', 'Thumbnail rules', 'Legal lines'];

const HELP = 'margin: 0; font-size: 12px; line-height: 1.45; color: var(--muted-2);';
const QUIET_BTN = 'min-height: 44px; padding: 0 18px; border: 0; border-radius: 14px; background: transparent; color: var(--ink-3); cursor: pointer;';
const OUTLINE_BTN = 'min-height: 44px; padding: 0 14px; border: 1px solid var(--border); border-radius: 14px; background: transparent; color: var(--ink); cursor: pointer;';
const REMOVE_BTN = 'width: 40px; height: 40px; flex: none; padding: 0; border: 0; border-radius: 10px; background: transparent; color: var(--muted-2); display: inline-flex; align-items: center; justify-content: center; cursor: pointer;';
const SWATCH = 'position: relative; width: 40px; height: 40px; flex: none; box-sizing: border-box; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; cursor: pointer;';

function PaneHead({ id, title, help }) {
  return (
    <div style={css('display: flex; flex-direction: column; gap: 4px')}>
      <h3 id={id} style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h5); font-weight: var(--weight-black); letter-spacing: -0.01em; color: var(--ink)')}>{title}</h3>
      {help ? <p style={css(HELP + ' font-size: 13px;')}>{help}</p> : null}
    </div>
  );
}

function AddRow({ children, onClick }) {
  return (
    <button type="button" className="fb-addrow" onClick={onClick} style={css('align-self: flex-start; display: inline-flex; align-items: center; gap: 6px; min-height: 36px; padding: 0 12px 0 10px; border: 1px dashed var(--border-strong); border-radius: 10px; background: transparent; color: var(--ink-2); font-size: 13px; font-weight: 600; cursor: pointer')}>
      <Icon d={IC.plus} size={14} sw={1.75} />
      {children}
    </button>
  );
}

function RemoveRow({ label, onClick }) {
  return <button type="button" className="fb-ni" aria-label={label} onClick={onClick} style={css(REMOVE_BTN)}><Icon d={IC.x} size={14} sw={1.75} /></button>;
}

function Empty({ children }) {
  return <p style={css('margin: 0; padding: 20px 16px; border: 1px dashed var(--border); border-radius: 12px; text-align: center; font-size: 13px; line-height: 1.5; color: var(--muted)')}>{children}</p>;
}

// A square that shows a color and opens the system color picker.
function Swatch({ label, color, pick, onChange }) {
  return (
    <label className="fb-swatchin" style={css(SWATCH + ' background: ' + color + ';')}>
      <input type="color" aria-label={label} value={pick} onChange={onChange} style={css('position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0; border: 0; opacity: 0; cursor: pointer')} />
    </label>
  );
}

// Rows that reorder by their drag handles. Each row gets props for its handle; rows carry data-opt.
function DragList({ onMove, children }) {
  const ref = useRef(null);
  const { handle, lineEl } = useOptionDrag(ref, (id, to) => onMove(Number(id), to));
  return (
    <div ref={ref} style={css('position: relative; display: flex; flex-direction: column; gap: 8px')}>
      {children(handle)}
      {lineEl}
    </div>
  );
}

function ToneInput({ value, onChange, dark }) {
  const [draft, setDraft] = useState('');
  const words = String(value || '').split(',').map((x) => x.trim()).filter(Boolean);
  const commit = () => {
    const t = draft.trim().replace(/,+$/, '');
    if (t && !words.some((w) => w.toLowerCase() === t.toLowerCase())) onChange({ target: { value: words.concat([t]).join(', ') } });
    setDraft('');
  };
  return (
    <Field label="Tone words" placeholder={words.length ? 'Add another' : 'Playful, direct, curious'} value={draft}
      chips={words.length ? words.map((w) => <Chip key={w} tone="gray" dark={dark} onRemove={() => onChange({ target: { value: words.filter((x) => x !== w).join(', ') } })}>{w}</Chip>) : null}
      onChange={(e) => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commit(); }
        else if (e.key === 'Backspace' && !draft && words.length) onChange({ target: { value: words.slice(0, -1).join(', ') } });
      }} />
  );
}

function IdentityPane({ e }) {
  const paletteColors = (e.colors || []).filter((r) => r.valid);
  return (
    <>
      <PaneHead id="be-pane-identity" title="Identity" help="How this brand shows up across the board." />
      <Field id="be-name" label="Name" autoComplete="off" value={e.name} onChange={e.onName} />
      {e.canAccount ? <Dropdown id="be-account" label="Sponsor account" value={e.account} options={e.accounts} onChange={e.onAccount} /> : null}
      <div style={css('display: flex; flex-direction: column; gap: 8px')}>
        <div style={css('display: flex; align-items: flex-end; gap: 8px')}>
          <Swatch label="Pick accent color" color={e.colorPick} pick={e.colorPick} onChange={e.onColor} />
          <div style={css('flex: 1 1 auto; max-width: 200px')}>
            <Field id="be-color" label="Accent color" autoComplete="off" placeholder="#1A73E8" value={e.color} invalid={e.colorBad} onChange={e.onColor} />
          </div>
          {e.color ? <button type="button" className="fb-ni" onClick={() => e.onColor('')} style={css('min-height: 40px; padding: 0 12px; border: 0; border-radius: 10px; background: transparent; color: var(--ink-3); font-size: 13px; font-weight: 600; cursor: pointer')}>Clear</button> : null}
        </div>
        <p style={css(HELP)}>{e.colorBad ? 'Use a hex code like #1A73E8.' : 'Tints this brand\'s tile and its idea cards.'}</p>
        {paletteColors.length ? (
          <div role="group" aria-label="Use a palette color" style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 6px')}>
            <span style={css(HELP + ' margin-right: 2px;')}>From the palette</span>
            {paletteColors.map((r, i) => (
              <button key={i} type="button" className="fb-dot" aria-label={'Use ' + (r.name || r.hex) + ' as accent'} aria-pressed={e.colorPick === r.pick} title={r.name || r.hex} onClick={() => e.onColor(r.pick)}
                style={css('width: 24px; height: 24px; padding: 0; box-sizing: border-box; border: 1px solid var(--border); border-radius: 999px; cursor: pointer; background: ' + r.pick + ';')}></button>
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}

function ColorsPane({ e }) {
  const valid = (e.colors || []).filter((r) => r.valid);
  return (
    <>
      <PaneHead id="be-pane-colors" title="Colors" help="The palette the team copies from. Drag to set the order." />
      {valid.length ? (
        <div aria-hidden="true" style={css('display: flex; height: 56px; flex: none; border: 1px solid var(--border); border-radius: 12px; overflow: hidden')}>
          {valid.map((r, i) => <span key={i} title={r.name || r.hex} style={css('flex: 1; min-width: 0; background: ' + r.pick + ';')}></span>)}
        </div>
      ) : null}
      {e.colors.length ? (
        <DragList onMove={(from, to) => e.moveRow('colors', from, to)}>
          {(handle) => e.colors.map((r, i) => (
            <div key={i} data-opt={i} style={css('display: flex; align-items: center; gap: 8px')}>
              <DragHandle props={handle(String(i))} />
              <Swatch label={'Pick color ' + (i + 1)} color={r.pick} pick={r.pick} onChange={r.onHex} />
              <div style={css('flex: 1; min-width: 0')}><Field label={'Color ' + (i + 1) + ' name'} hideLabel autoComplete="off" placeholder="Name" value={r.name} onChange={r.onName} /></div>
              <div style={css('flex: 0 0 116px; min-width: 0')}><Field label={'Color ' + (i + 1) + ' hex'} hideLabel autoComplete="off" placeholder="#000000" value={r.hex} invalid={r.bad} onChange={r.onHex} /></div>
              <RemoveRow label={'Remove color ' + (i + 1)} onClick={r.remove} />
            </div>
          ))}
        </DragList>
      ) : <Empty>No colors yet. Add the brand&apos;s palette so the team can copy exact values.</Empty>}
      <AddRow onClick={() => e.addColor()}>Add color</AddRow>
    </>
  );
}

function FontsPane({ e }) {
  const weightOpts = (w) => {
    const opts = WEIGHTS.map((x) => ({ value: x[0], label: x[0], note: x[1] }));
    return w && !opts.some((o) => o.value === w) ? opts.concat([{ value: w, label: w }]) : opts;
  };
  return (
    <>
      <PaneHead id="be-pane-fonts" title="Typography" help="Font name as installed or on Google Fonts, and what it is used for. The sample shows only if the font is on this device." />
      {e.fonts.length ? (
        <DragList onMove={(from, to) => e.moveRow('fonts', from, to)}>
          {(handle) => e.fonts.map((r, i) => (
            <div key={i} data-opt={i} className="fb-be-row" style={css('display: flex; align-items: center; gap: 8px')}>
              <DragHandle props={handle(String(i))} />
              <span aria-hidden="true" style={css('width: 40px; height: 40px; flex: none; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; background: var(--chip-2); color: var(--ink); font-size: 18px; line-height: 1; overflow: hidden; font-weight: ' + (r.weight || 400) + '; font-family: \'' + String(r.name || '').replace(/['";]/g, '') + '\', var(--font-main);')}>Ag</span>
              <div style={css('flex: 1 1 140px; min-width: 0')}><Field label={'Font ' + (i + 1) + ' name'} hideLabel autoComplete="off" placeholder="Inter" value={r.name} onChange={r.onName} /></div>
              <div style={css('flex: 1 1 120px; min-width: 0')}><Field label={'Font ' + (i + 1) + ' use'} hideLabel autoComplete="off" placeholder="Headlines" value={r.use} onChange={r.onUse} /></div>
              <div style={css('flex: 0 0 136px; min-width: 0')}><Dropdown label={'Font ' + (i + 1) + ' weight'} hideLabel value={r.weight} options={weightOpts(r.weight)} onChange={r.onWeight} minMenuWidth={200} /></div>
              <RemoveRow label={'Remove font ' + (i + 1)} onClick={r.remove} />
            </div>
          ))}
        </DragList>
      ) : <Empty>No fonts yet. Add the typefaces this brand uses.</Empty>}
      <AddRow onClick={() => e.addFont()}>Add font</AddRow>
    </>
  );
}

function VoicePane({ e, dark }) {
  return (
    <>
      <PaneHead id="be-pane-voice" title={e.voiceLabel} help="Sent to the assistant and research agent word for word." />
      <div style={css('display: flex; flex-direction: column; gap: 6px')}>
        <Field id="be-voice-prompt" label="Voice prompt" multiline rows={7} maxLength="6000" value={e.voice} onChange={e.onVoice}
          placeholder="Write the voice and rules as you would brief a writer: who the audience is, how the brand talks, what it never says, how scripts should open and close." />
        <div style={css('display: flex; justify-content: flex-end; font-size: 12px; font-variant-numeric: tabular-nums; color: var(--muted-2)')}>{e.voiceCount}</div>
      </div>
      <div style={css('display: flex; flex-direction: column; gap: 6px')}>
        <ToneInput value={e.tone} onChange={e.onTone} dark={dark} />
        <p style={css(HELP)}>Press Enter or a comma after each word.</p>
      </div>
      <div style={css('display: grid; grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr)); gap: 12px')}>
        <Field id="be-dos" label="Do" multiline rows={5} placeholder="One per line" value={e.dos} onChange={e.onDos} />
        <Field id="be-donts" label="Don't" multiline rows={5} placeholder="One per line" value={e.donts} onChange={e.onDonts} />
      </div>
    </>
  );
}

function SocialPane({ e }) {
  const list = useRef(null);
  const count = useRef(e.socials.length);
  // A new row is ready to paste into.
  useEffect(() => {
    if (e.socials.length > count.current && list.current) {
      const inputs = list.current.querySelectorAll('input[type="url"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
    }
    count.current = e.socials.length;
  }, [e.socials.length]);
  const options = (e.socialOpts || []).map((o) => Object.assign({}, o, { icon: o.value ? <SocialIcon id={o.value} /> : <Icon d="M8 2l1.4 3.6L13 7l-3.6 1.4L8 12 6.6 8.4 3 7l3.6-1.4z" /> }));
  return (
    <>
      <PaneHead id="be-pane-social" title="Social links" help="Pick a platform or paste any profile link. The platform is detected from the link." />
      <div role="group" aria-label="Add a link for a platform" className="fb-be-plats" style={css('display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px')}>
        {e.platforms.map((p) => (
          <button key={p.id} type="button" className="fb-plat" aria-label={'Add ' + p.name + ' link' + (p.used ? ', already added' : '')} onClick={p.add}
            style={css('position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-width: 0; min-height: 68px; padding: 8px 4px; border: 1px solid ' + (p.used ? 'var(--border-strong)' : 'var(--border)') + '; border-radius: 12px; background: ' + (p.used ? 'var(--chip-2)' : 'transparent') + '; color: var(--ink); font-size: 12px; font-weight: 600; letter-spacing: normal; cursor: pointer')}>
            <SocialIcon id={p.id} size={20} />
            <span style={css('max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap')}>{p.name}</span>
            {p.used ? <span aria-hidden="true" style={css('position: absolute; top: 5px; right: 5px; display: inline-flex; color: var(--ink-3)')}><Icon d={IC.check} size={12} sw={2.2} /></span> : null}
          </button>
        ))}
      </div>
      {e.socials.length ? (
        <div ref={list}>
          <DragList onMove={(from, to) => e.moveRow('socials', from, to)}>
            {(handle) => e.socials.map((r, i) => (
              <div key={i} data-opt={i} style={css('display: flex; flex-direction: column; gap: 4px')}>
                <div className="fb-be-row" style={css('display: flex; align-items: center; gap: 8px')}>
                  <DragHandle props={handle(String(i))} />
                  <div style={css('flex: 0 0 176px; min-width: 0')}>
                    <Dropdown label={'Link ' + (i + 1) + ' platform'} hideLabel value={r.platform} options={options} onChange={r.onPlatform} minMenuWidth={230}
                      display={r.platform || !r.detected ? null : { label: r.detectedName, note: 'Detected', icon: <SocialIcon id={r.detected} /> }} />
                  </div>
                  <div style={css('flex: 1 1 200px; min-width: 0')}>
                    <Field type="url" inputMode="url" autoComplete="off" label={'Link ' + (i + 1) + ' address'} hideLabel placeholder={r.example} value={r.url} invalid={r.bad} onChange={r.onUrl} />
                  </div>
                  {r.href ? (
                    <a href={r.href} target="_blank" rel="noopener noreferrer" className="fb-ni" aria-label={'Open link ' + (i + 1) + ' in a new tab'} style={css(REMOVE_BTN + ' text-decoration: none;')}>
                      <Icon d="M6 3H3v10h10v-3M9 3h4v4M13 3L7.5 8.5" size={14} sw={1.75} />
                    </a>
                  ) : null}
                  <RemoveRow label={'Remove link ' + (i + 1)} onClick={r.remove} />
                </div>
                {r.bad ? <p className="fb-be-hint" style={css(HELP + ' color: var(--red-ink);')}>Use a full address like {r.example}.</p> : null}
                {r.mismatch ? (
                  <p className="fb-be-hint" style={css(HELP)}>
                    This looks like a {r.mismatch.name} link.{' '}
                    <button type="button" onClick={r.mismatch.use} style={css('padding: 0; border: 0; background: transparent; color: var(--link); font-size: 12px; font-weight: 600; letter-spacing: normal; cursor: pointer')}>Switch to {r.mismatch.name}</button>
                  </p>
                ) : null}
              </div>
            ))}
          </DragList>
        </div>
      ) : <Empty>No links yet. Pick a platform above to add the first one.</Empty>}
      <AddRow onClick={() => e.addSocial()}>Add link</AddRow>
    </>
  );
}

function RulesPane({ e }) {
  const unused = RULE_IDEAS.filter((t) => !e.sections.some((r) => r.title.trim().toLowerCase() === t.toLowerCase()));
  return (
    <>
      <PaneHead id="be-pane-rules" title="More rules" help="Extra sections for the brand page. One item per line." />
      {e.sections.length ? e.sections.map((r, i) => (
        <div key={i} style={css('display: flex; flex-direction: column; gap: 8px; padding: 12px; border: 1px solid var(--line); border-radius: 12px')}>
          <div style={css('display: flex; align-items: center; gap: 8px')}>
            <div style={css('flex: 1; min-width: 0')}><Field label={'Section ' + (i + 1) + ' title'} hideLabel strong autoComplete="off" placeholder="Section title" value={r.title} onChange={r.onTitle} /></div>
            <RemoveRow label={'Remove section ' + (i + 1)} onClick={r.remove} />
          </div>
          <Field label={'Section ' + (i + 1) + ' items'} hideLabel multiline rows={3} placeholder="One per line" value={r.text} onChange={r.onText} />
        </div>
      )) : <Empty>No extra rules yet. Start from a suggestion or add your own section.</Empty>}
      <div style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px')}>
        <AddRow onClick={() => e.addSection()}>Add section</AddRow>
        {unused.map((t) => (
          <button key={t} type="button" className="fb-ni" onClick={() => e.addSection(t)} style={css('min-height: 36px; padding: 0 12px; border: 0; border-radius: 10px; background: var(--chip-2); color: var(--ink-2); font-size: 13px; font-weight: 600; letter-spacing: normal; cursor: pointer')}>{t}</button>
        ))}
      </div>
    </>
  );
}

export default function BrandEditor({ e, ui, dark }) {
  const [pane, setPane] = useState('identity');
  const dialog = useRef(null);
  const lastErr = useRef('');

  // A failed save opens the pane that needs fixing.
  useEffect(() => {
    if (e.err && e.err !== lastErr.current && e.errPane) setPane(e.errPane);
    lastErr.current = e.err;
  }, [e.err, e.errPane]);

  // On phones the section list scrolls sideways; keep the open section in view.
  useEffect(() => {
    const tab = dialog.current && dialog.current.querySelector('.fb-be-tab[aria-current]');
    if (tab) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pane]);

  // Focus starts on the name and returns to the opener; Tab stays inside the dialog.
  useEffect(() => {
    const back = document.activeElement;
    const first = dialog.current && dialog.current.querySelector('#be-name');
    if (first) first.focus({ preventScroll: true });
    return () => { if (back && back.focus && document.contains(back)) back.focus({ preventScroll: true }); };
  }, []);
  const onKey = (ev) => {
    if (ev.key === 'Escape') { ev.preventDefault(); e.close(); return; }
    if (ev.key !== 'Tab') return;
    const items = Array.from(dialog.current.querySelectorAll('button:not([tabindex="-1"]), a[href], input:not([type="color"]), textarea')).filter((el) => !el.disabled && el.offsetParent !== null);
    if (!items.length) return;
    const a = document.activeElement;
    if (ev.shiftKey && a === items[0]) { ev.preventDefault(); items[items.length - 1].focus(); }
    else if (!ev.shiftKey && a === items[items.length - 1]) { ev.preventDefault(); items[0].focus(); }
  };

  const counts = { colors: e.colors.length, fonts: e.fonts.length, social: e.socialCount, rules: e.sections.length };
  const label = (p) => (p.id === 'voice' ? e.voiceLabel : p.label);
  return (
    <>
      <button type="button" aria-label="Close dialog" onClick={e.close} style={css('position: fixed; inset: 0; z-index: 40; border: 0; background: rgba(17,17,17,0.32); cursor: default')}></button>
      <dialog ref={dialog} open aria-modal="true" aria-labelledby="br-edit-title" onKeyDown={onKey} className="fb-be"
        style={css(ui.dialog + ' display: flex; flex-direction: column; width: 880px; height: 720px; max-height: calc(100vh - 48px); padding: 0; overflow: hidden;')}>
        <header style={css('display: flex; align-items: center; gap: 12px; padding: 16px 16px 16px 20px; border-bottom: 1px solid var(--line)')}>
          <span aria-hidden="true" style={css(e.tile + ' transition: background-color .15s ease;')}>{e.initials}</span>
          <div style={css('flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px')}>
            <h2 id="br-edit-title" style={css('margin: 0; font-family: var(--font-title); font-size: var(--text-h4); font-weight: var(--weight-black); letter-spacing: -0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>Edit brand</h2>
            <p style={css('margin: 0; font-size: 13px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis')}>{e.subtitle}</p>
          </div>
          <button type="button" className="fb-ni" aria-label="Close" onClick={e.close} style={css(ui.iconBtn)}><Icon d={IC.x} size={16} sw={1.75} /></button>
        </header>

        <div className="fb-be-body" style={css('flex: 1; min-height: 0; display: flex')}>
          <nav aria-label="Brand sections" className="fb-be-rail" style={css('flex: 0 0 200px; box-sizing: border-box; display: flex; flex-direction: column; gap: 2px; padding: 12px; border-right: 1px solid var(--line); overflow-y: auto')}>
            {PANES.map((p) => {
              const on = pane === p.id;
              return (
                <button key={p.id} type="button" className="fb-mr fb-be-tab" aria-current={on ? 'true' : undefined} onClick={() => setPane(p.id)}
                  style={css('display: flex; align-items: center; gap: 10px; flex: none; min-height: 38px; padding: 0 10px; border: 0; border-radius: 10px; font-size: 14px; font-weight: ' + (on ? 600 : 500) + '; letter-spacing: normal; text-align: left; white-space: nowrap; cursor: pointer; background: ' + (on ? 'var(--hover)' : 'transparent') + '; color: ' + (on ? 'var(--ink)' : 'var(--ink-3)') + ';')}>
                  <Icon d={p.icon} />
                  <span style={css('flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis')}>{label(p)}</span>
                  {counts[p.id] ? <span style={css('flex: none; font-size: 12px; font-weight: 500; font-variant-numeric: tabular-nums; color: var(--muted-2)')}>{counts[p.id]}</span> : null}
                </button>
              );
            })}
          </nav>
          <section key={pane} aria-labelledby={'be-pane-' + pane} className="fb-pop fb-be-pane" style={css('flex: 1; min-width: 0; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; padding: 20px 24px 24px; overflow-y: auto')}>
            {pane === 'identity' ? <IdentityPane e={e} /> : null}
            {pane === 'colors' ? <ColorsPane e={e} /> : null}
            {pane === 'fonts' ? <FontsPane e={e} /> : null}
            {pane === 'voice' ? <VoicePane e={e} dark={dark} /> : null}
            {pane === 'social' ? <SocialPane e={e} /> : null}
            {pane === 'rules' ? <RulesPane e={e} /> : null}
          </section>
        </div>

        {e.hasErr ? <p role="alert" style={css('margin: 0; padding: 10px 20px; background: var(--red-soft); color: var(--red-ink); font-size: 13px; font-weight: 600')}>{e.err}</p> : null}
        <footer style={css('display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 12px 16px 12px 20px; border-top: 1px solid var(--line)')}>
          {e.confirm ? (
            <>
              <p role="alert" style={css('flex: 1 1 280px; margin: 0; font-size: 13px; font-weight: 600; line-height: 1.4; color: var(--red-ink)')}>{e.delNote}</p>
              <button type="button" className="fb-ni" onClick={e.keepBrand} style={css(QUIET_BTN)}>Keep brand</button>
              <button type="button" onClick={e.del} style={css(OUTLINE_BTN + ' background: var(--red-soft); color: var(--red-ink);')}>Delete brand</button>
            </>
          ) : e.leaving ? (
            <>
              <p role="alert" style={css('flex: 1 1 200px; margin: 0; font-size: 13px; font-weight: 600; color: var(--ink)')}>Discard your unsaved changes?</p>
              <button type="button" className="fb-ni" onClick={e.keepEditing} style={css(QUIET_BTN)}>Keep editing</button>
              <button type="button" onClick={e.discard} style={css(OUTLINE_BTN + ' color: var(--red-ink);')}>Discard</button>
            </>
          ) : (
            <>
              <button type="button" className="fb-ni" onClick={e.del} style={css(QUIET_BTN + ' padding: 0 12px; color: var(--red-ink);')}>Delete brand</button>
              <span style={css('flex: 1')}></span>
              {e.dirty ? <span role="status" className="fb-be-status" style={css('font-size: 13px; color: var(--muted-2); margin-right: 4px')}>Unsaved changes</span> : null}
              <button type="button" className="fb-ni" onClick={e.close} style={css(QUIET_BTN)}>Cancel</button>
              <button type="button" onClick={e.save} style={css(ui.btnPrimary)}>Save brand</button>
            </>
          )}
        </footer>
      </dialog>
    </>
  );
}

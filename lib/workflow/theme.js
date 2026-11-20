// Workflow builder theme tokens (handoff/santos-workflow-builder-handoff-2026-11-17/HANDOFF.md § Design tokens).
// The one brand file for the workflow screens: the hub, builder, run detail, connectors and approvals read colors,
// radii and control heights from here. Design values map to the board's tokens (lib/studio/vals.js TK) wherever one
// exists, so dark mode keeps working; a value with no board token is added here with light-dark().
const ld = (light, dark) => 'light-dark(' + light + ', ' + dark + ')';

export const T = {
  // Grounds
  page: 'var(--page)',            // #EBEBEB
  surface: 'var(--surface)',      // #FFFFFF panels, cards
  ground: 'var(--surface-2)',     // #FAFAFA canvas, previews, table heads
  ground2: 'var(--panel)',        // #F5F5F5 search, quiet boxes
  hover: 'var(--hover)',          // #F0F0F0
  // Lines
  border: 'var(--border)',        // #E6E6E6 cards
  chipLine: ld('#E3E3E3', '#2A2B30'), // canvas cards, preview chips
  line: 'var(--line-3)',          // #EDEDED dividers
  inputLine: 'var(--border-3)',   // #DADADA inputs, round buttons
  borderHover: ld('#CFCFCF', '#4A4C52'),
  pillOn: ld('#D6D6D6', '#4A4C52'),   // selected filter pill border, switch track when off
  // Text
  ink: 'var(--ink)',              // #111
  ink2: 'var(--ink-2b)',          // #333
  ink3: 'var(--ink-3)',           // #444
  sub: 'var(--ink-4)',            // #555
  muted: 'var(--muted)',          // #666, 12px minimum
  placeholder: 'var(--faint)',    // #8A8A8A
  // Accent is ink
  accent: 'var(--inv)', accentInk: 'var(--inv-ink)', accentHover: ld('#2B2B2B', '#FFFFFF'),
  link: ld('#2F5BEA', '#9DB9FF'), linkHover: ld('#1E3FB0', '#C3D4FF'), ring: ld('#2F5BEA', '#9DB9FF'),
  varInk: 'var(--blue-ink)', varBg: 'var(--blue-soft)',   // variable chips #2449C7 on #EAF0FF
  // Status
  live: ld('#1F7A45', '#6EE59A'), liveBg: 'var(--green-soft)',
  warn: ld('#8A5A00', '#F7CC6E'), warnInk: ld('#7A5300', '#F7CC6E'), warnBg: 'var(--amber-soft)',
  error: ld('#B42318', '#FF8F8C'), errorBg: ld('#FDECEC', 'rgba(240,82,79,0.16)'), errorLine: ld('#F1C4C4', 'rgba(240,82,79,0.4)'), errorInk: ld('#3A0F0A', '#FFD3D1'),
  off: 'var(--muted)',
  count: ld('#EFEFEF', '#232428'), countInk: 'var(--ink-2b)', countIn: ld('#E9E9E9', '#2A2B30'),
  dot: ld('#DEDEDE', '#2A2B30'), wire: ld('#CFCFCF', '#3A3B40'), knob: '#FFFFFF',
};

// Step kinds: 30px tile, radius 9 on cards; 22px tile, radius 6 on preview chips.
export const KIND = {
  trigger: { ink: ld('#8A5A00', '#F7CC6E'), bg: 'var(--amber-soft)', icon: 'M13 2 3 14h9l-1 8 10-12h-9l1-8z' },
  data: { ink: 'var(--blue-ink)', bg: 'var(--blue-soft)', icon: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z' },
  action: { ink: ld('#1F7A45', '#6EE59A'), bg: 'var(--green-soft)', icon: 'M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z' },
  logic: { ink: 'var(--coral-ink)', bg: 'var(--coral-soft)', icon: 'M6 3v12M18 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 9a9 9 0 0 1-9 9' },
  ai: { ink: 'var(--violet-ink)', bg: 'var(--violet-soft)', icon: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z' },
  human: { ink: 'var(--ink-3)', bg: 'var(--chip)', icon: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM16 11l2 2 4-4' },
};

export const R = { pill: 999, frame: 20, card: 16, control: 12, small: 10, chip: 9, tile: 6 };
export const H = { primary: 46, secondary: 40, segmented: 36, input: 44, chip: 28, plus: 34, touch: 44 };
export const SHADOW = { card: '0 1px 2px rgba(0,0,0,.04)', chip: '0 1px 2px rgba(0,0,0,.05)', hover: '0 4px 16px rgba(0,0,0,.06)', modal: '0 24px 80px rgba(0,0,0,.22)', toast: '0 8px 24px rgba(0,0,0,.2)' };
export const FONT = { display: 'var(--font-title)', body: 'var(--font-main)' };
export const dotGrid = 'background-color: ' + T.ground + '; background-image: radial-gradient(' + T.dot + ' 1px, transparent 1px); background-size: 16px 16px;';

// Hover, focus and motion rules shared by every workflow screen. Rendered once per screen inside its .wf root.
export const WF_CSS = [
  '.wf, .wf * { box-sizing: border-box; }',
  '.wf button { font-family: inherit; cursor: pointer; }',
  '.wf button:focus-visible, .wf a:focus-visible, .wf input:focus-visible, .wf textarea:focus-visible, .wf select:focus-visible { outline: 2px solid ' + T.ink + '; outline-offset: 2px; }',
  '.wf input::placeholder, .wf textarea::placeholder { color: ' + T.placeholder + '; }',
  '.wf-h:hover { background: ' + T.hover + ' !important; }',
  '.wf-k:hover { background: ' + T.accentHover + ' !important; }',
  '.wf-c:hover { border-color: ' + T.borderHover + ' !important; box-shadow: ' + SHADOW.hover + ' !important; }',
  '.wf-l:hover { color: ' + T.linkHover + ' !important; }',
  // The hub lays out by the width of its own column, not the window: the board's sidebar takes a share of it.
  '.wf-cq { container-type: inline-size; }',
  '.wf-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; }',
  '.wf-bar [role=tablist] { display: flex; flex: 0 1 auto; min-width: 0; gap: 6px; overflow-x: auto; scrollbar-width: none; }',
  '.wf-bar input { flex: 1 1 180px; min-width: 160px; max-width: 260px; margin-left: auto; }',
  '@container (max-width: 860px) { .wf-bar { flex-wrap: wrap; } .wf-bar [role=tablist] { flex: 1 1 100%; flex-wrap: wrap; overflow: visible; } .wf-bar input { flex: 1 1 100%; max-width: none; margin-bottom: 10px; } }',
  '.wf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(270px, 100%), 1fr)); gap: 12px; }',
  '.wf-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr)); gap: 12px; }',
  '@media (max-width: 900px) { .wf button[aria-pressed], .wf [role=tab] { min-height: 40px; } }',
  '@keyframes wf-pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }',
  '@media (prefers-reduced-motion: reduce) { .wf * { animation: none !important; transition: none !important; } }',
].join('\n');

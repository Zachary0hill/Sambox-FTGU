// Option colors for the board and the column system. Keys are the color_token values in the database.
// TONE: [soft background, soft ink, dot, solid fill]. DARKFILL: the solid [fill, ink] pair in dark mode.
export const TONE = {
  coral: ['var(--coral-soft)', 'var(--coral-ink)', '#F08A5D', '#C2532A'],
  pink: ['var(--pink-soft)', 'var(--pink-ink)', '#E0567F', '#B8335F'],
  violet: ['var(--violet-soft)', 'var(--violet-ink)', '#A66BD6', '#7A45C4'],
  blue: ['var(--blue-soft)', 'var(--blue-ink)', '#4C7CF0', '#2F5BD3'],
  green: ['var(--green-soft)', 'var(--green-ink)', '#3DB46D', '#22844C'],
  amber: ['var(--amber-soft)', 'var(--amber-ink)', '#E0A526', '#9A6A00'],
  red: ['var(--red-soft)', 'var(--red-ink)', '#E5484D', '#C42B2F'],
  gray: ['var(--chip)', 'var(--ink-3)', '#B0B0B0', '#6B6B6B']
};
export const DARKFILL = {
  coral: ['#FF8A5B', '#1A0A04'], pink: ['#F0457A', '#1A0510'], violet: ['#9B7BFF', '#120A2B'], blue: ['#5B8BFF', '#050B1F'],
  green: ['#3FCF73', '#04150A'], amber: ['#F5B83D', '#1A1000'], red: ['#F0524F', '#1A0504'], gray: ['#2C2D32', '#D4D4D8']
};
// Picker order and the names shown in color menus.
export const OPTION_COLORS = [['gray', 'Default'], ['coral', 'Coral'], ['pink', 'Pink'], ['violet', 'Violet'], ['blue', 'Blue'], ['green', 'Green'], ['amber', 'Amber'], ['red', 'Red']];

export const toneOf = (tn) => (TONE[tn] ? tn : 'gray');
// Solid block [fill, ink], the same pair the board uses for status cells.
export const solid = (tn, dark) => { const k = toneOf(tn); return dark ? DARKFILL[k].slice() : [TONE[k][3], '#FFFFFF']; };
// Dark gray's fill is close to the dark surface, so its dot uses the light side of the pair.
export const dotOf = (tn, dark) => { const k = toneOf(tn); return dark ? DARKFILL[k][k === 'gray' ? 1 : 0] : TONE[k][2]; };

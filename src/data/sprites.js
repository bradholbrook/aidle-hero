export const WEAPON_FRAME_W = 32;
export const WEAPON_FRAME_H = 32;
export const WEAPON_SHEET = 'assets/items/weapons.png';

// [row, col] 1-indexed, 32×32px frames — 512/32=16 cols, 3200/32=100 rows
// Section layout: hammers(1-8), +9 empty, swords(18-27), +9 empty, axes(37-46),
//                 +7 empty, staves(54-63), +8 empty, spears(72-75), +9 empty, daggers(85)
export const WEAPON_COORDS = {
  // ── Hammers: rows 1–8, offset 0 ─────────────────────────────────────────
  'hammer-rare-1':       [1, 1],
  'hammer-uncommon-1':   [2, 1],
  'hammer-common-1':     [3, 1],
  'hammer-uncommon-2':   [4, 1],
  'hammer-rare-2':       [5, 1],
  'hammer-common-2':     [6, 1],
  'hammer-common-3':     [7, 1],
  'hammer-common-4':     [8, 1],
  'hammer-uncommon-3':   [8, 2],
  'hammer-rare-3':       [8, 3],
  'hammer-epic-1':       [8, 4],
  'hammer-legendary-1':  [8, 5],

  // ── Swords: rows 18–27, offset +17 ──────────────────────────────────────
  'sword-common-1':      [18, 1],
  'sword-common-2':      [19, 4],
  'sword-rare-1':        [19, 7],
  'sword-epic-1':        [19, 8],
  'sword-legendary-1':   [19, 9],
  'sword-uncommon-1':    [25, 6],

  // ── Axes: rows 37–46, offset +36 ────────────────────────────────────────
  'axe-common-1':        [44, 1],
  'axe-legendary-1':     [44, 2],
  'axe-epic-1':          [44, 3],
  'axe-rare-1':          [44, 4],
  'axe-uncommon-1':      [44, 5],

  // ── Staves: rows 54–63, offset +53 ──────────────────────────────────────
  'staff-common-1':      [55, 1],
  'staff-uncommon-1':    [55, 2],
  'staff-legendary-1':   [55, 4],
  'staff-rare-1':        [55, 5],
  'staff-epic-1':        [55, 6],

  // ── Spears: rows 72–75, offset +71 ──────────────────────────────────────
  'spear-rare-1':        [72, 5],
  'spear-common-1':      [73, 1],
  'spear-uncommon-1':    [73, 2],
  'spear-epic-1':        [75, 3],
  'spear-legendary-1':   [75, 4],

  // ── Daggers: row 85, offset +84 ─────────────────────────────────────────
  'dagger-common-1':     [85, 1],
  'dagger-uncommon-1':   [85, 8],
  'dagger-rare-1':       [85, 9],
  'dagger-epic-1':       [85, 10],
  'dagger-legendary-1':  [85, 11],
};

/** Returns an inline-style object for rendering a weapon sprite from the sheet. */
export function weaponSpriteStyle(row, col, scale = 2) {
  const x = -(col - 1) * WEAPON_FRAME_W * scale;
  const y = -(row - 1) * WEAPON_FRAME_H * scale;
  return {
    backgroundImage:    `url(${WEAPON_SHEET})`,
    backgroundPosition: `${x}px ${y}px`,
    backgroundRepeat:   'no-repeat',
    backgroundSize:     `${512 * scale}px ${3200 * scale}px`,
    width:              `${WEAPON_FRAME_W * scale}px`,
    height:             `${WEAPON_FRAME_H * scale}px`,
    imageRendering:     'pixelated',
    display:            'inline-block',
  };
}

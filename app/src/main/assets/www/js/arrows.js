// Arrow Escape: arrows fill a picture on a grid. Tap an arrow and it flies the way it points,
// but only if nothing is in its way to the edge. Every level is checked to be solvable.
// Shared by the app and the online server (races replay the taps to check a win).
import { rng } from './sudoku.js';
export const HEARTS = 3;
const DIRS = { u: [-1, 0], d: [1, 0], l: [0, -1], r: [0, 1] };

// Picture shapes on a unit square (x, y from -1 to 1).
const SHAPES = [
  ['Heart', (x, y) => { const a = x * 1.15, b = -y * 1.2 + 0.25; return Math.pow(a * a + b * b - 1, 3) - a * a * b * b * b <= 0; }],
  ['Diamond', (x, y) => Math.abs(x) + Math.abs(y) <= 1.02],
  ['Circle', (x, y) => x * x + y * y <= 1.02],
  ['Star', (x, y) => { const a = Math.atan2(y, x), r = Math.hypot(x, y); const k = Math.cos(2.5 * (a + Math.PI / 2)); return r <= 0.55 + 0.45 * Math.max(0, k) ** 1.6 + 0.02; }],
  ['House', (x, y) => (y >= -0.05 && Math.abs(x) <= 0.8) || (y < -0.05 && y >= -1 && Math.abs(x) <= (y + 1.05))],
  ['Ring', (x, y) => { const r = Math.hypot(x, y); return r <= 1.02 && r >= 0.42; }],
  ['Fish', (x, y) => { const body = (x + 0.15) * (x + 0.15) / 0.62 + y * y / 0.36 <= 1; const tail = x > 0.5 && Math.abs(y) <= (x - 0.45) * 1.25 && x <= 1.02; return body || tail; }],
  ['Tree', (x, y) => (Math.abs(x) <= 0.18 && y > 0.55) || (y <= 0.6 && y >= -1 && Math.abs(x) <= (y + 1.02) * 0.62)],
  ['Moon', (x, y) => x * x + y * y <= 1.02 && (x - 0.45) * (x - 0.45) + (y + 0.15) * (y + 0.15) > 0.6],
  ['Cross', (x, y) => Math.abs(x) <= 0.36 || Math.abs(y) <= 0.36]
];
const PAL = [
  ['#ff5f93', '#ff3b6b', '#ff8ab4', '#e5196f'],
  ['#5ad8ff', '#1e9bff', '#8fe8ff', '#4f6bff'],
  ['#ffd34d', '#ffb31a', '#fff0a0', '#ff9f43'],
  ['#5dffa8', '#00c853', '#b0ffd6', '#16b89a'],
  ['#c78bff', '#9b5cff', '#e3c2ff', '#7a3df0'],
  ['#ff9f43', '#ff6b2c', '#ffd0a0', '#ff8a00']
];

export const sizeFor = level => Math.min(14, 6 + Math.floor((level - 1) / 3));

// Which arrows are in the way of arrow a (cells between its head and the edge)?
export function blockerOf(L, gone, a) {
  const [dr, dc] = DIRS[a.dir], head = a.cells[a.cells.length - 1];
  let r = head[0] + dr, c = head[1] + dc, steps = 1;
  while (r >= 0 && c >= 0 && r < L.n && c < L.n) {
    const id = L.at[r * L.n + c];
    if (id >= 0 && !gone.has(id)) return { id, steps };
    r += dr; c += dc; steps++;
  }
  return null;
}
export const isFree = (L, gone, id) => !blockerOf(L, gone, L.arrows[id]);

function solvable(L) {
  const gone = new Set(); let rounds = 0;
  for (;;) {
    const free = L.arrows.filter(a => !gone.has(a.id) && isFree(L, gone, a.id));
    if (!free.length) break;
    free.forEach(a => gone.add(a.id)); rounds++;
  }
  return { ok: gone.size === L.arrows.length, rounds, gone };
}

// Level number -> the same level for everyone. seed (optional) changes it for races.
export function makeLevel(level, seed) {
  level = Math.max(1, Math.floor(level) || 1);
  const n = sizeFor(level);
  for (let attempt = 0; attempt < 40; attempt++) {
    const rand = rng((seed || 0) * 977 + level * 7919 + attempt * 104729 + 13);
    const shapeIx = (level - 1) % SHAPES.length, [shape, f] = SHAPES[shapeIx];
    const mask = Array(n * n).fill(false);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) mask[r * n + c] = f((c + 0.5) / n * 2 - 1, (r + 0.5) / n * 2 - 1);
    const at = Array(n * n).fill(-1), arrows = [];
    const order = mask.map((m, i) => i).filter(i => mask[i]);
    for (let k = order.length - 1; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
    const maxLen = level < 4 ? 2 : level < 15 ? 3 : 4;
    for (const i of order) {
      if (at[i] >= 0) continue;
      const r = Math.floor(i / n), c = i % n, horiz = rand() < 0.5;
      const want = 1 + Math.floor(rand() * maxLen);
      const cells = [[r, c]];
      for (let s = 1; s < want; s++) { const rr = horiz ? r : r + s, cc = horiz ? c + s : c; if (rr < n && cc < n && mask[rr * n + cc] && at[rr * n + cc] < 0) cells.push([rr, cc]); else break; }
      const vert = cells.length > 1 ? !horiz : rand() < 0.5;
      const fwd = rand() < 0.5;
      const dir = vert ? (fwd ? 'd' : 'u') : (fwd ? 'r' : 'l');
      if (!fwd) cells.reverse();
      const id = arrows.length;
      cells.forEach(([rr, cc]) => { at[rr * n + cc] = id; });
      arrows.push({ id, cells, dir });
    }
    const L = { level, seed: seed || 0, n, shape, mask, at, arrows };
    // Turn stuck arrows around until the level can be cleared.
    let res = solvable(L), tries = 0;
    while (!res.ok && tries++ < 300) {
      const stuck = arrows.filter(a => !res.gone.has(a.id));
      const a = stuck[Math.floor(rand() * stuck.length)];
      const flip = { u: 'd', d: 'u', l: 'r', r: 'l' }[a.dir];
      if (a.cells.length === 1 && rand() < 0.5) a.dir = ['u', 'd', 'l', 'r'][Math.floor(rand() * 4)];
      else { a.dir = flip; a.cells.reverse(); }
      res = solvable(L);
    }
    if (!res.ok) continue;
    const pal = PAL[(level - 1) % PAL.length];
    arrows.forEach(a => { const [r, c] = a.cells[0]; a.color = pal[Math.floor((r * 3 + c * 7 + a.id) % pal.length)]; });
    L.rounds = res.rounds;
    return L;
  }
  throw new Error('no level');
}

// Replay taps (arrow ids in order). Returns true if every tap was allowed and all arrows left.
export function checkRun(level, seed, order) {
  if (!Array.isArray(order)) return false;
  const L = makeLevel(level, seed), gone = new Set();
  for (const id of order) {
    const a = L.arrows[Number(id)]; if (!a || gone.has(a.id) || !isFree(L, gone, a.id)) return false;
    gone.add(a.id);
  }
  return gone.size === L.arrows.length;
}
export const DIR = DIRS;

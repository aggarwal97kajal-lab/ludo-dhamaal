// Sudoku puzzles made from a number (seed), so a race between friends gets the same puzzle.
// Every puzzle has exactly one solution. Shared by the app and the online server.
export const LEVELS = ['easy', 'medium', 'hard', 'expert'];
export const LEVEL_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert' };
const CLUES = { easy: 40, medium: 33, hard: 28, expert: 24 };
export const MAX_MISTAKES = 3;

export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const box = i => Math.floor(Math.floor(i / 9) / 3) * 3 + Math.floor((i % 9) / 3);

// Count solutions (stops at 'limit'). g: array of 81 numbers, 0 = empty.
export function countSolutions(g, limit) {
  g = g.slice(); limit = limit || 2;
  const R = Array(9).fill(0), C = Array(9).fill(0), B = Array(9).fill(0);
  for (let i = 0; i < 81; i++) if (g[i]) { const b = 1 << g[i]; if ((R[(i / 9) | 0] | C[i % 9] | B[box(i)]) & b) return 0; R[(i / 9) | 0] |= b; C[i % 9] |= b; B[box(i)] |= b; }
  let n = 0;
  const go = () => {
    // The empty cell with the fewest choices.
    let best = -1, bestMask = 0, bestCount = 10;
    for (let i = 0; i < 81; i++) {
      if (g[i]) continue;
      const m = ~(R[(i / 9) | 0] | C[i % 9] | B[box(i)]) & 0x3FE;
      let c = 0; for (let v = m; v; v &= v - 1) c++;
      if (c < bestCount) { best = i; bestMask = m; bestCount = c; if (c <= 1) break; }
    }
    if (best < 0) { n++; return n >= limit; }
    if (!bestCount) return false;
    const r = (best / 9) | 0, c = best % 9, b = box(best);
    for (let v = 1; v <= 9; v++) {
      const bit = 1 << v; if (!(bestMask & bit)) continue;
      g[best] = v; R[r] |= bit; C[c] |= bit; B[b] |= bit;
      if (go()) return true;
      g[best] = 0; R[r] &= ~bit; C[c] &= ~bit; B[b] &= ~bit;
    }
    return false;
  };
  go();
  return n;
}

function fullGrid(rand) {
  const g = Array(81).fill(0);
  const R = Array(9).fill(0), C = Array(9).fill(0), B = Array(9).fill(0);
  const fill = i => {
    if (i === 81) return true;
    const r = (i / 9) | 0, c = i % 9, b = box(i);
    const vals = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    for (let k = 8; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [vals[k], vals[j]] = [vals[j], vals[k]]; }
    for (const v of vals) {
      const bit = 1 << v; if ((R[r] | C[c] | B[b]) & bit) continue;
      g[i] = v; R[r] |= bit; C[c] |= bit; B[b] |= bit;
      if (fill(i + 1)) return true;
      g[i] = 0; R[r] &= ~bit; C[c] &= ~bit; B[b] &= ~bit;
    }
    return false;
  };
  fill(0);
  return g;
}

// { seed, level, puzzle: [81], solution: [81] }
export function makePuzzle(seed, level) {
  level = LEVELS.includes(level) ? level : 'medium';
  const rand = rng(seed * 7 + LEVELS.indexOf(level) + 1);
  const solution = fullGrid(rand);
  const puzzle = solution.slice();
  const order = Array.from({ length: 81 }, (_, i) => i);
  for (let k = 80; k > 0; k--) { const j = Math.floor(rand() * (k + 1)); [order[k], order[j]] = [order[j], order[k]]; }
  let clues = 81;
  for (const i of order) {
    if (clues <= CLUES[level]) break;
    const keep = puzzle[i]; puzzle[i] = 0;
    if (countSolutions(puzzle, 2) !== 1) puzzle[i] = keep; else clues--;
  }
  return { seed, level, puzzle, solution };
}

// Today's puzzle number (same for everyone on the same day).
export function dailySeed(d) {
  d = d || new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
export const peers = i => {
  const r = (i / 9) | 0, c = i % 9, out = [];
  for (let k = 0; k < 9; k++) { out.push(r * 9 + k); out.push(k * 9 + c); }
  const br = r - r % 3, bc = c - c % 3;
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) out.push((br + a) * 9 + bc + b);
  return [...new Set(out)].filter(x => x !== i);
};
// Is a finished grid the solution of this puzzle?
export function checkSolved(seed, level, grid) {
  if (!Array.isArray(grid) || grid.length !== 81) return false;
  const p = makePuzzle(seed, level);
  return p.solution.every((v, i) => v === Number(grid[i]));
}

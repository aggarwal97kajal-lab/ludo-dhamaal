// Helix Drop levels: a tower of round platforms, each made of 12 slices.
// A slice is 0 = gap (fall through), 1 = safe, 2 = danger (red). The last platform is the finish.
// Same level number (and seed) gives the same tower for everyone. Shared by app and server.
import { rng } from './sudoku.js';
export const SLICES = 12;
export const platformsFor = level => Math.min(34, 12 + Math.floor(level * 1.5));

export function makeTower(level, seed) {
  level = Math.max(1, Math.floor(level) || 1);
  const rand = rng((seed || 0) * 7919 + level * 104729 + 99);
  const n = platformsFor(level), plats = [];
  const danger = Math.min(5, Math.floor((level + 1) / 2)); // more red slices as levels go up
  for (let i = 0; i < n; i++) {
    const s = Array(SLICES).fill(1);
    // One gap of 2-3 slices (narrower later), sometimes a second gap.
    const gw = level < 5 ? 3 : 2;
    const g0 = Math.floor(rand() * SLICES);
    for (let k = 0; k < gw; k++) s[(g0 + k) % SLICES] = 0;
    if (rand() < 0.35) { const g1 = (g0 + 5 + Math.floor(rand() * 3)) % SLICES; s[g1] = 0; }
    // Red slices, never on the first platform.
    if (i > 0) {
      const nd = Math.floor(rand() * (danger + 1));
      for (let k = 0; k < nd; k++) { const j = Math.floor(rand() * SLICES); if (s[j] === 1) s[j] = 2; }
    }
    plats.push({ s, turn: rand() * Math.PI * 2 });
  }
  plats.push({ s: Array(SLICES).fill(3), turn: 0, finish: true });
  return { level, seed: seed || 0, plats, hue: (level * 47) % 360 };
}

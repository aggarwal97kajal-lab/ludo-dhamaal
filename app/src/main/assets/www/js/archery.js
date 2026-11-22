// Archery rules. Shared by the app and the online server.
// 5 rounds, one arrow each per round, the target gets further away every round. Most points wins.
export const ROUNDS = 5;
export const DIST = [30, 40, 50, 60, 70];
// Wind for each round, the same for both players (from the match seed). km/h, minus = to the left.
export function windFor(seed, round) { const x = Math.sin(seed * 9301 + round * 49297) * 233280; const f = x - Math.floor(x); return Math.round((f * 2 - 1) * 90) / 10; }
// Where the arrow lands: (x, y) in target radii from the centre. 1 = edge of the face.
export function scoreAt(x, y) { const r = Math.hypot(x, y); if (r > 1) return 0; return Math.max(1, Math.min(10, 10 - Math.floor(r * 10))); }
// Sideways push of the wind, in target radii, for this distance.
export const drift = (wind, dist) => wind / 9 * 0.75 * (dist / 70);
export function newArchery(players, seed) {
  return { game: 'archery', players: players.slice(0, 2).map(p => Object.assign({}, p)), seed: seed || Math.floor(Math.random() * 1e6), round: 1, turn: 0, shots: [[], []], total: [0, 0], over: false, winner: null, reason: '', seq: 0 };
}
export const archeryWind = s => windFor(s.seed, s.round);
export const archeryDist = s => DIST[Math.min(ROUNDS, s.round) - 1];
// A shot by player `who` landing at x, y. Returns { who, x, y, pts } or null.
export function archeryShot(s, who, x, y) {
  if (s.over || s.turn !== who) return null;
  x = Math.max(-3, Math.min(3, +x || 0)); y = Math.max(-3, Math.min(3, +y || 0));
  const pts = scoreAt(x, y);
  s.shots[who].push({ x, y, pts, round: s.round }); s.total[who] += pts; s.seq++;
  // Player 0 shoots first in odd rounds, player 1 in even rounds.
  const first = (s.round - 1) % 2, done = s.shots[0].length >= s.round && s.shots[1].length >= s.round;
  if (done) {
    if (s.round >= ROUNDS) {
      if (s.total[0] === s.total[1]) { s.over = true; s.winner = null; s.reason = 'tie'; }
      else { s.over = true; s.winner = s.total[0] > s.total[1] ? 0 : 1; s.reason = 'points'; }
    } else { s.round++; s.turn = (s.round - 1) % 2; }
  } else s.turn = 1 - who;
  void first;
  return { who, x, y, pts, over: s.over };
}
export function archeryLeft(s, who) { if (s.over) return; s.over = true; s.winner = 1 - who; s.reason = 'left'; s.seq++; }
// Computer aim: tries to correct for the wind; mistakes get bigger on easy.
export function archeryBot(s, level) {
  const w = archeryWind(s), d = archeryDist(s), err = { easy: 0.55, medium: 0.32, hard: 0.16 }[level] || 0.32;
  const g = () => (Math.random() + Math.random() + Math.random() - 1.5) * err * (0.7 + d / 100);
  const fix = level === 'easy' ? 0.4 : level === 'hard' ? 0.95 : 0.75;
  const aimX = -drift(w, d) * fix + g(), aimY = g();
  return { x: aimX + drift(w, d), y: aimY };
}

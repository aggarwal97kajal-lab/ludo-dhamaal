import * as R from '../app/src/main/assets/www/js/rules.js';
let assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } };
// track sanity
assert(R.TRACK.length === 52, 'track 52');
const seen = new Set(R.TRACK.map(c => c.join(','))); assert(seen.size === 52, 'unique cells');
for (let i = 0; i < 52; i++) { const a = R.TRACK[i], b = R.TRACK[(i + 1) % 52]; const dd = Math.abs(a[0]-b[0]) + Math.abs(a[1]-b[1]); assert(dd === 1 || (Math.abs(a[0]-b[0]) === 1 && Math.abs(a[1]-b[1]) === 1), 'adjacent ' + i); }
for (let c = 0; c < 4; c++) { const e = R.cellOf(c, 50), h = R.cellOf(c, 51); assert(Math.abs(e[0]-h[0]) + Math.abs(e[1]-h[1]) === 1, 'lane entry ' + c); }
// rules
let s = R.newGame([{ id: 'a', color: 0 }, { id: 'b', color: 2 }]);
let r = R.roll(s, 3); assert(r.moves.length === 0, 'need 6'); R.passTurn(s); assert(s.turn === 2, 'turn passes');
r = R.roll(s, 6); assert(r.moves.length === 4, 'six all'); let ev = R.move(s, 0); assert(ev.extra && s.turn === 2, 'six extra');
// capture: put yellow token at global 30 (p=4), red token at global 26? red p=26 -> g26 safe(start of yellow). use g=30 => red p=30
s.tokens[0][1] = 25; s.tokens[2][1] = 4; s.turn = 0; s.rolled = false;
r = R.roll(s, 5); ev = R.move(s, 1); assert(ev.captured.length === 1 && s.tokens[2][1] === -1, 'capture'); assert(s.turn === 0 && ev.extra, 'capture extra');
// safe square no capture: yellow at p=8 -> g34 star
s.tokens[2][2] = 8; s.tokens[0][2] = 30; s.rolled = false; s.turn = 0;
r = R.roll(s, 4); ev = R.move(s, 2); assert(ev.captured.length === 0 && s.tokens[2][2] === 8, 'safe');
// exact finish
s.tokens[0][3] = 53; s.rolled = false; s.turn = 0; s.sixes = 0;
r = R.roll(s, 4); assert(!r.moves.includes(3), 'overshoot blocked'); R.passTurn(s);
// three sixes
s.turn = 2; s.rolled=false; s.sixes=0;
R.roll(s,6); R.move(s, R.movableTokens(s,2,6)[0]); R.roll(s,6); R.move(s, R.movableTokens(s,2,6)[0]); r = R.roll(s,6); assert(r.forfeit, 'third six forfeit');
// full random game simulation with bots
for (let g = 0; g < 300; g++) {
  const n = 2 + (g % 3); const cols = R.seatColors(n);
  const st = R.newGame(cols.map((c, i) => ({ id: 'p' + i, color: c })));
  let steps = 0;
  while (!st.over && steps < 20000) {
    const d = 1 + Math.floor(Math.random() * 6); const rr = R.roll(st, d);
    if (rr.forfeit || !rr.moves.length) R.passTurn(st); else R.move(st, R.botChoice(st, st.turn, d, rr.moves));
    steps++;
  }
  assert(st.over, 'game ends ' + g); assert(st.ranks.length === n, 'ranks ' + st.ranks.length + ' vs ' + n);
}
console.log('rules ok');

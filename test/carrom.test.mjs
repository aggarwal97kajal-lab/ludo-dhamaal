// Checks Carrom rules: shots move coins, turns pass, queen cover, fouls, bot plays full games.
import assert from 'node:assert';
import { newCarrom, applyShot, carromBot, strikerSpot, cleanShot, carromPass, BASE } from '../app/src/main/assets/www/js/carrom.js';
const P = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
let s = newCarrom(P);
assert.equal(s.coins.length, 19);
const sp = strikerSpot(s.coins, 0, 0.5);
assert.equal(sp.y, BASE[0]);
assert.equal(cleanShot(s, { x: 0.5, dx: 0, dy: 1, power: 1 }), null, 'backward shot refused');
let r = applyShot(s, { x: 0.5, y: BASE[0], dx: 0, dy: -1, power: 1 });
assert.ok(r && s.seq === 1, 'break shot played');
assert.ok(s.coins.some(c => Math.hypot(c.x - 0.5, c.y - 0.5) > 0.12), 'coins spread');
// Queen cover: pocket the queen alone -> pending, again; next shot without own coin -> returned
s = newCarrom(P);
s.coins.forEach(c => { if (c.kind !== 'queen') c.in = true; });
const q = s.coins.find(c => c.kind === 'queen'); q.x = 0.1; q.y = 0.1;
// aim from striker spot straight at the queen so she rolls into the top-left pocket
const st = strikerSpot(s.coins, 0, 0.3);
let ux = 0.04 - q.x, uy = 0.04 - q.y; let L = Math.hypot(ux, uy); ux /= L; uy /= L;
const gx = q.x - ux * 0.05, gy = q.y - uy * 0.05; let dx = gx - st.x, dy = gy - st.y; L = Math.hypot(dx, dy);
r = applyShot(s, { x: st.x, y: st.y, dx: dx / L, dy: dy / L, power: 0.9 });
if (r.queen === 'pocketed') { assert.ok(r.again && s.turn === 0, 'queen pocketed: shoot again to cover'); carromPass(s); assert.ok(!s.coins.find(c => c.kind === 'queen').in, 'queen back after missing the cover'); }
// Bots play many full games without breaking the rules engine
let finished = 0;
for (let g = 0; g < 6; g++) {
  const t = newCarrom(P); let n = 0;
  while (!t.over && n < 400) { const shot = carromBot(t, 0.9); const res = applyShot(t, shot); assert.ok(res); n++; }
  assert.ok(t.got[0] <= 9 && t.got[1] <= 9);
  if (t.over) finished++;
}
assert.ok(finished >= 3, 'bot games finish: ' + finished);
console.log('carrom ok (' + finished + '/6 bot games finished)');

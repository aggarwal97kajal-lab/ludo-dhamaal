import assert from 'node:assert';
import { makeLevel, isFree, checkRun, sizeFor } from '../app/src/main/assets/www/js/arrows.js';
const t0 = Date.now(); let worst = 0;
for (let lv = 1; lv <= 120; lv++) {
  const a = Date.now(); const L = makeLevel(lv); worst = Math.max(worst, Date.now() - a);
  assert.equal(L.n, sizeFor(lv));
  // solve greedily
  const gone = new Set(), order = [];
  for (;;) { const f = L.arrows.find(x => !gone.has(x.id) && isFree(L, gone, x.id)); if (!f) break; gone.add(f.id); order.push(f.id); }
  assert.equal(gone.size, L.arrows.length, 'level ' + lv + ' solvable');
  assert.ok(checkRun(lv, 0, order));
  if (lv % 30 === 0) console.log('level', lv, L.shape, 'size', L.n, 'arrows', L.arrows.length, 'rounds', L.rounds);
}
assert.ok(!checkRun(5, 0, [0]), 'partial run is not a win');
const r1 = makeLevel(20, 77), r2 = makeLevel(20, 77);
assert.deepEqual(r1.arrows.map(a => a.dir), r2.arrows.map(a => a.dir));
console.log('arrows ok, worst ms', worst, 'total', Date.now() - t0);

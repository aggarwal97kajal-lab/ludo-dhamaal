import * as Z from '../app/src/main/assets/www/js/zerokanta.js';
import * as A from '../app/src/main/assets/www/js/archery.js';
let ok = true; const check = (c, m) => { if (!c) { ok = false; console.error('FAIL', m); } };
const s = Z.newZK([{ id: 'a' }, { id: 'b' }]);
[0, 3, 1, 4].forEach((c, i) => Z.zkMove(s, i % 2, c)); const r = Z.zkMove(s, 0, 2);
check(r.line && r.line.join() === '0,1,2' && s.score[0] === 1, 'row win');
check(!Z.zkMove(s, 1, 5), 'no move after round');
Z.zkNext(s); check(s.turn === 1 && s.round === 2 && s.board.every(x => x == null), 'next round, other starts');
// hard bot never loses against random
for (let g = 0; g < 200; g++) { const t = Z.newZK([{}, {}]); while (!t.roundOver) { const m = t.turn === 1 ? Z.zkBot(t, 1, 'hard') : (() => { const f = t.board.map((x, i) => x == null ? i : -1).filter(i => i >= 0); return f[Math.floor(Math.random() * f.length)]; })(); Z.zkMove(t, t.turn, m); } check(t.roundWin !== 0, 'hard bot lost'); if (t.roundWin === 0) break; }
// match ends at 3
const m = Z.newZK([{}, {}]); m.score = [2, 0]; [0, 3, 1, 4].forEach((c, i) => Z.zkMove(m, i % 2, c)); Z.zkMove(m, 0, 2); check(m.over && m.winner === 0, 'match to 3');
// archery
check(A.scoreAt(0, 0) === 10 && A.scoreAt(0.05, 0) === 10 && A.scoreAt(0.95, 0) === 1 && A.scoreAt(1.2, 0) === 0, 'rings');
const a = A.newArchery([{}, {}], 7);
for (let k = 0; k < 10; k++) { const t = a.turn; const res = A.archeryShot(a, t, 0.1, 0); check(res && res.pts === 9, 'shot'); }
check(a.over && a.winner === null && a.total.join() === '45,45', 'tie after 5 rounds');
const b = A.newArchery([{}, {}], 7); check(!A.archeryShot(b, 1, 0, 0), 'wrong turn');
let sum = 0; for (let i = 0; i < 400; i++) { const c = A.newArchery([{}, {}], i); c.round = 5; const sh = A.archeryBot(c, 'hard'); sum += A.scoreAt(sh.x, sh.y); } check(sum / 400 > 6, 'hard bot scores well ' + sum / 400);
console.log(ok ? 'zk+archery ok' : 'FAILED'); process.exit(ok ? 0 : 1);

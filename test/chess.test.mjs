// Checks the shared chess rules: legal moves, checkmate, clocks, leaving.
import assert from 'node:assert';
import { newChess, chessMove, chessTimeout, chessLeft, chessBot } from '../app/src/main/assets/www/js/chessrules.js';
const P = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];
let s = newChess(P);
assert.equal(chessMove(s, { from: 'e2', to: 'e5' }), null, 'illegal move refused');
for (const [f, t] of [['f2', 'f3'], ['e7', 'e5'], ['g2', 'g4'], ['d8', 'h4']]) assert.ok(chessMove(s, { from: f, to: t }, 1000));
assert.ok(s.over && s.winner === 'b' && s.reason === 'checkmate', 'fool’s mate');
assert.equal(s.clock.w, 600000 - 2000);
s = newChess(P); chessTimeout(s, 'w'); assert.ok(s.over && s.winner === 'b' && s.reason === 'time');
s = newChess(P); chessLeft(s, 'b'); assert.ok(s.over && s.winner === 'w' && s.reason === 'left');
s = newChess(P); for (let i = 0; i < 40 && !s.over; i++) assert.ok(chessMove(s, chessBot(s.fen)));
console.log('chess ok');

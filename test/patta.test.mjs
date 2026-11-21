// Rang Patta rules: deck, plays, +2 stacking, EK! catch, bots finish games, hidden hands.
import assert from 'node:assert';
import { newPatta, playCard, drawCard, passTurn, sayEk, catchEk, timeout, pattaBot, playable, canPlay, top, viewFor, pattaLeft, makeDeck } from '../app/src/main/assets/www/js/patta.js';
const P = n => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i }));
assert.equal(makeDeck().length, 108);
let s = newPatta(P(3));
assert.equal(s.hands[0].length, 7); assert.equal(s.draw.length, 108 - 21 - 1);
assert.equal(typeof top(s).v, 'number');
// wrong turn / unplayable refused
assert.equal(playCard(s, 1, s.hands[1][0].id), null);
// +2 stacking
s = newPatta(P(3));
s.pile.push({ id: 900, c: 0, v: 5 }); s.col = 0;
s.hands[0] = [{ id: 901, c: 0, v: 'd2' }, { id: 902, c: 1, v: 3 }, { id: 905, c: 1, v: 4 }];
s.hands[1] = [{ id: 903, c: 2, v: 'd2' }, { id: 904, c: 2, v: 7 }];
assert.ok(playCard(s, 0, 901)); assert.equal(s.pend, 2); assert.equal(s.turn, 1);
assert.ok(!canPlay(s, { c: 2, v: 7 }), 'must answer +2 with +2 or draw');
assert.ok(playCard(s, 1, 903)); assert.equal(s.pend, 4);
assert.equal(s.catchable, 1, 'one card left without EK -> catchable');
assert.ok(catchEk(s, 0)); assert.equal(s.hands[1].length, 3);
const before = s.hands[2].length; drawCard(s, 2); assert.equal(s.hands[2].length, before + 4); assert.equal(s.pend, 0); assert.equal(s.turn, 0);
// EK said in time -> no catch
s = newPatta(P(2)); s.pile.push({ id: 900, c: 0, v: 5 }); s.col = 0;
s.hands[0] = [{ id: 1, c: 0, v: 3 }, { id: 2, c: 1, v: 3 }];
assert.ok(sayEk(s, 0)); playCard(s, 0, 1); assert.equal(s.catchable, null);
// reverse with 2 players = play again
s.hands[1] = [{ id: 3, c: 0, v: 'rev' }, { id: 4, c: 0, v: 8 }]; s.turn = 1; s.drawn = null;
playCard(s, 1, 3); assert.equal(s.turn, 1);
// hidden hands
const v = viewFor(newPatta(P(3)), 1); assert.equal(v.hands[0].length, 0); assert.equal(v.hands[1].length, 7); assert.equal(v.counts[2], 7); assert.equal(typeof v.draw, 'number');
// left player
s = newPatta(P(2)); pattaLeft(s, 1); assert.ok(s.over && s.winner === 0);
// bots play full games
let fin = 0;
for (let g = 0; g < 200; g++) {
  const t = newPatta(P(2 + (g % 3))); let n = 0;
  while (!t.over && n < 3000) {
    const i = t.turn, b = pattaBot(t, i);
    if (t.hands[i].length <= 2) sayEk(t, i);
    let r;
    if (b.draw) r = drawCard(t, i); else if (b.pass) r = passTurn(t, i); else r = playCard(t, i, b.card, b.color);
    if (n % 50 === 49) r = timeout(t) || r;
    assert.ok(r, 'bot move accepted');
    const total = t.hands.reduce((a, h) => a + h.length, 0) + t.draw.length + t.pile.length;
    assert.equal(total, 108, 'no cards lost');
    n++;
  }
  if (t.over) fin++;
}
assert.ok(fin >= 195, 'games finish: ' + fin);
console.log('patta ok (' + fin + '/200 bot games finished)');

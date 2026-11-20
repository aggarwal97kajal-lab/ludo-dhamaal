// Checks Snakes & Ladders rules: ladders, snakes, exact 100, extra roll on 6.
import assert from 'node:assert';
import { newSnakes, snakeRoll, LADDERS, SNAKES } from '../app/src/main/assets/www/js/snakes.js';
const P = [{ id: 'a', name: 'A', color: 0 }, { id: 'b', name: 'B', color: 2 }];
let s = newSnakes(P);
let ev = snakeRoll(s, 4); assert.equal(ev.via, 'ladder'); assert.equal(s.pos[0], LADDERS[4]); assert.equal(s.turn, 2);
s.pos[2] = 25; ev = snakeRoll(s, 2); assert.equal(ev.via, 'snake'); assert.equal(s.pos[2], SNAKES[27]);
s.pos[0] = 97; ev = snakeRoll(s, 5); assert.ok(ev.stay); assert.equal(s.pos[0], 97);
s.pos[2] = 10; ev = snakeRoll(s, 6); assert.ok(ev.extra); assert.equal(s.turn, 2);
s.turn = 0; s.sixes = 0; s.pos[0] = 97; ev = snakeRoll(s, 3); assert.ok(ev.won && s.over && s.ranks[0] === 0 && s.ranks.length === 2);
for (const k of Object.keys(LADDERS)) assert.ok(!SNAKES[k] && !SNAKES[LADDERS[k]], 'no ladder meets a snake head');
console.log('snakes ok');

import assert from 'node:assert';
import { makePuzzle, countSolutions, checkSolved, LEVELS, dailySeed } from '../app/src/main/assets/www/js/sudoku.js';
for (const lv of LEVELS) {
  const t0 = Date.now(); let clues = 0;
  for (let k = 0; k < 5; k++) {
    const p = makePuzzle(1000 + k, lv);
    assert.equal(countSolutions(p.puzzle, 2), 1, 'unique');
    assert.ok(p.puzzle.every((v, i) => !v || v === p.solution[i]));
    clues += p.puzzle.filter(Boolean).length;
  }
  console.log(lv, 'avg clues', clues / 5, 'ms per puzzle', (Date.now() - t0) / 5);
}
const a = makePuzzle(42, 'hard'), b = makePuzzle(42, 'hard');
assert.deepEqual(a.puzzle, b.puzzle, 'same seed, same puzzle');
assert.ok(checkSolved(42, 'hard', a.solution)); assert.ok(!checkSolved(42, 'hard', a.puzzle));
assert.ok(dailySeed(new Date(2026, 10, 22)) === 20261122);
console.log('sudoku ok');

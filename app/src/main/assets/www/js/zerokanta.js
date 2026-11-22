// Zero Kanta (noughts and crosses). Shared by the app and the online server.
// Two players: 0 plays ✕ (kanta), 1 plays ◯ (zero). First to 3 round wins takes the match.
export const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
export const WIN_ROUNDS = 3, MAX_ROUNDS = 5;
export function newZK(players) {
  return { game: 'zerokanta', players: players.slice(0, 2).map(p => Object.assign({}, p)), board: Array(9).fill(null), turn: 0, starter: 0, round: 1, score: [0, 0], draws: 0, line: null, roundWin: null, roundOver: false, over: false, winner: null, reason: '', seq: 0 };
}
export function lineOf(b) { for (const l of LINES) if (b[l[0]] != null && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return l; return null; }
// Place a mark. Returns { cell, who, line, roundOver, roundWin } or null if not allowed.
export function zkMove(s, who, cell) {
  if (s.over || s.roundOver || s.turn !== who || !(cell >= 0 && cell < 9) || s.board[cell] != null) return null;
  s.board[cell] = who; s.seq++;
  const line = lineOf(s.board);
  if (line) { s.line = line; s.roundOver = true; s.roundWin = who; s.score[who]++; }
  else if (s.board.every(x => x != null)) { s.roundOver = true; s.roundWin = null; s.draws++; }
  else s.turn = 1 - who;
  if (s.roundOver && (s.score[who] >= WIN_ROUNDS || s.round >= MAX_ROUNDS)) {
    s.over = true;
    s.winner = s.score[0] === s.score[1] ? null : (s.score[0] > s.score[1] ? 0 : 1);
    s.reason = 'rounds';
  }
  return { cell, who, line, roundOver: s.roundOver, roundWin: s.roundWin, over: s.over };
}
// Next round: the other player starts.
export function zkNext(s) {
  if (s.over || !s.roundOver) return false;
  s.round++; s.board = Array(9).fill(null); s.line = null; s.roundOver = false; s.roundWin = null;
  s.starter = 1 - s.starter; s.turn = s.starter; s.seq++;
  return true;
}
export function zkLeft(s, who) { if (s.over) return; s.over = true; s.winner = 1 - who; s.reason = 'left'; s.seq++; }
// Computer: easy is mostly random, medium blocks and wins, hard never loses.
export function zkBot(s, who, level) {
  const b = s.board, free = b.map((x, i) => (x == null ? i : -1)).filter(i => i >= 0);
  if (!free.length) return -1;
  const rnd = () => free[Math.floor(Math.random() * free.length)];
  if (level === 'easy' && Math.random() < 0.65) return rnd();
  const winAt = p => { for (const i of free) { b[i] = p; const ok = lineOf(b); b[i] = null; if (ok) return i; } return -1; };
  let m = winAt(who); if (m >= 0) return m;
  m = winAt(1 - who); if (m >= 0) return m;
  if (level !== 'hard') { if (b[4] == null && Math.random() < 0.7) return 4; return rnd(); }
  let best = -1, bestV = -2;
  for (const i of free) { b[i] = who; const v = -negamax(b, 1 - who); b[i] = null; if (v > bestV) { bestV = v; best = i; } }
  return best;
}
function negamax(b, p) {
  const l = lineOf(b); if (l) return b[l[0]] === p ? 1 : -1;
  const free = b.map((x, i) => (x == null ? i : -1)).filter(i => i >= 0); if (!free.length) return 0;
  let best = -2;
  for (const i of free) { b[i] = p; const v = -negamax(b, 1 - p); b[i] = null; if (v > best) best = v; if (best === 1) break; }
  return best;
}

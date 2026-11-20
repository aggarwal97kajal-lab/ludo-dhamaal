// Chess rules shared by the app and the online server. Moves are checked with chess.js.
import { Chess } from './chesslib.js';

export const CLOCK_MS = 10 * 60 * 1000; // 10 minutes for each player

export function newChess(players, clockMs) {
  // players: [{ id, name, look, kind }] -> first is White, second is Black
  const ms = clockMs || CLOCK_MS;
  return {
    game: 'chess',
    fen: new Chess().fen(),
    players: players.slice(0, 2).map((p, i) => Object.assign({}, p, { color: i ? 'b' : 'w' })),
    turn: 'w', seq: 0, over: false, winner: null, reason: '',
    clock: { w: ms, b: ms }, last: null, check: false, moves: 0
  };
}

export const chessPlayer = (s, c) => s.players.find(p => p.color === c);
export const other = c => (c === 'w' ? 'b' : 'w');

// Legal moves for a square, for the move help and for taps.
export function legalFrom(s, sq) {
  const g = new Chess(s.fen);
  return g.moves({ square: sq, verbose: true });
}

// Play a move. Returns the chess.js move (with from, to, flags, captured, san) or null if it is not legal.
// spent: milliseconds the player used on this move, taken off their clock.
export function chessMove(s, mv, spent) {
  if (s.over) return null;
  const g = new Chess(s.fen);
  const r = g.move({ from: String(mv.from || ''), to: String(mv.to || ''), promotion: /^[qrbn]$/.test(mv.promotion) ? mv.promotion : 'q' });
  if (!r) return null;
  if (spent) s.clock[r.color] = Math.max(0, s.clock[r.color] - spent);
  s.fen = g.fen(); s.turn = g.turn(); s.seq++; s.moves++;
  s.last = { from: r.from, to: r.to };
  s.check = g.in_check();
  if (g.in_checkmate()) { s.over = true; s.winner = r.color; s.reason = 'checkmate'; }
  else if (g.in_stalemate()) { s.over = true; s.winner = null; s.reason = 'stalemate'; }
  else if (g.insufficient_material()) { s.over = true; s.winner = null; s.reason = 'material'; }
  else if (g.in_threefold_repetition()) { s.over = true; s.winner = null; s.reason = 'repetition'; }
  else if (g.in_draw()) { s.over = true; s.winner = null; s.reason = 'fifty'; }
  return r;
}

export function chessTimeout(s, c) {
  if (s.over) return;
  s.clock[c] = 0; s.over = true; s.winner = other(c); s.reason = 'time'; s.seq++;
}
export function chessLeft(s, c) {
  if (s.over) return;
  s.over = true; s.winner = other(c); s.reason = 'left'; s.seq++;
}

export function chessResultText(s, myColor) {
  const W = chessPlayer(s, s.winner);
  const why = { checkmate: 'by checkmate', time: 'on time', left: 'the other player left' }[s.reason] || '';
  if (!s.winner) return { title: 'Draw!', sub: { stalemate: 'Stalemate: no legal move, but no check', material: 'Not enough pieces left to checkmate', repetition: 'Same position three times', fifty: '50 moves without a capture or pawn move' }[s.reason] || 'Draw' };
  if (myColor && s.winner === myColor) return { title: 'You won!', sub: s.reason === 'left' ? 'The other player left the game' : 'You won ' + why };
  return { title: `${W ? W.name : 'They'} won!`, sub: s.reason === 'left' ? 'The other player left the game' : `Won ${why}` };
}

// ---------- Computer player ----------
const VAL = { p: 100, n: 310, b: 320, r: 500, q: 900, k: 0 };
// Small bonus for pieces near the centre and pawns that advance.
const centre = (f, r) => 3.5 - Math.max(Math.abs(f - 3.5), Math.abs(r - 3.5));
function evaluate(g) {
  let sc = 0;
  const b = g.board();
  for (let ri = 0; ri < 8; ri++) for (let fi = 0; fi < 8; fi++) {
    const p = b[ri][fi]; if (!p) continue;
    const rank = 7 - ri; // 0 = rank 1
    let v = VAL[p.type];
    if (p.type === 'n' || p.type === 'b') v += centre(fi, rank) * 8;
    if (p.type === 'p') v += (p.color === 'w' ? rank - 1 : 6 - rank) * 6 + centre(fi, rank) * 3;
    if (p.type === 'q') v += centre(fi, rank) * 2;
    sc += p.color === 'w' ? v : -v;
  }
  return sc;
}
function search(g, depth, a, b, side) {
  if (g.in_checkmate()) return -100000 - depth;
  if (g.in_draw() || g.in_stalemate()) return 0;
  if (depth === 0) return side * evaluate(g);
  const ms = order(g.moves({ verbose: true }));
  for (const m of ms) {
    g.move(m);
    const v = -search(g, depth - 1, -b, -a, -side);
    g.undo();
    if (v > a) a = v;
    if (a >= b) break;
  }
  return a;
}
function order(ms) {
  return ms.sort((x, y) => ((y.captured ? VAL[y.captured] * 10 - VAL[y.piece] : 0) + (y.promotion ? 800 : 0)) - ((x.captured ? VAL[x.captured] * 10 - VAL[x.piece] : 0) + (x.promotion ? 800 : 0)));
}
// Looks two moves ahead (its move and your reply). A little randomness keeps games different.
export function chessBot(fen) {
  const g = new Chess(fen);
  const side = g.turn() === 'w' ? 1 : -1;
  const ms = order(g.moves({ verbose: true }));
  if (!ms.length) return null;
  let best = null, bestV = -Infinity;
  const deep = ms.length <= 14; // look one move deeper only when there are few choices, so it stays fast on phones
  for (const m of ms) {
    g.move(m);
    let v = -search(g, deep ? 2 : 1, -Infinity, Infinity, -side);
    g.undo();
    v += Math.random() * 18;
    if (v > bestV) { bestV = v; best = m; }
  }
  return { from: best.from, to: best.to, promotion: best.promotion || 'q' };
}

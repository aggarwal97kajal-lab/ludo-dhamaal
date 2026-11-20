// Snakes & Ladders rules, shared by the app and the online server.
import { nextTurn, playerOf } from './rules.js';

// Ladder: bottom -> top. Snake: head -> tail.
export const LADDERS = { 4: 25, 13: 46, 33: 49, 42: 63, 50: 69, 62: 81, 74: 92 };
export const SNAKES = { 27: 5, 40: 3, 43: 18, 54: 31, 66: 45, 76: 58, 89: 53, 99: 41 };
export const GOAL = 100;

export function newSnakes(players) {
  // players: [{ id, name, color, kind, look }]
  const order = players.map(p => p.color).sort((a, b) => a - b);
  const pos = [0, 0, 0, 0];
  return {
    game: 'snakes',
    players: players.map(p => ({ ...p, done: false, left: false })),
    pos, order, turn: order[0], dice: 0, rolled: false, sixes: 0, ranks: [], over: false, seq: 0
  };
}

// Roll and move in one go. Returns what happened, for the animation:
// { color, dice, from, to (after walking), end (after a ladder or snake), via, extra, won, stay }
export function snakeRoll(s, d) {
  if (s.over) return null;
  const color = s.turn, from = s.pos[color];
  s.seq++; s.dice = d;
  const ev = { color, dice: d, from, to: from, end: from, via: null, extra: false, won: false, stay: false };
  if (from + d > GOAL) ev.stay = true; // needs the exact number to land on 100
  else {
    ev.to = from + d;
    ev.end = LADDERS[ev.to] || SNAKES[ev.to] || ev.to;
    ev.via = LADDERS[ev.to] ? 'ladder' : SNAKES[ev.to] ? 'snake' : null;
    s.pos[color] = ev.end;
  }
  if (ev.end === GOAL) {
    ev.won = true;
    const p = playerOf(s, color); p.done = true;
    s.ranks.push(color);
    // First one to 100 wins. Everyone else is ranked by how far they got.
    s.order.filter(c => c !== color && !playerOf(s, c).left).sort((a, b) => s.pos[b] - s.pos[a]).forEach(c => s.ranks.push(c));
    s.over = true;
    return ev;
  }
  // Every 6 gives another roll.
  if (d === 6) { s.sixes++; ev.extra = true; }
  else { s.sixes = 0; nextTurn(s); }
  return ev;
}

export function snakePass(s) { s.seq++; s.sixes = 0; nextTurn(s); }

// Squares the player walks over, one by one.
export function walkPath(from, to) { const out = []; for (let q = from + 1; q <= to; q++) out.push(q); return out; }

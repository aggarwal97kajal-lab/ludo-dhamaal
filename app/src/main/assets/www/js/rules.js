// Ludo Dhamaal game rules. Shared by the app and the online server.
// Colours: 0 red (top-left), 1 green (top-right), 2 yellow (bottom-right), 3 blue (bottom-left).
// Token progress: -1 = in yard, 0..50 = main track, 51..55 = home lane, 56 = finished.

export const COLORS = ['red', 'green', 'yellow', 'blue'];
export const START = [0, 13, 26, 39];
export const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
export const FINISH = 56;

// Board cells (col,row) of the 52 main track squares, index 0 = red start.
export const TRACK = (() => {
  const t = [];
  const seg = (c, r, dc, dr, n) => { for (let i = 0; i < n; i++) t.push([c + dc * i, r + dr * i]); };
  seg(1, 6, 1, 0, 5); seg(6, 5, 0, -1, 6); seg(7, 0, 1, 0, 2); seg(8, 1, 0, 1, 5);
  seg(9, 6, 1, 0, 6); seg(14, 7, 0, 1, 2); seg(13, 8, -1, 0, 5); seg(8, 9, 0, 1, 6);
  seg(7, 14, -1, 0, 2); seg(6, 13, 0, -1, 5); seg(5, 8, -1, 0, 6); seg(0, 7, 0, -1, 2);
  return t;
})();

export function globalIndex(color, p) {
  if (p < 0 || p > 50) return -1;
  return (START[color] + p) % 52;
}

// Board cell for a token. Yard/finished return null (the 3D board places those).
export function cellOf(color, p) {
  if (p >= 0 && p <= 50) return TRACK[globalIndex(color, p)];
  if (p >= 51 && p <= 55) {
    const k = p - 50;
    if (color === 0) return [k, 7];
    if (color === 1) return [7, k];
    if (color === 2) return [14 - k, 7];
    return [7, 14 - k];
  }
  return null;
}

export function seatColors(n) {
  if (n === 2) return [0, 2];
  if (n === 3) return [0, 1, 2];
  return [0, 1, 2, 3];
}

export function newGame(players) {
  // players: [{ id, name, color, kind: 'human'|'bot'|'remote', look }]
  const tokens = [[-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1], [-1, -1, -1, -1]];
  const order = players.map(p => p.color).sort((a, b) => a - b);
  return {
    players: players.map(p => ({ ...p, done: false, left: false })),
    tokens,
    order,
    turn: order[0],
    dice: 0,
    rolled: false,
    sixes: 0,
    ranks: [],
    over: false,
    seq: 0
  };
}

export function playerOf(s, color) { return s.players.find(p => p.color === color); }

export function movableTokens(s, color, d) {
  const out = [];
  const t = s.tokens[color];
  for (let i = 0; i < 4; i++) {
    const p = t[i];
    if (p === FINISH) continue;
    if (p === -1) { if (d === 6) out.push(i); continue; }
    if (p + d <= FINISH) out.push(i);
  }
  return out;
}

export function activeColors(s) {
  return s.order.filter(c => { const p = playerOf(s, c); return p && !p.done && !p.left; });
}

// A player quit the game: they are skipped from now on. If only one player is left,
// the game ends.
export function markLeft(s, color) {
  const p = playerOf(s, color);
  if (!p || p.left || p.done) return;
  p.left = true;
  s.seq++;
  const act = activeColors(s);
  if (act.length <= 1) {
    if (act.length === 1 && !s.ranks.includes(act[0])) s.ranks.push(act[0]);
    s.over = true;
    return;
  }
  if (s.turn === color) nextTurn(s);
}

export function nextTurn(s) {
  const act = activeColors(s);
  if (act.length <= 1) return;
  let i = s.order.indexOf(s.turn);
  for (let k = 0; k < s.order.length; k++) {
    i = (i + 1) % s.order.length;
    const c = s.order[i];
    const p = playerOf(s, c);
    if (p && !p.done && !p.left) { s.turn = c; break; }
  }
  s.sixes = 0;
  s.rolled = false;
  s.dice = 0;
}

// Roll: returns { dice, moves, forfeit }. Caller then calls move() or passTurn().
export function roll(s, d) {
  if (s.over || s.rolled) return null;
  s.dice = d;
  s.rolled = true;
  s.seq++;
  if (d === 6) s.sixes++; else s.sixes = 0;
  // No penalty for three 6s in a row: every 6 gives another roll.
  return { dice: d, moves: movableTokens(s, s.turn, d), forfeit: false };
}

export function passTurn(s) {
  s.seq++;
  nextTurn(s);
}

// Move a token after a roll. Returns an event describing what happened, or null if not allowed.
export function move(s, token) {
  if (s.over || !s.rolled) return null;
  const color = s.turn;
  const d = s.dice;
  if (!movableTokens(s, color, d).includes(token)) return null;
  const from = s.tokens[color][token];
  const to = from === -1 ? 0 : from + d;
  s.tokens[color][token] = to;
  const captured = [];
  if (to <= 50) {
    const g = globalIndex(color, to);
    if (!SAFE.includes(g)) {
      for (const c of s.order) {
        if (c === color) continue;
        s.tokens[c].forEach((p, i) => {
          if (p >= 0 && p <= 50 && globalIndex(c, p) === g) {
            captured.push({ color: c, token: i, from: p });
            s.tokens[c][i] = -1;
          }
        });
      }
    }
  }
  const finished = to === FINISH;
  let won = false;
  if (s.tokens[color].every(p => p === FINISH)) {
    const pl = playerOf(s, color);
    pl.done = true;
    s.ranks.push(color);
    won = true;
  }
  const act = activeColors(s);
  if (act.length <= 1) {
    if (act.length === 1) s.ranks.push(act[0]);
    s.over = true;
  }
  const extra = !won && !s.over && (d === 6 || captured.length > 0 || finished);
  s.seq++;
  if (!s.over) {
    if (extra) { s.rolled = false; s.dice = 0; if (d !== 6) s.sixes = 0; }
    else nextTurn(s);
  }
  return { color, token, from, to, dice: d, captured, finished, won, extra, over: s.over };
}

// Path of board steps for animation (list of progress values the token visits).
export function stepsBetween(from, to) {
  if (from === -1) return [0];
  const out = [];
  for (let p = from + 1; p <= to; p++) out.push(p);
  return out;
}

// Simple bot: capture > finish > leave yard > reach safety > run from danger > furthest.
export function botChoice(s, color, d, moves) {
  if (moves.length === 1) return moves[0];
  let best = moves[0], bestScore = -1e9;
  for (const i of moves) {
    const from = s.tokens[color][i];
    const to = from === -1 ? 0 : from + d;
    let score = 0;
    if (to <= 50) {
      const g = globalIndex(color, to);
      if (!SAFE.includes(g)) {
        for (const c of s.order) {
          if (c === color) continue;
          s.tokens[c].forEach(p => { if (p >= 0 && p <= 50 && globalIndex(c, p) === g) score += 100; });
        }
      } else score += 15;
      if (dangerAt(s, color, g) && !SAFE.includes(g)) score -= 30;
    }
    if (to === FINISH) score += 60;
    if (to >= 51) score += 20;
    if (from === -1) score += 40;
    if (from >= 0 && from <= 50) {
      const g0 = globalIndex(color, from);
      if (dangerAt(s, color, g0) && !SAFE.includes(g0)) score += 25;
    }
    score += to * 0.5;
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

function dangerAt(s, color, g) {
  for (const c of s.order) {
    if (c === color) continue;
    for (const p of s.tokens[c]) {
      if (p < 0 || p > 50) continue;
      const gp = globalIndex(c, p);
      const dist = (g - gp + 52) % 52;
      if (dist >= 1 && dist <= 6) return true;
    }
  }
  return false;
}

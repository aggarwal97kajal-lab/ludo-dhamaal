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

// Ludo modes:
//  classic: all 4 tokens home to win.
//  quick:   2 tokens each, both already out on the start square.
//  timer:   10 minutes; points for every step and capture, most points wins.
//  team:    4 players, partners sit opposite (red+yellow vs green+blue), both home to win.
export const LUDO_MODES = ['classic', 'quick', 'timer', 'team'];
export const TIMER_MS = 10 * 60 * 1000;
export const OFF = -2; // token not used in this game (quick mode)
export function newGame(players, mode) {
  // players: [{ id, name, color, kind: 'human'|'bot'|'remote', look }]
  mode = LUDO_MODES.includes(mode) ? mode : 'classic';
  if (mode === 'team' && players.length !== 4) mode = 'classic';
  const row = mode === 'quick' ? [0, 0, OFF, OFF] : [-1, -1, -1, -1];
  const tokens = [0, 1, 2, 3].map(() => row.slice());
  const order = players.map(p => p.color).sort((a, b) => a - b);
  return {
    mode, n: mode === 'quick' ? 2 : 4, pts: [0, 0, 0, 0], endsAt: mode === 'timer' ? Date.now() + TIMER_MS : null,
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
export const partnerOf = (s, c) => (s.mode === 'team' ? (c + 2) % 4 : -1);
export const homeCount = (s, c) => s.tokens[c].filter(x => x === FINISH).length;
// Timer mode points: one per step walked, plus 20 for every capture (the captured token loses its steps).
export function score(s, c) { return s.tokens[c].reduce((a, p) => a + (p >= 0 ? p + 1 : 0), 0) + (s.pts ? s.pts[c] : 0); }
// Time is up (timer mode): most points first.
export function timeUp(s) {
  if (s.over) return;
  const left = s.order.filter(c => !s.ranks.includes(c));
  left.sort((a, b) => score(s, b) - score(s, a));
  s.ranks.push(...left); s.over = true; s.reason = 'time'; s.seq++;
}

export function movableTokens(s, color, d) {
  const out = [];
  const t = s.tokens[color];
  for (let i = 0; i < 4; i++) {
    const p = t[i];
    if (p === FINISH || p === OFF) continue;
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
  if (s.mode === 'team') {
    const teams = new Set(act.map(c => c % 2));
    if (teams.size <= 1) {
      const t = act.length ? act[0] % 2 : (color + 1) % 2, win = s.order.filter(c => c % 2 === t);
      s.ranks = win.concat(s.order.filter(c => c % 2 !== t)); s.over = true; s.winTeam = win;
      return;
    }
  } else if (act.length <= 1) {
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
        if (c === color || c === partnerOf(s, color)) continue;
        s.tokens[c].forEach((p, i) => {
          if (p >= 0 && p <= 50 && globalIndex(c, p) === g) {
            captured.push({ color: c, token: i, from: p });
            s.tokens[c][i] = -1;
          }
        });
      }
    }
  }
  if (s.pts) s.pts[color] += captured.length * 20;
  const finished = to === FINISH;
  let won = false;
  if (s.tokens[color].every(p => p === FINISH || p === OFF)) {
    const pl = playerOf(s, color);
    pl.done = true;
    s.ranks.push(color);
    won = true;
    if (s.mode === 'team') {
      // A team wins when both partners are home.
      const mate = partnerOf(s, color), mp = playerOf(s, mate);
      if (mp && (mp.done || mp.left)) {
        if (!s.ranks.includes(mate)) s.ranks.push(mate);
        s.order.filter(c => !s.ranks.includes(c)).forEach(c => s.ranks.push(c));
        s.over = true; s.winTeam = [color, mate];
      }
    } else if (s.mode === 'timer') {
      // First one home in timer mode wins straight away.
      s.order.filter(c => !s.ranks.includes(c)).sort((a, b) => score(s, b) - score(s, a)).forEach(c => s.ranks.push(c));
      s.over = true;
    }
  }
  const act = activeColors(s);
  if (!s.over && s.mode === 'team') {
    // Only one team still has players: the other team wins.
    const teams = new Set(act.map(c => c % 2));
    if (teams.size <= 1) {
      const t = act.length ? act[0] % 2 : color % 2, win = s.order.filter(c => c % 2 !== t);
      const rest = s.order.filter(c => c % 2 === t);
      s.ranks = win.concat(rest); s.over = true; s.winTeam = win;
    }
  } else if (!s.over && act.length <= 1) {
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

// Bot: capture > finish > leave yard > reach safety > run from danger > furthest.
// level: 'easy' plays almost at random, 'medium' is the normal bot, 'hard' plays more carefully.
export function botChoice(s, color, d, moves, level) {
  if (moves.length === 1) return moves[0];
  if (level === 'easy' && Math.random() < 0.7) return moves[Math.floor(Math.random() * moves.length)];
  const hard = level === 'hard';
  let best = moves[0], bestScore = -1e9;
  for (const i of moves) {
    const from = s.tokens[color][i];
    const to = from === -1 ? 0 : from + d;
    let score = 0;
    if (to <= 50) {
      const g = globalIndex(color, to);
      if (!SAFE.includes(g)) {
        for (const c of s.order) {
          if (c === color || c === partnerOf(s, color)) continue;
          s.tokens[c].forEach(p => { if (p >= 0 && p <= 50 && globalIndex(c, p) === g) score += 100 + (hard ? p * 2 : 0); });
        }
      } else score += hard ? 25 : 15;
      if (dangerAt(s, color, g) && !SAFE.includes(g)) score -= hard ? 70 + to : 30;
    }
    if (to === FINISH) score += 60;
    if (to >= 51) score += hard ? 35 : 20;
    if (from === -1) score += 40;
    if (from >= 0 && from <= 50) {
      const g0 = globalIndex(color, from);
      if (dangerAt(s, color, g0) && !SAFE.includes(g0)) score += hard ? 45 + from : 25;
    }
    score += to * (hard ? 0.8 : 0.5);
    if (score > bestScore) { bestScore = score; best = i; }
  }
  return best;
}

function dangerAt(s, color, g) {
  for (const c of s.order) {
    if (c === color || c === partnerOf(s, color)) continue;
    for (const p of s.tokens[c]) {
      if (p < 0 || p > 50) continue;
      const gp = globalIndex(c, p);
      const dist = (g - gp + 52) % 52;
      if (dist >= 1 && dist <= 6) return true;
    }
  }
  return false;
}

// Carrom rules and physics, shared by the app and the online server.
// The board is 1 x 1. Player 0 (white coins) shoots from the bottom (y near 1),
// player 1 (black coins) from the top (y near 0).
export const RC = 0.021, RS = 0.029, PR = 0.036, LO = 0.24, HI = 0.76;
export const BASE = [0.835, 0.165];
export const POCKETS = [[0.04, 0.04], [0.96, 0.04], [0.04, 0.96], [0.96, 0.96]];
export const KIND = ['white', 'black'];
export const STEP = 1 / 240;
const MS = 1.6; // the striker is heavier than a coin

// Modes: 'classic' (Queen + 9 coins each), 'free' (any coin scores points),
// 'disc' (8 coins each and one black "pitara" coin to pot last; no Queen).
export const MODES = ['classic', 'free', 'disc'];
export const POINTS = { white: 20, black: 10, queen: 50 };
export const NEED = mode => mode === 'disc' ? 8 : 9;
function startCoins(mode) {
  if (mode === 'disc') {
    const c = [{ x: 0.5, y: 0.5, kind: 'eight' }];
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.push({ x: 0.5 + Math.cos(a) * RC * 2.05, y: 0.5 + Math.sin(a) * RC * 2.05, kind: i % 2 ? 'black' : 'white' }); }
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 + 0.31, d = RC * 4.05; c.push({ x: 0.5 + Math.cos(a) * d, y: 0.5 + Math.sin(a) * d, kind: i % 2 ? 'white' : 'black' }); }
    return c.map((o, i) => ({ id: i, x: +o.x.toFixed(5), y: +o.y.toFixed(5), kind: o.kind, in: false }));
  }
  const c = [{ x: 0.5, y: 0.5, kind: 'queen' }];
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.push({ x: 0.5 + Math.cos(a) * RC * 2.05, y: 0.5 + Math.sin(a) * RC * 2.05, kind: i % 2 ? 'black' : 'white' }); }
  for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6, d = i % 2 ? RC * 3.6 : RC * 4.1; c.push({ x: 0.5 + Math.cos(a) * d, y: 0.5 + Math.sin(a) * d, kind: i % 2 ? 'white' : 'black' }); }
  return c.map((o, i) => ({ id: i, x: +o.x.toFixed(5), y: +o.y.toFixed(5), kind: o.kind, in: false }));
}

export function newCarrom(players, mode) {
  // players: [{ id, name, look, kind, tint }] -> first plays white from the bottom
  mode = MODES.includes(mode) ? mode : 'classic';
  return {
    game: 'carrom', mode, pts: [0, 0],
    players: players.slice(0, 2).map((p, i) => Object.assign({}, p, { color: i, left: false })),
    coins: startCoins(mode), turn: 0, seq: 0, got: [0, 0], queen: null, over: false, winner: null, reason: '', shots: 0
  };
}
export const carromPlayer = (s, i) => s.players[i];

// ---------- Physics ----------
// One small step for every moving piece. onPot(o) is called when a piece drops in a pocket.
export function physStep(list, dt, onPot, onHit) {
  for (const o of list) {
    const sp = Math.sqrt(o.vx * o.vx + o.vy * o.vy);
    if (sp > 0) { const ns = Math.max(0, sp - (0.32 + sp * 0.55) * dt); o.vx *= ns / sp; o.vy *= ns / sp; }
    o.x += o.vx * dt; o.y += o.vy * dt;
    if (o.x < o.r) { o.x = o.r; o.vx = Math.abs(o.vx) * 0.72; } if (o.x > 1 - o.r) { o.x = 1 - o.r; o.vx = -Math.abs(o.vx) * 0.72; }
    if (o.y < o.r) { o.y = o.r; o.vy = Math.abs(o.vy) * 0.72; } if (o.y > 1 - o.r) { o.y = 1 - o.r; o.vy = -Math.abs(o.vy) * 0.72; }
  }
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    const a = list[i], b = list[j], dx = b.x - a.x, dy = b.y - a.y, md = a.r + b.r;
    if (Math.abs(dx) > md || Math.abs(dy) > md) continue;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > 0 && d < md) {
      const nx = dx / d, ny = dy / d, ov = (md - d) / 2;
      a.x -= nx * ov; a.y -= ny * ov; b.x += nx * ov; b.y += ny * ov;
      const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (rv < 0) { const k = -(1 + 0.9) * rv / (1 / a.m + 1 / b.m); a.vx -= k * nx / a.m; a.vy -= k * ny / a.m; b.vx += k * nx / b.m; b.vy += k * ny / b.m; if (onHit && rv < -0.15) onHit(Math.min(1, -rv)); }
    }
  }
  for (let i = list.length - 1; i >= 0; i--) {
    const o = list[i];
    for (const p of POCKETS) { const dx = o.x - p[0], dy = o.y - p[1]; if (dx * dx + dy * dy < PR * PR) { o.in = true; o.vx = o.vy = 0; o.px = p[0]; o.py = p[1]; list.splice(i, 1); onPot(o); break; } }
  }
}
export const resting = list => list.every(o => o.vx * o.vx + o.vy * o.vy < 0.004 * 0.004);
export const speedOf = power => 0.4 + Math.max(0, Math.min(1, power)) * 3.4;

// Pieces on the board, ready to move. The striker is added at the shot's spot.
export function bodies(coins, shot) {
  const list = coins.filter(c => !c.in).map(c => ({ id: c.id, kind: c.kind, x: c.x, y: c.y, r: RC, m: 1, vx: 0, vy: 0 }));
  if (shot) { const sp = speedOf(shot.power); list.push({ id: 'S', kind: 'striker', x: shot.x, y: shot.y, r: RS, m: MS, vx: shot.dx * sp, vy: shot.dy * sp }); }
  return list;
}

// Striker spot on a base line: x is kept between the red circles and off any coin.
export function strikerSpot(coins, side, x) {
  const y = BASE[side];
  x = Math.max(LO, Math.min(HI, x));
  const clear = xx => !coins.some(c => !c.in && Math.hypot(c.x - xx, c.y - y) < RC + RS + 0.002);
  if (clear(x)) return { x, y };
  for (let k = 1; k < 40; k++) for (const s of [1, -1]) { const xx = x + s * k * 0.008; if (xx >= LO && xx <= HI && clear(xx)) return { x: xx, y }; }
  return { x, y };
}

// A shot must go forward, away from your own side.
export function forwardOk(side, dy) { return side === 0 ? dy < -0.05 : dy > 0.05; }

// Run a shot to the end. Returns the pieces that dropped (in order) and where everything stopped.
export function simulate(coins, shot) {
  const list = bodies(coins, shot), potted = [];
  let steps = 0;
  while (steps < 240 * 14 && !resting(list)) { physStep(list, STEP, o => potted.push(o)); steps++; }
  return { list, potted, steps };
}

// Free spot near the centre for a coin coming back.
function centreSpot(coins) {
  for (let r = 0; r < 0.2; r += 0.01) for (let a = 0; a < Math.PI * 2; a += 0.35) {
    const x = 0.5 + Math.cos(a) * r, y = 0.5 + Math.sin(a) * r;
    if (!coins.some(c => !c.in && Math.hypot(c.x - x, c.y - y) < RC * 2 + 0.002)) return { x, y };
    if (r === 0) break;
  }
  return { x: 0.5, y: 0.5 };
}
function backToCentre(s, coin) { const p = centreSpot(s.coins); coin.in = false; coin.x = +p.x.toFixed(5); coin.y = +p.y.toFixed(5); }

// Play a shot: move the coins, then apply the rules. Returns what happened, for messages.
// res: { potted: [kinds], foul, again, queen: 'pocketed'|'covered'|'returned'|null, finish, msg }
export function applyShot(s, shot) {
  if (s.over) return null;
  if (s.mode === 'free') return applyFree(s, shot);
  if (s.mode === 'disc') return applyDisc(s, shot);
  const me = s.turn, mine = KIND[me], theirs = KIND[1 - me];
  const sim = simulate(s.coins, shot);
  const byId = {}; s.coins.forEach(c => { byId[c.id] = c; });
  sim.list.forEach(o => { if (o.id !== 'S') { const c = byId[o.id]; c.x = +o.x.toFixed(5); c.y = +o.y.toFixed(5); } });
  const kinds = [];
  let foul = false, ownIn = 0, queenIn = false;
  sim.potted.forEach(o => {
    if (o.id === 'S') { foul = true; return; }
    const c = byId[o.id]; c.in = true; kinds.push(c.kind);
    if (c.kind === mine) ownIn++;
    else if (c.kind === theirs) s.got[1 - me]++;
    else queenIn = true;
  });
  const res = { potted: kinds, foul, again: false, queen: null, finish: false, msg: '', steps: sim.steps };
  s.seq++; s.shots++;
  if (foul) {
    // Striker in a pocket: coins you pocketed now come back, plus one more as a penalty.
    sim.potted.forEach(o => { if (o.id !== 'S') { const c = byId[o.id]; if (c.kind === mine || c.kind === 'queen') backToCentre(s, c); } });
    if (s.queen && s.queen.state === 'pending' && s.queen.by === me) { backToCentre(s, s.coins.find(c => c.kind === 'queen')); s.queen = null; }
    if (s.got[me] > 0) { const back = s.coins.find(c => c.in && c.kind === mine); if (back) { backToCentre(s, back); s.got[me]--; } }
    res.msg = 'Foul! The striker went in';
  } else {
    s.got[me] += ownIn;
    if (s.queen && s.queen.state === 'pending' && s.queen.by === me) {
      // Queen from the last shot: covered now, or she goes back to the centre.
      if (ownIn) { s.queen = { state: 'covered', by: me }; res.queen = 'covered'; }
      else { backToCentre(s, s.coins.find(c => c.kind === 'queen')); s.queen = null; res.queen = 'returned'; }
    }
    if (queenIn) {
      if (ownIn) { s.queen = { state: 'covered', by: me }; res.queen = 'covered'; }
      else { s.queen = { state: 'pending', by: me }; res.queen = 'pocketed'; }
    }
    res.again = ownIn > 0 || queenIn;
  }
  // Last coin before the Queen is taken: it comes back.
  const queenOnBoard = !s.queen || s.queen.state !== 'covered';
  if (!foul && s.got[me] >= 9 && queenOnBoard) {
    const back = s.coins.find(c => c.in && c.kind === mine); if (back) { backToCentre(s, back); s.got[me]--; }
    res.msg = 'Pocket the Queen before your last coin'; res.again = false;
  }
  if (s.got[me] >= 9 && !queenOnBoard) { s.over = true; s.winner = me; s.reason = 'cleared'; res.finish = true; }
  else if (s.got[1 - me] >= 9 && s.queen && s.queen.state === 'covered') { s.over = true; s.winner = 1 - me; s.reason = 'cleared'; res.finish = true; }
  if (!s.over && !res.again) s.turn = 1 - me;
  return res;
}

// Moves the coins for a shot and returns the pieces that dropped.
function runShot(s, shot) {
  const sim = simulate(s.coins, shot);
  const byId = {}; s.coins.forEach(c => { byId[c.id] = c; });
  sim.list.forEach(o => { if (o.id !== 'S') { const c = byId[o.id]; c.x = +o.x.toFixed(5); c.y = +o.y.toFixed(5); } });
  const foul = sim.potted.some(o => o.id === 'S');
  const coins = sim.potted.filter(o => o.id !== 'S').map(o => { const c = byId[o.id]; c.in = true; return c; });
  s.seq++; s.shots++;
  return { sim, foul, coins };
}
const left = (s, kind) => s.coins.filter(c => !c.in && c.kind === kind).length;

// Free Style: every coin scores for whoever pockets it (white 20, black 10, Queen 50 once covered).
// Pocket anything and you shoot again. Striker in: what you pocketed comes back and you lose 10.
function applyFree(s, shot) {
  const me = s.turn, { sim, foul, coins } = runShot(s, shot);
  const res = { potted: coins.map(c => c.kind), foul, again: false, queen: null, finish: false, msg: '', steps: sim.steps };
  const queenIn = coins.some(c => c.kind === 'queen'), other = coins.filter(c => c.kind !== 'queen');
  if (foul) {
    coins.forEach(c => backToCentre(s, c));
    if (s.queen && s.queen.state === 'pending' && s.queen.by === me) { backToCentre(s, s.coins.find(c => c.kind === 'queen')); s.queen = null; }
    s.pts[me] = Math.max(0, s.pts[me] - 10);
    res.msg = 'Foul! The striker went in (-10)';
  } else {
    other.forEach(c => { s.pts[me] += POINTS[c.kind]; });
    if (s.queen && s.queen.state === 'pending' && s.queen.by === me) {
      if (other.length) { s.queen = { state: 'covered', by: me }; s.pts[me] += POINTS.queen; res.queen = 'covered'; }
      else { backToCentre(s, s.coins.find(c => c.kind === 'queen')); s.queen = null; res.queen = 'returned'; }
    }
    if (queenIn) {
      if (other.length) { s.queen = { state: 'covered', by: me }; s.pts[me] += POINTS.queen; res.queen = 'covered'; }
      else { s.queen = { state: 'pending', by: me }; res.queen = 'pocketed'; }
    }
    res.again = coins.length > 0;
  }
  s.got = s.pts.slice();
  // Over when every coin is gone, or nobody can catch up any more.
  const rest = s.coins.filter(c => !c.in).reduce((a, c) => a + POINTS[c.kind], 0) + (s.queen && s.queen.state === 'pending' ? POINTS.queen : 0);
  const lead = s.pts[0] - s.pts[1];
  if (rest === 0 || Math.abs(lead) > rest) {
    s.over = true; s.reason = 'points'; res.finish = true;
    s.winner = lead > 0 ? 0 : lead < 0 ? 1 : me;
  } else if (!res.again) s.turn = 1 - me;
  return res;
}

// Disc Pool: pocket your 8 coins, then the black one. Black before that (or with a foul) loses.
function applyDisc(s, shot) {
  const me = s.turn, mine = KIND[me], theirs = KIND[1 - me], { sim, foul, coins } = runShot(s, shot);
  const res = { potted: coins.map(c => c.kind), foul, again: false, queen: null, finish: false, msg: '', steps: sim.steps };
  const eightIn = coins.some(c => c.kind === 'eight');
  const ownIn = coins.filter(c => c.kind === mine).length;
  coins.forEach(c => { if (c.kind === theirs) s.got[1 - me]++; });
  if (eightIn) {
    const clear = !foul && s.got[me] + ownIn >= NEED('disc');
    s.got[me] += foul ? 0 : ownIn;
    s.over = true; s.winner = clear ? me : 1 - me; s.reason = clear ? 'eight' : 'eight-early'; res.finish = true;
    res.msg = clear ? 'Black coin in, game won!' : 'Black coin went in too early';
    return res;
  }
  if (foul) {
    coins.forEach(c => { if (c.kind === mine) backToCentre(s, c); });
    if (s.got[me] > 0) { const back = s.coins.find(c => c.in && c.kind === mine); if (back) { backToCentre(s, back); s.got[me]--; } }
    res.msg = 'Foul! The striker went in';
  } else {
    s.got[me] += ownIn;
    res.again = ownIn > 0;
    if (s.got[me] >= NEED('disc') && ownIn) res.msg = 'All 8 in! Now pocket the black coin';
  }
  if (!res.again) s.turn = 1 - me;
  return res;
}

export function carromPass(s) { if (s.over) return; s.seq++; if (s.queen && s.queen.state === 'pending' && s.queen.by === s.turn) { backToCentre(s, s.coins.find(c => c.kind === 'queen')); s.queen = null; } s.turn = 1 - s.turn; }
export function carromLeft(s, i) { if (s.over) return; s.players[i].left = true; s.over = true; s.winner = 1 - i; s.reason = 'left'; s.seq++; }

// ---------- Aim line ----------
// First coin the striker touches going along (dx, dy), and the way that coin will go.
export function firstHit(coins, sx, sy, dx, dy) {
  let best = null;
  coins.forEach(c => {
    if (c.in) return;
    const fx = sx - c.x, fy = sy - c.y, R = RC + RS, b = fx * dx + fy * dy, cc = fx * fx + fy * fy - R * R, disc = b * b - cc;
    if (disc < 0) return; const t = -b - Math.sqrt(disc);
    if (t > 0 && (!best || t < best.t)) best = { t, c };
  });
  if (!best) return null;
  const px = sx + dx * best.t, py = sy + dy * best.t;
  let ux = best.c.x - px, uy = best.c.y - py; const L = Math.hypot(ux, uy); ux /= L; uy /= L;
  return { coin: best.c, px, py, ux, uy };
}

// ---------- Computer player ----------
function planFor(s, c, side, sx, sy) {
  let best = null;
  POCKETS.forEach(p => {
    let ux = p[0] - c.x, uy = p[1] - c.y; const dp = Math.hypot(ux, uy); ux /= dp; uy /= dp;
    const gx = c.x - ux * (RC + RS), gy = c.y - uy * (RC + RS);
    let dx = gx - sx, dy = gy - sy; const ds = Math.hypot(dx, dy); dx /= ds; dy /= ds;
    if (!forwardOk(side, dy)) return;
    const cut = dx * ux + dy * uy; if (cut < 0.3) return;
    const h = firstHit(s.coins, sx, sy, dx, dy); if (!h || h.coin !== c) return;
    if (s.coins.some(o => o !== c && !o.in && (() => { const wx = o.x - c.x, wy = o.y - c.y, al = wx * ux + wy * uy; return al > 0 && al < dp && Math.abs(wx * uy - wy * ux) < RC * 2; })())) return;
    const score = cut * 2 - ds * 0.8 - dp;
    if (!best || score > best.score) best = { c, dx, dy, score };
  });
  return best;
}
function powerFor(s, c, shot) {
  const ok = [];
  for (let pw = 0.2; pw <= 1.0001; pw += 0.05) {
    const r = simulate(s.coins, Object.assign({}, shot, { power: pw }));
    if (r.potted.some(o => o.id === c.id) && !r.potted.some(o => o.id === 'S')) ok.push(pw);
  }
  return ok.length ? ok[Math.floor(ok.length / 3)] : null;
}
// Returns a shot { x, y, dx, dy, power }. skill 0..1: how exact the aim is.
export function carromBot(s, skill) {
  const side = s.turn, mine = KIND[side];
  const want = s.mode === 'free' ? (c => !c.in)
    : s.mode === 'disc' ? (c => !c.in && (s.got[side] >= NEED('disc') ? c.kind === 'eight' : c.kind === mine))
      : (c => !c.in && (c.kind === mine || (c.kind === 'queen' && s.got[side] >= 1)));
  let best = null;
  for (let x = LO; x <= HI + 1e-9; x += 0.02) {
    const sp = strikerSpot(s.coins, side, x); if (Math.abs(sp.x - x) > 0.001) continue;
    s.coins.forEach(c => { if (!want(c)) return; const p = planFor(s, c, side, sp.x, sp.y); if (p && (!best || p.score > best.score)) best = Object.assign(p, { x: sp.x, y: sp.y }); });
  }
  if (best) {
    const power = powerFor(s, best.c, { x: best.x, y: best.y, dx: best.dx, dy: best.dy });
    if (power) {
      const err = (1 - (skill == null ? 0.7 : skill)) * 0.22 * (Math.random() - 0.5);
      const ca = Math.cos(err), sa = Math.sin(err);
      return { x: best.x, y: best.y, dx: best.dx * ca - best.dy * sa, dy: best.dx * sa + best.dy * ca, power };
    }
  }
  // No clean shot: hit the nearest coin of its colour fairly hard.
  const sp = strikerSpot(s.coins, side, 0.3 + Math.random() * 0.4);
  const t = s.coins.filter(c => !c.in && (s.mode === 'free' ? c.kind !== 'queen' : c.kind === mine)).sort((a, b) => Math.hypot(a.x - sp.x, a.y - sp.y) - Math.hypot(b.x - sp.x, b.y - sp.y)).find(c => forwardOk(side, c.y - sp.y)) || { x: 0.5, y: 0.5 };
  let dx = t.x - sp.x, dy = t.y - sp.y; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
  if (!forwardOk(side, dy)) { dx = 0; dy = side === 0 ? -1 : 1; }
  return { x: sp.x, y: sp.y, dx, dy, power: 0.7 };
}

// Check a shot from a player (online): spot on the base line, forward, sensible numbers.
export function cleanShot(s, m) {
  const side = s.turn, x = Number(m.x), dx = Number(m.dx), dy = Number(m.dy), power = Number(m.power);
  if (![x, dx, dy, power].every(Number.isFinite)) return null;
  const L = Math.hypot(dx, dy); if (L < 0.5) return null;
  const sp = strikerSpot(s.coins, side, x);
  const shot = { x: sp.x, y: sp.y, dx: dx / L, dy: dy / L, power: Math.max(0.05, Math.min(1, power)) };
  return forwardOk(side, shot.dy) ? shot : null;
}

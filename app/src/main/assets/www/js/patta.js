// Rang Patta: a colour-and-number card game, shared by the app and the online server.
// Colours: 0 ruby, 1 emerald, 2 sapphire, 3 topaz. Wild cards have colour -1.
// Card values: 0-9, 'skip', 'rev', 'd2' (+2), 'wild', 'w4' (+4).
// House rules: +2 can go on +2, and +4 on +2 or +4 (the next player picks up the total).
// With one card left you press "EK!"; if you forget, another player can catch you (+2 cards).
export const COLORS = ['Ruby', 'Emerald', 'Sapphire', 'Topaz'];
export const HAND = 7;

export function makeDeck(rnd) {
  const d = []; let id = 0;
  for (let c = 0; c < 4; c++) {
    d.push({ id: id++, c, v: 0 });
    for (let v = 1; v <= 9; v++) for (let k = 0; k < 2; k++) d.push({ id: id++, c, v });
    ['skip', 'rev', 'd2'].forEach(v => { for (let k = 0; k < 2; k++) d.push({ id: id++, c, v }); });
  }
  for (let k = 0; k < 4; k++) { d.push({ id: id++, c: -1, v: 'wild' }); d.push({ id: id++, c: -1, v: 'w4' }); }
  return shuffle(d, rnd);
}
function shuffle(a, rnd) { rnd = rnd || Math.random; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function newPatta(players, rnd) {
  const draw = makeDeck(rnd);
  const s = {
    game: 'patta', players: players.slice(0, 4).map((p, i) => Object.assign({}, p, { seat: i, left: false })),
    hands: [], draw, pile: [], col: 0, turn: 0, dir: 1, pend: 0, drawn: null, ek: [], catchable: null,
    seq: 0, over: false, winner: null, reason: '', last: null
  };
  s.players.forEach((p, i) => { s.hands[i] = draw.splice(0, HAND); s.ek[i] = false; });
  // First card on the table: a number card.
  let k = draw.findIndex(c => typeof c.v === 'number');
  const first = draw.splice(k, 1)[0]; s.pile.push(first); s.col = first.c;
  return s;
}

export const top = s => s.pile[s.pile.length - 1];
export const isWild = c => c.c === -1;
export const label = c => c.v === 'skip' ? '⦸' : c.v === 'rev' ? '⇄' : c.v === 'd2' ? '+2' : c.v === 'w4' ? '+4' : c.v === 'wild' ? '★' : String(c.v);
const active = s => s.players.filter(p => !p.left).length;

// Can this card go on the table now?
export function canPlay(s, card) {
  const t = top(s);
  if (s.pend > 0) return card.v === 'w4' || (card.v === 'd2' && t.v === 'd2');
  if (isWild(card)) return true;
  return card.c === s.col || card.v === t.v;
}
export function playable(s, i) {
  const h = s.hands[i] || [];
  if (s.drawn != null) return h.filter(c => c.id === s.drawn && canPlay(s, c)).map(c => c.id);
  return h.filter(c => canPlay(s, c)).map(c => c.id);
}

function nextSeat(s, from, steps) {
  let i = from;
  for (let k = 0; k < steps; k++) { do { i = (i + s.dir + s.players.length) % s.players.length; } while (s.players[i].left); }
  return i;
}
function refill(s) {
  if (s.draw.length) return;
  const keep = s.pile.pop();
  s.draw = shuffle(s.pile.map(c => (c.v === 'wild' || c.v === 'w4' ? { id: c.id, c: -1, v: c.v } : c)));
  s.pile = [keep];
}
function take(s, i, n) {
  const got = [];
  for (let k = 0; k < n; k++) { refill(s); if (!s.draw.length) break; const c = s.draw.pop(); s.hands[i].push(c); got.push(c); }
  if (s.hands[i].length > 1) s.ek[i] = false;
  return got;
}

// Play a card. color: the colour picked for a wild card.
// Returns { ok, card, effect, next } or null when not allowed.
export function playCard(s, i, cardId, color) {
  if (s.over || s.turn !== i) return null;
  const h = s.hands[i], k = h.findIndex(c => c.id === cardId); if (k < 0) return null;
  const card = h[k];
  if (s.drawn != null && card.id !== s.drawn) return null;
  if (!canPlay(s, card)) return null;
  if (isWild(card) && !(color >= 0 && color < 4)) return null;
  h.splice(k, 1);
  const placed = isWild(card) ? Object.assign({}, card, { c: color }) : card;
  s.pile.push(placed); s.col = placed.c; s.drawn = null; s.seq++;
  // Forgetting "EK!" with one card left: others can catch you until the next player acts.
  s.catchable = h.length === 1 && !s.ek[i] ? i : null;
  if (h.length !== 1) s.ek[i] = false;
  const ev = { t: 'play', who: i, card: placed, effect: card.v };
  if (!h.length) { s.over = true; s.winner = i; s.reason = 'empty'; s.last = ev; return ev; }
  let steps = 1;
  if (card.v === 'skip') steps = 2;
  else if (card.v === 'rev') { s.dir = -s.dir; if (active(s) === 2) steps = 2; }
  else if (card.v === 'd2') s.pend += 2;
  else if (card.v === 'w4') s.pend += 4;
  s.turn = nextSeat(s, i, steps);
  ev.next = s.turn; s.last = ev;
  return ev;
}

// Draw: picks up the +2/+4 pile (and the turn ends), or one card that you may play straight away.
export function drawCard(s, i) {
  if (s.over || s.turn !== i || s.drawn != null) return null;
  s.seq++;
  if (s.catchable != null && s.catchable !== i) s.catchable = null;
  if (s.pend > 0) {
    const n = s.pend, got = take(s, i, n); s.pend = 0;
    s.turn = nextSeat(s, i, 1);
    const ev = { t: 'draw', who: i, n: got.length, ids: got.map(c => c.id), forced: true, next: s.turn }; s.last = ev; return ev;
  }
  const got = take(s, i, 1);
  const c = got[0];
  const ev = { t: 'draw', who: i, n: got.length, ids: got.map(x => x.id) };
  if (c && canPlay(s, c)) s.drawn = c.id;
  else { s.turn = nextSeat(s, i, 1); ev.next = s.turn; }
  s.last = ev; return ev;
}
// Keep the card you just drew and end your turn.
export function passTurn(s, i) {
  if (s.over || s.turn !== i || s.drawn == null) return null;
  s.drawn = null; s.seq++; s.turn = nextSeat(s, i, 1);
  const ev = { t: 'pass', who: i, next: s.turn }; s.last = ev; return ev;
}
// Press "EK!" (with 2 cards before playing, or with 1 card left).
export function sayEk(s, i) {
  if (s.over || !s.hands[i]) return null;
  const n = s.hands[i].length; if (n > 2) return null;
  s.ek[i] = true; if (s.catchable === i) s.catchable = null; s.seq++;
  return { t: 'ek', who: i };
}
// Catch a player who forgot to say "EK!": they pick up 2.
export function catchEk(s, by) {
  const v = s.catchable; if (s.over || v == null || v === by || s.hands[v].length !== 1) return null;
  s.catchable = null; const got = take(s, v, 2); s.seq++;
  return { t: 'caught', who: v, by, n: got.length, ids: got.map(c => c.id) };
}
// Time ran out: pick up what you owe (or one card) and the turn moves on.
export function timeout(s) {
  if (s.over) return null;
  const i = s.turn;
  if (s.drawn != null) return passTurn(s, i);
  const ev = drawCard(s, i); if (ev && s.drawn != null) return passTurn(s, i);
  return ev;
}
// A player left: their cards go back under the pile. One player left wins.
export function pattaLeft(s, i) {
  if (s.over || !s.players[i]) return;
  s.players[i].left = true;
  s.draw = s.hands[i].concat(s.draw); s.hands[i] = [];
  s.seq++;
  if (active(s) < 2) { s.over = true; s.winner = s.players.findIndex(p => !p.left); s.reason = 'left'; return; }
  if (s.turn === i) { s.drawn = null; s.turn = nextSeat(s, i, 1); }
  if (s.catchable === i) s.catchable = null;
}
// Order at the end: winner first, then fewest cards.
export function ranking(s) {
  return s.players.map((p, i) => i).sort((a, b) => (a === s.winner ? -1 : b === s.winner ? 1 : (s.players[a].left - s.players[b].left) || (s.hands[a].length - s.hands[b].length)));
}

// What one player is allowed to see (online): their own hand, and only the number of cards of others.
export function viewFor(s, i) {
  const v = Object.assign({}, s);
  v.counts = s.hands.map(h => h.length);
  v.hands = s.hands.map((h, k) => (k === i || s.over ? h : []));
  v.draw = s.draw.length; v.pile = s.pile.slice(-4);
  return v;
}

// ---------- Computer player ----------
export function pattaBot(s, i) {
  const h = s.hands[i], ok = playable(s, i).map(id => h.find(c => c.id === id));
  if (!ok.length) return s.drawn != null ? { pass: true } : { draw: true };
  const nxt = nextSeat(s, i, 1), nextFew = (s.hands[nxt] || []).length <= 2;
  const count = c => h.filter(x => x.c === c).length;
  const score = c => {
    let v = 0;
    if (isWild(c)) v = c.v === 'w4' ? (nextFew || s.pend ? 30 : -10) : -5;
    else { v = count(c.c) * 2 + (typeof c.v === 'number' ? c.v / 3 : 4); if (c.v === 'd2' || c.v === 'skip') v += nextFew ? 12 : 2; }
    return v;
  };
  ok.sort((a, b) => score(b) - score(a));
  const card = ok[0];
  let color;
  if (isWild(card)) { const t = [0, 1, 2, 3].map(c => [c, count(c)]); t.sort((a, b) => b[1] - a[1]); color = t[0][0]; }
  return { card: card.id, color };
}

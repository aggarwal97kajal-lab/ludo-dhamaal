// Plays an online game through the room logic with fake sockets.
import { Room } from '../server/src/index.js';
const room = new Room({}, {});
room.claimed = true; room.code = 'ABCDE';
const mk = name => { const ws = { name, got: [], send(t) { this.got.push(JSON.parse(t)); }, close() {} }; return ws; };
const a = mk('a'), b = mk('b'), c = mk('c');
room.onMsg(a, JSON.stringify({ t: 'hello', pid: 'pa', name: 'Asha', look: 1 }));
room.onMsg(b, JSON.stringify({ t: 'hello', pid: 'pb', name: 'Bablu', look: 2 }));
let ok = true; const check = (c, m) => { if (!c) { ok = false; console.error('FAIL', m); } };
check(room.host === 'pa', 'host');
room.onMsg(b, JSON.stringify({ t: 'start' })); check(!room.s, 'only host starts');
room.onMsg(a, JSON.stringify({ t: 'start' })); check(room.s && room.s.order.join() === '0,2', 'started 2p');
room.onMsg(c, JSON.stringify({ t: 'hello', pid: 'pc', name: 'C' })); check(c.got.some(m => m.t === 'err'), 'late join refused');
let guard = 0;
while (!room.s.over && guard++ < 5000) {
  const cur = room.s.turn === 0 ? a : b;
  const other = cur === a ? b : a;
  room.onMsg(other, JSON.stringify({ t: 'roll' })); // wrong player is ignored
  room.onMsg(cur, JSON.stringify({ t: 'roll' }));
  if (room.moves.length) room.onMsg(cur, JSON.stringify({ t: 'move', token: room.moves[0] }));
  else if (room.s.rolled) room.skip('nomove');
}
check(room.s.over, 'game finished');
// rejoin gets a sync
const a2 = mk('a2'); room.onMsg(a2, JSON.stringify({ t: 'hello', pid: 'pa', name: 'Asha' })); check(a2.got.some(m => m.t === 'sync'), 'rejoin sync');
// chat reaches everyone and new joiners get history
room.onMsg(b, JSON.stringify({ t: 'chat', text: '  hello   there ' }));
check(a2.got.some(m => m.t === 'chat' && m.text === 'hello there' && m.name === 'Bablu'), 'chat relay');
const a3 = mk('a3'); room.onMsg(a3, JSON.stringify({ t: 'hello', pid: 'pa', name: 'Asha' })); check(a3.got.some(m => m.t === 'chatlog' && m.list.length === 1), 'chat history');
room.clearTurn();
// Leaving: host leaves mid-game -> next joiner is host, leaver is skipped, last one standing wins
{
  const r2 = new Room({}, {}); r2.claimed = true; r2.code = 'LEAVE'; r2.opts.bots = false;
  const x = mk('x'), y = mk('y'), z = mk('z');
  r2.onMsg(x, JSON.stringify({ t: 'hello', pid: 'px', name: 'X' }));
  r2.onMsg(y, JSON.stringify({ t: 'hello', pid: 'py', name: 'Y' }));
  r2.onMsg(z, JSON.stringify({ t: 'hello', pid: 'pz', name: 'Z' }));
  r2.onMsg(x, JSON.stringify({ t: 'start' }));
  check(r2.s && r2.s.turn === 0, 'leave game started, red to play');
  r2.onMsg(x, JSON.stringify({ t: 'leave' }));
  check(r2.host === 'py', 'next joiner becomes host');
  check(r2.s.turn !== 0, 'leaver turn skipped');
  check(r2.players.find(p => p.pid === 'px').left, 'leaver marked offline');
  // network drop is not a leave
  r2.onClose(y); r2.markAway('py'); // after the 3 second grace
  check(!r2.players.find(p => p.pid === 'py').left && !r2.players.find(p => p.pid === 'py').connected, 'network drop is waiting, not left');
  r2.onMsg(z, JSON.stringify({ t: 'leave' }));
  check(r2.s.over, 'last player standing ends the game');
  r2.clearTurn();
}
// Snakes & Ladders online
{
  const r = new Room({}, {}); r.claimed = true; r.code = 'SNAKE';
  const a = mk('a'), b = mk('b');
  r.onMsg(a, JSON.stringify({ t: 'hello', pid: 'pa', name: 'A', game: 'snakes' }));
  r.onMsg(b, JSON.stringify({ t: 'hello', pid: 'pb', name: 'B', game: 'ludo' }));
  check(r.game === 'snakes', 'room keeps the creator’s game');
  r.onMsg(a, JSON.stringify({ t: 'start' }));
  check(r.s && r.s.game === 'snakes' && r.s.pos[0] === 0, 'snakes started');
  r.onMsg(b, JSON.stringify({ t: 'roll' }));
  check(r.s.seq === 0, 'not your turn: no roll');
  r.onMsg(a, JSON.stringify({ t: 'roll' }));
  check(r.s.seq === 1 && r.s.pos[0] > 0, 'rolled and moved');
  r.clearTurn();
}
// Carrom online
{
  const r = new Room({}, {}); r.claimed = true; r.code = 'CARRM';
  const a = mk('a'), b = mk('b'), c = mk('c');
  r.onMsg(a, JSON.stringify({ t: 'hello', pid: 'pa', name: 'A', game: 'carrom' }));
  r.onMsg(b, JSON.stringify({ t: 'hello', pid: 'pb', name: 'B' }));
  r.onMsg(c, JSON.stringify({ t: 'hello', pid: 'pc', name: 'C' }));
  check(r.players.length === 2, 'carrom room holds 2');
  r.onMsg(a, JSON.stringify({ t: 'start' }));
  check(r.s && r.s.game === 'carrom' && r.s.players[0].id === 'pa', 'carrom started, host white');
  r.onMsg(b, JSON.stringify({ t: 'rshot', x: 0.5, dx: 0, dy: 1, power: 1, seq: 0 }));
  check(r.s.seq === 0, 'not your turn: no shot');
  r.onMsg(a, JSON.stringify({ t: 'rshot', x: 0.5, dx: 0, dy: 1, power: 1, seq: 0 }));
  check(r.s.seq === 0, 'backward shot refused');
  r.onMsg(a, JSON.stringify({ t: 'rshot', x: 0.5, dx: 0, dy: -1, power: 1, seq: 0 }));
  check(r.s.seq === 1 && b.got.some(m => m.t === 'rshot'), 'shot played and sent to everyone');
  r.onMsg(b, JSON.stringify({ t: 'leave' }));
  check(r.s.over && r.s.winner === 0, 'leaver loses');
  r.clearTurn();
}
// Rang Patta online: secret hands, server checks every card, a full game finishes
{
  const { pattaBot } = await import('../app/src/main/assets/www/js/patta.js');
  const r = new Room({}, {}); r.claimed = true; r.code = 'PATTA';
  const ws = ['a', 'b', 'c'].map(mk);
  ws.forEach((w, i) => r.onMsg(w, JSON.stringify({ t: 'hello', pid: 'q' + i, name: 'Q' + i, game: 'patta' })));
  r.onMsg(ws[0], JSON.stringify({ t: 'start' }));
  check(r.s && r.s.game === 'patta' && r.s.players.length === 3, 'patta started');
  const st = ws[1].got.filter(m => m.t === 'start').pop();
  const me = st.s.players.findIndex(p => p.id === 'q1');
  check(st.s.hands[me].length === 7 && st.s.hands.filter((h, k) => k !== me).every(h => h.length === 0), 'only own hand is sent');
  check(typeof st.s.draw === 'number', 'draw pile is just a number');
  let guard = 0;
  while (!r.s.over && guard++ < 4000) {
    const i = r.s.turn, w = ws[Number(r.s.players[i].id.slice(1))];
    const b = pattaBot(r.s, i);
    if (r.s.hands[i].length <= 2) r.onMsg(w, JSON.stringify({ t: 'pek' }));
    if (b.draw) r.onMsg(w, JSON.stringify({ t: 'pdraw', seq: r.s.seq }));
    else if (b.pass) r.onMsg(w, JSON.stringify({ t: 'ppass', seq: r.s.seq }));
    else r.onMsg(w, JSON.stringify({ t: 'pplay', card: b.card, color: b.color, seq: r.s.seq }));
    if (guard % 40 === 0) r.skip('timeout');
  }
  check(r.s.over, 'patta game finished');
  r.clearTurn();
}
// Sudoku race: same puzzle, progress shared, a correct grid wins, a wrong one is refused
{
  const { makePuzzle } = await import('../app/src/main/assets/www/js/sudoku.js');
  const r = new Room({}, {}); r.claimed = true; r.code = 'SUDOK';
  const ws = ['a', 'b'].map(mk);
  ws.forEach((w, i) => r.onMsg(w, JSON.stringify({ t: 'hello', pid: 'z' + i, name: 'Z' + i, game: 'sudoku', mode: 'hard' })));
  r.onMsg(ws[0], JSON.stringify({ t: 'start' }));
  check(r.s && r.s.game === 'sudoku' && r.s.level === 'hard', 'sudoku started');
  const pz = makePuzzle(r.s.seed, r.s.level);
  r.onMsg(ws[1], JSON.stringify({ t: 'sprog', filled: 10, mistakes: 1 }));
  check(ws[0].got.some(m => m.t === 'sprog' && m.s.players[1].filled === 10), 'progress shared');
  r.onMsg(ws[1], JSON.stringify({ t: 'sdone', grid: pz.puzzle }));
  check(!r.s.over, 'wrong grid refused');
  r.onMsg(ws[1], JSON.stringify({ t: 'sdone', grid: pz.solution }));
  check(r.s.over && r.s.winner === 'z1', 'solver wins');
}
// Arrow race: replayed taps decide the winner
{
  const { makeLevel, isFree } = await import('../app/src/main/assets/www/js/arrows.js');
  const r = new Room({}, {}); r.claimed = true; r.code = 'ARROW';
  const ws = ['a', 'b'].map(mk);
  ws.forEach((w, i) => r.onMsg(w, JSON.stringify({ t: 'hello', pid: 'y' + i, name: 'Y' + i, game: 'arrows' })));
  r.onMsg(ws[0], JSON.stringify({ t: 'start' }));
  check(r.s && r.s.game === 'arrows', 'arrows started');
  const L = makeLevel(r.s.level, r.s.seed), gone = new Set(), order = [];
  for (;;) { const f = L.arrows.find(x => !gone.has(x.id) && isFree(L, gone, x.id)); if (!f) break; gone.add(f.id); order.push(f.id); }
  r.onMsg(ws[0], JSON.stringify({ t: 'adone', order: order.slice(0, 3) }));
  check(!r.s.over, 'partial run refused');
  r.onMsg(ws[0], JSON.stringify({ t: 'adone', order }));
  check(r.s.over && r.s.winner === 'y0', 'arrow race won');
}
// Draw & Guess: secret word, guesses, points, turns
{
  const r = new Room({}, {}); r.claimed = true; r.code = 'DRAWW';
  const ws = ['a', 'b', 'c'].map(mk);
  ws.forEach((w, i) => r.onMsg(w, JSON.stringify({ t: 'hello', pid: 'd' + i, name: 'D' + i, game: 'draw' })));
  r.onMsg(ws[0], JSON.stringify({ t: 'start' }));
  check(r.s && r.s.game === 'draw' && r.s.phase === 'choose', 'draw started');
  const last = w => w.got.filter(m => m.s && m.s.game === 'draw').pop();
  check(last(ws[0]).s.choices && last(ws[0]).s.choices.length === 3 && !last(ws[1]).s.choices, 'only the drawer sees the choices');
  r.onMsg(ws[0], JSON.stringify({ t: 'dpick', i: 1 }));
  const word = r.s.word;
  check(r.s.phase === 'draw' && last(ws[0]).s.word === word && last(ws[1]).s.word === null, 'word secret');
  r.onMsg(ws[0], JSON.stringify({ t: 'dop', op: { t: 's', id: 1, c: '#ff0000', w: 8, pts: [[10, 10], [20, 30]] } }));
  check(ws[1].got.some(m => m.t === 'dop' && m.op.pts.length === 2), 'strokes relayed');
  r.onMsg(ws[1], JSON.stringify({ t: 'dop', op: { t: 'clear' } }));
  check(r.dops.length === 1, 'only the drawer draws');
  r.onMsg(ws[1], JSON.stringify({ t: 'dguess', text: 'zzzz' }));
  check(ws[2].got.some(m => m.t === 'dmsg' && m.kind === 'guess' && m.text === 'zzzz'), 'wrong guess shown to all');
  r.s.players[1].lastGuess = 0; r.onMsg(ws[1], JSON.stringify({ t: 'dguess', text: word.toUpperCase() + ' ' }));
  check(r.s.players[1].guessed && r.s.players[1].score > 0 && r.s.players[0].score > 0, 'right guess scores');
  check(!ws[2].got.some(m => m.t === 'dmsg' && m.text && m.text.toLowerCase().includes(word)), 'word never sent as text');
  r.onMsg(ws[2], JSON.stringify({ t: 'dguess', text: word }));
  check(r.s.phase === 'reveal', 'all guessed -> reveal');
  r.dClear(); r.s.turn++; r.dTurn('next');
  check(r.s.drawer === 1 && r.s.phase === 'choose', 'next drawer');
  r.onMsg(ws[1], JSON.stringify({ t: 'leave' }));
  check(r.s.phase === 'reveal', 'drawer left -> reveal');
  r.dClear();
  r.s.turn = 999; r.dTurn('next');
  check(r.s.over && r.s.winner, 'game ends after the rounds');
  r.dClear();
}

// Viewers: a running room offers "watch", viewers get the state but can't play
{
  const r = new Room({}, {}); r.claimed = true; r.code = 'VIEWS';
  const x = mk('x'), y = mk('y'), w = mk('w'), w2 = mk('w2');
  r.onMsg(x, JSON.stringify({ t: 'hello', pid: 'px', name: 'X' }));
  r.onMsg(y, JSON.stringify({ t: 'hello', pid: 'py', name: 'Y' }));
  r.onMsg(x, JSON.stringify({ t: 'start' }));
  r.onMsg(w, JSON.stringify({ t: 'hello', pid: 'pw', name: 'W' }));
  check(w.got.some(m => m.t === 'err' && m.code === 'full'), 'running room offers watch');
  r.onMsg(w2, JSON.stringify({ t: 'hello', pid: 'pw', name: 'W', watch: true }));
  check(w2.got.some(m => m.t === 'viewer' && m.on) && w2.got.some(m => m.t === 'sync'), 'viewer gets state');
  check(r.viewers.length === 1 && r.players.length === 2, 'viewer is not a player');
  check(x.got.some(m => m.t === 'lobby' && m.viewers && m.viewers.length === 1), 'players see viewer list');
  const seq = r.s.seq; r.onMsg(w2, JSON.stringify({ t: 'roll' })); check(r.s.seq === seq && !r.s.rolled, 'viewer cannot roll');
  r.onMsg(w2, JSON.stringify({ t: 'react', e: '🔥' })); check(x.got.some(m => m.t === 'react' && m.e === '🔥'), 'reaction reaches players');
  r.onMsg(w2, JSON.stringify({ t: 'chat', text: 'go go' })); check(x.got.some(m => m.t === 'chat' && m.viewer), 'viewer chat');
  r.onMsg(w2, JSON.stringify({ t: 'seat', on: true }));
  r.onMsg(x, JSON.stringify({ t: 'kick', pid: 'pw' })); check(!r.viewers.length && r.banned.has('pw'), 'host removes viewer');
  r.clearTurn(); clearTimeout(r.botTimer);
}
// Password + viewers off + seat in next game
{
  const r = new Room({}, {}); r.claimed = true; r.code = 'PASSW';
  const x = mk('x'), y = mk('y'), y2 = mk('y2'), z = mk('z'), q = mk('q');
  r.onMsg(x, JSON.stringify({ t: 'hello', pid: 'px', name: 'X', game: 'chess' }));
  r.onMsg(x, JSON.stringify({ t: 'hset', opts: { pw: '1234' } }));
  r.onMsg(y, JSON.stringify({ t: 'hello', pid: 'py', name: 'Y' })); check(y.got.some(m => m.code === 'pw'), 'password asked');
  r.onMsg(y2, JSON.stringify({ t: 'hello', pid: 'py', name: 'Y', pw: '1234' })); check(r.players.length === 2, 'right password joins');
  r.onMsg(z, JSON.stringify({ t: 'hello', pid: 'pz', name: 'Z', pw: '1234', watch: true })); check(r.viewers.length === 1, 'full chess room: watch');
  r.onMsg(z, JSON.stringify({ t: 'seat', on: true }));
  r.onMsg(y2, JSON.stringify({ t: 'leave' })); check(r.players.some(p => p.pid === 'pz') && !r.viewers.length, 'viewer takes free seat');
  r.onMsg(x, JSON.stringify({ t: 'hset', opts: { viewers: false } }));
  r.onMsg(q, JSON.stringify({ t: 'hello', pid: 'pq', name: 'Q', pw: '1234', watch: true })); check(q.got.some(m => m.t === 'err' && !m.code), 'viewers off: no watching');
}
// Computer plays for someone who leaves
{
  const r = new Room({}, {}); r.claimed = true; r.code = 'BOTTY';
  const x = mk('x'), y = mk('y');
  r.onMsg(x, JSON.stringify({ t: 'hello', pid: 'px', name: 'X' }));
  r.onMsg(y, JSON.stringify({ t: 'hello', pid: 'py', name: 'Y' }));
  r.onMsg(x, JSON.stringify({ t: 'start' }));
  r.onMsg(y, JSON.stringify({ t: 'leave' }));
  const gp = r.s.players.find(p => p.id === 'py');
  check(gp.bot && !r.s.over, 'bot takes the seat, game goes on');
  await new Promise(res => { let n = 0; const iv = setInterval(() => { if (r.current().id === 'px' && !r.s.rolled) { r.onMsg(x, JSON.stringify({ t: 'roll' })); if (r.moves.length) r.onMsg(x, JSON.stringify({ t: 'move', token: r.moves[0] })); } if (++n > 60 || x.got.filter(m => m.t === 'rolled').length > 4) { clearInterval(iv); res(); } }, 100); });
  const botRolls = x.got.filter(m => m.t === 'rolled' && r.s.players.find(p => p.color === m.s.turn) === gp).length;
  check(x.got.some(m => m.t === 'passed' && m.reason === 'bot'), 'players told about bot');
  check(botRolls >= 0 && x.got.filter(m => m.t === 'rolled').length > 2, 'game keeps moving with the bot');
  r.clearTurn(); clearTimeout(r.botTimer); r.s.over = true;
}

// Ludo modes online: host's mode is used, timer ends the game
{
  const r = new Room({}, {}); r.claimed = true; r.code = 'TIMER';
  const x = mk('x'), y = mk('y');
  r.onMsg(x, JSON.stringify({ t: 'hello', pid: 'px', name: 'X', game: 'ludo', mode: 'timer', fr: 'fr3' }));
  r.onMsg(y, JSON.stringify({ t: 'hello', pid: 'py', name: 'Y', fr: 'bad' }));
  check(x.got.some(m => m.t === 'lobby' && m.players.length === 2 && m.players[0].fr === 'fr3' && m.players[1].fr === 'fr0'), 'frames in lobby');
  r.onMsg(x, JSON.stringify({ t: 'start' }));
  check(r.s.mode === 'timer' && r.s.endsAt, 'timer game started');
  r.s.endsAt = Date.now() + 50; r.armClock();
  await new Promise(res => setTimeout(res, 150));
  check(r.s.over && r.s.reason === 'time' && x.got.some(m => m.t === 'passed' && m.reason === 'time'), 'time up ends online game');
  r.clearTurn(); clearTimeout(r.botTimer);
}
console.log(ok ? 'server ok' : 'server FAILED'); process.exit(ok ? 0 : 1);

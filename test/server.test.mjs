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
  const r2 = new Room({}, {}); r2.claimed = true; r2.code = 'LEAVE';
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
  r2.onClose(y);
  check(!r2.players.find(p => p.pid === 'py').left && !r2.players.find(p => p.pid === 'py').connected, 'network drop is waiting, not left');
  r2.onMsg(z, JSON.stringify({ t: 'leave' }));
  check(r2.s.over, 'last player standing ends the game');
  r2.clearTurn();
}
console.log(ok ? 'server ok' : 'server FAILED'); process.exit(ok ? 0 : 1);

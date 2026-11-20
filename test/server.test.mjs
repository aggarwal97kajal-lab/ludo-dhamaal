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
console.log(ok ? 'server ok' : 'server FAILED'); process.exit(ok ? 0 : 1);

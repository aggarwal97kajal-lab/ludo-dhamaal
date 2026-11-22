// Friends hub: codes, adding, online, invites, weekly wins.
import { Hub, codeOf, weekId } from '../server/src/hub.js';
const store = new Map();
const hub = new Hub({ storage: { get: async k => store.get(k), put: async (k, v) => { store.set(k, v); } } });
let ok = true; const check = (c, m) => { if (!c) { ok = false; console.error('FAIL', m); } };
const call = async (path, body) => (await hub.fetch(new Request('https://hub/hub/' + path, { method: 'POST', body: JSON.stringify(body) }))).json();
const A = 'a'.repeat(20), B = 'b'.repeat(20);
const a = await call('hello', { key: A, name: 'Suraj', look: 1 });
const b = await call('hello', { key: B, name: 'Shivu', look: 0, room: { code: 'ABCDE', game: 'ludo', open: true } });
check(a.me.code === await codeOf(A) && a.me.code.length === 6, 'friend code');
check((await call('add', { key: A, code: 'ZZZZZZ' })).error, 'unknown code');
check((await call('add', { key: A, code: a.me.code })).error, 'own code');
check((await call('add', { key: A, code: b.me.code })).ok, 'add friend');
const a2 = await call('hello', { key: A, name: 'Suraj' });
check(a2.friends.length === 1 && a2.friends[0].online && a2.friends[0].room.code === 'ABCDE', 'friend online in a room');
const b2 = await call('hello', { key: B, name: 'Shivu' });
check(b2.friends.length === 1 && b2.friends[0].name === 'Suraj', 'friendship goes both ways');
await call('invite', { key: A, to: b.me.code, room: 'QWERT', game: 'carrom' });
const b3 = await call('hello', { key: B, name: 'Shivu' });
check(b3.inbox.length === 1 && b3.inbox[0].room === 'QWERT' && b3.inbox[0].name === 'Suraj', 'invite arrives');
check((await call('hello', { key: B, name: 'Shivu' })).inbox.length === 0, 'invite delivered once');
await call('result', { key: A, won: true }); await call('result', { key: A, won: false });
const b4 = await call('hello', { key: B, name: 'Shivu' });
check(b4.friends[0].w === 1 && b4.friends[0].p === 2, 'weekly wins');
check(weekId(Date.UTC(2026, 10, 23, 0, 0)) === weekId(Date.UTC(2026, 10, 29, 18, 0)) && weekId(Date.UTC(2026, 10, 22, 18, 0)) !== weekId(Date.UTC(2026, 10, 23, 0, 0)), 'week starts Monday (India)');
check((await call('hello', { key: 'short' })).error, 'bad key');

// Tournament: 4 friends, semis then final
{
  const K = ['c', 'd'].map(x => x.repeat(20));
  const codes = [];
  for (const k of K) { const r = await call('hello', { key: k, name: 'P' + k[0] }); codes.push(r.me.code); await call('add', { key: A, code: r.me.code }); }
  check((await call('tour/new', { key: A, game: 'chess', players: [b.me.code, codes[0]] })).error, 'need 4 or 8');
  const t = (await call('tour/new', { key: A, game: 'chess', players: [b.me.code, codes[0], codes[1]] })).tour;
  check(t && t.rounds[0].length === 2, 'two semi-finals');
  const inb = await call('hello', { key: B, name: 'Shivu' });
  check(inb.tours.length === 1 && inb.inbox.some(x => x.tour === t.id), 'players get the tournament');
  const keyOf = c => [A, B, ...K].find(k => [a.me.code, b.me.code, ...codes][[A, B, ...K].indexOf(k)] === c);
  for (const m of t.rounds[0]) await call('tour/result', { key: keyOf(m.a), id: t.id, winner: m.a });
  const t2 = (await call('tour/result', { key: A, id: t.id, winner: 'nobody' })).tour;
  check(t2.rounds.length === 2 && t2.rounds[1][0].a === t.rounds[0][0].a, 'final made from winners');
  const f = t2.rounds[1][0];
  const t3 = (await call('tour/result', { key: keyOf(f.b), id: t.id, winner: f.b })).tour;
  check(t3.champ === f.b, 'champion');
}
console.log(ok ? 'hub ok' : 'hub FAILED'); process.exit(ok ? 0 : 1);

// Pitara online server (Ludo, Chess, Snakes & Ladders): one Durable Object per room.
import { newGame, roll, move, passTurn, movableTokens, seatColors, playerOf, markLeft } from '../../app/src/main/assets/www/js/rules.js';
import { newChess, chessMove, chessTimeout, chessLeft, chessPlayer } from '../../app/src/main/assets/www/js/chessrules.js';
import { newSnakes, snakeRoll, snakePass } from '../../app/src/main/assets/www/js/snakes.js';

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TURN_MS = 15000;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, app: 'pitara', games: ['ludo', 'chess', 'snakes'], v: 3 });
    if (url.pathname === '/turn') return turn(env);
    if (url.pathname === '/new' && req.method === 'POST') {
      for (let i = 0; i < 6; i++) {
        const code = randomCode();
        const stub = env.ROOMS.get(env.ROOMS.idFromName(code));
        const r = await stub.fetch('https://room/claim', { method: 'POST' });
        if (r.ok) return json({ code });
      }
      return json({ error: 'busy' }, 503);
    }
    const m = url.pathname.match(/^\/room\/([A-Z0-9]{5})$/);
    if (m) {
      if (req.headers.get('Upgrade') !== 'websocket') return json({ error: 'websocket only' }, 426);
      const stub = env.ROOMS.get(env.ROOMS.idFromName(m[1]));
      return stub.fetch(new Request('https://room/ws?code=' + m[1], req));
    }
    return json({ error: 'not found' }, 404);
  }
};

// Voice relay servers from Cloudflare Realtime TURN, if the keys are set on this Worker.
async function turn(env) {
  if (!env.TURN_KEY_ID || !env.TURN_KEY_API_TOKEN) return json({ iceServers: [] });
  try {
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 86400 })
    });
    if (!r.ok) return json({ iceServers: [] });
    const j = await r.json();
    const list = Array.isArray(j.iceServers) ? j.iceServers : (j.iceServers ? [j.iceServers] : []);
    const clean = list.map(x => ({ ...x, urls: [].concat(x.urls || []).filter(u => !/:53(\?|$)/.test(u)) })).filter(x => x.urls.length);
    return json({ iceServers: clean, relay: clean.some(x => x.urls.some(u => u.startsWith('turn'))) });
  } catch (e) { return json({ iceServers: [] }); }
}

function json(o, status) { return new Response(JSON.stringify(o), { status: status || 200, headers: { 'content-type': 'application/json', ...CORS } }); }
function randomCode() { const b = new Uint8Array(5); crypto.getRandomValues(b); return Array.from(b, x => CHARS[x % CHARS.length]).join(''); }
function rollDie() { const b = new Uint8Array(1); do { crypto.getRandomValues(b); } while (b[0] >= 252); return (b[0] % 6) + 1; }
const clean = s => String(s || '').replace(/[<>]/g, '').trim().slice(0, 14) || 'Player';

export class Room {
  constructor(state, env) {
    this.state = state; this.env = env;
    this.sockets = new Map();   // ws -> pid
    this.players = [];          // { pid, name, look, connected, mic }
    this.host = null;
    this.s = null;              // game state
    this.claimed = false;
    this.code = null;
    this.moves = [];
    this.turnTimer = null; this.turnEnds = null;
    this.emptyTimer = null;
    this.chat = [];
    this.game = 'ludo';
    this.turnStart = 0;
    // The room is saved, so a server restart (for example after an update) does not lose the game.
    if (state && state.storage && state.blockConcurrencyWhile) state.blockConcurrencyWhile(() => this.restore());
  }

  async restore() {
    try {
      const r = await this.state.storage.get('room');
      if (!r) return;
      Object.assign(this, { players: r.players || [], host: r.host, s: r.s, claimed: r.claimed, code: r.code, moves: r.moves || [], chat: r.chat || [], game: r.game || 'ludo', chessRound: r.chessRound || 0 });
      this.players.forEach(p => { p.connected = false; });
      if (this.s && !this.s.over) { if (this.s.game === 'chess') this.armChess(); else this.armTurn(); }
      this.armEmpty();
    } catch (e) { /* start fresh */ }
  }
  save() {
    if (!this.state || !this.state.storage) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const snap = { players: this.players.map(p => ({ pid: p.pid, name: p.name, look: p.look, tint: p.tint, left: !!p.left, mic: false })), host: this.host, s: this.s, claimed: this.claimed, code: this.code, moves: this.moves, chat: this.chat.slice(-30), game: this.game, chessRound: this.chessRound || 0 };
      this.state.storage.put('room', snap).catch(() => {});
    }, 200);
  }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === '/claim') {
      if (this.claimed || this.players.length) return new Response('taken', { status: 409 });
      this.claimed = true;
      this.armEmpty();
      return new Response('ok');
    }
    if (url.pathname === '/ws') {
      this.code = url.searchParams.get('code');
      const pair = new WebSocketPair();
      const ws = pair[1];
      ws.accept();
      ws.addEventListener('message', e => this.onMsg(ws, e.data));
      ws.addEventListener('close', () => this.onClose(ws));
      ws.addEventListener('error', () => this.onClose(ws));
      return new Response(null, { status: 101, webSocket: pair[0] });
    }
    return new Response('not found', { status: 404 });
  }

  send(ws, m) { try { ws.send(JSON.stringify(m)); } catch (e) { /* closed */ } }
  all(m) { const t = JSON.stringify(m); for (const ws of this.sockets.keys()) { try { ws.send(t); } catch (e) { /* closed */ } } if (m.t !== 'chat' && m.t !== 'rtc') this.save(); }
  wsOf(pid) { for (const [ws, p] of this.sockets) if (p === pid) return ws; return null; }

  lobby() {
    this.all({ t: 'lobby', code: this.code, game: this.game, host: this.host, players: this.players.map(p => ({ pid: p.pid, name: p.name, look: p.look, connected: p.connected, left: !!p.left, mic: p.mic, host: p.pid === this.host })) });
  }

  onMsg(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (typeof m !== 'object' || !m) return;
    const me = this.sockets.get(ws);
    if (m.t === 'hello') return this.hello(ws, m);
    if (!me) return;
    const p = this.players.find(x => x.pid === me);
    switch (m.t) {
      case 'ping': this.send(ws, { t: 'pong' }); break;
      case 'mic': p.mic = !!m.on; this.lobby(); break;
      case 'start': this.start(me); break;
      case 'roll': if (this.s && this.s.game === 'snakes') this.doSnakeRoll(me); else this.doRoll(me); break;
      case 'move': this.doMove(me, m.token); break;
      case 'cmove': this.doChessMove(ws, me, m); break;
      case 'chat': {
        const text = String(m.text || '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (!text) break;
        const now = Date.now();
        if (p.lastChat && now - p.lastChat < 400) break;
        p.lastChat = now;
        const msg = { t: 'chat', from: me, name: p.name, text, at: now };
        this.chat.push(msg); if (this.chat.length > 50) this.chat.shift();
        this.all(msg); break;
      }
      case 'rtc': { const to = this.wsOf(m.to); if (to && m.data && JSON.stringify(m.data).length < 20000) this.send(to, { t: 'rtc', from: me, data: m.data }); break; }
      case 'again': if (me === this.host && this.s && this.s.over) { this.s = null; this.clearTurn(); this.players = this.players.filter(x => x.connected); this.all({ t: 'lobbyAgain' }); this.lobby(); } break;
      case 'leave': this.leave(ws, me); break;
    }
  }

  hello(ws, m) {
    const pid = String(m.pid || '').slice(0, 40);
    if (!pid) return this.send(ws, { t: 'err', msg: 'Bad request', fatal: true });
    let p = this.players.find(x => x.pid === pid);
    if (!p) {
      if (this.s) return this.send(ws, { t: 'err', msg: 'This game has already started.', fatal: true });
      if (!this.claimed && !this.players.length) return this.send(ws, { t: 'err', msg: 'Room not found. Check the code.', fatal: true });
      // The person who creates the room picks the game. Everyone who joins plays that game.
      if (!this.players.length) this.game = ['chess', 'snakes'].includes(m.game) ? m.game : 'ludo';
      const max = this.game === 'chess' ? 2 : 4;
      if (this.players.length >= max) return this.send(ws, { t: 'err', msg: `This room is full (${max} players).`, fatal: true });
      p = { pid, name: clean(m.name), look: Number(m.look) >= 0 && Number(m.look) < 8 ? Number(m.look) : 0, tint: Number(m.tint) >= 0 && Number(m.tint) < 4 ? Number(m.tint) : 0, connected: true, mic: false };
      this.players.push(p);
      if (!this.host) this.host = pid;
    } else {
      if (p.left) return this.send(ws, { t: 'err', msg: 'You left this game.', fatal: true });
      const old = this.wsOf(pid); if (old && old !== ws) { this.sockets.delete(old); try { old.close(); } catch (e) { /* ignore */ } }
      p.connected = true; p.name = clean(m.name) || p.name;
    }
    this.sockets.set(ws, pid);
    if (this.emptyTimer) { clearTimeout(this.emptyTimer); this.emptyTimer = null; }
    this.lobby();
    this.send(ws, { t: 'chatlog', list: this.chat });
    if (this.s && this.s.game === 'chess') this.send(ws, { t: 'sync', s: this.s, left: this.chessLeftMs() });
    else if (this.s) this.send(ws, { t: 'sync', s: this.s, moves: this.s.rolled ? this.moves : [], turnEnds: this.turnEnds });
  }

  leave(ws, pid) {
    this.sockets.delete(ws);
    if (!this.s) this.players = this.players.filter(x => x.pid !== pid);
    else {
      const p = this.players.find(x => x.pid === pid);
      if (p) { p.connected = false; p.left = true; }
      const gp = this.s.players.find(x => x.id === pid);
      if (gp && !this.s.over && this.s.game === 'chess') {
        chessLeft(this.s, gp.color); this.clearTurn();
        this.all({ t: 'cend', s: this.s });
      } else if (gp && !this.s.over) {
        const wasTurn = this.s.turn === gp.color;
        markLeft(this.s, gp.color);
        if (this.s.over) { this.clearTurn(); this.all({ t: 'passed', s: this.s, reason: 'left', turnEnds: null }); }
        else if (wasTurn) { this.moves = []; this.armTurn(); this.all({ t: 'passed', s: this.s, reason: 'left', turnEnds: this.turnEnds }); }
        else this.all({ t: 'passed', s: this.s, reason: 'left-other', turnEnds: this.turnEnds });
      }
    }
    // The next person who joined after the host becomes the host.
    if (this.host === pid) { const n = this.players.find(x => x.connected && !x.left); this.host = n ? n.pid : null; }
    try { ws.close(); } catch (e) { /* ignore */ }
    this.lobby(); this.armEmpty();
  }

  onClose(ws) {
    const pid = this.sockets.get(ws); if (!pid) return;
    this.sockets.delete(ws);
    if (this.wsOf(pid)) return;
    // Phones often reconnect within a second or two (Wi-Fi <-> mobile data). Only show
    // "Waiting for network" to the others if they are still away after 3 seconds.
    setTimeout(() => { if (!this.wsOf(pid)) this.markAway(pid); }, 3000);
    this.armEmpty();
  }

  markAway(pid) {
    const p = this.players.find(x => x.pid === pid);
    if (!p || !p.connected) return;
    p.connected = false;
    if (!this.s && p) {
      // In the lobby, drop people who left after a short grace time.
      setTimeout(() => { const q = this.players.find(x => x.pid === pid); if (q && !q.connected && !this.s) { this.players = this.players.filter(x => x.pid !== pid); if (this.host === pid) { const n = this.players.find(x => x.connected); this.host = n ? n.pid : null; } this.lobby(); } }, 15000);
    }
    if (this.host === pid) { const n = this.players.find(x => x.connected && !x.left); if (n) this.host = n.pid; }
    this.lobby();
  }

  armEmpty() {
    if (this.sockets.size || this.emptyTimer) return;
    this.emptyTimer = setTimeout(() => { if (!this.sockets.size) { this.players = []; this.s = null; this.host = null; this.claimed = false; this.chat = []; this.clearTurn(); } }, 10 * 60 * 1000);
  }

  start(pid) {
    if (pid !== this.host || this.s) return;
    const ready = this.players.filter(p => p.connected);
    if (ready.length < 2) return;
    this.players = ready;
    if (this.game === 'chess') {
      // The host plays White in the first game; sides swap in every new game.
      this.chessRound = (this.chessRound || 0) + 1;
      const two = ready.slice(0, 2); if (this.chessRound % 2 === 0) two.reverse();
      this.s = newChess(two.map(p => ({ id: p.pid, name: p.name, kind: 'remote', look: p.look, tint: p.tint })));
      this.armChess();
      this.all({ t: 'start', s: this.s, left: this.chessLeftMs() });
      this.lobby();
      return;
    }
    const cols = seatColors(ready.length);
    const list = ready.map((p, i) => ({ id: p.pid, name: p.name, color: cols[i], kind: 'remote', look: p.look }));
    this.s = this.game === 'snakes' ? newSnakes(list) : newGame(list);
    this.moves = [];
    this.armTurn();
    this.all({ t: 'start', s: this.s, turnEnds: this.turnEnds });
    this.lobby();
    this.checkAway();
  }

  current() { return this.s ? playerOf(this.s, this.s.turn) : null; }

  // ---------- Chess ----------
  // Each side has its own clock. Only the clock of the player to move runs.
  chessLeftMs() { const s = this.s; if (!s || s.over) return null; return Math.max(0, s.clock[s.turn] - (Date.now() - this.turnStart)); }
  armChess() {
    this.clearTurn();
    const s = this.s; if (!s || s.over) return;
    this.turnStart = Date.now();
    const seq = s.seq, left = s.clock[s.turn];
    this.turnEnds = this.turnStart + left;
    this.turnTimer = setTimeout(() => {
      if (this.s === s && s.seq === seq && !s.over) { chessTimeout(s, s.turn); this.clearTurn(); this.all({ t: 'cend', s }); }
    }, left + 300);
  }
  doChessMove(ws, pid, m) {
    const s = this.s; if (!s || s.game !== 'chess' || s.over) return;
    const p = chessPlayer(s, s.turn);
    if (!p || p.id !== pid) return;
    if (m.seq != null && Number(m.seq) !== s.seq) return this.send(ws, { t: 'sync', s, left: this.chessLeftMs() });
    const r = chessMove(s, { from: m.from, to: m.to, promotion: m.promotion }, Date.now() - this.turnStart);
    if (!r) return this.send(ws, { t: 'sync', s, left: this.chessLeftMs() });
    if (s.over) this.clearTurn(); else this.armChess();
    this.all({ t: 'cmoved', mv: r, s, left: this.chessLeftMs() });
  }

  clearTurn() { if (this.turnTimer) clearTimeout(this.turnTimer); this.turnTimer = null; this.turnEnds = null; }

  armTurn() {
    this.clearTurn();
    if (!this.s || this.s.over) return;
    this.turnEnds = Date.now() + TURN_MS;
    const seq = this.s.seq;
    this.turnTimer = setTimeout(() => { if (this.s && this.s.seq === seq && !this.s.over) this.skip('timeout'); }, TURN_MS);
  }

  skip(reason) {
    if (this.s.game === 'snakes') snakePass(this.s); else passTurn(this.s);
    this.moves = [];
    this.armTurn();
    this.all({ t: 'passed', s: this.s, reason, turnEnds: this.turnEnds });
    this.checkAway();
  }

  // Someone with a network problem keeps their turn until the 15 second timer runs out.
  checkAway() {}

  doSnakeRoll(pid) {
    const s = this.s; if (!s || s.game !== 'snakes' || s.over) return;
    if (this.current().id !== pid) return;
    if (this.lastRollAt && Date.now() - this.lastRollAt < 1200) return; // one roll at a time
    this.lastRollAt = Date.now();
    const ev = snakeRoll(s, rollDie());
    if (!ev) return;
    if (s.over) this.clearTurn(); else this.armTurn();
    // Clients need about 1s for the dice plus walking time, so the timer starts after that.
    if (!s.over) { const extra = 1200 + Math.abs(ev.to - ev.from) * 330 + (ev.via ? 1500 : 0); this.clearTurn(); this.turnEnds = Date.now() + TURN_MS + extra; const seq = s.seq; this.turnTimer = setTimeout(() => { if (this.s && this.s.seq === seq && !this.s.over) this.skip('timeout'); }, TURN_MS + extra); }
    this.all({ t: 'srolled', ev, s, turnEnds: this.turnEnds });
  }

  doRoll(pid) {
    const s = this.s; if (!s || s.game !== 'ludo' && s.game !== undefined || s.over || s.rolled) return;
    if (this.current().id !== pid) return;
    const d = rollDie();
    const r = roll(s, d);
    if (!r) return;
    this.moves = r.moves;
    this.armTurn();
    this.all({ t: 'rolled', dice: d, moves: r.moves, forfeit: r.forfeit, s, turnEnds: this.turnEnds });
    if (r.forfeit || !r.moves.length) {
      const seq = s.seq;
      setTimeout(() => { if (this.s && this.s.seq === seq) this.skip(r.forfeit ? 'forfeit' : 'nomove'); }, 1900);
    }
  }

  doMove(pid, token) {
    const s = this.s; if (!s || s.game === 'chess' || s.game === 'snakes' || s.over || !s.rolled) return;
    if (this.current().id !== pid) return;
    const t = Number(token);
    if (!movableTokens(s, s.turn, s.dice).includes(t)) return;
    const ev = move(s, t);
    if (!ev) return;
    this.moves = [];
    if (s.over) this.clearTurn(); else this.armTurn();
    this.all({ t: 'moved', ev, s, turnEnds: this.turnEnds });
    this.checkAway();
  }
}

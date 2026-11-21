// Pitara online server (Ludo, Chess, Snakes & Ladders): one Durable Object per room.
import { newGame, roll, move, passTurn, movableTokens, seatColors, playerOf, markLeft } from '../../app/src/main/assets/www/js/rules.js';
import { newChess, chessMove, chessTimeout, chessLeft, chessPlayer } from '../../app/src/main/assets/www/js/chessrules.js';
import { newSnakes, snakeRoll, snakePass } from '../../app/src/main/assets/www/js/snakes.js';
import { newCarrom, applyShot, carromPass, carromLeft, cleanShot } from '../../app/src/main/assets/www/js/carrom.js';
import { newPatta, playCard, drawCard, passTurn as pattaPass, sayEk, catchEk, timeout as pattaTimeout, pattaLeft, viewFor } from '../../app/src/main/assets/www/js/patta.js';
const PATTA_MS = 20000;
import { makeLevel as arrowLevel, checkRun as arrowRun, HEARTS as ARROW_HEARTS } from '../../app/src/main/assets/www/js/arrows.js';
import { ROUNDS as DRAW_ROUNDS, CHOOSE_MS, DRAW_MS, REVEAL_MS, MAX_PLAYERS as DRAW_MAX, judge, hintOf, guessPoints, DRAWER_POINTS, pickWords } from '../../app/src/main/assets/www/js/draw.js';
import { platformsFor as helixPlatforms } from '../../app/src/main/assets/www/js/helix.js';
import { makePuzzle, checkSolved, LEVELS as SUDOKU_LEVELS, MAX_MISTAKES } from '../../app/src/main/assets/www/js/sudoku.js';
const CARROM_MS = 20000;

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'content-type' };
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const TURN_MS = 15000;
const PKG = 'com.ludodhamaal.app';
// SHA-256 of the key the APK is signed with. Android checks this before opening /r/ links in the app.
const CERTS = ['19:54:8C:92:13:5A:45:FA:EF:DE:E8:FD:B1:17:74:82:0D:07:14:D9:A8:B6:B1:49:9D:6B:97:6B:21:5E:57:6E'];
const APK = 'https://github.com/aggarwal97kajal-lab/ludo-dhamaal/releases/latest/download/Pitara.apk';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    if (url.pathname === '/' || url.pathname === '/health') return json({ ok: true, app: 'pitara', games: ['ludo', 'chess', 'snakes', 'carrom', 'patta', 'sudoku', 'arrows', 'draw', 'helix'], v: 9 });
    if (url.pathname === '/turn') return turn(env);
    if (url.pathname === '/.well-known/assetlinks.json') return json([{ relation: ['delegate_permission/common.handle_all_urls'], target: { namespace: 'android_app', package_name: PKG, sha256_cert_fingerprints: CERTS } }]);
    const link = url.pathname.match(/^\/r\/([A-Za-z0-9]{5})\/?$/);
    if (link) return invitePage(link[1].toUpperCase());
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
    // Profile photos: kept only in memory while the room is open, never saved.
    this.photos = new Map();    // pid -> data:image/jpeg;base64,...
    // The room is saved, so a server restart (for example after an update) does not lose the game.
    if (state && state.storage && state.blockConcurrencyWhile) state.blockConcurrencyWhile(() => this.restore());
  }

  async restore() {
    try {
      const r = await this.state.storage.get('room');
      if (!r) return;
      Object.assign(this, { players: r.players || [], host: r.host, s: r.s, claimed: r.claimed, code: r.code, moves: r.moves || [], chat: r.chat || [], game: r.game || 'ludo', mode: r.mode || 'classic', chessRound: r.chessRound || 0 });
      this.players.forEach(p => { p.connected = false; });
      if (this.s && !this.s.over && !['sudoku', 'arrows', 'draw', 'helix'].includes(this.s.game)) { if (this.s.game === 'chess') this.armChess(); else this.armTurn(); }
      this.carromRound = r.carromRound || 0;
      if (this.s && this.s.game === 'draw' && !this.s.over) { this.dops = []; setTimeout(() => { if (this.s && this.s.game === 'draw' && !this.s.over) { this.s.phase = 'choose'; this.dReveal('restart'); } }, 2000); }
      this.armEmpty();
    } catch (e) { /* start fresh */ }
  }
  save() {
    if (!this.state || !this.state.storage) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const snap = { players: this.players.map(p => ({ pid: p.pid, name: p.name, look: p.look, tint: p.tint, left: !!p.left, mic: false })), host: this.host, s: this.s, claimed: this.claimed, code: this.code, moves: this.moves, chat: this.chat.slice(-30), game: this.game, mode: this.mode || 'classic', chessRound: this.chessRound || 0, carromRound: this.carromRound || 0 };
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
    this.all({ t: 'lobby', code: this.code, game: this.game, mode: this.mode || 'classic', host: this.host, players: this.players.map(p => ({ pid: p.pid, name: p.name, look: p.look, connected: p.connected, left: !!p.left, mic: p.mic, host: p.pid === this.host })) });
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
      case 'rshot': this.doCarromShot(ws, me, m); break;
      case 'sprog': case 'sdone': this.doSudoku(me, m); break;
      case 'aprog': case 'adone': this.doArrows(me, m); break;
      case 'hprog': case 'hdone': this.doHelix(me, m); break;
      case 'dpick': this.dPick(me, Number(m.i)); break;
      case 'dop': this.dOp(me, m.op); break;
      case 'dguess': this.dGuess(me, m.text); break;
      case 'pplay': case 'pdraw': case 'ppass': case 'pek': case 'pcatch': this.doPatta(ws, me, m); break;
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
      case 'again': if (me === this.host && this.s && this.s.over) { this.s = null; this.clearTurn(); this.dClear(); this.players = this.players.filter(x => x.connected); this.all({ t: 'lobbyAgain' }); this.lobby(); } break;
      case 'photo': {
        const img = typeof m.img === 'string' ? m.img : '';
        if (img && !(img.startsWith('data:image/jpeg;base64,') || img.startsWith('data:image/webp;base64,')) ) break;
        if (img.length > 60000) break;
        if (img) this.photos.set(me, img); else this.photos.delete(me);
        const t = JSON.stringify({ t: 'photo', pid: me, img });
        for (const [w, who] of this.sockets) if (who !== me) { try { w.send(t); } catch (e) { /* closed */ } }
        break;
      }
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
      if (!this.players.length) { this.game = ['chess', 'snakes', 'carrom', 'patta', 'sudoku', 'arrows', 'draw', 'helix'].includes(m.game) ? m.game : 'ludo'; this.mode = this.game === 'arrows' || this.game === 'helix' ? 'race' : this.game === 'sudoku' ? (SUDOKU_LEVELS.includes(m.mode) ? m.mode : 'medium') : ['classic', 'free', 'disc'].includes(m.mode) ? m.mode : 'classic'; }
      const max = this.game === 'chess' || this.game === 'carrom' ? 2 : this.game === 'draw' ? DRAW_MAX : 4;
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
    for (const [who, img] of this.photos) if (who !== pid) this.send(ws, { t: 'photo', pid: who, img });
    if (this.s && this.s.game === 'chess') this.send(ws, { t: 'sync', s: this.s, left: this.chessLeftMs() });
    else if (this.s && this.s.game === 'carrom') this.send(ws, { t: 'sync', s: this.s, turnEnds: this.turnEnds });
    else if (this.s && (this.s.game === 'sudoku' || this.s.game === 'arrows' || this.s.game === 'helix')) this.send(ws, { t: 'sync', s: this.s });
    else if (this.s && this.s.game === 'draw') this.send(ws, { t: 'sync', s: this.dView(pid), ops: this.dops || [] });
    else if (this.s && this.s.game === 'patta') this.send(ws, { t: 'sync', s: viewFor(this.s, this.s.players.findIndex(x => x.id === pid)), turnEnds: this.turnEnds });
    else if (this.s) this.send(ws, { t: 'sync', s: this.s, moves: this.s.rolled ? this.moves : [], turnEnds: this.turnEnds });
  }

  leave(ws, pid) {
    this.sockets.delete(ws);
    this.photos.delete(pid);
    if (!this.s) this.players = this.players.filter(x => x.pid !== pid);
    else {
      const p = this.players.find(x => x.pid === pid);
      if (p) { p.connected = false; p.left = true; }
      const gp = this.s.players.find(x => x.id === pid);
      const ci = this.s.game === 'carrom' ? this.s.players.findIndex(x => x.id === pid) : -1;
      const pi = this.s.game === 'patta' ? this.s.players.findIndex(x => x.id === pid) : -1;
      if (this.s.game === 'draw' && !this.s.over) {
        const k = this.s.players.findIndex(x => x.id === pid);
        if (k >= 0) {
          this.s.players[k].left = true;
          if (this.dLive().length < 2) this.dEnd('left');
          else if (k === this.s.drawer && this.s.phase !== 'reveal') this.dReveal('left');
          else this.dAll({ t: 'dstate' });
        }
      } else if ((this.s.game === 'sudoku' || this.s.game === 'arrows' || this.s.game === 'helix') && !this.s.over) {
        const q = this.s.players.find(x => x.id === pid), k = { sudoku: 's', arrows: 'a', helix: 'h' }[this.s.game];
        if (q) { q.left = true; this.sudokuCheckEnd(); this.s.seq++; this.all({ t: k + (this.s.over ? 'end' : 'prog'), s: this.s }); }
      } else if (pi >= 0 && !this.s.over) {
        const wasTurn = this.s.turn === pi;
        pattaLeft(this.s, pi);
        if (this.s.over) this.clearTurn(); else if (wasTurn) this.armTurn(PATTA_MS);
        this.pAll({ t: 'pev', ev: { t: 'left', who: pi }, turnEnds: this.turnEnds });
      } else if (ci >= 0 && !this.s.over) {
        carromLeft(this.s, ci); this.clearTurn();
        this.all({ t: 'rend', s: this.s });
      } else if (gp && !this.s.over && this.s.game === 'chess') {
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
    if (this.game === 'carrom') {
      // The host plays white (bottom) in the first game; sides swap in every new game.
      this.carromRound = (this.carromRound || 0) + 1;
      const two = ready.slice(0, 2); if (this.carromRound % 2 === 0) two.reverse();
      this.s = newCarrom(two.map(p => ({ id: p.pid, name: p.name, kind: 'remote', look: p.look, tint: p.tint })), this.mode);
      this.armTurn(CARROM_MS);
      this.all({ t: 'start', s: this.s, turnEnds: this.turnEnds });
      this.lobby();
      return;
    }
    if (this.game === 'draw') {
      this.s = { game: 'draw', players: ready.map(q => ({ id: q.pid, name: q.name, look: q.look, tint: q.tint, score: 0, guessed: false, gain: 0, left: false })),
        rounds: DRAW_ROUNDS, turn: 0, round: 1, drawer: 0, phase: 'choose', word: null, choices: null, hint: [], endsAt: null, used: [], seq: 0, over: false, winner: null, reason: '' };
      this.dops = [];
      this.clearTurn();
      this.dTurn('start');
      this.lobby();
      return;
    }
    if (this.game === 'helix') {
      const b = new Uint32Array(1); crypto.getRandomValues(b);
      const seed = 1 + b[0] % 100000, level = 6 + b[0] % 6;
      this.s = { game: 'helix', level, seed, total: helixPlatforms(level), over: false, winner: null, reason: '', seq: 0,
        players: ready.map(q => ({ id: q.pid, name: q.name, look: q.look, tint: q.tint, filled: 0, mistakes: 0, falls: 0, out: false, left: false })) };
      this.clearTurn(); this.all({ t: 'start', s: this.s }); this.lobby();
      return;
    }
    if (this.game === 'arrows') {
      // A race on the same level: a mid-size picture.
      const b = new Uint32Array(1); crypto.getRandomValues(b);
      const seed = 1 + b[0] % 100000, level = 13 + b[0] % 7, L = arrowLevel(level, seed);
      this.s = { game: 'arrows', level, seed, total: L.arrows.length, over: false, winner: null, reason: '', seq: 0, startAt: Date.now(),
        players: ready.map(q => ({ id: q.pid, name: q.name, look: q.look, tint: q.tint, filled: 0, mistakes: 0, out: false, left: false })) };
      this.clearTurn();
      this.all({ t: 'start', s: this.s });
      this.lobby();
      return;
    }
    if (this.game === 'sudoku') {
      // Everyone races on the same puzzle.
      const b = new Uint32Array(1); crypto.getRandomValues(b);
      const seed = b[0] % 1000000, level = this.mode || 'medium', p = makePuzzle(seed, level);
      this.s = { game: 'sudoku', seed, level, total: p.puzzle.filter(v => !v).length, over: false, winner: null, reason: '', seq: 0, startAt: Date.now(),
        players: ready.map(q => ({ id: q.pid, name: q.name, look: q.look, tint: q.tint, filled: 0, mistakes: 0, out: false, left: false, time: null })) };
      this.clearTurn();
      this.all({ t: 'start', s: this.s });
      this.lobby();
      return;
    }
    if (this.game === 'patta') {
      // Who starts moves round the table in every new game.
      this.pattaRound = (this.pattaRound || 0) + 1;
      const k = (this.pattaRound - 1) % ready.length, order = ready.slice(k).concat(ready.slice(0, k));
      this.s = newPatta(order.map(p => ({ id: p.pid, name: p.name, kind: 'remote', look: p.look, tint: p.tint })));
      this.armTurn(PATTA_MS);
      this.pAll({ t: 'start', turnEnds: this.turnEnds });
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

  // ---------- Draw & Guess ----------
  // The word is secret: only the drawer (and people who guessed it) see it until the reveal.
  dView(pid) {
    const s = this.s, i = s.players.findIndex(p => p.id === pid), me = s.players[i];
    const see = s.phase === 'reveal' || s.phase === 'over' || i === s.drawer || (me && me.guessed);
    return Object.assign({}, s, { word: see ? s.word : null, choices: i === s.drawer && s.phase === 'choose' ? s.choices : null, used: undefined, left: s.endsAt ? Math.max(0, s.endsAt - Date.now()) : null });
  }
  dAll(m) { for (const [ws, pid] of this.sockets) this.send(ws, Object.assign({}, m, { s: this.dView(pid) })); this.save(); }
  dClear() { (this.dTimers || []).forEach(t => clearTimeout(t)); this.dTimers = []; }
  dLater(ms, f) { const s = this.s; this.dTimers = this.dTimers || []; this.dTimers.push(setTimeout(() => { if (this.s === s && !s.over) f(); }, ms)); }
  dLive() { return this.s.players.filter(p => !p.left); }
  // Next person draws. Everyone draws once in each round.
  dTurn(why) {
    const s = this.s; this.dClear();
    if (this.dLive().length < 2) return this.dEnd('left');
    const n = s.players.length;
    while (s.turn < s.rounds * n && s.players[s.turn % n].left) s.turn++;
    if (s.turn >= s.rounds * n) return this.dEnd('done');
    s.drawer = s.turn % n; s.round = Math.floor(s.turn / n) + 1;
    s.phase = 'choose'; s.word = null; s.hint = []; s.shown = [];
    s.choices = pickWords(Math.random, 3, s.used);
    s.players.forEach(p => { p.guessed = false; p.gain = 0; });
    s.endsAt = Date.now() + CHOOSE_MS; s.seq++;
    this.dops = [];
    this.dLater(CHOOSE_MS, () => this.dPick(s.players[s.drawer].id, 0));
    this.dAll({ t: 'dturn', why });
  }
  dPick(pid, k) {
    const s = this.s; if (!s || s.game !== 'draw' || s.phase !== 'choose' || s.players[s.drawer].id !== pid) return;
    this.dClear();
    s.word = s.choices[k >= 0 && k < 3 ? k : 0]; s.used.push(s.word); s.choices = null;
    s.phase = 'draw'; s.shown = []; s.hint = hintOf(s.word, []); s.endsAt = Date.now() + DRAW_MS; s.seq++;
    // Show a letter at half time and another at three quarters (longer words only).
    const letters = [...s.word].map((c, i) => (c === ' ' ? -1 : i)).filter(i => i >= 0);
    const reveal = () => { const left = letters.filter(i => !s.shown.includes(i)); if (left.length <= 2) return; s.shown.push(left[Math.floor(Math.random() * left.length)]); s.hint = hintOf(s.word, s.shown); s.seq++; this.dAll({ t: 'dhint' }); };
    if (letters.length >= 4) { this.dLater(DRAW_MS * 0.5, reveal); if (letters.length >= 6) this.dLater(DRAW_MS * 0.75, reveal); }
    this.dLater(DRAW_MS, () => this.dReveal('time'));
    this.dAll({ t: 'dturn', why: 'picked' });
  }
  dReveal(why) {
    const s = this.s; if (!s || s.phase === 'reveal' || s.over) return;
    this.dClear();
    s.phase = 'reveal'; s.endsAt = Date.now() + REVEAL_MS; s.seq++;
    if (!s.word && s.choices) s.word = s.choices[0];
    this.dAll({ t: 'dturn', why });
    this.dLater(REVEAL_MS, () => { s.turn++; this.dTurn('next'); });
  }
  dEnd(why) {
    const s = this.s; this.dClear();
    s.over = true; s.phase = 'over'; s.reason = why; s.seq++;
    const live = s.players.filter(p => !p.left), best = (live.length ? live : s.players).slice().sort((a, b) => b.score - a.score)[0];
    s.winner = best ? best.id : null;
    this.dAll({ t: 'dend' });
  }
  dOp(pid, op) {
    const s = this.s; if (!s || s.game !== 'draw' || s.phase !== 'draw' || s.players[s.drawer].id !== pid || !op || typeof op !== 'object') return;
    let clean = null;
    const num = (v, lo, hi) => Math.max(lo, Math.min(hi, Math.round(Number(v) || 0)));
    const col = c => (/^#[0-9a-fA-F]{6}$/.test(String(c)) ? String(c) : '#1d1d1d');
    if (op.t === 's' && Array.isArray(op.pts)) {
      const pts = op.pts.slice(0, 300).map(p => [num(p[0], 0, 1000), num(p[1], 0, 1000)]);
      clean = { t: 's', id: num(op.id, 0, 1e9), c: col(op.c), w: num(op.w, 1, 80), pts };
      const old = this.dops.find(o => o.t === 's' && o.id === clean.id);
      if (old) old.pts.push(...pts); else if (this.dops.length < 3000) this.dops.push({ t: 's', id: clean.id, c: clean.c, w: clean.w, pts: pts.slice() });
    } else if (op.t === 'fill') { clean = { t: 'fill', x: num(op.x, 0, 1000), y: num(op.y, 0, 1000), c: col(op.c) }; if (this.dops.length < 3000) this.dops.push(clean); }
    else if (op.t === 'clear') { clean = { t: 'clear' }; this.dops = []; }
    else if (op.t === 'undo') { clean = { t: 'undo' }; this.dops.pop(); }
    if (!clean) return;
    const txt = JSON.stringify({ t: 'dop', op: clean });
    for (const [ws, who] of this.sockets) if (who !== pid) { try { ws.send(txt); } catch (e) { /* closed */ } }
  }
  dGuess(pid, text) {
    const s = this.s; if (!s || s.game !== 'draw' || s.over) return;
    const i = s.players.findIndex(p => p.id === pid), p = s.players[i]; if (!p) return;
    text = String(text || '').replace(/\s+/g, ' ').trim().slice(0, 60); if (!text) return;
    const now = Date.now(); if (p.lastGuess && now - p.lastGuess < 350) return; p.lastGuess = now;
    const toAll = m => { const t = JSON.stringify(m); for (const ws of this.sockets.keys()) { try { ws.send(t); } catch (e) { /* closed */ } } };
    // The drawer and people who already guessed talk only among themselves (so they can't give it away).
    if (s.phase === 'draw' && (i === s.drawer || p.guessed)) {
      const inner = new Set(s.players.filter((q, k) => k === s.drawer || q.guessed).map(q => q.id));
      const t = JSON.stringify({ t: 'dmsg', kind: 'inner', from: pid, name: p.name, text });
      for (const [ws, who] of this.sockets) if (inner.has(who)) { try { ws.send(t); } catch (e) { /* closed */ } }
      return;
    }
    if (s.phase !== 'draw') return toAll({ t: 'dmsg', kind: 'chat', from: pid, name: p.name, text });
    const j = judge(text, s.word);
    if (j === 'right') {
      p.guessed = true; p.gain = guessPoints(s.endsAt - now); p.score += p.gain;
      const d = s.players[s.drawer]; d.score += DRAWER_POINTS; d.gain += DRAWER_POINTS; s.seq++;
      toAll({ t: 'dmsg', kind: 'right', from: pid, name: p.name, gain: p.gain });
      if (s.players.every((q, k) => k === s.drawer || q.left || q.guessed)) this.dReveal('all');
      else this.dAll({ t: 'dstate' });
    } else if (j === 'close') {
      this.send(this.wsOf(pid), { t: 'dmsg', kind: 'close', from: pid, name: p.name, text });
    } else toAll({ t: 'dmsg', kind: 'guess', from: pid, name: p.name, text });
  }

  // ---------- Sudoku race ----------
  doSudoku(pid, m) {
    const s = this.s; if (!s || s.game !== 'sudoku' || s.over) return;
    const p = s.players.find(x => x.id === pid); if (!p || p.out || p.left) return;
    if (m.t === 'sprog') {
      p.filled = Math.max(0, Math.min(s.total, Number(m.filled) || 0));
      p.mistakes = Math.max(p.mistakes, Math.min(MAX_MISTAKES, Number(m.mistakes) || 0));
      if (p.mistakes >= MAX_MISTAKES) p.out = true;
      this.sudokuCheckEnd();
      s.seq++; this.all({ t: s.over ? 'send' : 'sprog', s });
    } else if (m.t === 'sdone') {
      if (!checkSolved(s.seed, s.level, m.grid)) return;
      p.filled = s.total; p.time = Date.now() - s.startAt;
      s.over = true; s.winner = pid; s.reason = 'solved'; s.seq++;
      this.all({ t: 'send', s });
    }
  }
  doArrows(pid, m) {
    const s = this.s; if (!s || s.game !== 'arrows' || s.over) return;
    const p = s.players.find(x => x.id === pid); if (!p || p.out || p.left) return;
    if (m.t === 'aprog') {
      p.filled = Math.max(0, Math.min(s.total, Number(m.filled) || 0));
      p.mistakes = Math.max(p.mistakes, Math.min(ARROW_HEARTS, Number(m.mistakes) || 0));
      if (p.mistakes >= ARROW_HEARTS) p.out = true;
      this.sudokuCheckEnd();
      s.seq++; this.all({ t: s.over ? 'aend' : 'aprog', s });
    } else if (m.t === 'adone') {
      if (!arrowRun(s.level, s.seed, m.order)) return;
      p.filled = s.total; s.over = true; s.winner = pid; s.reason = 'solved'; s.seq++;
      this.all({ t: 'aend', s });
    }
  }
  // Helix race: everyone drops down the same tower; falling on red just starts you again.
  doHelix(pid, m) {
    const s = this.s; if (!s || s.game !== 'helix' || s.over) return;
    const p = s.players.find(x => x.id === pid); if (!p || p.left) return;
    if (m.t === 'hprog') { p.filled = Math.max(0, Math.min(s.total, Number(m.filled) || 0)); p.falls = Math.max(p.falls, Number(m.falls) || 0); s.seq++; this.all({ t: 'hprog', s }); }
    else if (m.t === 'hdone') { p.filled = s.total; s.over = true; s.winner = pid; s.reason = 'solved'; s.seq++; this.all({ t: 'hend', s }); }
  }
  // Everyone else is out (3 mistakes or left): the best one still playing wins; nobody left: most cells wins.
  sudokuCheckEnd() {
    const s = this.s, live = s.players.filter(x => !x.out && !x.left);
    if (live.length > 1) return;
    s.over = true; s.reason = live.length ? 'others-out' : 'all-out';
    s.winner = (live[0] || s.players.filter(x => !x.left).sort((a, b) => b.filled - a.filled)[0] || s.players[0]).id;
  }

  // ---------- Rang Patta ----------
  // Cards are secret: everyone gets their own view of the table.
  pAll(m) {
    const s = this.s;
    for (const [ws, pid] of this.sockets) this.send(ws, Object.assign({}, m, { s: viewFor(s, s.players.findIndex(x => x.id === pid)) }));
    this.save();
  }
  doPatta(ws, pid, m) {
    const s = this.s; if (!s || s.game !== 'patta' || s.over) return;
    const i = s.players.findIndex(x => x.id === pid); if (i < 0) return;
    const turnSeq = s.turn;
    let ev = null;
    if (m.t === 'pek') ev = sayEk(s, i);
    else if (m.t === 'pcatch') ev = catchEk(s, i);
    else {
      if (m.seq != null && Number(m.seq) !== s.seq) return this.send(ws, { t: 'sync', s: viewFor(s, i), turnEnds: this.turnEnds });
      if (m.t === 'pplay') ev = playCard(s, i, Number(m.card), Number(m.color));
      else if (m.t === 'pdraw') ev = drawCard(s, i);
      else if (m.t === 'ppass') ev = pattaPass(s, i);
    }
    if (!ev) return this.send(ws, { t: 'sync', s: viewFor(s, i), turnEnds: this.turnEnds });
    if (s.over) this.clearTurn(); else if (m.t !== 'pek' && m.t !== 'pcatch' && (s.turn !== turnSeq || m.t === 'pplay')) this.armTurn(PATTA_MS);
    this.pAll({ t: 'pev', ev, turnEnds: this.turnEnds });
  }

  current() { return this.s ? (this.s.game === 'carrom' ? this.s.players[this.s.turn] : playerOf(this.s, this.s.turn)) : null; }

  // ---------- Carrom ----------
  // The server plays every shot with the same physics as the phones and sends the result.
  doCarromShot(ws, pid, m) {
    const s = this.s; if (!s || s.game !== 'carrom' || s.over) return;
    if (this.current().id !== pid) return;
    if (m.seq != null && Number(m.seq) !== s.seq) return this.send(ws, { t: 'sync', s, turnEnds: this.turnEnds });
    const shot = cleanShot(s, m); if (!shot) return;
    const res = applyShot(s, shot); if (!res) return;
    if (s.over) this.clearTurn(); else this.armTurn(CARROM_MS + Math.round(res.steps / 240 * 1000) + 1500);
    this.all({ t: 'rshot', shot, s, res, turnEnds: this.turnEnds });
  }

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

  armTurn(ms) {
    this.clearTurn();
    if (!this.s || this.s.over) return;
    ms = ms || (this.s.game === 'carrom' ? CARROM_MS : this.s.game === 'patta' ? PATTA_MS : TURN_MS);
    this.turnEnds = Date.now() + ms;
    const seq = this.s.seq;
    this.turnTimer = setTimeout(() => { if (this.s && this.s.seq === seq && !this.s.over) this.skip('timeout'); }, ms);
  }

  skip(reason) {
    if (this.s.game === 'patta') {
      const ev = pattaTimeout(this.s);
      if (this.s.over) this.clearTurn(); else this.armTurn(PATTA_MS);
      this.pAll({ t: 'pev', ev: Object.assign({ timeout: true }, ev || {}), turnEnds: this.turnEnds });
      return;
    }
    if (this.s.game === 'snakes') snakePass(this.s); else if (this.s.game === 'carrom') carromPass(this.s); else passTurn(this.s);
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

// The page a room link opens when the app does not open by itself (app not installed yet).
function invitePage(code) {
  const intent = `intent://room/${code}#Intent;scheme=pitara;package=${PKG};end`;
  const html = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Join my Pitara room ${code}</title>
<meta property="og:title" content="Join my Pitara game room ${code}"><meta property="og:description" content="Tap to play Ludo, Chess, Carrom and Snakes &amp; Ladders with me on Pitara.">
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#160D3D;color:#fff;font-family:system-ui,sans-serif;text-align:center}
.c{padding:28px;max-width:360px}h1{font-size:44px;margin:0;color:#FFC21A;text-shadow:0 4px 0 #8a5a00}.code{font-size:40px;font-weight:800;letter-spacing:6px;background:#24145e;border:3px solid #3b2a8a;border-radius:18px;padding:10px 18px;margin:18px 0}
a.b{display:block;margin:12px 0;padding:16px;border-radius:999px;font-weight:800;font-size:18px;text-decoration:none}.g{background:#FFC21A;color:#3a2600}.o{background:#24145e;color:#fff;border:2px solid #3b2a8a}p{color:#b9b0e8;line-height:1.5}</style></head>
<body><div class="c"><h1>Pitara</h1><p>You are invited to a game room</p><div class="code">${code}</div>
<a class="b g" href="${intent}">Open in Pitara</a>
<a class="b o" href="${APK}">Download Pitara (Android)</a>
<p>Don't have the app? Download it, install, then tap this link again. Or open Pitara, tap <b>Join a room</b> and enter <b>${code}</b>.</p></div>
<script>setTimeout(function(){location.href=${JSON.stringify(intent)}},300)</script></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } });
}

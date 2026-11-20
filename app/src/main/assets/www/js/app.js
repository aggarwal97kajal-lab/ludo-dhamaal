import { newGame, roll, move, passTurn, botChoice, seatColors, playerOf, FINISH } from './rules.js';
import { Board3D } from './board3d.js';
import { sfx, buzz, music, prefs, unlock } from './sound.js';
import { Net } from './net.js';
import { Voice, loadIce } from './voice.js';
import * as VoiceMod from './voice.js';

const $ = id => document.getElementById(id);
const UI = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0'];
const UI_EDGE = ['#FF8FA3', '#8AFFC1', '#FFF59D', '#9EC2FF'];
const UI_FG = ['#FFFFFF', '#062B14', '#3A2600', '#FFFFFF'];
const CNAME = ['Red', 'Green', 'Yellow', 'Blue'];
const MIC = '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg>';
const MIC_OFF = '<svg viewBox="0 0 24 24"><path d="M2 2l20 20M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7M17 16.9A7 7 0 0 1 5 12v-2M19 10v2a7 7 0 0 1-.1 1.2M12 19v3"/></svg>';
const BOT_NAMES = ['Raju', 'Pinky', 'Chintu'];

// ---------- Storage ----------
const store = {
  get(k, d) { try { const v = localStorage.getItem('ld:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ld:' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
};
let profile = store.get('profile', null);
const settings = Object.assign({ sound: true, music: true, vibrate: true, automic: false, listen: true }, store.get('settings', {}));
let pid = store.get('pid', null);
if (!pid) { pid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); store.set('pid', pid); }
Object.assign(prefs, { sound: settings.sound, music: settings.music, vibrate: settings.vibrate });

// Any character can play in any team colour: img/c<character>-<colour>.png
const CHAR_NAME = ['Riya', 'Arjun', 'Dadaji', 'Chotu'];
const ch = look => ((Number(look) || 0) % 4 + 4) % 4;
const face = (look, c) => `img/c${ch(look)}-${c}-face.png`;
const body = (look, c, h) => `<img class="body" src="img/c${ch(look)}-${c}.png" alt="" style="height:${h}px">`;
const avatar = (look, color, cls) => `<div class="av ${cls || ''}" style="border-color:${UI_EDGE[color]};background:${UI[color]}"><img src="${face(look, color)}" alt=""></div>`;

// ---------- Screens ----------
let current = 'splash';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  current = id;
  if (id === 'home') renderHome();
}
function modal(html) { $('modalBox').innerHTML = html; $('modal').classList.add('show'); }
function closeModal() { $('modal').classList.remove('show'); }
$('modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) { sfx('click'); show(b.dataset.go); } });
document.addEventListener('pointerdown', () => unlock(), { once: true });

function confirmBox(title, text, yes, no, onYes) {
  modal(`<h3>${title}</h3><p>${text}</p><button class="btn gold" id="mYes">${yes}</button><button class="btn ghost" id="mNo">${no}</button>`);
  $('mYes').onclick = () => { closeModal(); onYes(); };
  $('mNo').onclick = closeModal;
}

// ---------- Splash ----------
function splash() {
  $('splashCrowd').innerHTML = [0, 1, 2, 3].map(i => body(i, i, 110)).join('');
  let p = 0;
  const t = setInterval(() => {
    p = Math.min(100, p + 9 + Math.random() * 14);
    $('loadFill').style.width = p + '%';
    $('loadText').textContent = 'Setting up the board... ' + Math.round(p) + '%';
    if (p >= 100) { clearInterval(t); setTimeout(() => show(profile ? 'home' : 'profile'), 250); if (!profile) openProfile(); }
  }, 140);
}

// ---------- Profile ----------
let pfLook = 0, pfColor = 0;
function openProfile() {
  pfLook = profile ? ch(profile.look) : 0; pfColor = profile ? profile.color : 0;
  $('pfName').value = profile ? profile.name : '';
  $('pfErr').textContent = '';
  renderProfile(); show('profile');
}
function renderProfile() {
  $('pfPreview').innerHTML = `<img src="${face(pfLook, pfColor)}" alt="">`;
  $('pfPreview').style.background = UI[pfColor];
  $('pfLooks').innerHTML = [0, 1, 2, 3].map(i => `<button class="charbtn ${i === pfLook ? 'on' : ''}" data-l="${i}" style="background:${UI[pfColor]}" aria-label="${CHAR_NAME[i]}">${body(i, pfColor, 118)}<span>${CHAR_NAME[i]}</span></button>`).join('');
  $('pfColors').innerHTML = UI.map((c, i) => `<button class="colbtn ${i === pfColor ? 'on' : ''}" data-c="${i}" style="background:${c}" aria-label="${CNAME[i]} colour"></button>`).join('');
}
$('pfLooks').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) { pfLook = +b.dataset.l; sfx('click'); renderProfile(); } });
$('pfColors').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { pfColor = +b.dataset.c; sfx('click'); renderProfile(); } });
$('pfName').addEventListener('input', () => { $('pfErr').textContent = ''; });
$('pfSave').onclick = () => {
  const name = $('pfName').value.trim().replace(/\s+/g, ' ');
  if (name.length < 2) { $('pfErr').textContent = 'Enter a name with at least 2 letters'; return; }
  profile = { name, look: pfLook, color: pfColor };
  store.set('profile', profile); sfx('pop'); show('home');
};

// ---------- Home ----------
function renderHome() {
  $('homeAv').outerHTML = `<div class="av sm" id="homeAv" style="background:${UI[profile.color]}"><img src="${face(profile.look, profile.color)}" alt=""></div>`;
  $('homeName').textContent = profile.name;
  const modes = [
    ['online', 'Create online room', 'Invite friends anywhere and talk on mic', 0, [0, 1]],
    ['join', 'Join a room', 'Enter your friend’s room code', 3, [3, 2]],
    ['bot', 'Play vs computer', 'Play solo against a bot', 1, [1]],
    ['local', 'Pass & play', '2-4 players taking turns on one phone', 2, [2, 0, 3]]
  ];
  $('modes').innerHTML = modes.map(m => `<button class="mode" data-mode="${m[0]}" style="background:${UI[m[3]]};border-color:${UI_EDGE[m[3]]};color:${UI_FG[m[3]]}">
    <div class="col grow"><span class="t">${m[1]}</span><span class="s">${m[2]}</span></div>
    <div class="ppl">${m[4].map(i => body(i, i, 82)).join('')}</div></button>`).join('');
  music(true);
}
$('modes').addEventListener('click', e => {
  const b = e.target.closest('[data-mode]'); if (!b) return; sfx('click');
  const m = b.dataset.mode;
  if (m === 'online') createRoom();
  else if (m === 'join') { $('joinCode').value = ''; $('joinErr').textContent = ''; show('join'); }
  else openSetup(m);
});
$('homeSettings').onclick = () => { sfx('click'); openSettings(); };

// ---------- Offline setup ----------
let setupMode = 'bot', setupN = 2;
function openSetup(m) {
  setupMode = m; setupN = m === 'bot' ? 2 : 2;
  $('setupTitle').textContent = m === 'bot' ? 'Play vs computer' : 'Pass & play';
  renderSetup(); show('setup');
}
function setupColors() { return seatColors(setupN).map(c => (c + profile.color) % 4); }
function renderSetup() {
  $('setupCount').innerHTML = [2, 3, 4].map(n => `<button class="countbtn ${n === setupN ? 'on' : ''}" data-n="${n}">${n}</button>`).join('');
  const cols = setupColors();
  $('setupNames').innerHTML = cols.map((c, i) => {
    const nm = i === 0 ? profile.name : (setupMode === 'bot' ? CHAR_NAME[[0, 1, 2, 3].filter(x => x !== ch(profile.look))[i - 1]] : 'Player ' + (i + 1));
    const ed = setupMode === 'local' && i > 0;
    return `<div class="prow"><span class="dot" style="background:${UI[c]}"></span>${ed ? `<input class="input" data-pn="${i}" maxlength="14" value="${nm}">` : `<b style="font-size:18px">${esc(nm)}</b>`}</div>`;
  }).join('');
}
$('setupCount').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) { setupN = +b.dataset.n; sfx('click'); renderSetup(); } });
$('setupGo').onclick = () => {
  const cols = setupColors();
  const others = [0, 1, 2, 3].filter(x => x !== ch(profile.look));
  const players = cols.map((c, i) => {
    if (i === 0) return { id: pid, name: profile.name, color: c, kind: 'me', look: profile.look };
    if (setupMode === 'bot') return { id: 'bot' + i, name: CHAR_NAME[others[i - 1]], color: c, kind: 'bot', look: others[i - 1] };
    const inp = document.querySelector(`[data-pn="${i}"]`);
    return { id: 'p' + i, name: (inp && inp.value.trim()) || 'Player ' + (i + 1), color: c, kind: 'me', look: others[i - 1] };
  });
  startOffline(setupMode, players);
};

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Game (shared) ----------
let board = null, G = null;
function ensureBoard() { if (!board) board = new Board3D($('board')); else board.resize(); return board; }

function toast(text, color) {
  const t = $('toast'); t.textContent = text; t.style.background = color || UI[0];
  t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1300);
}

let diceSpin = null;
function spinDiceFace() {
  stopDiceSpin();
  $('diceBtn').classList.add('spin');
  diceSpin = setInterval(() => setDiceFace(1 + Math.floor(Math.random() * 6)), 90);
}
function stopDiceSpin(v) {
  if (diceSpin) clearInterval(diceSpin); diceSpin = null;
  $('diceBtn').classList.remove('spin');
  if (v) setDiceFace(v);
}
function setDiceFace(v) {
  const on = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[v || 0];
  const face = v || 5;
  const pips = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[face];
  void on;
  $('diceBtn').innerHTML = Array.from({ length: 9 }, (_, i) => `<i class="${pips.includes(i) ? '' : 'r'}" ${face === 1 && i === 4 ? 'style="background:#E0103A"' : ''}></i>`).join('');
}

function renderCards() {
  if (!G) return;
  const s = G.s;
  // Cards sit in the same corner as each player's home (your home is bottom-left).
  const me = s.players.find(p => p.id === pid) || s.players[0];
  const at = k => playerOf(s, (me.color + k) % 4);
  const top = [at(1), at(2)], bottom = [at(0), at(3)];
  const html = p => {
    const fin = s.tokens[p.color].filter(x => x === FINISH).length;
    const speaking = G.speaking && G.speaking.has(p.id);
    let st = p.done ? 'Finished!' : `Home ${fin}/4`;
    if (G.mode === 'online') {
      const lp = G.lobby.find(x => x.pid === p.id);
      if (lp && lp.left) st = 'Offline';
      else if (lp && !lp.connected) st = 'Waiting for network...';
      else if (speaking) st = 'Speaking...';
      else if (p.id !== pid && G.voice && voiceText(p.id) !== 'voice on') st = voiceText(p.id).replace('voice', 'Voice');
    }
    if (p.kind === 'bot') st = p.done ? 'Finished!' : `Bot · Home ${fin}/4`;
    const lp = G.mode === 'online' ? G.lobby.find(x => x.pid === p.id) : null;
    const micOn = lp ? lp.mic : false;
    const away = lp && (!lp.connected || lp.left);
    return `<div data-pid="${p.id}" class="gcard ${s.turn === p.color && !s.over ? 'turn' : ''} ${away ? 'away' : ''}" style="${s.turn === p.color ? '' : ''}">
      ${avatar(p.look, p.color, speaking ? 'speak' : '')}
      <div class="info"><span class="nm">${esc(p.name)}${p.id === pid ? ' (You)' : ''}</span><span class="st">${st}</span></div>
      ${G.mode === 'online' ? `<button class="mic ${micOn ? 'on' : ''}" data-deaf="${p.id}" aria-label="Mute ${esc(p.name)}">${micOn && !(G.voice && G.voice.deafened.has(p.id)) ? MIC : MIC_OFF}</button>` : ''}
    </div>`;
  };
  const cell = p => p ? html(p) : '<div></div>';
  $('cardsTop').innerHTML = top.map(cell).join('');
  $('cardsBottom').innerHTML = bottom.map(cell).join('');
}
['cardsTop', 'cardsBottom'].forEach(id => $(id).addEventListener('click', e => {
  const b = e.target.closest('[data-deaf]'); if (!b || !G || !G.voice || b.dataset.deaf === pid) return;
  const off = G.voice.toggleDeafen(b.dataset.deaf); toast(off ? 'Muted for you' : 'Unmuted', '#3A2490'); renderCards();
}));

// Small text under the dice for minor events, instead of a pop-up over the board.
function note(text) {
  if (!G) return;
  G.note = { text, until: Date.now() + 1400 };
  $('turnText').textContent = text;
}

function turnLabel() {
  if (!G) return '';
  if (G.note && G.note.until > Date.now()) return G.note.text;
  const s = G.s; if (s.over) return '';
  const p = playerOf(s, s.turn);
  if (G.mode === 'online') {
    const left = G.turnEnds ? Math.max(0, Math.ceil((G.turnEnds - Date.now()) / 1000)) : '';
    const tail = left !== '' ? ` · 0:${String(left).padStart(2, '0')}` : '';
    return (p.id === pid ? 'Your turn' : `${p.name}’s turn`) + tail;
  }
  if (p.kind === 'bot') return `${p.name} is playing...`;
  const left = G.turnEnds ? Math.max(0, Math.ceil((G.turnEnds - Date.now()) / 1000)) : '';
  const tail = left !== '' ? ` · 0:${String(left).padStart(2, '0')}` : '';
  if (G.mode === 'local') return `${p.name}’s turn${tail}`;
  return 'Your turn' + tail;
}
// 15 second turn timer: roll and move within it, or the turn is lost.
const TURN_SECS = 15;
function armTimer() {
  if (!G || G.mode === 'online') return;
  const p = playerOf(G.s, G.s.turn);
  G.turnEnds = p && p.kind === 'me' && !G.s.over ? Date.now() + TURN_SECS * 1000 : null;
}
let lastTick = 0;
setInterval(() => {
  if (!G || current !== 'game' || !G.s) { $('tfill').style.width = '0'; return; }
  if (G.busy && board && !board.tweens.length && !diceSpin) { G.stuck = (G.stuck || 0) + 250; if (G.stuck > 6000) { G.busy = false; G.stuck = 0; } } else G.stuck = 0;
  refreshDice();
  const left = G.turnEnds ? G.turnEnds - Date.now() : null;
  const fill = $('tfill');
  if (left == null || G.s.over) fill.style.width = '0';
  else {
    fill.style.width = Math.max(0, Math.min(100, left / (TURN_SECS * 10))) + '%';
    fill.classList.toggle('low', left < 5000);
    const sec = Math.ceil(left / 1000);
    const mine = G.mode === 'online' ? playerOf(G.s, G.s.turn).id === pid : true;
    if (mine && sec <= 5 && sec > 0 && sec !== lastTick) { lastTick = sec; sfx('tick'); }
  }
  if (G.mode !== 'online' && G.turnEnds && left <= 0 && !G.busy) timeUp();
}, 250);
function timeUp() {
  const s = G.s; G.turnEnds = null;
  board.clearHighlight();
  note('Time up, turn skipped'); buzz([80]);
  if (G.pickRes) { const f = G.pickRes; G.pickRes = null; f(-1); return; }
  passTurn(s); afterMove();
}

function myTurnToRoll() {
  if (!G || G.busy || !G.s) return false;
  if (G.mode === 'online' && G.rollSent && Date.now() - G.rollSent < 3000) return false;
  const s = G.s; if (s.over || s.rolled) return false;
  const p = playerOf(s, s.turn);
  if (G.mode === 'online') return p.id === pid;
  return p.kind === 'me';
}
function refreshDice() {
  const ok = myTurnToRoll();
  $('diceBtn').disabled = !ok;
  $('diceBtn').classList.toggle('ready', ok);
  $('turnText').textContent = turnLabel();
  const p = G && playerOf(G.s, G.s.turn);
  $('diceBtn').style.borderColor = p ? UI[p.color] : '';
}

function enterGame(mode) {
  show('game');
  const b = ensureBoard();
  const s = G.s;
  const looks = {}; s.players.forEach(p => { looks[p.color] = ch(p.look); });
  b.setPlayers(s.order.slice(), looks);
  b.placeAll(s.tokens);
  const me = s.players.find(p => p.id === pid) || s.players[0];
  b.faceColor(me.color);
  b.diceIdle();
  setDiceFace(0);
  $('gameRoom').textContent = mode === 'online' ? 'Room ' + G.code : (mode === 'bot' ? 'Vs computer' : 'Pass & play');
  $('gameMic').classList.toggle('hide', mode !== 'online');
  $('emojiBtn').style.visibility = mode === 'online' ? 'visible' : 'hidden';
  setBadges();
  renderCards(); refreshDice();
}

function tapDice(e) {
  if (e) e.preventDefault();
  if (!myTurnToRoll()) return;
  sfx('click');
  $('diceBtn').disabled = true; $('diceBtn').classList.remove('ready');
  if (G.mode === 'online') { G.rollSent = Date.now(); G.net.send({ t: 'roll' }); }
  else offlineRoll();
}
$('diceBtn').addEventListener('pointerdown', tapDice);
$('diceBtn').addEventListener('click', e => e.preventDefault());

$('gameLeave').onclick = () => leaveGame();
// Speaker button in the game: one tap mutes all sound and music, the icon shows the state.
const SPK_ON = '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
const SPK_OFF = '<svg viewBox="0 0 24 24"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>';
function syncSpeaker() {
  const on = settings.sound || settings.music;
  $('gameSound').innerHTML = on ? SPK_ON : SPK_OFF;
  $('gameSound').setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
  $('gameSound').classList.toggle('off', !on);
}
$('gameSound').onclick = () => {
  const on = !(settings.sound || settings.music);
  settings.sound = on; settings.music = on;
  Object.assign(prefs, { sound: on, music: on }); store.set('settings', settings);
  music(on && current !== 'game'); if (on) sfx('click');
  syncSpeaker();
};
syncSpeaker();
function leaveGame() {
  confirmBox('Leave the game?', G && G.mode === 'online' ? 'You can come back with the same room code while the game is on.' : 'This game will end.', 'Leave', 'Stay', () => {
    if (G && G.mode === 'online') endOnline();
    G = null; show('home');
  });
}

// ---------- Offline match ----------
function startOffline(mode, players) {
  G = { mode, s: newGame(players), busy: false };
  enterGame(mode);
  setTimeout(nextOffline, 600);
}

function nextOffline() {
  if (!G || G.mode === 'online') return;
  const s = G.s;
  renderCards(); refreshDice();
  if (s.over) return finishGame();
  const p = playerOf(s, s.turn);
  armTimer();
  if (p.kind === 'bot') setTimeout(() => { if (G && G.s === s) offlineRoll(); }, 750);
}

async function offlineRoll() {
  const s = G.s; G.busy = true; G.turnEnds = null; refreshDice();
  const d = 1 + Math.floor(Math.random() * 6);
  const r = roll(s, d);
  if (!r) { G.busy = false; return; }
  spinDiceFace();
  await board.throwDice(d, sfx);
  stopDiceSpin(d);
  const p = playerOf(s, s.turn);
  if (r.forfeit) { note('Three 6s, turn lost'); await board.wait(900); passTurn(s); return afterMove(); }
  if (!r.moves.length) { note('No move'); await board.wait(700); passTurn(s); return afterMove(); }
  let pick;
  if (p.kind === 'bot') { await board.wait(350); pick = botChoice(s, s.turn, d, r.moves); }
  else if (r.moves.length === 1) { await board.wait(250); pick = r.moves[0]; }
  else {
    armTimer(); G.busy = false;
    pick = await new Promise(res => { G.pickRes = res; board.highlight(s.turn, r.moves, i => { G.pickRes = null; res(i); }); });
    G.busy = true; G.turnEnds = null;
    if (pick === -1) { passTurn(s); return afterMove(); }
  }
  const ev = move(s, pick);
  await board.animateMove(ev, s.tokens, sfx);
  if (ev.captured.length) { const v = playerOf(s, ev.captured[0].color); toast(p.kind === 'me' && G.mode === 'bot' ? `You captured ${v.name}!` : `${p.name} captured ${v.name}!`, UI[p.color]); buzz([40, 30, 80]); }
  if (ev.won) toast(`${p.name} finished!`, UI[p.color]);
  else if (ev.extra) note('Roll again!');
  afterMove();
}
function afterMove() {
  if (!G) return;
  board.diceIdle(); G.busy = false;
  if (G.s.over) return setTimeout(finishGame, 900);
  nextOffline();
}

// ---------- Finish ----------
function finishGame() {
  const s = G.s; renderCards();
  const ranks = s.ranks.slice();
  s.order.forEach(c => { if (!ranks.includes(c)) ranks.push(c); });
  const P = c => playerOf(s, c);
  const me = s.players.find(p => p.id === pid);
  const winner = P(ranks[0]);
  const iWon = me && winner.id === pid;
  $('winTitle').textContent = iWon ? 'You won!' : `${winner.name} won!`;
  $('winSub').textContent = iWon ? 'All 4 of your players made it home' : 'Good game! Try again?';
  const podOrder = [1, 0, 2].filter(i => i < ranks.length);
  const H = [150, 110, 80];
  $('podium').innerHTML = podOrder.map(i => { const p = P(ranks[i]); return `<div class="col center gap10"><div>${body(p.look, p.color, 120)}</div><b>${esc(p.name)}</b><div class="pod" style="height:${H[i]}px;background:${UI[p.color]};border-color:${UI_EDGE[p.color]};color:${UI_FG[p.color]}">${i + 1}</div></div>`; }).join('');
  $('winRest').innerHTML = ranks.slice(3).map((c, i) => `<div class="restrow"><b style="font-size:22px;color:#C9C1F0">${i + 4}</b><b class="grow">${esc(P(c).name)}</b><span class="small muted">Better luck next time!</span></div>`).join('');
  const cc = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0', '#FF4FD8', '#FFFFFF', '#FFC21A'];
  $('winConf').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:${cc[i % 7]};animation-duration:${2.5 + (i % 5) * 0.6}s;animation-delay:${(i % 10) * 0.25}s"></i>`).join('');
  $('winAgain').style.display = G.mode === 'online' ? (G.host ? 'flex' : 'none') : 'flex';
  sfx('win'); buzz([60, 40, 60, 40, 120]);
  show('win');
}
$('winAgain').onclick = () => {
  if (!G) return show('home');
  if (G.mode === 'online') { G.net.send({ t: 'again' }); return; }
  startOffline(G.mode, G.s.players.map(p => ({ id: p.id, name: p.name, color: p.color, kind: p.kind, look: p.look })));
};
$('winHome').onclick = () => { if (G && G.mode === 'online') endOnline(); G = null; show('home'); };

// ---------- Online ----------
function netReady() {
  if (Net.serverBase()) return true;
  modal('<h3>Online play is coming soon</h3><p>The online server is not switched on yet. You can play vs computer or pass & play for now.</p><button class="btn gold" id="mOk">OK</button>');
  $('mOk').onclick = closeModal; return false;
}

async function createRoom() {
  if (!netReady()) return;
  try { const code = await Net.newCode(); openRoom(code); }
  catch (e) { modal(`<h3>Could not create room</h3><p>${esc(e.message || 'Check your internet and try again.')}</p><button class="btn gold" id="mOk">OK</button>`); $('mOk').onclick = closeModal; }
}
$('joinGo').onclick = () => {
  const code = $('joinCode').value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (code.length !== 5) { $('joinErr').textContent = 'Room code has 5 letters or numbers'; return; }
  if (!netReady()) return;
  openRoom(code);
};
$('joinCode').addEventListener('input', () => { $('joinErr').textContent = ''; });

function openRoom(code) {
  if (G && G.net) endOnline();
  G = { mode: 'online', code, lobby: [], host: false, s: null, busy: false, speaking: new Set(), q: Promise.resolve(), chat: [], unread: 0 };
  setBadges();
  G.net = new Net({
    message: m => {
      const g = G; if (!g || !g.net) return;
      if (m.t === 'pong') return;
      // Voice messages never wait in (or block) the game's queue.
      if (m.t === 'rtc') { if (g.voice) g.voice.signal(m.from, m.data).catch(() => {}); return; }
      // A full resync replaces whatever was still waiting, so a stuck animation can't block the game.
      if (m.t === 'sync') { board && board.clearHighlight(); stopDiceSpin(); g.q = Promise.resolve(); }
      g.q = g.q.then(() => onNet(m)).catch(err => console.error(err));
    },
    status: st => { if (st !== 'online' && G) G.wasOffline = true; setNetState(st); }
  });
  G.voice = new Voice((to, data) => G && G.net && G.net.send({ t: 'rtc', to, data }), (who, on) => { if (!G) return; if (on) G.speaking.add(who); else G.speaking.delete(who); if (current === 'lobby') renderLobby(); else renderCards(); });
  G.voice.setListen(settings.listen);
  G.voice.onState = () => { if (current === 'lobby') renderLobby(); else if (current === 'game') renderCards(); };
  G.net.join(code, { pid, name: profile.name, look: profile.look });
  $('lobbyCode').textContent = code;
  renderLobby(); show('lobby');
  loadIce(Net.serverBase()).then(() => G && G.voice ? G.voice.start(pid, settings.automic) : false).then(ok => {
    if (!G) return;
    if (!ok) toast('Mic not allowed. You can still listen.', '#3A2490');
    G.net.send({ t: 'mic', on: ok && settings.automic });
    syncMicButtons();
  });
}
function setNetState(st) {
  $('netBanner').classList.toggle('show', st !== 'online');
  const el = $('netState');
  el.textContent = st === 'online' ? 'Online' : 'Reconnecting...';
  el.className = 'pill ' + (st === 'online' ? 'ok' : 'bad');
}
function endOnline() {
  if (!G) return;
  closeChat();
  if (G.net) G.net.close();
  if (G.voice) G.voice.stop();
  $('netBanner').classList.remove('show');
  G.net = null;
}

function syncMicButtons() {
  if (!G || !G.voice) return;
  const on = G.voice.hasMic() && !G.voice.muted;
  ['lobbyMic', 'gameMic'].forEach(id => { $(id).innerHTML = on ? MIC : MIC_OFF; $(id).classList.toggle('on', on); });
}
['lobbyMic', 'gameMic'].forEach(id => $(id).onclick = async () => {
  if (!G || !G.voice) return;
  if (!G.voice.hasMic()) { const ok = await G.voice.start(pid, true); if (!ok) { toast('Allow the mic in phone settings', '#3A2490'); return; } }
  else G.voice.setMuted(!G.voice.muted);
  sfx('click');
  G.net.send({ t: 'mic', on: !G.voice.muted });
  syncMicButtons();
});

function renderLobby() {
  if (!G) return;
  const L = G.lobby;
  $('lobbyCount').textContent = `Players (${L.length}/4)`;
  const cols = seatColors(Math.max(2, L.length));
  const rows = L.map((p, i) => {
    const c = L.length >= 2 ? cols[i] : i;
    const sp = G.speaking.has(p.pid);
    let st = !p.connected ? 'Waiting for network...' : sp ? 'Speaking...' : p.host ? 'Host' : 'Ready';
    if (p.pid !== pid && p.connected) st += ' \u00b7 ' + voiceText(p.pid);
    return `<div class="pcard" style="border-color:${p.pid === pid ? UI[c] : ''}">${avatar(p.look, c, sp ? 'speak' : '')}
      <div class="col grow"><span class="nm">${esc(p.name)}${p.pid === pid ? ' (You)' : ''}</span><span class="st">${st}</span></div>
      <span class="mic ${p.mic ? 'on' : ''}">${p.mic ? MIC : MIC_OFF}</span></div>`;
  });
  $('voiceInfo').textContent = !G.voice.hasMic() ? 'Your mic is not allowed. Others can\u2019t hear you.' : (VoiceMod.RELAY ? 'Voice relay: on' : 'Voice relay: off (voice may fail on mobile data)');
  for (let i = L.length; i < 4; i++) rows.push(`<div class="pcard"><div class="av" style="background:#2E1A75;border-color:#3A2490"></div><div class="col grow"><span class="nm">Empty slot</span><span class="st">Waiting for a friend...</span></div></div>`);
  $('lobbyPlayers').innerHTML = rows.join('');
  const btn = $('lobbyStart');
  if (G.host) { btn.textContent = 'Start game'; btn.disabled = L.filter(p => p.connected).length < 2; }
  else { btn.textContent = 'Waiting for host...'; btn.disabled = true; }
}
$('lobbyStart').onclick = () => { if (G && G.host) { sfx('click'); G.net.send({ t: 'start' }); } };
$('lobbyBack').onclick = () => confirmBox('Leave the room?', 'You will leave this room.', 'Leave', 'Stay', () => { endOnline(); G = null; show('home'); });
$('lobbyShare').onclick = () => {
  if (!G) return;
  const text = `Let's play Ludo Dhamaal! Open the app, tap "Join a room" and enter code: ${G.code}`;
  if (window.LDNative && window.LDNative.shareWhatsApp) window.LDNative.shareWhatsApp(text);
  else window.location.href = 'https://wa.me/?text=' + encodeURIComponent(text);
};
$('lobbyCopy').onclick = () => {
  if (!G) return;
  if (window.LDNative && window.LDNative.copy) window.LDNative.copy(G.code);
  else if (navigator.clipboard) navigator.clipboard.writeText(G.code).catch(() => {});
  toast('Code copied', '#3A2490');
};

async function onNet(m) {
  if (!G) return;
  switch (m.t) {
    case 'lobby': {
      const wasHost = G.host;
      const before = {}; (G.lobby || []).forEach(p => { before[p.pid] = p.connected; });
      G.lobby = m.players; G.host = m.host === pid;
      const live = m.players.filter(p => p.connected && !p.left).map(p => p.pid);
      if (G.wasOffline) { G.wasOffline = false; G.voice.restart(live); }
      else m.players.forEach(p => { if (p.pid !== pid && p.connected && before[p.pid] === false) G.voice.restart([p.pid]); });
      if (G.host && !wasHost && G.hostKnown) toast('You are now the host', '#3A2490');
      G.hostKnown = true;
      if (current === 'win') $('winAgain').style.display = G.host ? 'flex' : 'none';
      G.voice.sync(live);
      if (current === 'lobby') renderLobby();
      if (current === 'game') renderCards();
      break;
    }
    case 'err':
      modal(`<h3>Oops</h3><p>${esc(m.msg)}</p><button class="btn gold" id="mOk">OK</button>`);
      $('mOk').onclick = () => { closeModal(); if (m.fatal) { endOnline(); G = null; show('home'); } };
      break;
    case 'start':
    case 'sync':
      G.s = m.s; G.turnEnds = m.turnEnds || null; G.busy = false;
      G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
      if (m.s.over && m.t === 'sync') { finishGame(); break; }
      enterGame('online');
      if (m.t === 'start') sfx('turn');
      if (m.s.rolled && playerOf(m.s, m.s.turn).id === pid && m.moves && m.moves.length) pickOnline(m.moves);
      break;
    case 'rolled': {
      G.busy = true; G.rollSent = 0; refreshDice();
      spinDiceFace();
      await board.throwDice(m.dice, sfx);
      stopDiceSpin(m.dice);
      G.s = m.s; G.turnEnds = m.turnEnds; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
      const mine = playerOf(G.s, G.s.turn).id === pid;
      if (m.forfeit) note('Three 6s, turn lost');
      else if (!m.moves.length) note('No move');
      else if (mine) pickOnline(m.moves);
      G.busy = false; refreshDice();
      break;
    }
    case 'moved': {
      G.busy = true; board.clearHighlight();
      const ev = m.ev;
      await board.animateMove(ev, m.s.tokens, sfx);
      board.diceIdle();
      const prevS = m.s; G.s = prevS; G.turnEnds = m.turnEnds; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
      const P = playerOf(G.s, ev.color);
      if (ev.captured.length) { const v = playerOf(G.s, ev.captured[0].color); toast(P.id === pid ? `You captured ${v.name}!` : (v.id === pid ? `${P.name} captured you!` : `${P.name} captured ${v.name}!`), UI[P.color]); buzz(v.id === pid ? [120, 60, 120] : [40, 30, 80]); }
      if (ev.won) toast(`${P.name} finished!`, UI[P.color]);
      else if (ev.extra && P.id === pid) note('Roll again!');
      G.busy = false; renderCards(); refreshDice();
      if (G.s.over) setTimeout(finishGame, 900);
      else if (playerOf(G.s, G.s.turn).id === pid) sfx('turn');
      break;
    }
    case 'passed':
      if (m.reason !== 'left-other') { board.clearHighlight(); board.diceIdle(); }
      G.s = m.s; G.turnEnds = m.turnEnds; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
      if (m.reason === 'timeout') note('Time up, turn skipped');
      if (m.reason === 'left') note('Player left the game');
      renderCards(); refreshDice();
      if (G.s.over) { setTimeout(finishGame, 600); break; }
      if (playerOf(G.s, G.s.turn).id === pid) sfx('turn');
      break;
    case 'chat': onChat(m); break;
    case 'chatlog': G.chat = m.list || []; if ($('chat').classList.contains('show')) renderChat(); break;
    case 'rtc': await G.voice.signal(m.from, m.data); break;
    case 'lobbyAgain':
      G.s = null; show('lobby'); renderLobby(); break;
  }
}

function pickOnline(moves) {
  const s = G.s;
  if (moves.length === 1) { setTimeout(() => G && G.net && G.net.send({ t: 'move', token: moves[0], seq: s.seq }), 250); return; }
  board.highlight(s.turn, moves, i => G && G.net && G.net.send({ t: 'move', token: i, seq: s.seq }));
}

function voiceText(id) {
  const st = G && G.voice ? G.voice.state(id) : 'none';
  return st === 'connected' ? 'voice on' : st === 'failed' || st === 'disconnected' ? 'voice failed' : 'voice connecting';
}

// ---------- Chat (online rooms) ----------
const QUICK = ['😂', '🔥', '👏', '😡', '😭', '🙏', 'Well played!', 'Hurry up!', 'Oh no!', 'Haha', 'Good luck!'];
$('chatQuick').innerHTML = QUICK.map(q => `<button type="button" class="${q.length <= 2 ? 'e' : ''}" data-q="${esc(q)}">${esc(q)}</button>`).join('');
function openChat() {
  if (!G || G.mode !== 'online') return;
  G.unread = 0; setBadges();
  renderChat(); $('chat').classList.add('show');
}
function closeChat() { $('chat').classList.remove('show'); $('chatInput').blur(); }
$('emojiBtn').onclick = () => { sfx('click'); openChat(); };
$('lobbyChat').onclick = () => { sfx('click'); openChat(); };
$('chatClose').onclick = closeChat;
$('chat').addEventListener('click', e => { if (e.target.id === 'chat') closeChat(); });
$('chatQuick').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) sendChat(b.dataset.q); });
$('chatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('chatInput').value.trim(); if (v) { sendChat(v); $('chatInput').value = ''; } });
function sendChat(text) { if (G && G.net) G.net.send({ t: 'chat', text: text.slice(0, 120) }); }
const isBig = t => /^\p{Extended_Pictographic}{1,3}$/u.test(t);
function renderChat() {
  if (!G) return;
  const list = G.chat || [];
  $('chatList').innerHTML = list.length ? list.map(m => `<div class="msg ${m.from === pid ? 'me' : ''} ${isBig(m.text) ? 'big' : ''}">${m.from === pid || isBig(m.text) ? '' : `<b style="color:${UI_EDGE[colorOf(m.from)] || '#C9C1F0'}">${esc(m.name)}</b>`}${esc(m.text)}</div>`).join('') : '<div class="chatempty">Say hi to your friends!</div>';
  $('chatList').scrollTop = 1e6;
}
function colorOf(id) {
  if (G && G.s) { const p = G.s.players.find(x => x.id === id); if (p) return p.color; }
  if (G && G.lobby) { const i = G.lobby.findIndex(x => x.pid === id); if (i >= 0) return seatColors(Math.max(2, G.lobby.length))[i]; }
  return 0;
}
function setBadges() {
  const n = (G && G.unread) || 0;
  ['chatBadge', 'lobbyBadge'].forEach(id => { $(id).textContent = n > 9 ? '9+' : n; $(id).classList.toggle('show', n > 0); });
}
function onChat(m) {
  G.chat = G.chat || []; G.chat.push(m); if (G.chat.length > 60) G.chat.shift();
  if ($('chat').classList.contains('show')) renderChat();
  else if (m.from !== pid) { G.unread = (G.unread || 0) + 1; setBadges(); sfx('pop'); }
  if (current === 'game') sayBubble(m);
}
function sayBubble(m) {
  const card = document.querySelector(`.gcard[data-pid="${m.from}"]`);
  if (!card) return;
  const r = card.getBoundingClientRect(), g = $('game').getBoundingClientRect();
  const el = document.createElement('div'); el.className = 'saybub' + (isBig(m.text) ? ' big' : ''); el.textContent = m.text;
  el.style.left = Math.max(8, Math.min(g.width - 180, r.left - g.left + 46)) + 'px';
  const below = r.top - g.top < g.height / 2;
  el.style.top = (below ? r.bottom - g.top + 6 : r.top - g.top - 40) + 'px';
  $('bubbles').appendChild(el); setTimeout(() => el.remove(), 3300);
}

// ---------- Settings ----------
const SET_ROWS = [
  ['sound', 'Sound', 'Dice, jump and capture sounds'],
  ['music', 'Music', 'Background music'],
  ['vibrate', 'Vibration', 'Phone vibrates on a capture'],
  ['automic', 'Auto mic on', 'Mic turns on when you join a room'],
  ['listen', 'Voice chat', 'Hear other players during the game']
];
function openSettings() {
  $('setRows').innerHTML = SET_ROWS.map(r => `<label class="setrow"><div class="col grow"><span class="t">${r[1]}</span><span class="s">${r[2]}</span></div><span class="switch"><input type="checkbox" data-k="${r[0]}" ${settings[r[0]] ? 'checked' : ''}><span></span></span></label>`).join('');
  $('ver').textContent = (window.LD_CONFIG && window.LD_CONFIG.version) || '1.0';
  show('settings');
}
$('setRows').addEventListener('change', e => {
  const k = e.target.dataset.k; if (!k) return;
  settings[k] = e.target.checked; store.set('settings', settings);
  Object.assign(prefs, { sound: settings.sound, music: settings.music, vibrate: settings.vibrate });
  if (k === 'music') music(settings.music);
  syncSpeaker();
  if (k === 'listen' && G && G.voice) G.voice.setListen(settings.listen);
  sfx('click');
});
$('setBack').onclick = () => show('home');
$('setProfile').onclick = () => openProfile();
$('setRules').onclick = () => {
  modal(`<h3>How to play</h3><ul>
  <li>Roll a 6 to bring a player out of home.</li>
  <li>Land on another player to send them back home. They need a 6 to come out again.</li>
  <li>Star squares and start squares are safe. No one can be captured there.</li>
  <li>You get another turn for a 6, a capture, or a player reaching the centre.</li>
  <li>Three 6s in a row and your turn is lost.</li>
  <li>You need the exact number to reach the centre.</li>
  <li>Get all 4 of your players to the centre to win.</li></ul>
  <button class="btn gold" id="mOk">Got it</button>`);
  $('mOk').onclick = closeModal;
};

// ---------- Android back button ----------
window.ldBack = () => {
  if ($('modal').classList.contains('show')) { closeModal(); return true; }
  if ($('chat').classList.contains('show')) { closeChat(); return true; }
  if (current === 'game') { leaveGame(); return true; }
  if (current === 'lobby') { $('lobbyBack').onclick(); return true; }
  if (current === 'win') { $('winHome').onclick(); return true; }
  if (current === 'profile' && !profile) return false;
  if (current !== 'home' && current !== 'splash') { show('home'); return true; }
  return false;
};
document.addEventListener('visibilitychange', () => music(!document.hidden && current !== 'game'));

window.__ld = () => G; window.__board = () => board;
splash();

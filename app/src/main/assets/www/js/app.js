import { newGame, roll, move, passTurn, botChoice, seatColors, playerOf, FINISH } from './rules.js';
import { Board3D, LOOKS, TEAM } from './board3d.js';
import { sfx, buzz, music, prefs, unlock } from './sound.js';
import { Net } from './net.js';
import { Voice } from './voice.js';

const $ = id => document.getElementById(id);
const UI = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0'];
const UI_EDGE = ['#FF8FA3', '#8AFFC1', '#FFF59D', '#9EC2FF'];
const UI_FG = ['#FFFFFF', '#062B14', '#3A2600', '#FFFFFF'];
const CNAME = ['Red', 'Green', 'Yellow', 'Blue'];
const MIC = '<svg viewBox="0 0 24 24"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4"/></svg>';
const MIC_OFF = '<svg viewBox="0 0 24 24"><path d="M2 2l20 20M9 9v2a3 3 0 0 0 5.1 2.1M15 9.3V5a3 3 0 0 0-5.9-.7M17 16.9A7 7 0 0 1 5 12v-2M19 10v2a7 7 0 0 1-.1 1.2M12 19v3"/></svg>';
const EMOJIS = ['😂', '🔥', '😡', '👏', '😭', '🙏', '😎', '🤣'];
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

// ---------- Person drawings for the UI ----------
const HAIR = {
  short: 'M12.6 10 Q12 2.5 20 2.6 Q28 2.5 27.4 10 Q25 6 20 6.5 Q15 6 12.6 10 Z',
  long: 'M12 14 Q11 2.5 20 2.6 Q29 2.5 28 14 L28.5 22 L26 22 Q27 9 20 6.5 Q13 9 14 22 L11.5 22 Z',
  spiky: 'M12.4 10.5 L12 4 L14.5 5.5 L15 1.8 L17.8 4.4 L20 1 L22.2 4.4 L25 1.8 L25.5 5.5 L28 4 L27.6 10.5 Q24 6.8 20 7 Q16 6.8 12.4 10.5 Z',
  cap: 'M12.9 9 L13 5.6 Q13 1 20 1 Q27 1 27 5.6 L27.1 9 Z'
};
function personSVG(look, shirt, w, h, bust) {
  const kurta = look.outfit === 'kurta';
  const vb = bust ? '6 0 28 34' : '0 0 40 72';
  const torso = kurta ? 'M13 20.5 Q20 18.8 27 20.5 L32.5 23.5 L33.4 38.5 L28.6 38.9 L29.2 57 L10.8 57 L11.4 38.9 L6.6 38.5 L7.5 23.5 Z'
    : 'M13 21 Q20 19 27 21 L32 24 L33 31 L28 31 L27 46 L13 46 L12 31 L7 31 L8 24 Z';
  const hairFill = look.style === 'cap' ? '#ffffff' : look.hair;
  let s = `<svg width="${w}" height="${h}" viewBox="${vb}" aria-hidden="true">`;
  if (!bust) {
    s += '<ellipse cx="20" cy="69" rx="11" ry="2.6" fill="#000" opacity=".3"/>';
    s += `<path d="M14 44 L13.5 66 L19 66 L20 48 L21 66 L26.5 66 L26 44 Z" fill="${look.pants}"/>`;
    s += `<rect x="11.5" y="64.5" width="8" height="4" rx="2" fill="${kurta ? '#6b3e1e' : '#f5f5f5'}"/><rect x="20.5" y="64.5" width="8" height="4" rx="2" fill="${kurta ? '#6b3e1e' : '#f5f5f5'}"/>`;
    s += `<rect x="7.5" y="24" width="4.6" height="19" rx="2.3" fill="${look.skin}"/><rect x="27.9" y="24" width="4.6" height="19" rx="2.3" fill="${look.skin}"/>`;
  }
  if (look.style === 'long') s += `<path d="M11.6 12 Q11 1.6 20 2 Q29 1.6 28.4 12 L29.4 27 Q26.5 28.5 24.2 26.2 L24.5 16 L15.5 16 L15.8 26.2 Q13.5 28.5 10.6 27 Z" fill="${look.hair}"/>`;
  s += `<path d="${torso}" fill="${shirt}"/>`;
  s += `<rect x="17.5" y="16" width="5" height="5" fill="${look.skin}"/><circle cx="13" cy="11.5" r="1.6" fill="${look.skin}"/><circle cx="27" cy="11.5" r="1.6" fill="${look.skin}"/><ellipse cx="20" cy="11" rx="7" ry="7.8" fill="${look.skin}"/>`;
  s += `<path d="${HAIR[look.style] || HAIR.short}" fill="${hairFill}"/>`;
  s += '<circle cx="17.3" cy="11.6" r="1" fill="#1a1a1a"/><circle cx="22.7" cy="11.6" r="1" fill="#1a1a1a"/>';
  if (look.style === 'cap') s += '<path d="M16.6 15 Q18.5 14 20 14.8 Q21.5 14 23.4 15 Q22.5 16 20 15.6 Q17.5 16 16.6 15 Z" fill="#3a3a3a"/>';
  else s += '<path d="M18 14.8 Q20 16.3 22 14.8" stroke="#7a3b2b" stroke-width=".9" fill="none" stroke-linecap="round"/>';
  return s + '</svg>';
}
const avatar = (look, color, cls) => `<div class="av ${cls || ''}" style="border-color:${UI_EDGE[color]};background:${UI[color]}">${personSVG(look, '#ffffff', 40, 48, true)}</div>`;

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
  $('splashCrowd').innerHTML = [0, 1, 2, 3].map(i => personSVG(LOOKS[[0, 1, 2, 3][i]], UI[i], 50, 90)).join('');
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
  pfLook = profile ? profile.look : 0; pfColor = profile ? profile.color : 0;
  $('pfName').value = profile ? profile.name : '';
  $('pfErr').textContent = '';
  renderProfile(); show('profile');
}
function renderProfile() {
  $('pfPreview').innerHTML = personSVG(LOOKS[pfLook], UI[pfColor], 128, 156, true);
  $('pfLooks').innerHTML = LOOKS.map((l, i) => `<button class="lookbtn ${i === pfLook ? 'on' : ''}" data-l="${i}" aria-label="Look ${i + 1}">${personSVG(l, UI[pfColor], 54, 66, true)}</button>`).join('');
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
  $('homeAv').outerHTML = `<div class="av sm" id="homeAv" style="background:${UI[profile.color]}">${personSVG(LOOKS[profile.look], '#ffffff', 40, 48, true)}</div>`;
  $('homeName').textContent = profile.name;
  const modes = [
    ['online', 'Create online room', 'Invite friends anywhere and talk on mic', 0, [0, 1]],
    ['join', 'Join a room', 'Enter your friend’s room code', 3, [3, 2]],
    ['bot', 'Play vs computer', 'Play solo against a bot', 1, [1]],
    ['local', 'Pass & play', '2-4 players taking turns on one phone', 2, [2, 0, 3]]
  ];
  $('modes').innerHTML = modes.map(m => `<button class="mode" data-mode="${m[0]}" style="background:${UI[m[3]]};border-color:${UI_EDGE[m[3]]};color:${UI_FG[m[3]]}">
    <div class="col grow"><span class="t">${m[1]}</span><span class="s">${m[2]}</span></div>
    <div class="ppl">${m[4].map(i => personSVG(LOOKS[i], UI[i], 38, 68)).join('')}</div></button>`).join('');
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
    const nm = i === 0 ? profile.name : (setupMode === 'bot' ? 'Bot ' + BOT_NAMES[i - 1] : 'Player ' + (i + 1));
    const ed = setupMode === 'local' && i > 0;
    return `<div class="prow"><span class="dot" style="background:${UI[c]}"></span>${ed ? `<input class="input" data-pn="${i}" maxlength="14" value="${nm}">` : `<b style="font-size:18px">${esc(nm)}</b>`}</div>`;
  }).join('');
}
$('setupCount').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b) { setupN = +b.dataset.n; sfx('click'); renderSetup(); } });
$('setupGo').onclick = () => {
  const cols = setupColors();
  const players = cols.map((c, i) => {
    if (i === 0) return { id: pid, name: profile.name, color: c, kind: 'me', look: profile.look };
    if (setupMode === 'bot') return { id: 'bot' + i, name: 'Bot ' + BOT_NAMES[i - 1], color: c, kind: 'bot', look: [2, 1, 3][i - 1] };
    const inp = document.querySelector(`[data-pn="${i}"]`);
    return { id: 'p' + i, name: (inp && inp.value.trim()) || 'Player ' + (i + 1), color: c, kind: 'me', look: [3, 1, 4][i - 1] };
  });
  startOffline(setupMode, players);
};

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Game (shared) ----------
let board = null, G = null;
function ensureBoard() { if (!board) board = new Board3D($('board')); else board.resize(); return board; }

function toast(text, color) {
  const t = $('toast'); t.textContent = text; t.style.background = color || UI[0];
  t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1500);
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
      if (lp && !lp.connected) st = 'Offline';
      else if (speaking) st = 'Speaking...';
    }
    if (p.kind === 'bot') st = p.done ? 'Finished!' : `Bot · Home ${fin}/4`;
    const lp = G.mode === 'online' ? G.lobby.find(x => x.pid === p.id) : null;
    const micOn = lp ? lp.mic : false;
    const away = lp && !lp.connected;
    return `<div class="gcard ${s.turn === p.color && !s.over ? 'turn' : ''} ${away ? 'away' : ''}" style="${s.turn === p.color ? '' : ''}">
      ${avatar(LOOKS[p.look] || LOOKS[0], p.color, speaking ? 'speak' : '')}
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

function turnLabel() {
  if (!G) return '';
  const s = G.s; if (s.over) return '';
  const p = playerOf(s, s.turn);
  if (G.mode === 'online') {
    const left = G.turnEnds ? Math.max(0, Math.ceil((G.turnEnds - Date.now()) / 1000)) : '';
    const tail = left !== '' ? ` · 0:${String(left).padStart(2, '0')}` : '';
    return (p.id === pid ? 'Your turn' : `${p.name}’s turn`) + tail;
  }
  if (p.kind === 'bot') return `${p.name} is playing...`;
  if (G.mode === 'local') return `${p.name}’s turn`;
  return 'Your turn';
}
setInterval(() => { if (G && current === 'game') $('turnText').textContent = turnLabel(); }, 500);

function myTurnToRoll() {
  if (!G || G.busy) return false;
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
  const looks = {}; s.players.forEach(p => { looks[p.color] = LOOKS[p.look] || LOOKS[0]; });
  b.setPlayers(s.order.slice(), looks);
  b.placeAll(s.tokens);
  const me = s.players.find(p => p.id === pid) || s.players[0];
  b.faceColor(me.color);
  b.diceIdle();
  setDiceFace(0);
  $('gameRoom').textContent = mode === 'online' ? 'Room ' + G.code : (mode === 'bot' ? 'Vs computer' : 'Pass & play');
  $('gameMic').classList.toggle('hide', mode !== 'online');
  $('emojiBtn').style.visibility = mode === 'online' ? 'visible' : 'hidden';
  renderCards(); refreshDice();
}

$('diceBtn').onclick = () => {
  if (!myTurnToRoll()) return;
  sfx('click');
  $('diceBtn').disabled = true; $('diceBtn').classList.remove('ready');
  if (G.mode === 'online') G.net.send({ t: 'roll' });
  else offlineRoll();
};

$('gameLeave').onclick = () => leaveGame();
$('gameSound').onclick = () => {
  settings.sound = !settings.sound; prefs.sound = settings.sound; store.set('settings', settings);
  toast(settings.sound ? 'Sound on' : 'Sound off', '#3A2490');
};
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
  if (p.kind === 'bot') setTimeout(() => { if (G && G.s === s) offlineRoll(); }, 750);
  else if (G.mode === 'local') toast(`${p.name}’s turn`, UI[p.color]);
}

async function offlineRoll() {
  const s = G.s; G.busy = true; refreshDice();
  const d = 1 + Math.floor(Math.random() * 6);
  const r = roll(s, d);
  if (!r) { G.busy = false; return; }
  setDiceFace(d);
  await board.throwDice(d, sfx);
  const p = playerOf(s, s.turn);
  if (r.forfeit) { toast('Three 6s! Turn lost', '#3A2490'); await board.wait(900); passTurn(s); return afterMove(); }
  if (!r.moves.length) { toast(p.kind === 'bot' ? 'No move' : 'No move this time', '#3A2490'); await board.wait(800); passTurn(s); return afterMove(); }
  let pick;
  if (p.kind === 'bot') { await board.wait(350); pick = botChoice(s, s.turn, d, r.moves); }
  else if (r.moves.length === 1) { await board.wait(250); pick = r.moves[0]; }
  else { G.busy = false; pick = await new Promise(res => board.highlight(s.turn, r.moves, res)); G.busy = true; }
  const ev = move(s, pick);
  await board.animateMove(ev, s.tokens, sfx);
  if (ev.captured.length) { const v = playerOf(s, ev.captured[0].color); toast(p.kind === 'me' && G.mode === 'bot' ? `You captured ${v.name}!` : `${p.name} captured ${v.name}!`, UI[p.color]); buzz([40, 30, 80]); }
  if (ev.won) toast(`${p.name} finished!`, UI[p.color]);
  else if (ev.extra && !ev.captured.length) { if (d === 6) toast('Six! Roll again', UI[p.color]); else if (ev.finished) toast('Home! Roll again', UI[p.color]); }
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
  $('podium').innerHTML = podOrder.map(i => { const p = P(ranks[i]); return `<div class="col center gap10"><div>${personSVG(LOOKS[p.look] || LOOKS[0], UI[p.color], 56, 100)}</div><b>${esc(p.name)}</b><div class="pod" style="height:${H[i]}px;background:${UI[p.color]};border-color:${UI_EDGE[p.color]};color:${UI_FG[p.color]}">${i + 1}</div></div>`; }).join('');
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
  G = { mode: 'online', code, lobby: [], host: false, s: null, busy: false, speaking: new Set(), q: Promise.resolve() };
  G.net = new Net({ message: m => { const g = G; if (!g || !g.net) return; g.q = g.q.then(() => onNet(m)).catch(err => console.error(err)); }, status: st => setNetState(st) });
  G.voice = new Voice((to, data) => G && G.net && G.net.send({ t: 'rtc', to, data }), (who, on) => { if (!G) return; if (on) G.speaking.add(who); else G.speaking.delete(who); if (current === 'lobby') renderLobby(); else renderCards(); });
  G.voice.setListen(settings.listen);
  G.net.join(code, { pid, name: profile.name, look: profile.look });
  $('lobbyCode').textContent = code;
  renderLobby(); show('lobby');
  G.voice.start(pid, settings.automic).then(ok => {
    if (!G) return;
    if (!ok) toast('Mic not allowed. You can still listen.', '#3A2490');
    G.net.send({ t: 'mic', on: ok && settings.automic });
    syncMicButtons();
  });
}
function setNetState(st) {
  const el = $('netState');
  el.textContent = st === 'online' ? 'Online' : 'Reconnecting...';
  el.className = 'pill ' + (st === 'online' ? 'ok' : 'bad');
}
function endOnline() {
  if (!G) return;
  if (G.net) G.net.close();
  if (G.voice) G.voice.stop();
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
    const st = !p.connected ? 'Offline' : sp ? 'Speaking...' : p.host ? 'Host' : 'Ready';
    return `<div class="pcard" style="border-color:${p.pid === pid ? UI[c] : ''}">${avatar(LOOKS[p.look] || LOOKS[0], c, sp ? 'speak' : '')}
      <div class="col grow"><span class="nm">${esc(p.name)}${p.pid === pid ? ' (You)' : ''}</span><span class="st">${st}</span></div>
      <span class="mic ${p.mic ? 'on' : ''}">${p.mic ? MIC : MIC_OFF}</span></div>`;
  });
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
    case 'lobby':
      G.lobby = m.players; G.host = m.host === pid;
      G.voice.sync(m.players.filter(p => p.connected).map(p => p.pid));
      if (current === 'lobby') renderLobby();
      if (current === 'game') renderCards();
      break;
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
      if (m.t === 'start') { sfx('turn'); toast('Game on!', UI[0]); }
      if (m.s.rolled && playerOf(m.s, m.s.turn).id === pid && m.moves && m.moves.length) pickOnline(m.moves);
      break;
    case 'rolled': {
      G.busy = true; refreshDice();
      setDiceFace(m.dice);
      await board.throwDice(m.dice, sfx);
      G.s = m.s; G.turnEnds = m.turnEnds; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
      const mine = playerOf(G.s, G.s.turn).id === pid;
      if (m.forfeit) toast('Three 6s! Turn lost', '#3A2490');
      else if (!m.moves.length) toast('No move', '#3A2490');
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
      G.busy = false; renderCards(); refreshDice();
      if (G.s.over) setTimeout(finishGame, 900);
      else if (playerOf(G.s, G.s.turn).id === pid) sfx('turn');
      break;
    }
    case 'passed':
      board.clearHighlight(); board.diceIdle();
      G.s = m.s; G.turnEnds = m.turnEnds; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
      if (m.reason === 'timeout') toast('Time up! Turn skipped', '#3A2490');
      if (m.reason === 'away') toast('Player offline, turn skipped', '#3A2490');
      renderCards(); refreshDice();
      if (playerOf(G.s, G.s.turn).id === pid) sfx('turn');
      break;
    case 'emoji': showBubble(m.e, m.from); break;
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

// Emoji reactions
$('emojiPick').innerHTML = EMOJIS.map(e => `<button data-e="${e}">${e}</button>`).join('');
$('emojiBtn').onclick = () => $('emojiPick').classList.toggle('show');
$('emojiPick').addEventListener('click', e => {
  const b = e.target.closest('[data-e]'); if (!b || !G || !G.net) return;
  G.net.send({ t: 'emoji', e: b.dataset.e }); $('emojiPick').classList.remove('show');
});
function showBubble(e, from) {
  if (!EMOJIS.includes(e)) return;
  const el = document.createElement('div'); el.className = 'bubble'; el.textContent = e;
  const idx = G && G.s ? G.s.order.indexOf((G.s.players.find(p => p.id === from) || {}).color) : 0;
  el.style.left = (idx % 2 === 0 ? 18 : 62) + '%'; el.style.top = (idx < 2 ? 22 : 62) + '%';
  $('bubbles').appendChild(el); setTimeout(() => el.remove(), 2300); sfx('pop');
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
  if ($('emojiPick').classList.contains('show')) { $('emojiPick').classList.remove('show'); return true; }
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

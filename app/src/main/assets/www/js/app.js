import { newGame, roll, move, passTurn, botChoice, seatColors, playerOf, FINISH, homeCount, score as ludoScore, timeUp as ludoTimeUp, partnerOf } from './rules.js';
import { Board3D } from './board3d.js';
import { sfx, buzz, music, prefs, unlock, playTrack, stopTrack, trackTime, applyVolumes } from './sound.js';
import { Net } from './net.js';
import { Voice, loadIce } from './voice.js';
import * as VoiceMod from './voice.js';
import { Chess3D } from './chess3d.js';
import { SnakeBoard3D } from './snakes3d.js';
import { Carrom3D } from './carrom3d.js';
import { newCarrom, applyShot, carromBot, carromPass, strikerSpot, forwardOk, NEED as CNEED, BASE as CBASE, LO as CLO, HI as CHI } from './carrom.js';
import { newSnakes, snakeRoll, snakePass, GOAL } from './snakes.js';
import { Chess } from './chesslib.js';
import { makeLevel as arrowLevel, blockerOf, isFree as arrowFree, DIR as ADIR, HEARTS as AR_HEARTS } from './arrows.js';
import { judge as drawJudge, ROUNDS as D_ROUNDS, DRAW_MS, CHOOSE_MS, REVEAL_MS } from './draw.js';
import { makeTower, platformsFor } from './helix.js';
import { Helix3D } from './helix3d.js';
import { makePuzzle, dailySeed, peers as sdPeers, LEVELS as SD_LEVELS, LEVEL_NAME as SD_NAME, MAX_MISTAKES as SD_MAX } from './sudoku.js';
import { newPatta, playCard, drawCard, passTurn as pattaPass, sayEk, catchEk, timeout as pattaTimeout, pattaBot, playable as pattaPlayable, canPlay as pattaCanPlay, top as pattaTop, label as pattaLabel, ranking as pattaRanking, COLORS as PCOLORS } from './patta.js';
import { PUZZLES } from './puzzles.js';
import { setLang, LANGS } from './lang.js';
import { newChess, chessMove, chessTimeout, chessPlayer, chessBot, chessResultText, CLOCK_MS, other } from './chessrules.js';

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
const settings = Object.assign({ sound: true, music: true, vibrate: true, automic: false, listen: true, chessHelp: true, carromHelp: true, queenBuzz: true, carromMode: 'classic', ludoMode: 'classic', botLevel: 'medium', carrom3d: false, striker: 0, sdLevel: 'medium', arLevel: 1, hxLevel: 1 }, store.get('settings', {}));
// Volumes 0-100 (mic: 50 = normal, 100 = twice as loud).
const vol = Object.assign({ master: 80, music: 60, sfx: 80, win: 90, voice: 100, mic: 50, vib: 70 }, store.get('vol', {}));
prefs.vol = vol;
let pid = store.get('pid', null);
if (!pid) { pid = Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); store.set('pid', pid); }
Object.assign(prefs, { sound: settings.sound, music: settings.music, vibrate: settings.vibrate });

// Any character can play in any team colour: img/c<character>-<colour>.png
const CHAR_NAME = ['Riya', 'Arjun', 'Dadaji', 'Chotu'];
const ch = look => ((Number(look) || 0) % 4 + 4) % 4;
const face = (look, c) => `img/c${ch(look)}-${c}-face.png`;
const body = (look, c, h) => `<img class="body" src="img/c${ch(look)}-${c}.png" alt="" style="height:${h}px">`;
// Profile photos: yours is kept on this phone only (ld:photo). Other players' photos come from
// the room while you play online and are never saved.
let myPhoto = store.get('photo', null);
const roomPhotos = new Map();
const photoOf = id => !id ? null : id === pid ? myPhoto : roomPhotos.get(id) || null;
const faceImg = (look, color, id) => { const ph = photoOf(id); return ph ? `<div class="in photo" style="background:${UI[color]}"><img src="${ph}" alt=""></div>` : `<div class="in" style="background:${UI[color]}"><img src="${face(look, color)}" alt=""></div>`; };
// Other people's frames come from the room (they bought them in their own shop).
const frameOf = id => { let g = null; try { g = G; } catch (e) { return ''; } if (!id || id === pid || !g || !g.lobby) return ''; const G2 = g; const p = G2.lobby.concat(G2.viewers || []).find(x => x.pid === id); return p && p.fr && p.fr !== 'fr0' ? 'fr-' + p.fr : ''; };
const avatar = (look, color, cls, id) => `<div class="av ${cls || ''} ${id && id === pid ? 'mine' : frameOf(id)}">${faceImg(look, color, id)}</div>`;

// ---------- Screens ----------
let current = 'splash';
let hboard = null;
function dropHBoard() { if (hboard) { hboard.destroy(); hboard = null; } }
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  current = id;
  if (id !== 'win') stopDance();
  if (board) board.paused = id !== 'game';
  if (cboard) cboard.paused = id !== 'chess';
  if (rboard) rboard.paused = id !== 'carrom';
  if (hboard) hboard.paused = id !== 'helix';
  if (id === 'home') renderHome();
  if (id === 'gamehome') renderModes();
  if (id === 'history') renderHistory();
  if (id === 'hgame') renderHGame();
  if (id === 'daily') renderDaily();
  if (id === 'shop') renderShop();
  if (id === 'badges') renderBadges();
  if (id === 'friends') { if (window.LDNative && window.LDNative.askNotify && !store.get('askedNotify', false)) { store.set('askedNotify', true); window.LDNative.askNotify(); } renderFriends(); hubPing(); $('navFriendsDot').classList.remove('show'); }
  if (id === 'win') winExtras();
  if (id === 'home') { renderCoins(); setDailyDot(); }
  updateVStrip();
  const nav = ['home', 'history', 'hgame', 'shop', 'badges', 'daily', 'friends'].includes(id) || (id === 'profile' && !!profile);
  $('bnav').classList.toggle('show', nav);
  document.querySelectorAll('#bnav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === (id === 'hgame' ? 'history' : id)));
}
document.querySelectorAll('#bnav [data-nav]').forEach(b => b.onclick = () => {
  const to = b.dataset.nav; if (to === current) return; sfx('click');
  if (to === 'profile') openProfile(); else show(to);
});
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
    if (p >= 100) { clearInterval(t); setTimeout(() => { show(profile ? 'home' : 'profile'); if (profile && !takeLinkRoom()) offerRejoin(); }, 250); if (!profile) openProfile(); }
  }, 140);
}

// If the app was closed during an online game (or Android restarted it), offer to go back in.
// ---------- Room links (…/r/ABCDE opens the app straight in that room) ----------
let linkRoom = null;
function takeLinkRoom() {
  let code = null;
  try { code = window.LDNative && window.LDNative.takeRoom ? window.LDNative.takeRoom() : null; } catch (e) { /* no bridge */ }
  if (code) linkRoom = code;
  if (!linkRoom || !profile) return false;
  const c = linkRoom; linkRoom = null; joinFromLink(c); return true;
}
function joinFromLink(code) {
  if (G && G.mode === 'online' && G.code === code) return;
  const go = () => { if (G && G.mode === 'online') endOnline(); G = null; openRoom(code); };
  if (G && G.s && !G.s.over) confirmBox('Join the new room?', `You will leave this game and join room ${code}.`, 'Join', 'Stay', go);
  else go();
}
// Called by the app when a room link is tapped while Pitara is already open.
window.ldDeepLink = code => {
  if (!profile || current === 'splash' || current === 'profile') { linkRoom = code; return true; }
  joinFromLink(code); return true;
};
function roomLink(code) { return Net.serverBase() + '/r/' + code; }

function offerRejoin() {
  const r = store.get('room', null);
  if (!r || !r.code || Date.now() - r.at > 3 * 60 * 60 * 1000) return;
  confirmBox('Go back to your game?', `You were in ${GAME_NAME[r.game] || 'a'} room ${r.code}.`, 'Rejoin', 'No', () => { GAME = r.game || 'ludo'; openRoom(r.code); });
  const no = $('mNo'); if (no) no.addEventListener('click', () => store.set('room', null), { once: true });
}

// ---------- Profile ----------
let pfLook = 0, pfColor = 0, pfPhoto = null;
function openProfile() {
  pfLook = profile ? ch(profile.look) : 0; pfColor = profile ? profile.color : 0; pfPhoto = myPhoto;
  $('pfName').value = profile ? profile.name : '';
  $('pfErr').textContent = '';
  $('pfTitle').textContent = profile ? 'My Profile' : 'Create your player';
  $('pfBack').style.visibility = profile ? 'visible' : 'hidden';
  $('pfIntro').style.display = profile ? 'none' : '';
  $('pfStats').style.display = profile ? '' : 'none';
  $('pfStats').innerHTML = statsHtml(stats(), true);
  $('pfSave').textContent = profile ? 'Save profile' : 'Continue';
  renderProfile(); show('profile');
}
function renderProfile() {
  $('pfPreview').innerHTML = pfPhoto ? `<div class="in photo" style="background:${UI[pfColor]}"><img src="${pfPhoto}" alt=""></div>` : `<div class="in" style="background:${UI[pfColor]}"><img src="${face(pfLook, pfColor)}" alt=""></div>`;
  $('pfLooks').innerHTML = [0, 1, 2, 3].map(i => `<button class="lookm ${i === pfLook ? 'on' : ''}" data-l="${i}" aria-label="${CHAR_NAME[i]}"><div class="in" style="background:${UI[pfColor]}"><img src="${face(i, pfColor)}" alt=""></div><small>${CHAR_NAME[i]}</small></button>`).join('');
  $('pfColors').innerHTML = UI.map((c, i) => `<button class="gemc ${i === pfColor ? 'on' : ''}" data-c="${i}" style="background:${c};color:${c}" aria-label="${CNAME[i]} colour"></button>`).join('');
  document.querySelectorAll('#pfPhotoBtns [data-ph]').forEach(b => b.classList.toggle('on', b.dataset.ph === 'cartoon' ? !pfPhoto : false));
}
$('pfLooks').addEventListener('click', e => { const b = e.target.closest('[data-l]'); if (b) { pfLook = +b.dataset.l; sfx('click'); renderProfile(); } });
$('pfColors').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { pfColor = +b.dataset.c; sfx('click'); renderProfile(); } });
$('pfName').addEventListener('input', () => { $('pfErr').textContent = ''; });
$('pfBack').onclick = () => show('home');
// Photo: the Android app opens the camera or gallery and sends back a small square JPEG.
// In a browser, a file picker is used instead.
function askPhoto(from) {
  if (window.LDNative && window.LDNative.pickPhoto) { try { window.LDNative.pickPhoto(from); return; } catch (e) { /* use the file picker */ } }
  const f = $('pfFile'); if (from === 'camera') f.setAttribute('capture', 'user'); else f.removeAttribute('capture'); f.value = ''; f.click();
}
window.ldPhoto = data => {
  if (!data) return;
  squarePhoto(data, 256).then(d => { pfPhoto = d; renderProfile(); sfx('pop'); }).catch(() => {});
};
$('pfFile').addEventListener('change', e => {
  const file = e.target.files && e.target.files[0]; if (!file) return;
  const r = new FileReader(); r.onload = () => window.ldPhoto(r.result); r.readAsDataURL(file);
});
// Centre-crops a picture to a square JPEG of the given size.
function squarePhoto(src, size) {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const side = Math.min(im.width, im.height);
      c.getContext('2d').drawImage(im, (im.width - side) / 2, (im.height - side) / 2, side, side, 0, 0, size, size);
      res(c.toDataURL('image/jpeg', size > 200 ? 0.82 : 0.75));
    };
    im.onerror = rej; im.src = src;
  });
}
$('pfPhotoBtns').addEventListener('click', e => {
  const b = e.target.closest('[data-ph]'); if (!b) return; sfx('click');
  if (b.dataset.ph === 'cartoon') { pfPhoto = null; renderProfile(); return; }
  askPhoto(b.dataset.ph);
});
$('pfCam').onclick = () => {
  sfx('click');
  modal(`<h3>Change photo</h3><div class="grid3"><button class="pbtn" id="mCam"><span>📷</span>Camera</button><button class="pbtn" id="mGal"><span>🖼️</span>Gallery</button><button class="pbtn" id="mCart"><span>🙂</span>Cartoon</button></div><button class="btn ghost" id="mNo">Cancel</button>`);
  $('mCam').onclick = () => { closeModal(); askPhoto('camera'); };
  $('mGal').onclick = () => { closeModal(); askPhoto('gallery'); };
  $('mCart').onclick = () => { closeModal(); pfPhoto = null; renderProfile(); };
  $('mNo').onclick = closeModal;
};
$('pfSave').onclick = () => {
  const name = $('pfName').value.trim().replace(/\s+/g, ' ');
  if (name.length < 2) { $('pfErr').textContent = 'Enter a name with at least 2 letters'; return; }
  const first = !profile;
  profile = { name, look: pfLook, color: pfColor };
  store.set('profile', profile);
  if (pfPhoto !== myPhoto) {
    myPhoto = pfPhoto;
    try { if (myPhoto) localStorage.setItem('ld:photo', JSON.stringify(myPhoto)); else localStorage.removeItem('ld:photo'); } catch (e) { toast('Photo too big to save', '#E0103A'); }
    sendMyPhoto();
  }
  sfx('pop'); show('home'); if (first) takeLinkRoom(); else toast('Profile saved', '#3A2490');
};
// In an online room, share your photo with the players in it (small copy, not saved by the server).
function sendMyPhoto() {
  if (!G || !G.net) return;
  if (!myPhoto) { G.net.send({ t: 'photo', img: '' }); return; }
  squarePhoto(myPhoto, 128).then(d => { if (G && G.net) G.net.send({ t: 'photo', img: d }); }).catch(() => {});
}

// ---------- Match history (kept on this phone) ----------
let history = store.get('history', []);
// Photos of people you played with online, small copies kept on this phone for the history list.
let friendPhotos = store.get('fphotos', {});
// Solo levels (Arrow Escape, Helix): each cleared level counts as a win.
function soloLevelWin(game, score) { if (!G) return; G.recorded = false; addHistory({ game, mode: 'solo', result: 'won', of: 1, score, opp: [] }); G.recorded = false; }
function addHistory(h) {
  if (!G || G.recorded) return;
  G.recorded = true;
  history.unshift(Object.assign({ at: Date.now() }, h));
  if (history.length > 400) history.length = 400;
  store.set('history', history);
  rewardGame(h);
  (h.opp || []).forEach(o => {
    const img = o.id && G.mode === 'online' ? roomPhotos.get(o.id) : null;
    if (!img) return;
    squarePhoto(img, 72).then(d => {
      friendPhotos[o.id] = { img: d, at: Date.now() };
      // Keep only photos of people still in the history, at most 40.
      const used = new Set(); history.forEach(x => (x.opp || []).forEach(y => y.id && used.add(y.id)));
      const keep = Object.keys(friendPhotos).filter(k => used.has(k)).sort((a, b) => friendPhotos[b].at - friendPhotos[a].at).slice(0, 40);
      friendPhotos = Object.fromEntries(keep.map(k => [k, friendPhotos[k]]));
      store.set('fphotos', friendPhotos);
      if (current === 'history') renderHistory(); else if (current === 'hgame') renderHGame();
    }).catch(() => {});
  });
}
function stats(list) {
  const L = list || history;
  const won = L.filter(h => h.result === 'won').length, lost = L.filter(h => h.result === 'lost').length;
  let streak = 0; for (const h of L) { if (h.result === 'won') streak++; else if (h.result === 'lost') break; }
  const by = {}; L.forEach(h => { if (h.result === 'won') by[h.game] = (by[h.game] || 0) + 1; });
  const best = Object.keys(by).sort((x, y) => by[y] - by[x])[0] || null;
  return { played: L.length, won, lost, rate: L.length ? Math.round(won / L.length * 100) : 0, streak, best };
}
const GAME_ICON = { ludo: '🎲', chess: '&#9822;', carrom: '🎯', snakes: '🐍', patta: '🃏', sudoku: '🔢', arrows: '➹', draw: '✏️', helix: '🌀' };
function statsHtml(st, profileView) {
  const four = profileView
    ? [['gold', st.played, 'Played'], ['green', st.won, 'Won'], ['', st.rate + '%', 'Win rate'], ['', (st.streak ? '🔥' : '') + st.streak, 'Streak']]
    : [['gold', st.played, 'Games'], ['green', st.won, 'Wins'], ['', st.lost, 'Losses'], ['', st.best ? `<span class="${st.best === 'chess' ? 'gl' : ''}">${GAME_ICON[st.best]}</span>` : '–', st.best ? 'Best at ' + GAME_NAME[st.best].split(' ')[0] : 'Best game']];
  return four.map(x => `<div class="stat"><b class="${x[0]}">${x[1]}</b><span>${x[2]}</span></div>`).join('');
}
function dayLabel(t) {
  const d = new Date(t), now = new Date(), a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t >= a) return 'Today';
  if (t >= a - 864e5) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
const MODE_TEXT = { online: 'online', bot: 'vs computer', local: 'pass & play', solo: '' };
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
// Player level: one level for every 3 wins, with a title.
function levelOf(won) {
  const lv = 1 + Math.floor(won / 3), titles = [[15, 'Maharaja'], [10, 'Shahi Khiladi'], [6, 'Ustaad'], [3, 'Khiladi'], [1, 'Naya Khiladi']];
  return { lv, title: titles.find(t => lv >= t[0])[1], left: 3 - (won % 3), frac: (won % 3) / 3 };
}
const GAME_GRAD = { ludo: ['#ff5a82', '#c3093f', '#5a0020'], chess: ['#8f6bff', '#4a22d6', '#1d0a6b'], carrom: ['#ffb347', '#e06d06', '#5a1e06'], snakes: ['#3ee0a3', '#059669', '#053b2c'],
  patta: ['#ff7a59', '#d6301b', '#5a0a06'], sudoku: ['#ffe27a', '#c99400', '#4a3300'], arrows: ['#5ad8ff', '#1479d6', '#082a6b'], draw: ['#ff8fd1', '#c2188a', '#4a0638'], helix: ['#ff8fd1', '#b02a8a', '#3a0d5a'] };
const gname = g => GAME_NAME[g].replace(' & Ladders', '');
const ringSvg = (pc, size, w, col) => { const r = size / 2 - w / 2 - 1, L = 2 * Math.PI * r; return `<svg viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#12072e" stroke-width="${w}"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(L * pc / 100).toFixed(1)} ${L.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>`; };
const secsOf = h => { if (h.secs) return h.secs; const m = /in (\d+):(\d+)/.exec(h.score || ''); return m ? +m[1] * 60 + +m[2] : null; };
const mmss = t => `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
function gameBest(g, L) {
  const W = L.filter(h => h.result === 'won');
  if (g === 'sudoku') { const t = W.map(secsOf).filter(Boolean); return t.length ? 'best ' + mmss(Math.min(...t)) : ''; }
  if (g === 'ludo' || g === 'snakes' || g === 'patta' || g === 'draw') { return W.length ? `${W.length}× 1st place` : ''; }
  if (g === 'carrom' && W.length) return 'best ' + (W[0].score || '').split(' ·')[0];
  return W.length ? `${W.length} won` : '';
}
function renderHistory() {
  const st = stats(), lv = levelOf(st.won);
  $('hHero').innerHTML = `<div class="jl"></div><div class="med"><div class="medal">${myPhoto ? `<div class="in photo" style="background:${UI[profile.color]}"><img src="${myPhoto}" alt=""></div>` : `<div class="in" style="background:${UI[profile.color]}"><img src="${face(profile.look, profile.color)}" alt=""></div>`}</div>${lv.lv >= 10 ? '<span class="crown">👑</span>' : ''}</div>
    <div class="info"><span class="rank">${lv.title.toUpperCase()} · LV ${lv.lv}</span><div class="nm">${esc(profile.name)}</div><div class="xp"><i style="width:${lv.frac * 100}%"></i></div><div class="xpt">${lv.left} more win${lv.left > 1 ? 's' : ''} to level ${lv.lv + 1}</div></div>
    <div class="donut">${ringSvg(st.rate, 92, 10, 'url(#g)')}<b class="goldtxt">${st.rate}%<small>WIN RATE</small></b></div>
    <div class="chipsrow"><span class="pillA">🎮 <b>${st.played}</b> played</span><span class="pillA">🏆 <b>${st.won}</b> won</span><span class="pillA">🔥 <b>${st.streak}</b> streak</span></div>`;
  $('hRecentWrap').style.display = history.length ? '' : 'none';
  $('hRecent').innerHTML = history.slice(0, 6).map(h => {
    const c = GAME_GRAD[h.game] || GAME_GRAD.ludo, won = h.result === 'won';
    const opp = (h.opp || []).map(o => o.name), vs = opp.length ? (opp.length > 1 ? `${opp.length + 1} players` : 'vs ' + esc(opp[0])) : '';
    return `<button class="rc" data-g="${h.game}" style="background:radial-gradient(120% 120% at 80% 20%, ${c[0]}, ${c[1]} 50%, ${c[2]})"><span class="res ${won ? 'w' : 'l'}">${won ? 'WON' : h.result === 'draw' ? 'DRAW' : 'LOST'}</span><span class="ic">${GAME_ICON[h.game]}</span><b>${gname(h.game)}</b><span>${esc((h.score || '').split(' ·')[0]) || vs}</span><span>${new Date(h.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span></button>`;
  }).join('');
  const by = {}; history.forEach(h => { (by[h.game] = by[h.game] || []).push(h); });
  const games = Object.keys(by).sort((a, b) => by[b].length - by[a].length);
  if (!games.length) { $('hGames').innerHTML = `<div class="panel hempty"><b>No games yet</b>Play a game and it will show up here.</div>`; return; }
  $('hGames').innerHTML = games.map((g, k) => {
    const L = by[g], w = L.filter(h => h.result === 'won').length, pc = Math.round(w / L.length * 100), c = GAME_GRAD[g];
    const best = gameBest(g, L), spark = L.slice(0, 10).reverse().map(h => `<i class="${h.result === 'won' ? 'w' : 'l'}"></i>`).join('');
    return `<button class="gc" data-g="${g}" style="--c1:${c[1]}cc"><div class="gbadge ${g}">${GAME_ICON[g]}</div><div class="grow minw0"><div class="t">${gname(g)}${k === 0 && games.length > 1 ? ' <span class="fav">★ FAVOURITE</span>' : ''}</div>
      <div class="s">${L.length} played · ${w} won${best ? ' · ' + best : ''}</div><div class="spark">${spark}</div></div>
      <div class="ring">${ringSvg(pc, 58, 7, pc >= 50 ? '#5dffa8' : '#ffd34d')}<b>${pc}%</b></div><span class="chev">›</span></button>`;
  }).join('');
}
$('history').addEventListener('click', e => { const b = e.target.closest('[data-g]'); if (b) { sfx('click'); openHGame(b.dataset.g); } });
// One game's history
let hgGame = 'ludo', hgFilter = 'all', hgShow = 12;
function openHGame(g) { hgGame = g; hgFilter = 'all'; hgShow = 12; show('hgame'); }
function hgFiltersFor(g, L) {
  const f = [['all', 'All'], ['won', 'Won'], ['lost', 'Lost']];
  if (g === 'sudoku') ['Easy', 'Medium', 'Hard', 'Expert'].forEach(x => { if (L.some(h => (h.score || '').startsWith(x))) f.push([x, x]); });
  if (g === 'sudoku' && L.some(h => h.daily)) f.push(['daily', 'Daily']);
  if (g === 'carrom') ['Free Style', 'Disc Pool'].forEach(x => { if (L.some(h => (h.score || '').includes(x))) f.push([x, x]); });
  if (L.some(h => h.mode === 'online') && L.some(h => h.mode !== 'online')) f.push(['online', 'Online']);
  return f;
}
function renderHGame() {
  const g = hgGame, L = history.filter(h => h.game === g), c = GAME_GRAD[g];
  const w = L.filter(h => h.result === 'won').length, pc = L.length ? Math.round(w / L.length * 100) : 0;
  $('hgBanner').style.background = `radial-gradient(90% 80% at 75% 20%, ${c[0]}, ${c[1]} 40%, ${c[2]} 85%)`;
  $('hgBanner').innerHTML = `<div class="jaali"></div><span class="big">${GAME_ICON[g]}</span><div class="fade"></div>`;
  $('hgTitle').innerHTML = `<b class="goldtxt">${gname(g)}</b><span>Your history · ${L.length} game${L.length === 1 ? '' : 's'}</span>`;
  let t3 = ['', ''], t4 = ['', ''];
  if (g === 'sudoku') { const t = L.filter(h => h.result === 'won').map(secsOf).filter(Boolean); t3 = [t.length ? mmss(Math.min(...t)) : '–', 'Best time']; t4 = [t.length ? mmss(Math.round(t.reduce((a, b) => a + b, 0) / t.length)) : '–', 'Average']; }
  else { let s = 0; for (const h of L) { if (h.result === 'won') s++; else break; } t3 = [pc + '%', 'Win rate']; t4 = [(s ? '🔥' : '') + s, 'Streak']; }
  $('hgTiles').innerHTML = [[L.length, 'Played', 'goldtxt'], [w, 'Won', 'green'], [t3[0], t3[1], ''], [t4[0], t4[1], '']].map(x => `<div class="tile2"><b class="${x[2]}">${x[0]}</b><span>${x[1]}</span></div>`).join('');
  // Last 7 days
  const day0 = new Date(); day0.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, k) => { const a = day0.getTime() - (6 - k) * 864e5, b = a + 864e5, D = L.filter(h => h.at >= a && h.at < b); return { w: D.filter(h => h.result === 'won').length, l: D.filter(h => h.result !== 'won').length, d: k === 6 ? 'Today' : new Date(a).toLocaleDateString(undefined, { weekday: 'short' }) }; });
  const mx = Math.max(1, ...days.map(d => d.w + d.l));
  $('hgChart').innerHTML = `<div class="ch"><span>Last 7 days</span><span class="lg"><i class="w"></i>won <i class="l"></i>lost</span></div><div class="bars">${days.map(d => `<div><div class="st" style="height:${(d.w + d.l) / mx * 60}px"><i class="w" style="flex:${d.w}"></i><i class="l" style="flex:${d.l}"></i></div><small>${d.d}</small></div>`).join('')}</div>`;
  $('hgFilters').innerHTML = hgFiltersFor(g, L).map(f => `<button class="chip ${hgFilter === f[0] ? 'on' : ''}" data-hf="${f[0]}">${f[1]}</button>`).join('');
  const F = L.filter(h => hgFilter === 'all' || (hgFilter === 'won' ? h.result === 'won' : hgFilter === 'lost' ? h.result !== 'won' : hgFilter === 'daily' ? h.daily : hgFilter === 'online' ? h.mode === 'online' : (h.score || '').includes(hgFilter)));
  if (!F.length) { $('hgList').innerHTML = `<div class="panel hempty"><b>Nothing here</b>No games match this filter.</div>`; return; }
  const bestT = g === 'sudoku' ? Math.min(...L.filter(h => h.result === 'won').map(secsOf).filter(Boolean)) : null;
  const groups = [];
  F.slice(0, hgShow).forEach(h => { const k = dayLabel(h.at); let gr = groups[groups.length - 1]; if (!gr || gr.k !== k) groups.push(gr = { k, list: [] }); gr.list.push(h); });
  $('hgList').innerHTML = groups.map(gr => `<div><div class="sec">${gr.k}</div><div class="panel" style="padding:0">${gr.list.map(h => {
    const won = h.result === 'won', opp = (h.opp || []).map(o => o.name);
    const vs = opp.length ? (opp.length > 2 ? `${opp.length + 1} players` : 'vs ' + opp.map(esc).join(', ')) : '';
    const time = new Date(h.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const rib = won ? '' : h.rank && h.of > 2 ? ordinal(h.rank) + ' place' : h.result === 'draw' ? 'Draw' : 'Lost';
    const parts = [vs, MODE_TEXT[h.mode] || '', time].filter(Boolean).join(' · ');
    const nb = g === 'sudoku' && won && secsOf(h) === bestT;
    return `<div class="mrow ${won ? 'w' : 'l'}"><div class="grow minw0"><div class="t">${esc((h.score || gname(g)).split(' ·')[0])}${h.daily ? ' · Daily 🏆' : ''}${nb ? ' <span class="newbest">BEST</span>' : ''}</div><div class="s">${parts}</div></div>
      <div class="tm"><b class="${won ? 'goldtxt' : 'lost'}">${won ? 'WON' : rib}</b></div>
      <div class="minis">${(h.opp || []).slice(0, 3).map(o => { const fp = o.id && friendPhotos[o.id]; return `<div class="mini" style="background:${UI[o.tint || 0]}"><img src="${fp ? fp.img : face(o.look, o.tint || 0)}" alt=""${fp ? ' style="object-position:center"' : ''}></div>`; }).join('')}</div></div>`;
  }).join('')}</div></div>`).join('') + (F.length > hgShow ? `<button class="panel more" id="hgMore">Show ${Math.min(20, F.length - hgShow)} more ›</button>` : '');
}
$('hgFilters').addEventListener('click', e => { const b = e.target.closest('[data-hf]'); if (b) { hgFilter = b.dataset.hf; hgShow = 12; sfx('click'); renderHGame(); } });
$('hgList').addEventListener('click', e => { if (e.target.closest('#hgMore')) { hgShow += 20; sfx('click'); renderHGame(); } });
$('hgBack').onclick = () => { sfx('click'); show('history'); };

// ---------- Home ----------
// The game picked on the Pitara home screen: 'ludo' or 'chess'.
let GAME = store.get('game', 'ludo');
const GAME_NAME = { ludo: 'Ludo', chess: 'Chess', snakes: 'Snakes & Ladders', carrom: 'Carrom', patta: 'UNO', sudoku: 'Sudoku', arrows: 'Arrow Escape', draw: 'Draw & Guess', helix: 'Helix Drop' };
// Screens where a game is being played (music off, back button asks to leave, chat bubbles).
const PLAY_SCREENS = ['game', 'chess', 'carrom', 'patta', 'sudoku', 'arrows', 'draw', 'helix'];
const ARCH = '<svg class="frame" viewBox="0 0 176 228" preserveAspectRatio="none"><use href="#archOuter" fill="none" stroke="url(#g)" stroke-width="7"/><use href="#archInner" fill="none" stroke="#ffe17a" stroke-width="1.2" opacity=".8"/><circle cx="88" cy="7" r="5" fill="GEM" stroke="#ffe17a" stroke-width="2"/></svg>';
function renderHome() {
  $('homeAv').innerHTML = myPhoto ? `<div class="in photo" style="background:${UI[profile.color]}"><img src="${myPhoto}" alt=""></div>` : `<div class="in" style="background:${UI[profile.color]}"><img src="${face(profile.look, profile.color)}" alt=""></div>`;
  $('homeName').textContent = profile.name;
  const st = stats();
  $('homeChips').innerHTML = `<span class="hchip g">🏆 ${st.won} win${st.won === 1 ? '' : 's'}</span>${st.streak > 1 ? `<span class="hchip">🔥 ${st.streak} streak</span>` : ''}`;
  if (!$('homeLights').innerHTML) {
    const cols = ['#ffd34d', '#ff5f93', '#4be3d0', '#ffd34d', '#ff9f43'];
    let h = '<path d="M0 6 Q102 46 205 14 Q308 46 410 6" fill="none" stroke="#3b2a1a" stroke-width="1.5"/>';
    for (let i = 1; i < 28; i++) {
      const t = i / 28, x = t * 410, u = t < 0.5 ? t * 2 : (t - 0.5) * 2, y = 6 + Math.sin(u * Math.PI) * 22 + (Math.abs(t - 0.5) < 0.02 ? -10 : 0), c = cols[i % 5];
      h += `<g class="b" style="animation-delay:${(i % 7) * 0.33}s"><circle cx="${x}" cy="${y + 7}" r="9" fill="${c}" opacity=".25"/><circle cx="${x}" cy="${y + 7}" r="3.6" fill="${c}"/><circle cx="${x - 1}" cy="${y + 6}" r="1.2" fill="#fff"/></g>`;
    }
    $('homeLights').innerHTML = h;
  }
  const arch = (g, gem, count, art, name, sub, cls, isNew, off) => `<button class="arch ${g}" ${off ? 'disabled' : `data-game="${g}"`}>${isNew ? '<span class="new">NEW</span>' : ''}<div class="inner"></div>${ARCH.replace('GEM', gem)}${count ? `<span class="count">${count}</span>` : ''}<div class="art">${art}</div><div class="name"><b class="${cls || ''}">${name}</b><span>${sub}</span></div></button>`;
  const pk = (l, t) => `<i style="${l};background:${t}"></i>`;
  const mc = (c, v, r) => pcardHtml({ c, v }, '', `style="transform:rotate(${r}deg)"`);
  $('games').innerHTML =
    arch('ludo', '#e5196f', '2-4', `<img class="body" src="img/c0-0.png" alt="" style="height:100px;margin-right:-22px">` + body(3, 3, 106), 'Ludo', 'Walk your team home') +
    arch('chess', '#0fb5a5', '2', '<span class="glyph w">&#9819;</span><span class="glyph g">&#9822;</span>', 'Chess', 'With move help') +
    arch('carrom', '#e5196f', '2', `<div class="cboard3">${pk('left:1px;top:1px', '#120a06')}${pk('right:1px;top:1px', '#120a06')}${pk('left:1px;bottom:1px', '#120a06')}${pk('right:1px;bottom:1px', '#120a06')}${pk('left:28px;top:28px', '#d9142e')}${pk('left:15px;top:30px', '#f6efdc')}${pk('left:41px;top:25px', '#1f1f1f')}<i style="left:30px;top:44px;width:15px;height:15px;background:#eef;border:2px solid #3d5afe"></i></div>`, 'Carrom', '3 ways to play') +
    arch('snakes', '#0fb5a5', '2-4', body(2, 2, 104), 'Snakes &amp; Ladders', 'First to 100', 'long') +
    arch('patta', '#0fb5a5', '2-4', `<div class="minicards">${mc(0, 7, -16)}${mc(3, 'rev', -2)}${mc(2, 'd2', 14)}</div>`, 'UNO', 'Colour &amp; number', '', true) +
    arch('sudoku', '#e5196f', '1-4', `<div class="minisd">${[5, '', 3, '', 8, '', 7, '', 1].map((n, i) => `<i class="${i === 4 ? 'on' : ''}">${n}</i>`).join('')}</div>`, 'Sudoku', 'Daily puzzle', '', true) +
    arch('arrows', '#0fb5a5', '1-4', '<svg viewBox="0 0 80 80" style="width:78px;height:78px;margin-bottom:10px;stroke:none"><g stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M14 22 H50 M44 14 L54 22 L44 30" stroke="#fff"/><path d="M30 40 V70 M22 62 L30 72 L38 62" stroke="#ffd34d"/><path d="M66 70 V36 M58 44 L66 34 L74 44" stroke="#ff5f93"/><path d="M46 52 H14 M22 44 L12 52 L22 60" stroke="#7af0ff"/></g></svg>', 'Arrow Escape', `Level ${settings.arLevel || 1}`, 'long', true) +
    arch('draw', '#ffd34d', '2-6', '<div class="minidraw"><span class="pg"><svg viewBox="0 0 100 90"><path d="M30 34 C42 20 66 24 70 44 C74 64 56 76 42 72 C26 68 22 52 30 34Z" fill="none" stroke="#e6a800" stroke-width="5"/><path d="M48 26 L52 14" stroke="#6b3a00" stroke-width="5" stroke-linecap="round"/><path d="M52 16 C60 8 72 10 74 16 C66 20 58 20 52 16Z" fill="#059669" stroke="none"/></svg></span><i>✏️</i></div>', 'Draw &amp; Guess', 'Draw, friends guess', 'long', true) +
    arch('helix', '#e5196f', '1-4', '<svg viewBox="0 0 80 90" style="width:76px;height:86px;margin-bottom:8px;stroke:none"><rect x="35" y="0" width="10" height="90" rx="3" fill="#fff6c4"/><path d="M6 22 A34 10 0 0 0 74 22 L74 28 A34 10 0 0 1 6 28Z" fill="#ffb3d9"/><ellipse cx="40" cy="22" rx="34" ry="10" fill="#ffd1ea"/><path d="M40 22 L74 22 A34 10 0 0 1 58 31Z" fill="#e5196f"/><path d="M6 52 A34 10 0 0 0 74 52 L74 58 A34 10 0 0 1 6 58Z" fill="#ffb3d9"/><ellipse cx="40" cy="52" rx="34" ry="10" fill="#ffd1ea"/><path d="M40 52 L6 52 A34 10 0 0 1 22 43Z" fill="#7a2a8a"/><circle cx="54" cy="10" r="7" fill="#ff3b6b" stroke="#fff" stroke-width="1.5"/></svg>', 'Helix Drop', `Level ${settings.hxLevel || 1}`, 'long', true);
  music(true);
}
$('homeAv').onclick = () => { sfx('click'); openProfile(); };
$('homeHistory').onclick = () => { sfx('click'); show('history'); };
$('games').addEventListener('click', e => {
  const b = e.target.closest('[data-game]'); if (!b) return; sfx('click');
  GAME = b.dataset.game; store.set('game', GAME); show('gamehome');
});
const PIECE = { k: '&#9818;', q: '&#9819;', r: '&#9820;', b: '&#9821;', n: '&#9822;', p: '&#9823;' };
function renderModes() {
  const chess = GAME === 'chess';
  $('gameLogo').innerHTML = chess ? '<div class="l1">3D</div><div class="l2">Chess</div>' : GAME === 'carrom' ? '<div class="l1">Carrom</div>' : GAME === 'snakes' ? '<div class="l1">Snakes</div><div class="l2">& Ladders</div>' : GAME === 'patta' ? '<div class="l1">UNO</div>' : GAME === 'sudoku' ? '<div class="l1">Sudoku</div>' : GAME === 'arrows' ? '<div class="l1">Arrow</div><div class="l2">Escape</div>' : GAME === 'draw' ? '<div class="l1">Draw &amp;</div><div class="l2">Guess</div>' : GAME === 'helix' ? '<div class="l1">Helix</div><div class="l2">Drop</div>' : '<div class="l1">Ludo</div><div class="l2">Dhamaal</div>';
  const g = k => `<div class="glyphs">${k}</div>`;
  const modes = GAME === 'carrom' ? [
    ['online', 'Create online room', 'Play a friend anywhere and talk on mic', 0, [0, 1]],
    ['join', 'Join a room', 'Enter your friend’s room code', 3, [3]],
    ['bot', 'Play vs computer', 'Play solo against the computer', 1, [1]],
    ['local', 'Pass & play', '2 players taking turns on one phone', 2, [2, 0]]
  ] : chess ? [
    ['online', 'Create online room', 'Play a friend anywhere and talk on mic', 0, g(PIECE.q + PIECE.k)],
    ['join', 'Join a room', 'Enter your friend’s room code', 3, g(PIECE.r)],
    ['bot', 'Play vs computer', 'Play solo against the computer', 1, g(PIECE.n)],
    ['local', 'Pass & play', '2 players taking turns on one phone', 2, g(PIECE.b + PIECE.p)]
  ] : [
    ['online', 'Create online room', 'Invite friends anywhere and talk on mic', 0, [0, 1]],
    ['join', 'Join a room', 'Enter your friend’s room code', 3, [3, 2]],
    ['bot', 'Play vs computer', 'Play solo against a bot', 1, [1]],
    ['local', 'Pass & play', '2-4 players taking turns on one phone', 2, [2, 0, 3]]
  ];
  const list = modes.map(m => `<button class="mode ${GAME === 'carrom' ? 'sm' : ''}" data-mode="${m[0]}" style="background:${UI[m[3]]};border-color:${UI_EDGE[m[3]]};color:${UI_FG[m[3]]}">
    <div class="col grow"><span class="t">${m[1]}</span><span class="s">${m[2]}</span></div>
    <div class="ppl">${typeof m[4] === 'string' ? m[4] : m[4].map(i => body(i, i, GAME === 'carrom' ? 58 : 82)).join('')}</div></button>`).join('');
  if (GAME === 'sudoku') { $('modes').innerHTML = sudokuModesHtml(); music(true); return; }
  if (GAME === 'arrows') { $('modes').innerHTML = arrowModesHtml(); music(true); return; }
  if (GAME === 'helix') {
    const lv = settings.hxLevel || 1;
    $('modes').innerHTML = `<button class="sdmode gold" data-hxmode="play"><span class="col grow"><b>Play level ${lv}</b><small>Best score ${store.get('hxBest', 0)}. Swipe to turn the tower, drop through the gaps</small></span></button>
      <button class="sdmode ruby" data-mode="online"><span class="col grow"><b>Race a friend</b><small>Same tower for both, talk on mic. First to the bottom wins</small></span></button>
      <button class="sdmode blue" data-mode="join"><span class="col grow"><b>Join a race</b><small>Enter your friend’s room code</small></span></button>`;
    music(true); return;
  }
  if (GAME === 'draw') {
    $('modes').innerHTML = `<div class="drawintro panel"><b>How it works</b><span>One person draws a secret word. Everyone else types guesses. The quicker you guess, the more points you get. Everyone draws once in each of 3 rounds. 2 to 6 players, with voice chat.</span></div>
      <button class="sdmode ruby" data-mode="online"><span class="col grow"><b>Create a room</b><small>Invite friends on WhatsApp</small></span></button>
      <button class="sdmode blue" data-mode="join"><span class="col grow"><b>Join a room</b><small>Enter your friend’s room code</small></span></button>`;
    music(true); return;
  }
  $('modes').innerHTML = GAME === 'chess' ? puzzleCardHtml() + list : GAME === 'carrom' ? carromTypesHtml() + `<div class="modegrid">${list}</div>` : GAME === 'ludo' ? ludoModesHtml() + `<div class="modegrid">${list}</div>` : list;
  music(true);
}
// Ludo: four ways to play, picked above the play buttons.
const LMODES = [
  ['classic', '🎲', 'Classic', 'All 4 tokens home to win'],
  ['quick', '⚡', 'Quick Ludo', '2 tokens each, already out. Short games'],
  ['timer', '⏱', 'Timer Ludo', '10 minutes. Points for steps and captures'],
  ['team', '🤝', '2 vs 2 Team', 'Partner sits opposite. 4 players, win together']
];
const LMODE_NAME = { classic: 'Classic', quick: 'Quick Ludo', timer: 'Timer Ludo', team: '2 vs 2 Team' };
function ludoModesHtml() {
  return `<div class="lmodes">${LMODES.map(t => `<button class="lmode ${t[0]} ${settings.ludoMode === t[0] ? 'on' : ''}" data-lmode="${t[0]}"><i>${t[1]}</i><span class="col grow"><b>${t[2]}</b><small>${t[3]}</small></span>${settings.ludoMode === t[0] ? '<em class="tick">✓</em>' : ''}</button>`).join('')}</div>`;
}
// Carrom: three ways to play and the striker design, picked above the play buttons.
const CTYPES = [
  ['classic', 'Carrom', 'Pocket your colour and cover the Queen'],
  ['free', 'Free Style', 'Any coin scores: white 20, black 10, Queen 50'],
  ['disc', 'Disc Pool', 'Pocket your 8 coins, then the black one']
];
const CTYPE_NAME = { classic: 'Carrom', free: 'Free Style', disc: 'Disc Pool' };
function carromTypesHtml() {
  return `<div class="ctypes">${CTYPES.map(t => `<button class="ctype ${t[0]} ${settings.carromMode === t[0] ? 'on' : ''}" data-ctype="${t[0]}"><svg viewBox="0 0 120 120">${carromPic(t[0])}</svg><span class="col"><b>${t[1]}</b><small>${t[2]}</small></span>${settings.carromMode === t[0] ? '<i class="tick">✓</i>' : ''}</button>`).join('')}</div>
  <div class="panel strow"><div class="vic">🎯</div><div class="col grow"><b>Striker</b><small>Your striker design</small></div>${['blue', 'gold', 'ruby'].map((c, i) => eco.owned.includes('st' + i) ? `<button class="stk ${c} ${settings.striker === i ? 'on' : ''}" data-stk="${i}" aria-label="${c} striker"></button>` : '').join('')}<button class="stk more" data-go="shop" aria-label="More strikers in the shop">+</button></div>`;
}
function carromPic(mode) {
  let s = '<rect x="4" y="4" width="112" height="112" rx="10" fill="#5a2a10"/><rect x="12" y="12" width="96" height="96" rx="4" fill="#f1d498"/>';
  [[18, 18], [102, 18], [18, 102], [102, 102]].forEach(p => { s += `<circle cx="${p[0]}" cy="${p[1]}" r="6.5" fill="#120a06"/>`; });
  const cols = mode === 'disc' ? ['#f6efdc', '#1f1f1f'] : ['#f6efdc', '#1f1f1f'];
  const c = [[60, 60, mode === 'disc' ? '#3a1866' : '#d9142e']];
  for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; c.push([60 + Math.cos(a) * 10, 60 + Math.sin(a) * 10, cols[i % 2]]); }
  for (let i = 0; i < (mode === 'disc' ? 10 : 12); i++) { const a = i * Math.PI * 2 / (mode === 'disc' ? 10 : 12) + 0.3; c.push([60 + Math.cos(a) * 20, 60 + Math.sin(a) * 20, cols[(i + 1) % 2]]); }
  c.forEach(o => { s += `<circle cx="${o[0]}" cy="${o[1]}" r="5" fill="${o[2]}" stroke="${o[2] === '#3a1866' ? '#ffd34d' : 'rgba(0,0,0,.35)'}" stroke-width="1.2"/>`; });
  if (mode === 'free') s += '<text x="60" y="44" text-anchor="middle" font-size="13" font-weight="800" fill="#b87800" stroke="none">+20</text>';
  return s + '<circle cx="60" cy="96" r="7" fill="#eef" stroke="#3d5afe" stroke-width="2.5"/>';
}
$('modes').addEventListener('click', e => {
  const lv = e.target.closest('[data-sdlevel]'); if (lv) { settings.sdLevel = lv.dataset.sdlevel; store.set('settings', settings); sfx('click'); renderModes(); return; }
  const sm = e.target.closest('[data-sdmode]'); if (sm) { sfx('click'); sudokuMode(sm.dataset.sdmode); return; }
  const hm = e.target.closest('[data-hxmode]'); if (hm) { sfx('click'); startHelix(settings.hxLevel || 1); return; }
  const am = e.target.closest('[data-armode]'); if (am) { sfx('click'); arrowMode(am.dataset.armode); return; }
  if (e.target.closest('[data-puzzle]')) { sfx('click'); startPuzzle(); return; }
  const lm = e.target.closest('[data-lmode]'); if (lm) { settings.ludoMode = lm.dataset.lmode; store.set('settings', settings); sfx('click'); renderModes(); return; }
  const ct = e.target.closest('[data-ctype]'); if (ct) { settings.carromMode = ct.dataset.ctype; store.set('settings', settings); sfx('click'); renderModes(); return; }
  const sk = e.target.closest('[data-stk]'); if (sk) { settings.striker = +sk.dataset.stk; store.set('settings', settings); eco.use.st = 'st' + settings.striker; saveEco(); sfx('click'); if (rboard) rboard.setStrikerStyle(settings.striker); renderModes(); return; }
  const b = e.target.closest('[data-mode]'); if (!b) return; sfx('click');
  const m = b.dataset.mode;
  if (m === 'online') createRoom();
  else if (m === 'join') { $('joinCode').value = ''; $('joinErr').textContent = ''; show('join'); }
  else openSetup(m);
});
$('homeSettings').onclick = () => { sfx('click'); openSettings(); };

// ---------- Offline setup ----------
let setupMode = 'bot', setupN = 2, setupSide = 'w';
function openSetup(m) {
  setupMode = m; setupN = GAME === 'ludo' && settings.ludoMode === 'team' ? 4 : 2;
  $('setupTitle').textContent = m === 'bot' ? 'Play vs computer' : 'Pass & play';
  renderSetup(); show('setup');
}
function setupColors() { return seatColors(setupN).map(c => (c + profile.color) % 4); }
function renderSetup() {
  if (GAME === 'chess') return renderChessSetup();
  if (GAME === 'carrom') return renderCarromSetup();
  const team = GAME === 'ludo' && settings.ludoMode === 'team';
  if (team) setupN = 4;
  $('setupTitle').textContent = (setupMode === 'bot' ? 'Play vs computer' : 'Pass & play') + (GAME === 'ludo' && settings.ludoMode !== 'classic' ? ' · ' + LMODE_NAME[settings.ludoMode] : '');
  $('setupAsk').textContent = team ? 'Your team: you and your partner (opposite corner)' : 'How many players?';
  $('setupCount').innerHTML = team ? '' : [2, 3, 4].map(n => `<button class="countbtn ${n === setupN ? 'on' : ''}" data-n="${n}">${n}</button>`).join('');
  $('setupLevel').innerHTML = setupMode === 'bot' && GAME === 'ludo' ? `<div class="lbl">Computer level</div><div class="row gap10">${[['easy', '😊 Easy'], ['medium', '🙂 Medium'], ['hard', '😈 Hard']].map(l => `<button class="lvlbtn ${settings.botLevel === l[0] ? 'on' : ''}" data-blv="${l[0]}">${l[1]}</button>`).join('')}</div>` : '';
  const cols = setupColors();
  $('setupNames').innerHTML = cols.map((c, i) => {
    const nm = i === 0 ? profile.name : (setupMode === 'bot' ? CHAR_NAME[[0, 1, 2, 3].filter(x => x !== ch(profile.look))[i - 1]] : 'Player ' + (i + 1));
    const ed = setupMode === 'local' && i > 0;
    const tag = team ? `<span class="teamtag ${i % 2 ? 'b' : 'a'}">${i === 0 ? 'You' : i === 2 ? 'Partner' : 'Rival'}</span>` : '';
    return `<div class="prow"><span class="dot" style="background:${UI[c]}"></span>${ed ? `<input class="input" data-pn="${i}" maxlength="14" value="${nm}">` : `<b style="font-size:18px">${esc(nm)}</b>`}${tag}</div>`;
  }).join('');
}
$('setupLevel').addEventListener('click', e => { const b = e.target.closest('[data-blv]'); if (b) { settings.botLevel = b.dataset.blv; store.set('settings', settings); sfx('click'); renderSetup(); } });
$('setupCount').addEventListener('click', e => {
  const sd = e.target.closest('[data-side]'); if (sd) { setupSide = sd.dataset.side; sfx('click'); renderSetup(); return; }
  const b = e.target.closest('[data-n]'); if (b) { setupN = +b.dataset.n; sfx('click'); renderSetup(); }
});
$('setupGo').onclick = () => {
  if (GAME === 'chess') return goChessSetup();
  if (GAME === 'carrom') return goCarromSetup();
  const cols = setupColors();
  const others = [0, 1, 2, 3].filter(x => x !== ch(profile.look));
  const players = cols.map((c, i) => {
    if (i === 0) return { id: pid, name: profile.name, color: c, kind: 'me', look: profile.look };
    if (setupMode === 'bot') return { id: 'bot' + i, name: CHAR_NAME[others[i - 1]], color: c, kind: 'bot', look: others[i - 1] };
    const inp = document.querySelector(`[data-pn="${i}"]`);
    return { id: 'p' + i, name: (inp && inp.value.trim()) || 'Player ' + (i + 1), color: c, kind: 'me', look: others[i - 1] };
  });
  if (GAME === 'patta') startPatta(setupMode, players.map(p => Object.assign(p, { tint: p.color })));
  else if (GAME === 'snakes') startSnakes(setupMode, players); else startOffline(setupMode, players);
};

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Game (shared) ----------
let board = null, G = null;
// A new <canvas> for every new 3D board, so a lost or old graphics context never comes back.
function freshCanvas(id) { const old = $(id), c = old.cloneNode(false); old.replaceWith(c); return c; }
function dropBoard() { if (board) { board.destroy(); board = null; } }
function ensureBoard(kind) {
  kind = kind || 'ludo';
  if (board && (board.kind !== kind || board.dead)) dropBoard();
  if (!board) { board = kind === 'snakes' ? new SnakeBoard3D(freshCanvas('board')) : new Board3D(freshCanvas('board')); board.kind = kind; if (board.setDiceStyle) board.setDiceStyle(itemOf(eco.use.dc).st); if (board.setTheme) board.setTheme(itemOf(eco.use.bd).th); }
  else board.resize();
  board.paused = false;
  return board;
}
// Put the players on the board as the game state says.
function syncBoard(b) {
  const s = G.s;
  const looks = {}; s.players.forEach(p => { looks[p.color] = ch(p.look); });
  b.setPlayers(s.order.slice(), looks);
  b.placeAll(s.game === 'snakes' ? s.pos : s.tokens);
  const me = s.players.find(p => p.id === pid) || s.players[0];
  b.faceColor(me.color);
}
// If the phone takes the 3D drawing away (white screen) and it does not come back by itself,
// build a new board with the same game on it.
function checkBoards() {
  const now = Date.now();
  [board, cboard, rboard].forEach(b => { if (b && !b.lost && !b.dead) { try { if (b.R.getContext().isContextLost()) { b.lost = true; b.lostAt = now; } } catch (e) { /* ignore */ } } });
  if (board && board.lost && now - board.lostAt > 900) {
    const hl = board.hlArgs, kind = board.kind; dropBoard();
    if (G && G.s && G.s.game !== 'chess') { const b = ensureBoard(kind); syncBoard(b); b.paused = current !== 'game'; if (hl) b.highlight(...hl); }
  }
  if (cboard && cboard.lost && now - cboard.lostAt > 900) {
    dropCBoard();
    if (G && G.s && G.s.game === 'chess') { const b = ensureCBoard(); b.setPosition(G.s.fen); b.setLast(G.s.last); setChessCheck(); b.view(chessViewSide(), false); b.paused = current !== 'chess'; if (G.sel) chessTap(G.sel, true); }
  }
  if (rboard && rboard.lost && now - rboard.lostAt > 900 && !rboard.anim) {
    dropRBoard();
    if (G && G.s && G.s.game === 'carrom') { const b = ensureRBoard(); syncCarromBoard(); b.paused = current !== 'carrom'; }
  }
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(checkBoards, 300); });

function toast(text, color) {
  const t = $('toast'); t.textContent = text; t.style.background = color || UI[0];
  t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 1300);
}

let diceSpin = null;
function spinDiceFace() {
  stopDiceSpin();
  $('diceBtn').classList.add('rolling');
  diceSpin = setInterval(() => setDiceFace(1 + Math.floor(Math.random() * 6)), 90);
}
function stopDiceSpin(v) {
  if (diceSpin) clearInterval(diceSpin); diceSpin = null;
  $('diceBtn').classList.remove('rolling');
  if (v) setDiceFace(v);
}
function setDiceFace(v) {
  const on = { 0: [], 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[v || 0];
  const face = v || 5;
  const pips = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] }[face];
  void on;
  const btn = $('diceBtn');
  if (btn.children.length === 9) { [...btn.children].forEach((el, i) => { el.className = pips.includes(i) ? '' : 'r'; el.style.background = face === 1 && i === 4 ? '#E0103A' : ''; }); return; }
  btn.innerHTML = Array.from({ length: 9 }, (_, i) => `<i class="${pips.includes(i) ? '' : 'r'}" ${face === 1 && i === 4 ? 'style="background:#E0103A"' : ''}></i>`).join('');
}

function renderCards() {
  if (!G) return;
  if (G.s && G.s.game === 'patta') return renderPatta();
  if (G.s && G.s.game === 'sudoku') return renderRace();
  if (G.s && G.s.game === 'arrows') return renderArRace();
  if (G.s && G.s.game === 'draw') return renderDraw();
  if (G.s && G.s.game === 'helix') return renderHxRace();
  if (G.s && G.s.game === 'chess') return renderChessCards();
  if (G.s && G.s.game === 'carrom') return renderCarromCards();
  const s = G.s;
  // Cards sit in the same corner as each player's home (your home is bottom-left).
  const me = s.players.find(p => p.id === pid) || s.players[0];
  const at = k => playerOf(s, (me.color + k) % 4);
  const top = [at(1), at(2)], bottom = [at(0), at(3)];
  const html = p => {
    const snakes = s.game === 'snakes';
    const fin = snakes ? 0 : homeCount(s, p.color);
    const where = snakes ? (s.pos[p.color] ? `Square ${s.pos[p.color]}` : 'At start') : s.mode === 'timer' ? `${ludoScore(s, p.color)} pts · Home ${fin}/4` : `Home ${fin}/${s.n || 4}` + (s.mode === 'team' ? (p.color === partnerOf(s, me.color) ? ' 🤝' : p.color === me.color ? '' : ' ⚔️') : '');
    const speaking = G.speaking && G.speaking.has(p.id);
    let st = p.done ? 'Finished!' : where;
    if (G.mode === 'online') {
      const lp = G.lobby.find(x => x.pid === p.id);
      if (p.bot) st = 'Computer · ' + where;
      else if (lp && lp.left) st = 'Offline';
      else if (lp && !lp.connected) st = 'Waiting for network...';
      else if (speaking) st = 'Speaking...';
      else if (p.id !== pid && G.voice && voiceText(p.id) !== 'voice on') st = voiceText(p.id).replace('voice', 'Voice');
    }
    if (p.kind === 'bot') st = p.done ? 'Finished!' : `Bot · ${where}`;
    const lp = G.mode === 'online' ? G.lobby.find(x => x.pid === p.id) : null;
    const micOn = lp ? lp.mic : false;
    const away = lp && (!lp.connected || lp.left);
    return `<div data-pid="${p.id}" class="gcard ${s.turn === p.color && !s.over ? 'turn' : ''} ${away ? 'away' : ''}" style="${s.turn === p.color ? '' : ''}">
      ${avatar(p.look, p.color, speaking ? 'speak' : '', p.id)}
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
  checkBoards();
  if (G && current === 'chess' && G.s) { chessTick(); ringSync('chess', 'cFill'); return; }
  if (G && current === 'carrom' && G.s) { carromTick(); ringSync('carrom', 'rFill'); return; }
  if (G && current === 'patta' && G.s) { pattaTick(); ringSync('patta', 'pFill'); return; }
  if (G && current === 'draw' && G.s) { drawTick(); return; }
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
  ringSync('game', 'tfill');
}, 250);
// The gold ring around the playing person's medallion shows the time left (same as the bar).
function ringSync(screen, fillId) {
  const av = document.querySelector(`#${screen} .turn .av`); if (!av) return;
  const f = $(fillId), w = parseFloat(f.style.width);
  const t = isNaN(w) || w <= 0 ? 1 : w / 100;
  av.style.setProperty('--t', t.toFixed(3));
  av.classList.toggle('low', f.classList.contains('low') && w > 0);
}
function timeUp() {
  const s = G.s; G.turnEnds = null;
  board.clearHighlight();
  note('Time up, turn skipped'); buzz([80]);
  if (s.game === 'snakes') { snakePass(s); return afterMove(); }
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
  if (diceSpin) { $('turnText').textContent = turnLabel(); return; }
  const ok = myTurnToRoll();
  $('diceBtn').disabled = !ok;
  $('diceBtn').classList.toggle('ready', ok);
  $('turnText').textContent = turnLabel();
  const p = G && playerOf(G.s, G.s.turn);
  $('diceBtn').style.borderColor = p ? UI[p.color] : '';
}

function enterGame(mode) {
  dropCBoard(); dropRBoard(); dropHBoard();
  show('game');
  const b = ensureBoard(G.s.game === 'snakes' ? 'snakes' : 'ludo');
  syncBoard(b);
  b.diceIdle();
  setDiceFace(0);
  G.roomLabel = (G.s.game === 'snakes' ? 'Snakes & Ladders · ' : G.s.mode && G.s.mode !== 'classic' ? LMODE_NAME[G.s.mode] + ' · ' : '') + (mode === 'online' ? 'Room ' + G.code : (mode === 'bot' ? 'Vs computer' : 'Pass & play'));
  $('gameRoom').textContent = G.roomLabel;
  startLudoClock();
  $('gameMic').classList.toggle('hide', mode !== 'online');
  $('emojiBtn').style.visibility = mode === 'online' ? 'visible' : 'hidden';
  setBadges();
  renderCards(); refreshDice();
}

// Timer Ludo: a clock in the top bar. Offline the phone ends the game; online the server does.
function startLudoClock() {
  clearInterval(startLudoClock.t);
  if (!G || !G.s || !G.s.endsAt) return;
  const s = G.s;
  const tick = () => {
    if (!G || G.s !== s || current !== 'game') { clearInterval(startLudoClock.t); return; }
    const left = Math.max(0, s.endsAt - Date.now()), sec = Math.ceil(left / 1000);
    $('gameRoom').textContent = `⏱ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')} · ${G.roomLabel}`;
    $('gameRoom').classList.toggle('hurry', sec <= 60);
    if (!left && G.mode !== 'online' && !s.over && !G.busy) { clearInterval(startLudoClock.t); ludoTimeUp(s); note('Time up!'); setTimeout(finishGame, 700); }
  };
  tick(); startLudoClock.t = setInterval(tick, 1000);
}

function tapDice(e) {
  if (e) e.preventDefault();
  if (!myTurnToRoll()) return;
  sfx('click');
  $('diceBtn').disabled = true; $('diceBtn').classList.remove('ready');
  if (G.mode === 'online') {
    if (!G.net.send({ t: 'roll' })) { note('No connection, reconnecting...'); G.net.probe(); refreshDice(); return; }
    G.rollSent = Date.now();
  }
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
  ['gameSound', 'cSound', 'rSound', 'pSound', 'sdSound', 'arSound', 'hxSound'].forEach(id => {
    $(id).innerHTML = on ? SPK_ON : SPK_OFF;
    $(id).setAttribute('aria-label', on ? 'Sound on' : 'Sound off');
    $(id).classList.toggle('off', !on);
  });
}
$('cSound').onclick = () => $('gameSound').onclick();
$('gameSound').onclick = () => {
  const on = !(settings.sound || settings.music);
  settings.sound = on; settings.music = on;
  Object.assign(prefs, { sound: on, music: on }); store.set('settings', settings);
  music(on && !PLAY_SCREENS.includes(current)); if (on) sfx('click');
  syncSpeaker();
};
syncSpeaker();
function leaveGame() {
  if (G && G.game === 'sudoku' && G.mode !== 'online') { saveSudoku(); G = null; show('gamehome'); return; }
  if (G && G.game === 'arrows' && G.mode !== 'online') { G = null; show('gamehome'); return; }
  if (G && G.game === 'helix' && G.mode !== 'online') { G = null; show('gamehome'); return; }
  confirmBox('Leave the game?', G && G.mode === 'online' ? 'You can come back with the same room code while the game is on.' : 'This game will end.', 'Leave', 'Stay', () => {
    if (G && G.mode === 'online') endOnline();
    G = null; show('gamehome');
  });
}
$('cLeave').onclick = () => leaveGame();

// ---------- Offline match ----------
function startOffline(mode, players) {
  G = { mode, s: newGame(players, settings.ludoMode), busy: false, level: settings.botLevel };
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
  if (G.s.game === 'snakes') return snakesOfflineRoll();
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
  if (p.kind === 'bot') { await board.wait(350); pick = botChoice(s, s.turn, d, r.moves, G.level); }
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

// ---------- Snakes & Ladders ----------
function startSnakes(mode, players) {
  G = { mode, game: 'snakes', s: newSnakes(players), busy: false };
  enterGame(mode);
  setTimeout(nextOffline, 600);
}
async function snakesOfflineRoll() {
  const s = G.s; G.busy = true; G.turnEnds = null; refreshDice();
  const d = 1 + Math.floor(Math.random() * 6);
  spinDiceFace();
  await board.throwDice(d, sfx);
  stopDiceSpin(d);
  const P = playerOf(s, s.turn);
  const ev = snakeRoll(s, d);
  if (!ev) { G.busy = false; return; }
  await board.animateMove(ev, s.pos, sfx);
  if (!G || G.s !== s) return;
  snakeNotes(ev, P);
  afterMove();
}
function snakeNotes(ev, P) {
  const you = P.id === pid || (G.mode !== 'online' && P.kind === 'me' && G.mode === 'bot');
  if (ev.stay) note(`Need exactly ${GOAL - ev.from} to reach ${GOAL}`);
  else if (ev.via === 'ladder') { toast(`${you ? 'You' : P.name} climbed a ladder: ${ev.to} → ${ev.end}`, UI[P.color]); buzz([30, 30, 30]); }
  else if (ev.via === 'snake') { toast(`Snake bite! ${you ? 'You' : P.name} slid down to ${ev.end}`, '#E0103A'); buzz([120, 60, 120]); }
  if (ev.won) toast(`${P.name} reached ${GOAL}!`, UI[P.color]);
  else if (ev.extra) note('Rolled a 6, roll again!');
}

// ---------- Finish ----------
function finishGame() {
  if (G.s && G.s.game === 'chess') return finishChess();
  if (G.s && G.s.game === 'carrom') return finishCarrom();
  if (G.s && G.s.game === 'patta') return finishPatta();
  const s = G.s; renderCards();
  const ranks = s.ranks.slice();
  s.order.forEach(c => { if (!ranks.includes(c)) ranks.push(c); });
  const P = c => playerOf(s, c);
  const me = s.players.find(p => p.id === pid);
  const winner = P(ranks[0]);
  const team = s.mode === 'team' && s.winTeam;
  const iWon = me && (team ? s.winTeam.includes(me.color) : winner.id === pid);
  const mate = team ? P(partnerOf(s, winner.color)) : null;
  $('winTitle').textContent = team ? (iWon ? 'Your team won!' : `${winner.name} & ${mate ? mate.name : ''} won!`) : iWon ? 'You won!' : `${winner.name} won!`;
  $('winSub').textContent = s.mode === 'timer' ? (s.reason === 'time' ? `Time up! ${iWon ? 'You' : winner.name} scored ${ludoScore(s, winner.color)} points` : `${iWon ? 'You' : winner.name} got every token home first`)
    : team ? (iWon ? 'You and your partner made it home' : 'Good game! Try again?')
    : iWon ? (s.game === 'snakes' ? 'You reached 100 first!' : `All ${s.n || 4} of your players made it home`) : (s.game === 'snakes' ? `${winner.name} reached 100 first` : 'Good game! Try again?');
  danceStage({ look: winner.look, tint: winner.color, name: winner.name }, ranks.slice(1).map(c => ({ look: P(c).look, tint: P(c).color })));
  if (me) {
    const rank = ranks.indexOf(me.color) + 1;
    addHistory({ game: s.game === 'snakes' ? 'snakes' : 'ludo', mode: G.mode, result: (team ? iWon : rank === 1) ? 'won' : 'lost', rank: team ? (iWon ? 1 : 2) : rank, of: ranks.length,
      score: s.game === 'snakes' ? (rank === 1 ? 'Reached 100' : `Square ${s.pos[me.color] || 0}`) : (s.mode && s.mode !== 'classic' ? LMODE_NAME[s.mode] + ' · ' : '') + (s.mode === 'timer' ? `${ludoScore(s, me.color)} pts` : `${homeCount(s, me.color)}/${s.n || 4} home`),
      opp: s.players.filter(p => p.id !== pid).map(p => ({ id: p.id, name: p.name, look: p.look, tint: p.color })) });
  }
  $('winRest').innerHTML = `<div class="rankchips">${ranks.slice(1).map((c, i) => `<span class="rankchip"><b>${i + 2}</b>${esc(P(c).name)}</span>`).join('')}</div>`;
  const cc = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0', '#FF4FD8', '#FFFFFF', '#FFC21A'];
  $('winConf').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:${cc[i % 7]};animation-duration:${2.5 + (i % 5) * 0.6}s;animation-delay:${(i % 10) * 0.25}s"></i>`).join('');
  $('winAgain').style.display = G.mode === 'online' ? (G.host ? 'flex' : 'none') : 'flex';
  buzz([60, 40, 60, 40, 120]);
  show('win'); startDance();
}
$('winAgain').onclick = () => {
  if (!G) return show('home');
  if (G.mode === 'online') { G.net.send({ t: 'again' }); return; }
  if (G.s && G.s.game === 'carrom') return startCarrom(G.mode, G.s.players.map(p => ({ id: p.id, name: p.name, kind: p.kind, look: p.look, tint: p.tint })), G.s.mode);
  if (G.game === 'sudoku' && G.mode !== 'online') { startSudoku(G.daily ? 'medium' : G.sd.level, null); return; }
  if (G.s && G.s.game === 'patta') return startPatta(G.mode, G.s.players.map(p => ({ id: p.id, name: p.name, kind: p.kind, look: p.look, tint: p.tint })));
  if (G.s && G.s.game === 'chess') return startChess(G.mode, G.s.players.map(p => ({ id: p.id, name: p.name, kind: p.kind, look: p.look, tint: p.tint })));
  const again = G.s.players.map(p => ({ id: p.id, name: p.name, color: p.color, kind: p.kind, look: p.look }));
  if (G.s.game === 'snakes') startSnakes(G.mode, again); else startOffline(G.mode, again);
};
$('winHome').onclick = () => { if (G && G.mode === 'online') endOnline(); G = null; show('gamehome'); };

// ---------- Chess ----------
let cboard = null;
function dropCBoard() { if (cboard) { cboard.destroy(); cboard = null; } }
function ensureCBoard() {
  if (cboard && cboard.dead) cboard = null;
  if (!cboard) { cboard = new Chess3D(freshCanvas('cboard')); cboard.onTap = chessTap; cboard.setTheme(itemOf(eco.use.bd).th); }
  else cboard.resize();
  cboard.paused = false;
  return cboard;
}
const SIDE = { w: 'White', b: 'Black' };
const SIDE_DOT = { w: '#F4EFE6', b: '#2B1D55' };
// Move help: name and how each piece moves (Hindi names in brackets).
const HELP = {
  p: ['Pawn (Pyada)', 'Moves 1 square forward, or 2 on its first move. Captures 1 square diagonally forward.'],
  n: ['Knight (Ghoda)', 'Moves in an L: 2 squares straight, then 1 to the side (dhaai chaal). It can jump over pieces.'],
  b: ['Bishop (Oont)', 'Moves any number of squares diagonally, until something is in the way.'],
  r: ['Rook (Haathi)', 'Moves any number of squares straight: up, down, left or right.'],
  q: ['Queen (Rani)', 'The strongest piece: any number of squares straight or diagonally.'],
  k: ['King (Raja)', 'Moves 1 square in any direction. Keep him safe: if he can’t escape a check, the game is lost.']
};
const PIECE_W = { k: '&#9812;', q: '&#9813;', r: '&#9814;', b: '&#9815;', n: '&#9816;', p: '&#9817;' };

function renderChessSetup() {
  const bot = setupMode === 'bot';
  $('setupAsk').textContent = bot ? 'Play as' : 'Who plays which side?';
  $('setupCount').innerHTML = bot ? ['w', 'b'].map(c => `<button class="sidebtn ${setupSide === c ? 'on' : ''}" data-side="${c}"><span class="dot" style="background:${SIDE_DOT[c]}"></span>${SIDE[c]}</button>`).join('') : '';
  const otherLook = [0, 1, 2, 3].filter(x => x !== ch(profile.look))[0];
  const meSide = bot ? setupSide : 'w';
  const rows = [
    `<div class="prow"><span class="dot" style="background:${SIDE_DOT[meSide]}"></span><b style="font-size:18px">${esc(profile.name)}</b><span class="small muted">${SIDE[meSide]}</span></div>`,
    bot ? `<div class="prow"><span class="dot" style="background:${SIDE_DOT[other(meSide)]}"></span><b style="font-size:18px">${CHAR_NAME[otherLook]} (computer)</b><span class="small muted">${SIDE[other(meSide)]}</span></div>`
      : `<div class="prow"><span class="dot" style="background:${SIDE_DOT.b}"></span><input class="input" data-pn="1" maxlength="14" value="Player 2"><span class="small muted">Black</span></div>`
  ];
  $('setupNames').innerHTML = rows.join('') + (bot ? '<span class="small muted">White moves first. Each side has 10 minutes.</span>' : '<span class="small muted">The board turns around after every move. Each side has 10 minutes.</span>');
}
function goChessSetup() {
  const otherLook = [0, 1, 2, 3].filter(x => x !== ch(profile.look))[0];
  const me = { id: pid, name: profile.name, kind: 'me', look: profile.look, tint: profile.color };
  let them;
  if (setupMode === 'bot') them = { id: 'bot1', name: CHAR_NAME[otherLook], kind: 'bot', look: otherLook, tint: (profile.color + 2) % 4 };
  else { const inp = document.querySelector('[data-pn="1"]'); them = { id: 'p1', name: (inp && inp.value.trim()) || 'Player 2', kind: 'me', look: otherLook, tint: (profile.color + 2) % 4 }; }
  const players = setupMode === 'bot' && setupSide === 'b' ? [them, me] : [me, them];
  startChess(setupMode, players);
}

function startChess(mode, players) {
  G = { mode, game: 'chess', s: newChess(players), busy: false };
  enterChess();
  nextChess();
}
// The side shown at the bottom of the screen.
function chessViewSide() {
  const s = G.s;
  if (G.mode === 'local') return s.turn;
  const me = s.players.find(p => p.id === pid);
  return me ? me.color : 'w';
}
function myChessColor() {
  const s = G.s, p = chessPlayer(s, s.turn);
  if (G.mode === 'online') { const me = s.players.find(x => x.id === pid); return me ? me.color : null; }
  if (G.mode === 'local') return s.turn;
  return p && p.kind === 'me' ? s.turn : other(s.turn);
}
function enterChess() {
  dropBoard(); dropRBoard(); dropHBoard();
  show('chess');
  const b = ensureCBoard();
  b.setPosition(G.s.fen); b.clearMarks();
  b.setLast(G.s.last); setChessCheck();
  b.view(chessViewSide(), false);
  $('cRoom').textContent = G.puzzle ? `Daily puzzle · Mate in ${G.puzzle.n}` : G.mode === 'online' ? 'Chess · Room ' + G.code : (G.mode === 'bot' ? 'Chess · Vs computer' : 'Chess · Pass & play');
  $('cMic').classList.toggle('hide', G.mode !== 'online');
  $('cChat').style.visibility = G.mode === 'online' ? 'visible' : 'hidden';
  $('cHelp').checked = settings.chessHelp;
  G.sel = null; hideHint();
  setBadges(); syncMicButtons(); renderChessCards(); chessTick();
  music(false);
}
function setChessCheck() {
  if (!cboard) return;
  if (!G.s.check) { cboard.setCheck(null); return; }
  const g = new Chess(G.s.fen), t = G.s.turn;
  let sq = null;
  'abcdefgh'.split('').forEach(f => { for (let r = 1; r <= 8; r++) { const p = g.get(f + r); if (p && p.type === 'k' && p.color === t) sq = f + r; } });
  cboard.setCheck(sq);
}
const fmtClock = ms => { const t = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
function clockOf(c) {
  const s = G.s;
  if (s.turn === c && !s.over && G.turnEnds) return Math.max(0, G.turnEnds - Date.now());
  return s.clock[c];
}
function renderChessCards() {
  if (!G || !G.s || current !== 'chess') return;
  const s = G.s, bottom = chessViewSide(), top = other(bottom);
  const card = c => {
    const p = chessPlayer(s, c); if (!p) return '';
    const lp = G.mode === 'online' ? G.lobby.find(x => x.pid === p.id) : null;
    const speaking = G.speaking && G.speaking.has(p.id);
    let st = SIDE[c];
    if (p.kind === 'bot') st += ' · Computer';
    if (lp && lp.left) st = 'Offline';
    else if (lp && !lp.connected) st = 'Waiting for network...';
    else if (speaking) st = 'Speaking...';
    else if (s.turn === c && !s.over && s.check) st = SIDE[c] + ' · Check!';
    else if (s.turn === c && !s.over && p.kind === 'bot') st = 'Thinking...';
    const ms = clockOf(c);
    const micOn = lp ? lp.mic : false;
    const tint = p.tint != null ? p.tint : (c === 'w' ? 2 : 3);
    return `<div data-pid="${p.id}" class="gcard ${s.turn === c && !s.over ? 'turn' : ''} ${lp && (!lp.connected || lp.left) ? 'away' : ''}">
      ${avatar(p.look, tint, speaking ? 'speak' : '', p.id)}
      <div class="info"><span class="nm">${esc(p.name)}${p.id === pid && G.mode !== 'local' ? ' (You)' : ''}</span><span class="st"><span class="side" style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${SIDE_DOT[c]};border:1.5px solid #fff;margin-right:4px"></span>${st}</span></div>
      <span class="clk ${ms < 30000 ? 'low' : ''}" data-clk="${c}">${fmtClock(ms)}</span>
      ${G.mode === 'online' && p.id !== pid ? `<button class="mic ${micOn ? 'on' : ''}" data-deaf="${p.id}" aria-label="Mute ${esc(p.name)}">${micOn && !(G.voice && G.voice.deafened.has(p.id)) ? MIC : MIC_OFF}</button>` : ''}
    </div>`;
  };
  $('cTop').innerHTML = card(top);
  $('cBottom').innerHTML = card(bottom);
}
['cTop', 'cBottom'].forEach(id => $(id).addEventListener('click', e => {
  const b = e.target.closest('[data-deaf]'); if (!b || !G || !G.voice) return;
  const off = G.voice.toggleDeafen(b.dataset.deaf); toast(off ? 'Muted for you' : 'Unmuted', '#3A2490'); renderCards();
}));
function chessTurnLabel() {
  const s = G.s; if (s.over) return 'Game over';
  if (G.note && G.note.until > Date.now()) return G.note.text;
  const p = chessPlayer(s, s.turn);
  if (G.mode === 'local') return `${p.name}’s turn (${SIDE[s.turn]})`;
  if (canTouchChess() || (G.mode !== 'online' && p.kind === 'me') || (G.mode === 'online' && p.id === pid)) return s.check ? 'Check! Your turn' : 'Your turn';
  return p.kind === 'bot' ? `${p.name} is thinking...` : `${p.name}’s turn`;
}
let lastChessTick = 0;
function chessTick() {
  if (!G || !G.s) return;
  const s = G.s;
  $('cTurn').textContent = chessTurnLabel();
  document.querySelectorAll('[data-clk]').forEach(el => { const ms = clockOf(el.dataset.clk); el.textContent = fmtClock(ms); el.classList.toggle('low', ms < 30000); });
  const left = s.over || !G.turnEnds ? null : G.turnEnds - Date.now();
  const fill = $('cFill');
  if (left == null) fill.style.width = '0';
  else {
    fill.style.width = Math.max(0, Math.min(100, left / CLOCK_MS * 100)) + '%';
    fill.classList.toggle('low', left < 30000);
    const sec = Math.ceil(left / 1000), mine = G.mode === 'online' ? chessPlayer(s, s.turn).id === pid : chessPlayer(s, s.turn).kind === 'me';
    if (mine && sec <= 10 && sec > 0 && sec !== lastChessTick) { lastChessTick = sec; sfx('tick'); }
  }
  if (G.mode !== 'online' && !s.over && left != null && left <= 0 && !G.busy) {
    chessTimeout(s, s.turn); G.turnEnds = null; cboard.clearMarks(); hideHint();
    note('Time up!'); buzz([80]); renderChessCards(); setTimeout(finishChess, 900);
  }
}
function canTouchChess() {
  if (!G || !G.s || G.busy || G.s.over) return false;
  const p = chessPlayer(G.s, G.s.turn);
  if (G.mode === 'online') return p.id === pid && !(G.sent && Date.now() - G.sent < 4000);
  return p.kind === 'me';
}
function nextChess() {
  if (!G || G.mode === 'online') return;
  const s = G.s;
  renderChessCards();
  if (s.over) { setTimeout(finishChess, 1000); return; }
  G.turnStart = Date.now(); G.turnEnds = G.puzzle ? null : Date.now() + s.clock[s.turn];
  const p = chessPlayer(s, s.turn);
  if (G.mode === 'local' && s.moves > 0) cboard.view(s.turn, true);
  if (p.kind === 'bot') {
    G.busy = true; renderChessCards();
    setTimeout(() => {
      if (!G || G.s !== s) return;
      const t0 = Date.now(), mv = chessBot(s.fen);
      setTimeout(() => { if (G && G.s === s && mv) playChess(mv); }, Math.max(0, 700 - (Date.now() - t0)));
    }, 60);
  } else if (s.check) sfx('turn');
  chessTick();
}
// Why a piece has no move, in plain words (shown with move help on).
function explainStuck(g, sq, pc) {
  let why = 'This piece has no free square right now.';
  if (g.in_check()) why = 'Your King (Raja) is in check. First move a piece that saves him.';
  else if (pc.type === 'p') why = 'This pawn is blocked: a piece is standing right in front of it. Pawns can’t capture straight ahead, only one square diagonally.';
  else if (pc.type !== 'k') {
    // Pinned: with this piece gone, its own King would be in check.
    const t = new Chess(g.fen()); t.remove(sq);
    if (t.in_check()) why = 'This piece is protecting your King: moving it would put him in check.';
  }
  $('cHintS').textContent = why; $('cHint').classList.add('show', 'warn');
  buzz([30]);
}
function showHint(type) {
  $('cHint').classList.remove('warn');
  const h = HELP[type];
  $('cHintIc').innerHTML = PIECE_W[type]; $('cHintT').textContent = h[0]; $('cHintS').textContent = h[1];
  $('cHint').classList.add('show');
}
function hideHint() { $('cHint').classList.remove('show'); }
$('cHint').addEventListener('click', hideHint);
function chessTap(sq) {
  if (!canTouchChess()) return;
  const s = G.s, g = new Chess(s.fen), pc = g.get(sq);
  if (pc && pc.color === s.turn) {
    sfx('click'); G.sel = sq;
    // Help (dots and the piece card) shows only on the phone of the player whose turn it is.
    const moves = g.moves({ square: sq, verbose: true });
    if (settings.chessHelp) { cboard.select(sq, moves); showHint(pc.type); if (!moves.length) explainStuck(g, sq, pc); }
    else { cboard.select(sq, null); hideHint(); }
    return;
  }
  if (!G.sel) return;
  const opts = g.moves({ square: G.sel, verbose: true }).filter(m => m.to === sq);
  if (!opts.length) {
    if (pc || settings.chessHelp) { note('Can’t move there'); buzz([30]); }
    G.sel = null; cboard.clearMarks(); hideHint(); return;
  }
  const from = G.sel; G.sel = null; hideHint();
  if (opts.length > 1 || opts[0].flags.includes('p')) askPromotion(s.turn, p => sendChessMove({ from, to: sq, promotion: p }));
  else sendChessMove({ from, to: sq });
}
function askPromotion(color, done) {
  const set = color === 'w' ? PIECE_W : PIECE;
  modal(`<h3>Your pawn reached the end!</h3><p>Pick what it becomes:</p><div class="promo">${['q', 'r', 'b', 'n'].map(k => `<button data-pr="${k}">${set[k]}<small>${HELP[k][0].split(' ')[0]}</small></button>`).join('')}</div>`);
  $('modalBox').querySelectorAll('[data-pr]').forEach(b => b.onclick = () => { closeModal(); done(b.dataset.pr); });
}
function sendChessMove(mv) {
  cboard.clearMarks();
  if (G.mode === 'online') {
    if (!G.net.send({ t: 'cmove', from: mv.from, to: mv.to, promotion: mv.promotion || 'q', seq: G.s.seq })) { note('No connection, try again in a moment'); G.net.probe(); return; }
    G.sent = Date.now(); return;
  }
  playChess(mv);
}
async function playChess(mv) {
  const s = G.s;
  if (G.puzzle && chessPlayer(s, s.turn).kind === 'me' && !puzzleOk(mv)) return;
  G.busy = true;
  const spent = Date.now() - (G.turnStart || Date.now());
  const r = chessMove(s, mv, spent);
  if (!r) { G.busy = false; return; }
  G.turnEnds = null;
  await cboard.animate(r, s.fen, sfx);
  if (!G || G.s !== s) return;
  afterChessMove(r);
  G.busy = false;
  nextChess();
}
function afterChessMove(r) {
  const s = G.s;
  cboard.setLast(s.last); setChessCheck();
  const P = chessPlayer(s, r.color);
  if (r.captured) buzz([40, 30, 60]);
  if (s.over && s.reason === 'checkmate') { toast('Checkmate!', '#E0103A'); sfx('win'); }
  else if (s.check) { toast('Check!', '#E0103A'); buzz([60, 40, 60]); }
  else if (r.flags.includes('p')) toast(`${P.name}’s pawn became a ${HELP[r.promotion][0].split(' ')[0]}!`, '#3A2490');
  renderChessCards();
}
// Online chess
function onChessState(m) {
  G.s = m.s; G.busy = false; G.sent = 0;
  G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
  G.turnEnds = m.left != null && !m.s.over ? Date.now() + m.left : null;
  if (m.s.over && m.t === 'sync') { finishChess(); return; }
  enterChess();
  if (m.t === 'start') sfx('turn');
}
async function onChessMoved(m) {
  G.busy = true; hideHint(); G.sel = null;
  const s = m.s; s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
  if (current === 'chess') await cboard.animate(m.mv, s.fen, sfx);
  G.s = s; G.sent = 0;
  G.turnEnds = m.left != null && !s.over ? Date.now() + m.left : null;
  if (current === 'chess') afterChessMove(m.mv);
  G.busy = false;
  if (s.over) setTimeout(finishChess, 1100);
  else if (chessPlayer(s, s.turn).id === pid) sfx('turn');
}
function onChessEnd(m) {
  G.s = m.s; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
  G.turnEnds = null; if (cboard) cboard.clearMarks(); hideHint();
  if (m.s.reason === 'time') note('Time up!');
  if (m.s.reason === 'left') note('Player left the game');
  renderChessCards(); setTimeout(finishChess, 900);
}
function finishChess() {
  if (!G || !G.s) return;
  if (G.puzzle) return puzzleSolved();
  const s = G.s;
  const meColor = G.mode === 'online' ? (s.players.find(p => p.id === pid) || {}).color : (G.mode === 'bot' ? (s.players.find(p => p.kind === 'me') || {}).color : null);
  const res = chessResultText(s, meColor);
  const meP = s.players.find(p => p.id === pid);
  if (meP) {
    const mc = G.mode === 'local' ? meP.color : meColor;
    addHistory({ game: 'chess', mode: G.mode, result: !s.winner ? 'draw' : s.winner === mc ? 'won' : 'lost', of: 2,
      score: s.reason === 'time' ? 'On time' : s.reason === 'left' ? 'Player left' : s.winner ? 'Checkmate' : 'Draw',
      opp: s.players.filter(p => p.id !== pid).map(p => ({ id: p.id, name: p.name, look: p.look, tint: p.tint != null ? p.tint : (p.color === 'w' ? 2 : 3) })) });
  }
  $('winTitle').textContent = res.title;
  $('winSub').textContent = res.sub;
  const W = s.winner ? [chessPlayer(s, s.winner)] : s.players;
  const tintOf = p => p.tint != null ? p.tint : (p.color === 'w' ? 2 : 3);
  if (s.winner) { const L = s.players.find(p => p.color !== s.winner); danceStage({ look: W[0].look, tint: tintOf(W[0]), name: W[0].name }, L ? [{ look: L.look, tint: tintOf(L) }] : []); }
  else danceStage(null, s.players.map(p => ({ look: p.look, tint: tintOf(p) })));
  $('winRest').innerHTML = '';
  const cc = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0', '#FF4FD8', '#FFFFFF', '#FFC21A'];
  $('winConf').innerHTML = s.winner ? Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:${cc[i % 7]};animation-duration:${2.5 + (i % 5) * 0.6}s;animation-delay:${(i % 10) * 0.25}s"></i>`).join('') : '';
  $('winAgain').style.display = G.mode === 'online' ? (G.host ? 'flex' : 'none') : 'flex';
  buzz([60, 40, 60, 40, 120]);
  show('win'); startDance();
}
$('cHelp').addEventListener('change', e => {
  settings.chessHelp = e.target.checked; store.set('settings', settings); sfx('click');
  if (G && G.sel && cboard) { const g = new Chess(G.s.fen), pc = g.get(G.sel); if (settings.chessHelp && pc) { cboard.select(G.sel, g.moves({ square: G.sel, verbose: true })); showHint(pc.type); } else { cboard.select(G.sel, null); hideHint(); } }
  toast(settings.chessHelp ? 'Move help on' : 'Move help off', '#3A2490');
});

// ---------- Carrom ----------
let rboard = null;
const CARROM_SECS = 20;
const CSIDE = ['White', 'Black'], CDOT = ['#F4EFE6', '#1D1D1D'];
function dropRBoard() { if (rboard) { rboard.destroy(); rboard = null; } }
function ensureRBoard() {
  if (rboard && rboard.dead) rboard = null;
  if (!rboard) { rboard = new Carrom3D(freshCanvas('rboard')); hookCarromInput(rboard); rboard.setStrikerStyle(settings.striker); rboard.setFlat(!settings.carrom3d); rboard.setTheme(itemOf(eco.use.bd).th); }
  else rboard.resize();
  rboard.paused = false;
  return rboard;
}
function renderCarromSetup() {
  const bot = setupMode === 'bot';
  $('setupAsk').textContent = bot ? 'You play' : 'Players';
  $('setupCount').innerHTML = '';
  const otherLook = [0, 1, 2, 3].filter(x => x !== ch(profile.look))[0];
  $('setupNames').innerHTML = `<div class="prow"><span class="dot" style="background:${CDOT[0]}"></span><b style="font-size:18px">${esc(profile.name)}</b><span class="small muted">White · bottom</span></div>` +
    (bot ? `<div class="prow"><span class="dot" style="background:${CDOT[1]}"></span><b style="font-size:18px">${CHAR_NAME[otherLook]} (computer)</b><span class="small muted">Black · top</span></div>`
      : `<div class="prow"><span class="dot" style="background:${CDOT[1]}"></span><input class="input" data-pn="1" maxlength="14" value="Player 2"><span class="small muted">Black · top</span></div>`) +
    `<span class="small muted">${bot ? 'White shoots first.' : 'The board turns around for each player.'} 20 seconds for each shot.</span>`;
}
function goCarromSetup() {
  const otherLook = [0, 1, 2, 3].filter(x => x !== ch(profile.look))[0];
  const me = { id: pid, name: profile.name, kind: 'me', look: profile.look, tint: profile.color };
  let them;
  if (setupMode === 'bot') them = { id: 'bot1', name: CHAR_NAME[otherLook], kind: 'bot', look: otherLook, tint: (profile.color + 2) % 4 };
  else { const inp = document.querySelector('[data-pn="1"]'); them = { id: 'p1', name: (inp && inp.value.trim()) || 'Player 2', kind: 'me', look: otherLook, tint: (profile.color + 2) % 4 }; }
  startCarrom(setupMode, [me, them]);
}
function startCarrom(mode, players, type) {
  G = { mode, game: 'carrom', s: newCarrom(players, type || settings.carromMode), busy: false };
  enterCarrom();
  nextCarrom();
}
// Your side of the board is at the bottom of the screen.
function carromViewSide() {
  const s = G.s;
  if (G.mode === 'local') return s.turn;
  const i = s.players.findIndex(p => p.id === pid);
  return i < 0 ? 0 : i;
}
function canShoot() {
  if (!G || !G.s || G.busy || G.s.over) return false;
  const p = G.s.players[G.s.turn];
  if (G.mode === 'online') return p.id === pid && !(G.sent && Date.now() - G.sent < 4000);
  return p.kind === 'me';
}
function enterCarrom() {
  dropBoard(); dropCBoard(); dropHBoard();
  show('carrom');
  ensureRBoard();
  $('rRoom').textContent = CTYPE_NAME[G.s.mode || 'classic'] + ' · ' + (G.mode === 'online' ? 'Room ' + G.code : (G.mode === 'bot' ? 'Vs computer' : 'Pass & play'));
  $('rMic').classList.toggle('hide', G.mode !== 'online');
  $('rChat').style.visibility = G.mode === 'online' ? 'visible' : 'hidden';
  $('rHelp').checked = settings.carromHelp;
  syncViewBtn();
  setBadges(); syncMicButtons();
  G.sx = 0.5;
  syncCarromBoard();
  music(false);
}
function syncCarromBoard() {
  const s = G.s, b = rboard; if (!b) return;
  b.view(carromViewSide(), false);
  b.setCoins(s.coins);
  placeCarromStriker();
  const far = s.players[1 - carromViewSide()];
  b.setFar(far ? `img/c${ch(far.look)}-${far.tint != null ? far.tint : 3}.png` : null);
  renderCarromCards(); carromTick();
}
// Put the striker on the base line of the player whose turn it is.
function placeCarromStriker() {
  const s = G.s; if (!rboard || !s) return;
  const sp = strikerSpot(s.coins, s.turn, G.sx == null ? 0.5 : G.sx);
  G.spot = sp;
  rboard.setStriker(sp.x, sp.y, !s.over);
  rboard.bob = canShoot();
  // Slider: the knob follows the striker (mirrored when the board is turned around).
  const r = $('rSlider').getBoundingClientRect(), f = (sp.x - CLO) / (CHI - CLO), h = KNOB_HALF;
  const ff = rboard.flipped() ? 1 - f : f;
  $('rKnob').style.left = (h + ff * Math.max(0, r.width - 2 * h)) + 'px';
  $('rSlider').classList.toggle('off', !canShoot());
}
function renderCarromCards() {
  if (!G || !G.s || current !== 'carrom') return;
  const s = G.s, bottom = carromViewSide();
  const card = i => {
    const p = s.players[i]; if (!p) return '';
    const lp = G.mode === 'online' ? G.lobby.find(x => x.pid === p.id) : null;
    const speaking = G.speaking && G.speaking.has(p.id);
    let st = CSIDE[i] + (p.kind === 'bot' ? ' · Computer' : '');
    if (lp && lp.left) st = 'Offline';
    else if (lp && !lp.connected) st = 'Waiting for network...';
    else if (speaking) st = 'Speaking...';
    const q = s.queen && s.queen.by === i ? (s.queen.state === 'covered' ? '<i class="q"></i>' : '<i class="q" style="opacity:.45"></i>') : '';
    const micOn = lp ? lp.mic : false;
    return `<div data-pid="${p.id}" class="gcard ${s.turn === i && !s.over ? 'turn' : ''} ${lp && (!lp.connected || lp.left) ? 'away' : ''}">
      ${avatar(p.look, p.tint != null ? p.tint : i ? 3 : 0, speaking ? 'speak' : '', p.id)}
      <div class="info"><span class="nm">${esc(p.name)}${p.id === pid && G.mode !== 'local' ? ' (You)' : ''}</span><span class="st">${st}</span></div>
      <span class="coins">${s.mode === 'free' ? `<b class="pts">${s.pts[i]}</b><small>pts</small>${q}` : `<i style="background:${CDOT[i]}"></i>${s.got[i]}/${CNEED(s.mode)}${q}${s.mode === 'disc' && s.got[i] >= 8 ? '<i class="q" style="background:#3a1866;border-color:#ffd34d"></i>' : ''}`}</span>
      ${G.mode === 'online' && p.id !== pid ? `<button class="mic ${micOn ? 'on' : ''}" data-deaf="${p.id}" aria-label="Mute ${esc(p.name)}">${micOn && !(G.voice && G.voice.deafened.has(p.id)) ? MIC : MIC_OFF}</button>` : ''}
    </div>`;
  };
  $('rTop').innerHTML = card(1 - bottom);
  $('rBottom').innerHTML = card(bottom);
}
['rTop', 'rBottom'].forEach(id => $(id).addEventListener('click', e => {
  const b = e.target.closest('[data-deaf]'); if (!b || !G || !G.voice) return;
  const off = G.voice.toggleDeafen(b.dataset.deaf); toast(off ? 'Muted for you' : 'Unmuted', '#3A2490'); renderCards();
}));
function carromTurnLabel() {
  const s = G.s; if (s.over) return 'Game over';
  if (G.note && G.note.until > Date.now()) return G.note.text;
  const p = s.players[s.turn];
  const left = G.turnEnds ? Math.max(0, Math.ceil((G.turnEnds - Date.now()) / 1000)) : '';
  const tail = left !== '' ? ` · 0:${String(left).padStart(2, '0')}` : '';
  if (G.busy) return 'Shooting...';
  if (G.mode === 'local') return `${p.name}’s shot${tail}`;
  if (canShoot() || (G.mode === 'online' && p.id === pid)) return 'Your shot' + tail;
  return p.kind === 'bot' ? `${p.name} is aiming...` : `${p.name}’s shot${tail}`;
}
let lastCTick = 0;
function carromTick() {
  if (!G || !G.s) return;
  $('rTurn').textContent = carromTurnLabel();
  const left = G.turnEnds && !G.s.over && !G.busy ? G.turnEnds - Date.now() : null;
  const fill = $('rFill');
  if (left == null) fill.style.width = '0';
  else {
    fill.style.width = Math.max(0, Math.min(100, left / (CARROM_SECS * 10))) + '%';
    fill.classList.toggle('low', left < 5000);
    const sec = Math.ceil(left / 1000);
    if (canShoot() && sec <= 5 && sec > 0 && sec !== lastCTick) { lastCTick = sec; sfx('tick'); }
  }
  if (G.mode !== 'online' && left != null && left <= 0 && !G.busy) {
    carromPass(G.s); G.turnEnds = null; G.aim = null; rboard.hideAim();
    note('Time up, turn skipped'); buzz([80]);
    rboard.setCoins(G.s.coins); nextCarrom();
  }
}
function nextCarrom() {
  if (!G || G.mode === 'online') return;
  const s = G.s;
  G.sx = 0.5;
  if (G.mode === 'local' && s.shots > 0) rboard.view(s.turn, true);
  if (G.mode === 'local') { const far = s.players[1 - s.turn]; rboard.setFar(`img/c${ch(far.look)}-${far.tint}.png`); }
  placeCarromStriker(); renderCarromCards();
  if (s.over) { setTimeout(finishCarrom, 900); return; }
  const p = s.players[s.turn];
  G.turnEnds = p.kind === 'me' ? Date.now() + CARROM_SECS * 1000 : null;
  if (p.kind === 'bot') {
    G.busy = true;
    setTimeout(() => {
      if (!G || G.s !== s) return;
      const shot = carromBot(s, 0.55);
      G.sx = shot.x; placeCarromStriker();
      rboard.showAim(s.coins, shot.x, shot.y, shot.dx, shot.dy, shot.power, settings.carromHelp);
      setTimeout(() => { if (G && G.s === s) { G.busy = false; playCarromShot(shot); } }, 1200);
    }, 700);
  } else sfx('turn');
  carromTick();
}
// Aim: slide the striker, then pull back on the board (like a catapult) and let go.
// Camera: two fingers turn and zoom the board; one finger off the board (or when it's not
// your shot) turns and tilts it. The "Reset view" button brings the normal view back.
function hookCarromInput(b) {
  const c = b.canvas;
  const ptr = new Map();
  let down = null, cam = null;
  const onBoard = p => p && p.x > -0.04 && p.x < 1.04 && p.y > -0.04 && p.y < 1.04;
  const two = () => { const [p1, p2] = [...ptr.values()]; return { d: Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1, a: Math.atan2(p2.y - p1.y, p2.x - p1.x), my: (p1.y + p2.y) / 2 }; };
  const cancelAim = () => { if (down && down.aiming && G) { G.aim = null; b.hideAim(); } down = null; };
  c.addEventListener('pointerdown', e => {
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { c.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    if (ptr.size >= 2) { cancelAim(); cam = Object.assign({ kind: 'two' }, two()); return; }
    if (canShoot() && onBoard(b.boardPoint(e))) { down = { x: e.clientX, y: e.clientY, aiming: false }; cam = null; }
    else { down = null; cam = { kind: 'one', x: e.clientX, y: e.clientY }; }
  });
  c.addEventListener('pointermove', e => {
    if (!ptr.has(e.pointerId)) return;
    ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (cam && cam.kind === 'two' && ptr.size >= 2) {
      const t = two();
      let da = t.a - cam.a; da = Math.atan2(Math.sin(da), Math.cos(da));
      b.orbit(-da, (t.my - cam.my) * 0.004);
      b.pinch(t.d / cam.d);
      Object.assign(cam, t); placeCarromStriker(); showResetView(); return;
    }
    if (cam && cam.kind === 'one') {
      b.orbit(-(e.clientX - cam.x) * 0.008, (e.clientY - cam.y) * 0.005);
      cam.x = e.clientX; cam.y = e.clientY; placeCarromStriker(); showResetView(); return;
    }
    if (!down) return;
    if (!down.aiming && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) down.aiming = true;
    if (!down.aiming || !canShoot()) return;
    const p = b.boardPoint(e); if (!p) return;
    const sp = G.spot; let dx = sp.x - p.x, dy = sp.y - p.y; const L = Math.hypot(dx, dy); if (L < 0.01) return;
    dx /= L; dy /= L;
    if (!forwardOk(G.s.turn, dy)) { G.aim = null; b.hideAim(); note('Aim forward, toward the other side'); return; }
    G.aim = { x: sp.x, y: sp.y, dx, dy, power: Math.min(1, L / 0.32) };
    b.showAim(G.s.coins, sp.x, sp.y, dx, dy, G.aim.power, settings.carromHelp);
    G.note = { text: `Power ${Math.round(G.aim.power * 100)}% · let go to shoot`, until: Date.now() + 400 }; $('rTurn').textContent = G.note.text;
  });
  const up = e => {
    ptr.delete(e.pointerId);
    if (ptr.size === 1 && cam && cam.kind === 'two') { const [p] = [...ptr.values()]; cam = { kind: 'one', x: p.x, y: p.y }; return; }
    if (ptr.size) return;
    cam = null;
    if (!down) return; const was = down; down = null;
    if (!was.aiming) return;
    const a = G && G.aim; if (G) G.aim = null;
    if (a && a.power > 0.06 && canShoot()) shootCarrom(a); else b.hideAim();
  };
  c.addEventListener('pointerup', up);
  c.addEventListener('pointercancel', e => { ptr.delete(e.pointerId); cam = null; down = null; if (G) G.aim = null; b.hideAim(); });
  c.addEventListener('wheel', e => { e.preventDefault(); b.pinch(1 - e.deltaY * 0.001); showResetView(); }, { passive: false });
}
function syncViewBtn() { const b = $('rView'); b.textContent = settings.carrom3d ? 'Flat view' : '3D view'; b.setAttribute('aria-label', settings.carrom3d ? 'Flat view' : '3D view'); $('rReset').classList.remove('show'); }
$('rView').onclick = () => {
  sfx('click'); settings.carrom3d = !settings.carrom3d; store.set('settings', settings);
  if (rboard) { rboard.setFlat(!settings.carrom3d); placeCarromStriker(); }
  syncViewBtn(); toast(settings.carrom3d ? '3D view: 2 fingers turn the board' : 'Flat view', '#3A2490');
};
function showResetView() { $('rReset').classList.toggle('show', !!(rboard && rboard.moved())); }
$('rReset').onclick = () => { sfx('click'); if (rboard) rboard.resetView(); $('rReset').classList.remove('show'); setTimeout(placeCarromStriker, 400); };
const KNOB_HALF = 30;
function slideCarrom(e) {
  if (!canShoot()) return;
  const r = $('rSlider').getBoundingClientRect();
  let f = Math.min(1, Math.max(0, (e.clientX - r.left - KNOB_HALF) / Math.max(1, r.width - 2 * KNOB_HALF)));
  if (rboard && rboard.flipped()) f = 1 - f;
  G.sx = CLO + f * (CHI - CLO); G.aim = null; rboard.hideAim(); placeCarromStriker();
}
$('rSlider').addEventListener('pointerdown', e => { try { $('rSlider').setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } $('rSlider')._d = true; slideCarrom(e); });
$('rSlider').addEventListener('pointermove', e => { if ($('rSlider')._d) slideCarrom(e); });
$('rSlider').addEventListener('pointerup', () => { $('rSlider')._d = false; });
$('rHelp').addEventListener('change', e => { settings.carromHelp = e.target.checked; store.set('settings', settings); sfx('click'); toast(settings.carromHelp ? 'Aim help on' : 'Aim help off', '#3A2490'); });
$('rLeave').onclick = () => leaveGame();
$('rSound').onclick = () => $('gameSound').onclick();
$('rChat').onclick = () => { sfx('click'); openChat(); };
function shootCarrom(shot) {
  rboard.hideAim(); rboard.bob = false;
  if (G.mode === 'online') {
    if (!G.net.send({ t: 'rshot', x: shot.x, dx: shot.dx, dy: shot.dy, power: shot.power, seq: G.s.seq })) { note('No connection, try again in a moment'); G.net.probe(); return; }
    G.sent = Date.now(); return;
  }
  playCarromShot(shot);
}
async function playCarromShot(shot) {
  const s = G.s, before = s.coins.map(c => Object.assign({}, c));
  G.busy = true; G.turnEnds = null;
  const res = applyShot(s, shot);
  if (!res) { G.busy = false; return; }
  await rboard.playShot(before, shot, sfx);
  if (!G || G.s !== s) return;
  G.busy = false;
  carromAfter(res, s.players[res.foul ? s.turn : s.turn]);
  nextCarrom();
}
function carromAfter(res, P) {
  rboard.setCoins(G.s.coins);
  const name = n => n.id === pid && G.mode !== 'local' ? 'You' : n.name;
  const shooter = P;
  if (res.foul) { toast(`Foul! ${res.msg ? '' : ''}Striker went in, a coin comes back`, '#E0103A'); buzz([120, 60, 120]); }
  else if (res.queen === 'pocketed') { toast(`Queen! Now pocket your coin to cover her`, '#D9142E'); if (settings.queenBuzz) buzz([400, 100, 400], true); }
  else if (res.queen === 'covered') { toast(`${name(shooter)} covered the Queen!`, '#00A844'); sfx('win'); }
  else if (res.queen === 'returned') toast('Queen not covered: back to the centre', '#3A2490');
  else if (res.msg) toast(res.msg, '#3A2490');
  else if (G.s.mode === 'free' && res.potted.length) note(`+${res.potted.reduce((a, k) => a + ({ white: 20, black: 10 }[k] || 0), 0)} points! Shoot again`);
  else if (res.again) note('Pocketed! Shoot again');
  if (res.potted.length && !res.foul) buzz([30, 20, 30]);
  renderCarromCards();
}
// Online
function onCarromState(m) {
  G.s = m.s; G.busy = false; G.sent = 0;
  G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
  G.turnEnds = m.turnEnds || null;
  if (m.s.over && m.t === 'sync') { finishCarrom(); return; }
  if (current !== 'carrom') enterCarrom(); else syncCarromBoard();
  if (m.t === 'start') sfx('turn');
}
async function onCarromShot(m) {
  G.busy = true; G.turnEnds = null;
  const before = G.s.coins.map(c => Object.assign({}, c)), shooter = G.s.players[G.s.turn];
  G.sx = m.shot.x;
  if (current === 'carrom' && rboard) {
    if (shooter.id !== pid) { rboard.setStriker(m.shot.x, m.shot.y); rboard.showAim(before, m.shot.x, m.shot.y, m.shot.dx, m.shot.dy, m.shot.power, false); await new Promise(r => setTimeout(r, 450)); }
    await rboard.playShot(before, m.shot, sfx);
  }
  G.s = m.s; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
  G.turnEnds = m.turnEnds; G.busy = false; G.sent = 0;
  if (current === 'carrom') { carromAfter(m.res, shooter); G.sx = 0.5; placeCarromStriker(); }
  if (G.s.over) setTimeout(finishCarrom, 1000);
  else if (G.s.players[G.s.turn].id === pid) sfx('turn');
}
function onCarromPassed(m) {
  G.s = m.s; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
  G.turnEnds = m.turnEnds; G.sx = 0.5;
  if (m.reason === 'timeout') note('Time up, turn skipped');
  if (rboard) { rboard.hideAim(); rboard.setCoins(G.s.coins); placeCarromStriker(); }
  renderCarromCards();
  if (G.s.over) setTimeout(finishCarrom, 700);
  else if (G.s.players[G.s.turn].id === pid) sfx('turn');
}
function onCarromEnd(m) {
  G.s = m.s; G.turnEnds = null; if (rboard) rboard.hideAim();
  if (m.s.reason === 'left') note('Player left the game');
  renderCarromCards(); setTimeout(finishCarrom, 900);
}
function finishCarrom() {
  if (!G || !G.s) return;
  const s = G.s, W = s.players[s.winner];
  const meI = G.mode === 'local' ? -1 : s.players.findIndex(p => p.id === pid || (G.mode === 'bot' && p.kind === 'me'));
  const iWon = meI === s.winner;
  const mi = s.players.findIndex(p => p.id === pid);
  if (mi >= 0) addHistory({ game: 'carrom', mode: G.mode, result: s.winner === mi ? 'won' : 'lost', of: 2, score: (s.mode === 'free' ? `${s.pts[mi]}–${s.pts[1 - mi]} pts` : `${s.got[mi]}–${s.got[1 - mi]}`) + (s.mode && s.mode !== 'classic' ? ' · ' + CTYPE_NAME[s.mode] : ''),
    opp: s.players.filter(p => p.id !== pid).map(p => ({ id: p.id, name: p.name, look: p.look, tint: p.tint != null ? p.tint : 3 })) });
  $('winTitle').textContent = iWon ? 'You won!' : `${W.name} won!`;
  const who = iWon ? 'You' : W.name;
  $('winSub').textContent = s.reason === 'left' ? 'The other player left the game'
    : s.mode === 'free' ? `${who} scored more points (${s.pts[0]} - ${s.pts[1]})`
      : s.reason === 'eight' ? `${who} pocketed all 8 coins and the black one`
        : s.reason === 'eight-early' ? 'The black coin went in too early'
          : `${who} pocketed all 9 coins first (${s.got[0]} - ${s.got[1]})`;
  const Lo = s.players[1 - s.winner];
  danceStage({ look: W.look, tint: W.tint != null ? W.tint : 0, name: W.name }, Lo ? [{ look: Lo.look, tint: Lo.tint != null ? Lo.tint : 3 }] : []);
  $('winRest').innerHTML = '';
  const cc = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0', '#FF4FD8', '#FFFFFF', '#FFC21A'];
  $('winConf').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:${cc[i % 7]};animation-duration:${2.5 + (i % 5) * 0.6}s;animation-delay:${(i % 10) * 0.25}s"></i>`).join('');
  $('winAgain').style.display = G.mode === 'online' ? (G.host ? 'flex' : 'none') : 'flex';
  buzz([60, 40, 60, 40, 120]);
  show('win'); startDance();
}

// ---------- Rang Patta (colour & number cards) ----------
const PATTA_SECS = 20;
const JEWEL = ['ruby', 'emer', 'saph', 'topaz'];
const JEWEL_HEX = ['#c3093f', '#059669', '#1460d6', '#e6a800'];
function pcardHtml(c, cls, attrs) {
  const wild = c.v === 'wild' || c.v === 'w4';
  const col = wild && c.c === -1 ? 'wild' : JEWEL[c.c];
  const lb = pattaLabel(c);
  return `<span class="pc ${cls || ''}" ${attrs || ''}><span class="f ${col}${wild && c.c >= 0 ? ' wildset' : ''}"><i class="ca">${lb}</i><b class="${wild && c.c === -1 ? '' : JEWEL[c.c] + '-t'}">${lb}</b><i class="cb">${lb}</i></span></span>`;
}
// Which seat's cards are shown at the bottom.
function pattaMe() {
  const s = G.s;
  if (G.mode === 'online') return s.players.findIndex(p => p.id === pid);
  if (G.mode === 'local') return G.shown != null ? G.shown : s.turn;
  return s.players.findIndex(p => p.kind === 'me');
}
const pIsMine = () => { const s = G.s, me = pattaMe(); return !s.over && s.turn === me && (G.mode !== 'local' || G.shown === s.turn); };
function startPatta(mode, players) {
  G = { mode, game: 'patta', s: newPatta(players), busy: false };
  G.shown = mode === 'local' ? null : undefined;
  enterPatta();
  setTimeout(nextPatta, 500);
}
function enterPatta() {
  dropBoard(); dropCBoard(); dropRBoard();
  show('patta');
  $('pRoom').textContent = 'UNO · ' + (G.mode === 'online' ? 'Room ' + G.code : G.mode === 'bot' ? 'Vs computer' : 'Pass & play');
  $('pMic').classList.toggle('hide', G.mode !== 'online');
  $('pChat').style.visibility = G.mode === 'online' ? 'visible' : 'hidden';
  setBadges(); syncMicButtons(); syncSpeaker();
  renderPatta(); music(false);
}
// Seats around the table, counted from the player at the bottom.
function pattaSeats() {
  const s = G.s, me = Math.max(0, pattaMe()), n = s.players.length, out = [];
  for (let k = 1; k < n; k++) out.push((me + k) % n);
  const spots = n === 2 ? ['top'] : n === 3 ? ['left', 'right'] : ['left', 'top', 'right'];
  return out.map((i, k) => [i, spots[k]]);
}
function renderPatta() {
  if (!G || !G.s || G.s.game !== 'patta' || current !== 'patta') return;
  const s = G.s, me = pattaMe(), counts = s.counts || s.hands.map(h => h.length);
  const tint = p => p.tint != null ? p.tint : p.seat % 4;
  // Others
  $('pOpps').innerHTML = pattaSeats().map(([i, at]) => {
    const p = s.players[i], n = counts[i], lp = G.mode === 'online' ? G.lobby.find(x => x.pid === p.id) : null;
    const speaking = G.speaking && G.speaking.has(p.id), micOn = lp ? lp.mic : false;
    const st = p.left || (lp && lp.left) ? 'Left' : lp && !lp.connected ? 'No network' : n === 1 ? 'UNO!' : `${n} cards`;
    return `<div class="popp ${at} ${s.turn === i && !s.over ? 'turn' : ''} ${p.left ? 'away' : ''}" data-pid="${p.id}">
      ${avatar(p.look, tint(p), speaking ? 'speak' : '', p.id)}
      <span class="nm">${esc(p.name)}</span>
      <span class="fan">${Array.from({ length: Math.min(n, 8) }, () => '<i></i>').join('')}</span>
      <span class="k ${n <= 2 ? 'hot' : ''}">${st}</span>
      ${s.catchable === i && me >= 0 && me !== i ? '<button class="catchbtn" data-catch="1">Catch! +2</button>' : ''}
      ${G.mode === 'online' ? `<button class="mic ${micOn ? 'on' : ''}" data-deaf="${p.id}" aria-label="Mute ${esc(p.name)}">${micOn && !(G.voice && G.voice.deafened.has(p.id)) ? MIC : MIC_OFF}</button>` : ''}
    </div>`;
  }).join('');
  // Table
  const pile = s.pile.slice(-3);
  $('pPile').innerHTML = pile.map((c, k) => pcardHtml(c, 'onpile', `style="transform:rotate(${[-10, 6, -3][k + 3 - pile.length]}deg) translate(${[-6, 5, 0][k + 3 - pile.length]}px,0)"`)).join('');
  $('pDeckN').textContent = typeof s.draw === 'number' ? s.draw : s.draw.length;
  $('pDir').classList.toggle('rev', s.dir < 0);
  const t = pattaTop(s);
  $('pCol').innerHTML = `<span class="dot" style="background:${JEWEL_HEX[s.col]}"></span>${PCOLORS[s.col]}${s.pend ? ` · ${esc(s.players[s.turn].name)} must pick ${s.pend}` : ''}`;
  $('pCol').style.background = JEWEL_HEX[s.col] + 'dd';
  void t;
  // My hand
  const hand = me >= 0 ? (s.hands[me] || []) : [];
  const mine = pIsMine(), ok = mine ? pattaPlayable(s, me) : [];
  const n = hand.length, W = Math.min(innerWidth, 480), cw = 74;
  const step = n > 1 ? Math.min(46, (W - 40 - cw) / (n - 1)) : 0;
  const x0 = (W - (cw + step * (n - 1))) / 2;
  $('pHand').innerHTML = hand.map((c, k) => {
    const tt = k - (n - 1) / 2, rot = n > 1 ? tt * Math.min(3, 20 / n) : 0, y = Math.abs(tt) * Math.abs(tt) * Math.min(2.2, 36 / (n * n));
    const can = ok.includes(c.id);
    return pcardHtml(c, `inhand ${mine ? (can ? 'can' : 'cant') : ''} ${G.newIds && G.newIds.includes(c.id) ? 'new' : ''}`, `data-card="${c.id}" style="left:${x0 + k * step}px;top:${y}px;transform:rotate(${rot}deg);z-index:${k}"`);
  }).join('');
  // Me
  const P = me >= 0 ? s.players[me] : null;
  $('pMe').innerHTML = P ? `<div class="${mine ? 'turn' : ''}">${avatar(P.look, tint(P), G.speaking && G.speaking.has(P.id) ? 'speak' : '', P.id)}</div>` : '';
  const canEk = me >= 0 && !s.over && hand.length <= 2 && hand.length > 0 && !s.ek[me];
  $('pEk').classList.toggle('show', canEk || (s.catchable === me && me >= 0));
  $('pKeep').classList.toggle('show', mine && s.drawn != null);
  $('pDeck').classList.toggle('ready', mine && s.drawn == null && !ok.length);
  $('pDeck').disabled = !(mine && s.drawn == null) || G.busy;
  $('pTurn').textContent = pattaTurnText();
  // Pass & play: hide the cards until the next person is holding the phone.
  const cur = G.mode === 'local' && !s.over && G.shown !== s.turn;
  $('pCurtain').classList.toggle('show', cur);
  if (cur) { const q = s.players[s.turn]; $('pCurAv').innerHTML = faceImg(q.look, tint(q), q.id); $('pCurName').textContent = q.name + '’s turn'; }
}
function pattaTurnText() {
  const s = G.s; if (s.over) return 'Game over';
  if (G.note && G.note.until > Date.now()) return G.note.text;
  const p = s.players[s.turn], left = G.turnEnds ? Math.max(0, Math.ceil((G.turnEnds - Date.now()) / 1000)) : '';
  const tail = left !== '' ? ` · 0:${String(left).padStart(2, '0')}` : '';
  if (pIsMine()) {
    if (s.pend) return `Play a +${s.pend > 2 || pattaTop(s).v === 'w4' ? '4' : '2'} or pick up ${s.pend}` + tail;
    if (s.drawn != null) return 'Play the new card or keep it' + tail;
    return (pattaPlayable(s, pattaMe()).length ? 'Your turn' : 'No match: draw a card') + tail;
  }
  return p.kind === 'bot' ? `${p.name} is thinking...` : `${p.name}’s turn${tail}`;
}
let lastPTick = 0;
function pattaTick() {
  if (!G || !G.s) return;
  $('pTurn').textContent = pattaTurnText();
  const left = G.turnEnds && !G.s.over ? G.turnEnds - Date.now() : null, fill = $('pFill');
  if (left == null) fill.style.width = '0';
  else {
    fill.style.width = Math.max(0, Math.min(100, left / (PATTA_SECS * 10))) + '%';
    fill.classList.toggle('low', left < 5000);
    const sec = Math.ceil(left / 1000);
    if (pIsMine() && sec <= 5 && sec > 0 && sec !== lastPTick) { lastPTick = sec; sfx('tick'); }
  }
  if (G.mode !== 'online' && left != null && left <= 0 && !G.busy) {
    G.turnEnds = null; const ev = pattaTimeout(G.s); note('Time up'); buzz([80]);
    pattaApplied(ev).then(nextPatta);
  }
}
// Fly a card picture from one place on the screen to another.
function flyCard(html, from, to, ms) {
  return new Promise(res => {
    if (!from || !to) return res();
    const a = from.getBoundingClientRect(), b = to.getBoundingClientRect();
    const el = document.createElement('div'); el.className = 'pfly'; el.innerHTML = html;
    el.style.left = a.left + a.width / 2 - 37 + 'px'; el.style.top = a.top + a.height / 2 - 55 + 'px';
    document.body.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.transition = `transform ${ms || 320}ms cubic-bezier(.3,.8,.4,1)`;
      el.style.transform = `translate(${b.left + b.width / 2 - a.left - a.width / 2}px, ${b.top + b.height / 2 - a.top - a.height / 2}px) rotate(${Math.random() * 16 - 8}deg)`;
    }));
    setTimeout(() => { el.remove(); res(); }, (ms || 320) + 30);
  });
}
const seatEl = i => i === pattaMe() ? $('pHand') : document.querySelector(`#pOpps [data-pid="${G.s.players[i].id}"]`);
// Animate what just happened, then show the new table.
async function pattaApplied(ev, fromEl) {
  if (!ev || !G) { renderPatta(); return; }
  G.busy = true;
  try { await pattaAnim(ev, fromEl); } catch (e) { console.error(e); }
  if (!G) return;
  G.busy = false;
  renderPatta();
  setTimeout(() => { if (G && G.newIds) { G.newIds = null; } }, 900);
}
async function pattaAnim(ev, fromEl) {
  const s = G.s;
  if (ev.t === 'play') {
    sfx('hop');
    await flyCard(pcardHtml(ev.card, ''), fromEl || seatEl(ev.who), $('pPile'));
    const P = s.players[ev.who], you = ev.who === pattaMe() && G.mode !== 'local';
    if (ev.effect === 'skip') toast(`${you ? 'You' : P.name} skipped the next player`, JEWEL_HEX[ev.card.c]);
    else if (ev.effect === 'rev') toast('Direction reversed', JEWEL_HEX[ev.card.c]);
    else if (ev.effect === 'd2' || ev.effect === 'w4') { toast(`+${ev.effect === 'd2' ? 2 : 4}! ${s.pend} cards waiting`, JEWEL_HEX[ev.card.c]); buzz([60, 40, 60]); }
    else if (ev.effect === 'wild') toast(`Colour: ${PCOLORS[ev.card.c]}`, JEWEL_HEX[ev.card.c]);
  } else if (ev.t === 'draw' || ev.t === 'caught') {
    const n = Math.min(ev.n || 1, 4);
    for (let k = 0; k < n; k++) { sfx('step'); await flyCard('<span class="pc back"><span class="f"></span></span>', $('pDeck'), seatEl(ev.who), 220); }
    G.newIds = ev.ids || null;
    if (ev.t === 'caught') { const v = s.players[ev.who]; toast(ev.who === pattaMe() ? 'Caught! You forgot UNO! +2' : `${v.name} forgot UNO! +2`, '#E5196F'); buzz([100, 50, 100]); }
    else if (ev.forced) note(`${s.players[ev.who].name} picked up ${ev.n}`);
  } else if (ev.t === 'ek') { toast(`${ev.who === pattaMe() && G.mode !== 'local' ? 'You' : s.players[ev.who].name}: UNO!`, '#E5196F'); sfx('pop'); }
}
function nextPatta() {
  if (!G || G.mode === 'online' || !G.s || G.s.game !== 'patta') return;
  const s = G.s;
  renderPatta();
  if (s.over) { setTimeout(finishPatta, 900); return; }
  const p = s.players[s.turn];
  G.turnEnds = p.kind === 'me' ? Date.now() + PATTA_SECS * 1000 : null;
  if (p.kind === 'bot') setTimeout(() => botPatta(s), 900 + Math.random() * 500);
  else if (G.mode !== 'local' || G.shown === s.turn) sfx('turn');
  // Computer players catch you if you forget EK! (not always).
  if (s.catchable != null && s.players[s.catchable].kind === 'me') {
    const v = s.catchable, seq = s.seq;
    setTimeout(() => {
      if (!G || G.s !== s || s.catchable !== v || s.seq !== seq) return;
      const by = s.players.findIndex(q => q.kind === 'bot' && !q.left); if (by < 0 || Math.random() < 0.35) return;
      pattaApplied(catchEk(s, by)).then(nextPatta);
    }, 1600 + Math.random() * 1200);
  }
}
async function botPatta(s) {
  if (!G || G.s !== s || s.over) return;
  const i = s.turn, b = pattaBot(s, i);
  if (s.hands[i].length <= 2 && Math.random() < 0.85) sayEk(s, i);
  let ev;
  if (b.draw) ev = drawCard(s, i); else if (b.pass) ev = pattaPass(s, i); else ev = playCard(s, i, b.card, b.color);
  await pattaApplied(ev);
  if (G && G.s === s && s.drawn != null && s.turn === i) { setTimeout(() => botPatta(s), 700); return; }
  nextPatta();
}
// My moves
function pattaDo(kind, card, color) {
  const s = G.s, me = pattaMe();
  if (G.mode === 'online') {
    if (!G.net.send({ t: kind, card, color, seq: s.seq })) { note('No connection, try again'); G.net.probe(); }
    return;
  }
  let ev = null;
  if (kind === 'pplay') ev = playCard(s, me, card, color);
  else if (kind === 'pdraw') ev = drawCard(s, me);
  else if (kind === 'ppass') ev = pattaPass(s, me);
  if (!ev) return;
  G.turnEnds = null;
  const fromEl = kind === 'pplay' ? document.querySelector(`#pHand [data-card="${card}"]`) : null;
  const turnBefore = me;
  pattaApplied(ev, fromEl).then(() => {
    if (!G || G.s !== s) return;
    if (G.mode === 'local' && s.turn !== turnBefore) G.shown = null;
    if (s.drawn != null && s.turn === me) { G.turnEnds = Date.now() + PATTA_SECS * 1000; renderPatta(); return; }
    nextPatta();
  });
}
$('pHand').addEventListener('click', e => {
  const el = e.target.closest('[data-card]'); if (!el || !G || G.busy) return;
  const s = G.s, id = +el.dataset.card;
  if (!pIsMine()) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); return; }
  const card = s.hands[pattaMe()].find(c => c.id === id);
  if (!card || !pattaPlayable(s, pattaMe()).includes(id)) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); note(s.pend ? `Play a +2/+4 or tap the deck to pick up ${s.pend}` : 'This card doesn’t match'); buzz([30]); return; }
  sfx('click');
  if (card.c === -1) {
    modal(`<h3>Pick a colour</h3><div class="pickcol">${PCOLORS.map((n, i) => `<button class="gemc2 ${JEWEL[i]}" data-pc="${i}"><span></span>${n}</button>`).join('')}</div>`);
    $('modalBox').querySelectorAll('[data-pc]').forEach(b => b.onclick = () => { closeModal(); pattaDo('pplay', id, +b.dataset.pc); });
    return;
  }
  pattaDo('pplay', id);
});
$('pDeck').onclick = () => { if (!G || G.busy || !pIsMine() || G.s.drawn != null) return; sfx('click'); pattaDo('pdraw'); };
$('pKeep').onclick = () => { if (!G || G.busy || !pIsMine()) return; sfx('click'); pattaDo('ppass'); };
$('pEk').onclick = () => {
  if (!G || !G.s) return; const s = G.s, me = pattaMe();
  if (G.mode === 'online') { G.net.send({ t: 'pek' }); sfx('pop'); return; }
  const ev = sayEk(s, me); if (ev) pattaApplied(ev);
};
$('pOpps').addEventListener('click', e => {
  if (e.target.closest('[data-catch]')) {
    sfx('click');
    if (G.mode === 'online') { G.net.send({ t: 'pcatch' }); return; }
    const ev = catchEk(G.s, pattaMe()); if (ev) pattaApplied(ev).then(nextPatta);
    return;
  }
  const b = e.target.closest('[data-deaf]'); if (!b || !G || !G.voice) return;
  const off = G.voice.toggleDeafen(b.dataset.deaf); toast(off ? 'Muted for you' : 'Unmuted', '#3A2490'); renderPatta();
});
$('pCurtain').onclick = () => { if (!G || !G.s) return; G.shown = G.s.turn; G.turnEnds = Date.now() + PATTA_SECS * 1000; sfx('turn'); renderPatta(); };
$('pLeave').onclick = () => leaveGame();
$('pSound').onclick = () => $('gameSound').onclick();
$('pChat').onclick = () => { sfx('click'); openChat(); };
// Online
function onPattaState(m) {
  G.s = m.s; G.busy = false; G.turnEnds = m.turnEnds || null;
  G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
  if (m.s.over && m.t === 'sync') { finishPatta(); return; }
  if (current !== 'patta') enterPatta(); else renderPatta();
  if (m.t === 'start') sfx('turn');
}
async function onPattaEv(m) {
  const ev = m.ev, before = G.s;
  const fromEl = ev && ev.t === 'play' && ev.who === pattaMe() ? document.querySelector(`#pHand [data-card="${ev.card.id}"]`) : null;
  G.s = m.s; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
  G.turnEnds = m.turnEnds || null;
  void before;
  if (current === 'patta') {
    if (ev && ev.t === 'left') { note(`${G.s.players[ev.who].name} left the game`); renderPatta(); }
    else if (ev && ev.t === 'bot') { note(`${G.s.players[ev.who].name.replace(' 🤖', '')} left · the computer plays for them`); renderPatta(); }
    else await pattaApplied(ev, fromEl);
  }
  if (ev && ev.timeout && ev.who === pattaMe()) note('Time up');
  if (G.s.over) setTimeout(finishPatta, 900);
  else if (G.s.players[G.s.turn].id === pid && ev && ev.next === G.s.turn) sfx('turn');
}
function finishPatta() {
  if (!G || !G.s) return;
  const s = G.s, order = pattaRanking(s), W = s.players[s.winner];
  const me = G.mode === 'local' ? s.players.findIndex(p => p.id === pid) : s.players.findIndex(p => p.id === pid || (G.mode === 'bot' && p.kind === 'me'));
  const iWon = me === s.winner && G.mode !== 'local';
  const counts = s.counts || s.hands.map(h => h.length);
  const tint = p => p.tint != null ? p.tint : p.seat % 4;
  $('winTitle').textContent = iWon ? 'You won!' : `${W.name} won!`;
  $('winSub').textContent = s.reason === 'left' ? 'Everyone else left the game' : `${iWon ? 'You' : W.name} played the last card`;
  if (me >= 0) addHistory({ game: 'patta', mode: G.mode, result: me === s.winner ? 'won' : 'lost', rank: order.indexOf(me) + 1, of: s.players.length,
    score: me === s.winner ? 'All cards played' : `${counts[me]} card${counts[me] === 1 ? '' : 's'} left`,
    opp: s.players.filter((p, i) => i !== me).map(p => ({ id: p.id, name: p.name, look: p.look, tint: tint(p) })) });
  danceStage({ look: W.look, tint: tint(W), name: W.name }, order.slice(1).map(i => ({ look: s.players[i].look, tint: tint(s.players[i]) })));
  $('winRest').innerHTML = `<div class="rankchips">${order.slice(1).map((i, k) => `<span class="rankchip"><b>${k + 2}</b>${esc(s.players[i].name)} · ${counts[i]} left</span>`).join('')}</div>`;
  const cc = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0', '#FF4FD8', '#FFFFFF', '#FFC21A'];
  $('winConf').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:${cc[i % 7]};animation-duration:${2.5 + (i % 5) * 0.6}s;animation-delay:${(i % 10) * 0.25}s"></i>`).join('');
  $('winAgain').style.display = G.mode === 'online' ? (G.host ? 'flex' : 'none') : 'flex';
  buzz([60, 40, 60, 40, 120]);
  show('win'); startDance();
}

// ---------- Sudoku ----------
// G.sd holds the board: puzzle, solution, cur (what is in each cell), notes (bit masks),
// bad (cells with a wrong number), mistakes, hints, time, undo list.
function sudokuModesHtml() {
  const saved = store.get('sudoku', null), d = new Date(), daySeed = dailySeed(d);
  const dailyDone = history.some(h => h.game === 'sudoku' && h.daily === daySeed && h.result === 'won');
  const fmt = ms => { const t = Math.floor(ms / 1000); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); };
  const btn = (k, t, sub, cls, extra) => `<button class="sdmode ${cls}" data-sdmode="${k}"><span class="col grow"><b>${t}</b><small>${sub}</small></span>${extra || ''}</button>`;
  return `<div class="chips sdlevels">${SD_LEVELS.map(l => `<button class="chip ${settings.sdLevel === l ? 'on' : ''}" data-sdlevel="${l}">${SD_NAME[l]}</button>`).join('')}</div>
    ${saved && !saved.over ? btn('cont', 'Continue', `${SD_NAME[saved.level]}${saved.daily ? ' daily' : ''} · ${fmt(saved.time)} · ${saved.mistakes}/3 mistakes`, 'gold') : ''}
    ${btn('new', 'New game', SD_NAME[settings.sdLevel] + ' puzzle', saved && !saved.over ? 'plum' : 'gold')}
    ${btn('daily', '🏆 Daily puzzle', d.toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) + (dailyDone ? ' · solved ✓' : ' · same for everyone'), 'teal')}
    ${btn('online', 'Race a friend', `Same ${SD_NAME[settings.sdLevel]} puzzle, talk on mic. First to finish wins`, 'ruby')}
    ${btn('join', 'Join a race', 'Enter your friend’s room code', 'blue')}`;
}
function sudokuMode(m) {
  if (m === 'cont') { const sv = store.get('sudoku', null); if (sv) { G = { mode: 'solo', game: 'sudoku', sd: sv, daily: sv.daily }; enterSudoku(); } return; }
  if (m === 'new') return startSudoku(settings.sdLevel, null);
  if (m === 'daily') return startSudoku('medium', dailySeed());
  if (m === 'online') return createRoom();
  if (m === 'join') { $('joinCode').value = ''; $('joinErr').textContent = ''; show('join'); }
}
function newBoard(seed, level) {
  const p = makePuzzle(seed, level);
  return { seed, level, puzzle: p.puzzle, solution: p.solution, cur: p.puzzle.slice(), notes: Array(81).fill(0), bad: [], mistakes: 0, hints: 3, time: 0, undo: [], over: false, second: false };
}
function startSudoku(level, daily) {
  const seed = daily || Math.floor(Math.random() * 1e6);
  G = { mode: 'solo', game: 'sudoku', sd: newBoard(seed, level), daily: daily || null };
  G.sd.daily = daily || null;
  saveSudoku(); enterSudoku();
}
function saveSudoku() { if (G && G.game === 'sudoku' && G.mode !== 'online' && G.sd) store.set('sudoku', Object.assign({}, G.sd, { undo: G.sd.undo.slice(-60) })); }
function enterSudoku() {
  dropBoard(); dropCBoard(); dropRBoard();
  G.sel = G.sel != null ? G.sel : G.sd.cur.findIndex(v => !v);
  G.notes = false; G.tick = Date.now();
  show('sudoku');
  $('sdRace').classList.toggle('show', G.mode === 'online');
  setBadges(); syncMicButtons(); syncSpeaker();
  renderSudoku(); music(false);
}
const sdFilled = sd => sd.cur.reduce((a, v, i) => a + (!sd.puzzle[i] && v === sd.solution[i] ? 1 : 0), 0);
function renderSudoku() {
  if (!G || !G.sd || current !== 'sudoku') return;
  const sd = G.sd, sel = G.sel, sv = sel >= 0 ? sd.cur[sel] : 0;
  const pr = sel >= 0 ? new Set(sdPeers(sel)) : new Set();
  $('sdGrid').innerHTML = sd.cur.map((v, i) => {
    const r = Math.floor(i / 9), c = i % 9, cls = [];
    if (c % 3 === 2 && c < 8) cls.push('br'); if (r % 3 === 2 && r < 8) cls.push('bb');
    if (pr.has(i)) cls.push('hl');
    if (sv && v === sv) cls.push('same');
    if (i === sel) cls.push('sel');
    if (sd.puzzle[i]) cls.push('given'); else if (v) cls.push('u');
    if (sd.bad.includes(i)) cls.push('err');
    let inner = v || '';
    if (!v && sd.notes[i]) inner = `<span class="nt">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<span>${sd.notes[i] & (1 << n) ? n : ''}</span>`).join('')}</span>`;
    return `<button class="${cls.join(' ')}" data-i="${i}" aria-label="Row ${r + 1} column ${c + 1}${v ? ', ' + v : ''}">${inner}</button>`;
  }).join('');
  const left = n => 9 - sd.cur.filter((v, i) => v === n && !sd.bad.includes(i)).length;
  $('sdPad').innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => `<button class="${left(n) ? '' : 'done'}" data-n="${n}">${n}<small>${left(n) || '✓'}</small></button>`).join('');
  $('sdLevel').innerHTML = `${G.daily ? '🏆 Daily · ' : ''}<b>${SD_NAME[sd.level]}</b>`;
  $('sdMist').textContent = `${sd.mistakes}/${SD_MAX}`;
  $('sdMist').classList.toggle('bad', sd.mistakes > 0);
  $('sdNotes').classList.toggle('on', !!G.notes);
  $('sdHintN').textContent = sd.hints;
  $('sdHint').classList.toggle('none', !sd.hints);
  $('sdOut').classList.toggle('show', G.mode === 'online' && !!G.out);
  sudokuClock();
  if (G.mode === 'online') renderRace();
}
function sudokuClock() {
  if (!G || !G.sd) return;
  const now = Date.now();
  if (!G.sd.over && current === 'sudoku' && !document.hidden) G.sd.time += now - (G.tick || now);
  G.tick = now;
  const t = Math.floor(G.sd.time / 1000);
  $('sdTime').textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
}
setInterval(() => { if (G && G.game === 'sudoku' && current === 'sudoku') { sudokuClock(); if (Math.floor(G.sd.time / 1000) % 10 === 0) saveSudoku(); } }, 1000);
$('sdGrid').addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b || !G || !G.sd) return; G.sel = +b.dataset.i; renderSudoku(); });
function sdPlace(n) {
  const sd = G.sd, i = G.sel; if (sd.over || i == null || i < 0 || sd.puzzle[i] || (G.mode === 'online' && G.out)) return;
  if (sd.cur[i] && !sd.bad.includes(i)) return; // already right
  sd.undo.push({ i, v: sd.cur[i], n: sd.notes[i], bad: sd.bad.includes(i) });
  if (G.notes) {
    if (sd.cur[i]) return;
    sd.notes[i] ^= 1 << n; sfx('step'); renderSudoku(); saveSudoku(); return;
  }
  sd.cur[i] = n; sd.notes[i] = 0;
  if (n === sd.solution[i]) {
    sd.bad = sd.bad.filter(x => x !== i);
    sdPeers(i).forEach(k => { sd.notes[k] &= ~(1 << n); });
    sfx('hop');
    const done = sd.cur.every((v, k) => v === sd.solution[k]);
    // Little glow when a row, column or box is complete.
    const r = Math.floor(i / 9), c = i % 9, bx = r - r % 3, by = c - c % 3;
    const full = idx => idx.every(k => sd.cur[k] === sd.solution[k]);
    if (!done && (full([...Array(9)].map((_, k) => r * 9 + k)) || full([...Array(9)].map((_, k) => k * 9 + c)) || full([...Array(9)].map((_, k) => (bx + Math.floor(k / 3)) * 9 + by + k % 3)))) { sfx('finish'); G.flash = i; }
    if (done) { sd.over = true; renderSudoku(); saveSudoku(); return sudokuSolved(); }
  } else {
    if (!sd.bad.includes(i)) sd.bad.push(i);
    sd.mistakes++; sfx('capture'); buzz([60, 40, 60]);
    if (sd.mistakes >= SD_MAX) { renderSudoku(); saveSudoku(); return sudokuFailed(); }
  }
  renderSudoku(); saveSudoku();
  if (G.mode === 'online') G.net.send({ t: 'sprog', filled: sdFilled(sd), mistakes: sd.mistakes });
}
$('sdPad').addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (b && G && G.sd) sdPlace(+b.dataset.n); });
$('sdUndo').onclick = () => {
  const sd = G && G.sd; if (!sd || sd.over || !sd.undo.length) return;
  const u = sd.undo.pop(); sd.cur[u.i] = u.v; sd.notes[u.i] = u.n; sd.bad = sd.bad.filter(x => x !== u.i); if (u.bad) sd.bad.push(u.i);
  G.sel = u.i; sfx('click'); renderSudoku(); saveSudoku();
};
$('sdErase').onclick = () => {
  const sd = G && G.sd, i = G && G.sel; if (!sd || sd.over || i == null || i < 0 || sd.puzzle[i]) return;
  if (sd.cur[i] && !sd.bad.includes(i)) return;
  sd.undo.push({ i, v: sd.cur[i], n: sd.notes[i], bad: sd.bad.includes(i) });
  sd.cur[i] = 0; sd.notes[i] = 0; sd.bad = sd.bad.filter(x => x !== i); sfx('click'); renderSudoku(); saveSudoku();
};
$('sdNotes').onclick = () => { if (!G || !G.sd) return; G.notes = !G.notes; sfx('click'); renderSudoku(); toast(G.notes ? 'Notes on: numbers go in small' : 'Notes off', '#3A2490'); };
$('sdHint').onclick = () => {
  const sd = G && G.sd; if (!sd || sd.over || (G.mode === 'online' && G.out)) return;
  if (!sd.hints) { toast('No hints left in this game', '#3A2490'); return; }
  let i = G.sel;
  if (i == null || i < 0 || sd.puzzle[i] || (sd.cur[i] === sd.solution[i])) i = sd.cur.findIndex((v, k) => v !== sd.solution[k]);
  if (i < 0) return;
  sd.hints--; G.sel = i;
  const n = sd.solution[i], wasNotes = G.notes; G.notes = false;
  sd.bad = sd.bad.filter(x => x !== i); sd.cur[i] = 0;
  const m = sd.mistakes; sdPlace(n); sd.mistakes = m; G.notes = wasNotes;
  renderSudoku(); saveSudoku();
};
$('sdBack').onclick = () => leaveGame();
$('sdSound').onclick = () => $('gameSound').onclick();
$('sdChat').onclick = () => { sfx('click'); openChat(); };
function sudokuSolved() {
  const sd = G.sd, t = Math.floor(sd.time / 1000), tt = `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
  if (G.mode === 'online') { G.net.send({ t: 'sdone', grid: sd.cur }); return; }
  store.set('sudoku', null);
  addHistory({ game: 'sudoku', mode: 'solo', result: 'won', of: 1, secs: t, score: `${SD_NAME[sd.level]} in ${tt}${sd.mistakes ? ` · ${sd.mistakes} mistake${sd.mistakes > 1 ? 's' : ''}` : ''}`, daily: G.daily || undefined, opp: [] });
  $('winTitle').textContent = 'Solved!';
  $('winSub').textContent = `${G.daily ? 'Daily puzzle' : SD_NAME[sd.level] + ' puzzle'} in ${tt}${sd.mistakes ? '' : ' with no mistakes'}`;
  danceStage({ look: profile.look, tint: profile.color, name: profile.name }, []);
  $('winRest').innerHTML = '';
  const cc = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0', '#FF4FD8', '#FFFFFF', '#FFC21A'];
  $('winConf').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:${cc[i % 7]};animation-duration:${2.5 + (i % 5) * 0.6}s;animation-delay:${(i % 10) * 0.25}s"></i>`).join('');
  $('winAgain').style.display = 'flex'; $('winAgain').textContent = 'New puzzle';
  buzz([60, 40, 60, 40, 120]);
  setTimeout(() => { show('win'); startDance(); }, 700);
}
function sudokuFailed() {
  const sd = G.sd;
  if (G.mode === 'online') { G.out = true; G.net.send({ t: 'sprog', filled: sdFilled(sd), mistakes: sd.mistakes }); renderSudoku(); return; }
  modal(`<h3>3 mistakes</h3><p>${sd.second ? 'That was your second chance.' : 'Keep going with one more chance, or start again.'}</p>
    ${sd.second ? '' : '<button class="btn gold" id="mYes">Second chance</button>'}<button class="btn ghost" id="mNo">New game</button>`);
  if (!sd.second) $('mYes').onclick = () => { closeModal(); sd.second = true; sd.mistakes = SD_MAX - 1; renderSudoku(); saveSudoku(); };
  $('mNo').onclick = () => {
    closeModal();
    addHistory({ game: 'sudoku', mode: 'solo', result: 'lost', of: 1, score: `${SD_NAME[sd.level]} · 3 mistakes`, daily: G.daily || undefined, opp: [] });
    store.set('sudoku', null); startSudoku(sd.level, null);
  };
}
// Online race
function renderRace() {
  if (!G || !G.s || G.s.game !== 'sudoku' || current !== 'sudoku') return;
  const s = G.s;
  $('sdRacers').innerHTML = s.players.map(p => {
    const lp = G.lobby.find(x => x.pid === p.id), speaking = G.speaking && G.speaking.has(p.id), f = Math.round(p.filled / s.total * 100);
    return `<div class="racer ${p.out || p.left ? 'out' : ''}" data-pid="${p.id}">${avatar(p.look, p.tint != null ? p.tint : 0, speaking ? 'speak' : '', p.id)}
      <div class="col grow minw0"><span class="nm">${esc(p.id === pid ? 'You' : p.name)}${lp && lp.mic ? ' 🎙️' : ''}</span><span class="racebar"><i style="width:${f}%"></i></span><span class="st">${p.left ? 'Left' : p.out ? 'Out (3 mistakes)' : `${f}% · ${p.mistakes}/3`}</span></div></div>`;
  }).join('');
}
function onRaceState(m) {
  G.s = m.s;
  if (m.s.over && m.t === 'sync') { onRaceEnd(m); return; }
  if (!G.sd || G.sd.seed !== m.s.seed) { G.sd = newBoard(m.s.seed, m.s.level); G.out = false; G.sel = null; }
  const me = m.s.players.find(p => p.id === pid); if (me && me.out) G.out = true;
  if (current !== 'sudoku') enterSudoku(); else renderSudoku();
  if (m.t === 'start') { sfx('turn'); toast('Go! Same puzzle for everyone', '#3A2490'); }
}
function onRaceProg(m) {
  const before = G.s; G.s = m.s;
  if (before) m.s.players.forEach(p => { const o = before.players.find(x => x.id === p.id); if (p.id !== pid && o && !o.out && p.out) toast(`${p.name} is out (3 mistakes)`, '#3A2490'); });
  renderRace();
}
function onRaceEnd(m) {
  G.s = m.s; if (G.sd) G.sd.over = true;
  const s = m.s, W = s.players.find(p => p.id === s.winner) || s.players[0], iWon = W.id === pid;
  const me = s.players.find(p => p.id === pid);
  if (me) addHistory({ game: 'sudoku', mode: 'online', result: iWon ? 'won' : 'lost', of: s.players.length, rank: iWon ? 1 : 2, score: `${SD_NAME[s.level]} race · ${Math.round(me.filled / s.total * 100)}% done`,
    opp: s.players.filter(p => p.id !== pid).map(p => ({ id: p.id, name: p.name, look: p.look, tint: p.tint || 0 })) });
  $('winTitle').textContent = iWon ? 'You won the race!' : `${W.name} won!`;
  $('winSub').textContent = s.reason === 'solved' ? `${iWon ? 'You' : W.name} solved it first` : s.reason === 'others-out' ? 'Everyone else made 3 mistakes or left' : 'Most cells filled';
  danceStage({ look: W.look, tint: W.tint || 0, name: W.name }, s.players.filter(p => p.id !== W.id).map(p => ({ look: p.look, tint: p.tint || 0 })));
  $('winRest').innerHTML = `<div class="rankchips">${s.players.filter(p => p.id !== W.id).map((p, k) => `<span class="rankchip"><b>${k + 2}</b>${esc(p.name)} · ${Math.round(p.filled / s.total * 100)}%</span>`).join('')}</div>`;
  const cc = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0', '#FF4FD8', '#FFFFFF', '#FFC21A'];
  $('winConf').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:${cc[i % 7]};animation-duration:${2.5 + (i % 5) * 0.6}s;animation-delay:${(i % 10) * 0.25}s"></i>`).join('');
  $('winAgain').style.display = G.host ? 'flex' : 'none';
  buzz([60, 40, 60, 40, 120]);
  setTimeout(() => { show('win'); startDance(); }, 600);
}

// ---------- Arrow Escape ----------
function arrowModesHtml() {
  const lv = settings.arLevel || 1;
  return `<div class="armini"><svg viewBox="0 0 80 80"><g stroke-width="7" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M14 22 H50 M44 14 L54 22 L44 30" stroke="#fff"/><path d="M30 40 V70 M22 62 L30 72 L38 62" stroke="#ffd34d"/><path d="M66 70 V36 M58 44 L66 34 L74 44" stroke="#ff5f93"/><path d="M46 52 H14 M22 44 L12 52 L22 60" stroke="#7af0ff"/></g></svg></div>
    <button class="sdmode gold" data-armode="play"><span class="col grow"><b>Play level ${lv}</b><small>${lv > 1 ? `${lv - 1} level${lv > 2 ? 's' : ''} cleared` : 'Clear the picture, one arrow at a time'}</small></span></button>
    <button class="sdmode ruby" data-armode="online"><span class="col grow"><b>Race a friend</b><small>Same level for both, talk on mic. First to clear wins</small></span></button>
    <button class="sdmode blue" data-armode="join"><span class="col grow"><b>Join a race</b><small>Enter your friend’s room code</small></span></button>
    ${lv > 1 ? '<button class="sdmode plum" data-armode="pick"><span class="col grow"><b>Play an old level</b><small>Go back to any level you have cleared</small></span></button>' : ''}`;
}
function arrowMode(m) {
  if (m === 'play') return startArrows(settings.arLevel || 1);
  if (m === 'online') return createRoom();
  if (m === 'join') { $('joinCode').value = ''; $('joinErr').textContent = ''; show('join'); return; }
  if (m === 'pick') {
    const lv = settings.arLevel || 1;
    modal(`<h3>Pick a level</h3><div class="lvgrid">${Array.from({ length: lv }, (_, i) => `<button data-lv="${i + 1}" class="${i + 1 === lv ? 'on' : ''}">${i + 1}</button>`).join('')}</div>`);
    $('modalBox').querySelectorAll('[data-lv]').forEach(b => b.onclick = () => { closeModal(); startArrows(+b.dataset.lv); });
  }
}
function startArrows(level, seed) {
  G = { mode: 'solo', game: 'arrows' };
  G.L = arrowLevel(level, seed); G.gone = new Set(); G.order = []; G.hearts = AR_HEARTS; G.hints = 3; G.level = level; G.over = false; G.hint = null;
  enterArrows();
}
function enterArrows() {
  dropBoard(); dropCBoard(); dropRBoard();
  show('arrows');
  $('arRace').classList.toggle('show', G.mode === 'online');
  $('arRestart').style.display = G.mode === 'online' ? 'none' : '';
  $('arOver').classList.remove('show');
  setBadges(); syncMicButtons(); syncSpeaker();
  drawArrows(); renderArrows(); music(false);
}
const ARW = 10;
// Points of an arrow, tail to head tip (in board units), and the way out past the edge.
function arrowPts(a) {
  const pts = a.cells.map(([r, c]) => [c * ARW + ARW / 2, r * ARW + ARW / 2]);
  const [dr, dc] = ADIR[a.dir];
  const [hx, hy] = pts[pts.length - 1];
  if (pts.length === 1) pts.unshift([hx - dc * 3.4, hy - dr * 3.4]);
  pts.push([hx + dc * 3.4, hy + dr * 3.4]);
  return pts;
}
const plen = pts => { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; };
function pointAt(pts, d) {
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (d <= l || i === pts.length - 1) { const t = l ? Math.min(1, d / l) : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t, pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]; }
    d -= l;
  }
  return pts[pts.length - 1].concat([1, 0]);
}
const HEAD = 'M-2.9 -2.5 L0 0 L-2.9 2.5';
function drawArrows() {
  const L = G.L, W = L.n * ARW;
  // Same thin line on every level: about 2.5 screen pixels.
  const px = ($('arBoard').clientWidth || 360) / (W + 6), sw = Math.max(0.3, Math.min(1.1, 2.5 / px)), hs = sw / 1.05;
  const HEADS = `M${(-2.9 * hs).toFixed(2)} ${(-2.5 * hs).toFixed(2)} L0 0 L${(-2.9 * hs).toFixed(2)} ${(2.5 * hs).toFixed(2)}`;
  let dots = ''; L.mask.forEach((m, i) => { if (m) dots += `<circle cx="${(i % L.n) * ARW + 5}" cy="${Math.floor(i / L.n) * ARW + 5}" r="0.55" fill="rgba(42,16,88,.13)" stroke="none"/>`; });
  G.apts = {};
  $('arBoard').innerHTML = `<svg viewBox="-3 -3 ${W + 6} ${W + 6}" id="arSvg">${dots}${L.arrows.map(a => {
    const pts = arrowPts(a), [dr, dc] = ADIR[a.dir];
    // The path continues straight out past the edge, so the arrow can slide along it.
    const far = (L.n + 2) * ARW, last = pts[pts.length - 1], out = pts.concat([[last[0] + dc * far, last[1] + dr * far]]);
    const vis = plen(pts), d = 'M' + out.map(p => p[0].toFixed(2) + ' ' + p[1].toFixed(2)).join(' L');
    G.apts[a.id] = { out, vis };
    const ang = Math.atan2(dr, dc) * 180 / Math.PI;
    return `<g class="arw" data-a="${a.id}"><path class="hit" d="M${pts.map(p => p.join(' ')).join(' L')}" stroke="rgba(0,0,0,0)" stroke-width="8" fill="none" pointer-events="stroke" stroke-linecap="round"/>
      <path class="body" d="${d}" stroke-dasharray="${vis.toFixed(2)} 9999" stroke-dashoffset="0" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" fill="none" pointer-events="none"/>
      <path class="head" d="${HEADS}" transform="translate(${last[0].toFixed(2)} ${last[1].toFixed(2)}) rotate(${ang})" stroke-width="${sw.toFixed(2)}" stroke-linecap="round" stroke-linejoin="round" fill="none" pointer-events="none"/></g>`;
  }).join('')}</svg>`;
}
// Slide an arrow along its own path: s goes from 0 to 'to' (and back if bounce).
function slideArrow(g, id, to, bounce, ms) {
  return new Promise(res => {
    const { out, vis } = G.apts[id], body = g.querySelector('.body'), head = g.querySelector('.head'), t0 = performance.now();
    const step = now => {
      const k = Math.min(1, (now - t0) / ms);
      const e = bounce ? Math.sin(Math.PI * k) : k * k * (2 - k) * 0.4 + k * k * 0.6;
      const sd = to * e;
      body.setAttribute('stroke-dashoffset', (-sd).toFixed(2));
      const [x, y, dx, dy] = pointAt(out, vis + sd);
      head.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${Math.atan2(dy, dx) * 180 / Math.PI})`);
      if (!bounce) g.style.opacity = String(Math.max(0, 1 - Math.max(0, k - 0.6) / 0.4));
      if (k < 1) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
}
function renderArrows() {
  if (!G || !G.L || current !== 'arrows') return;
  const L = G.L, left = L.arrows.length - G.gone.size;
  $('arTitle').textContent = G.mode === 'online' ? 'Arrow race' : `Level ${G.level}`;
  $('arLeft').innerHTML = `<b>${G.gone.size}</b> of ${L.arrows.length} arrows gone · ${L.shape}`;
  $('arHearts').innerHTML = Array.from({ length: AR_HEARTS }, (_, i) => `<i class="${i < G.hearts ? 'on' : ''}">${i < G.hearts ? '❤️' : '🤍'}</i>`).join('');
  $('arProg').style.width = (G.gone.size / L.arrows.length * 100) + '%';
  $('arHintN').textContent = G.hints; $('arHint').classList.toggle('none', !G.hints);
  document.querySelectorAll('#arSvg .arw').forEach(g => { const id = +g.dataset.a; g.classList.toggle('gone', G.gone.has(id)); g.classList.toggle('hint', G.hint === id); });
  void left;
  if (G.mode === 'online') renderArRace();
}
$('arBoard').addEventListener('click', e => {
  const g = e.target.closest('.arw'); if (!g || !G || !G.L || G.over || (G.mode === 'online' && G.out)) return;
  const id = +g.dataset.a; if (G.gone.has(id) || g.classList.contains('moving')) return;
  const L = G.L, a = L.arrows[id], blk = blockerOf(L, G.gone, a);
  if (G.hint === id) G.hint = null;
  if (!blk) {
    G.gone.add(id); G.order.push(id); sfx('hop');
    g.classList.add('moving');
    slideArrow(g, id, (L.n + 2) * ARW, false, 520).then(() => { g.classList.remove('moving'); g.classList.add('gone'); });
    renderArrows();
    if (G.mode === 'online') G.net.send({ t: 'aprog', filled: G.gone.size, mistakes: AR_HEARTS - G.hearts });
    if (G.gone.size === L.arrows.length) { G.over = true; setTimeout(arrowsCleared, 600); }
  } else {
    // Slide up to the arrow in the way, bump, slide back. Costs a heart.
    g.classList.add('moving', 'bump');
    slideArrow(g, id, Math.max(1.5, (blk.steps - 1) * ARW + 1.5), true, 480).then(() => g.classList.remove('moving', 'bump'));
    const bg = document.querySelector(`#arSvg [data-a="${blk.id}"]`); if (bg && !blk.self) { bg.classList.remove('hit'); void bg.getBoundingClientRect(); bg.classList.add('hit'); }
    G.hearts--; sfx('capture'); buzz([80, 40, 80]);
    renderArrows();
    if (G.mode === 'online') G.net.send({ t: 'aprog', filled: G.gone.size, mistakes: AR_HEARTS - G.hearts });
    if (G.hearts <= 0) { G.over = true; setTimeout(arrowsFailed, 600); }
  }
});
$('arHint').onclick = () => {
  if (!G || !G.L || G.over) return;
  if (!G.hints) { toast('No hints left on this level', '#3A2490'); return; }
  const f = G.L.arrows.find(a => !G.gone.has(a.id) && arrowFree(G.L, G.gone, a.id)); if (!f) return;
  G.hints--; G.hint = f.id; sfx('pop'); renderArrows();
};
$('arRestart').onclick = () => { if (!G || G.mode === 'online') return; sfx('click'); startArrows(G.level); };
$('arBack').onclick = () => leaveGame();
$('arSound').onclick = () => $('gameSound').onclick();
$('arChat').onclick = () => { sfx('click'); openChat(); };
function arOverlay(html) { $('arOverBox').innerHTML = html; $('arOver').classList.add('show'); }
function arrowsCleared() {
  if (G.mode === 'online') { G.net.send({ t: 'adone', order: G.order }); return; }
  const stars = G.hearts;
  soloLevelWin('arrows', `Level ${G.level} · ${'★'.repeat(stars)}`);
  if (G.level >= (settings.arLevel || 1)) { settings.arLevel = G.level + 1; store.set('settings', settings); }
  sfx('win'); buzz([60, 40, 120]);
  arOverlay(`<div class="stars">${[1, 2, 3].map(i => `<i class="${i <= stars ? 'on' : ''}">★</i>`).join('')}</div><b class="goldtxt big">Level ${G.level} cleared!</b><span>${stars === 3 ? 'Perfect, no bumps!' : `${AR_HEARTS - stars} bump${AR_HEARTS - stars > 1 ? 's' : ''}`}</span>
    <button class="btn gold w100" id="arNext">Next level</button><button class="btn ghost w100" id="arHome">Back</button>`);
  $('arNext').onclick = () => { sfx('click'); startArrows(G.level + 1); };
  $('arHome').onclick = () => { G = null; show('gamehome'); };
}
function arrowsFailed() {
  if (G.mode === 'online') { G.out = true; renderArRace(); toast('Out of hearts. Watch the others finish', '#3A2490'); return; }
  arOverlay(`<b class="big" style="color:#ff8ab4">Out of hearts</b><span>Arrows bumped 3 times. Look at where each one points before you tap.</span>
    <button class="btn gold w100" id="arNext">Try again</button><button class="btn ghost w100" id="arHome">Back</button>`);
  $('arNext').onclick = () => { sfx('click'); startArrows(G.level); };
  $('arHome').onclick = () => { G = null; show('gamehome'); };
}
// Online race
function renderArRace() {
  if (!G || !G.s || G.s.game !== 'arrows' || current !== 'arrows') return;
  const s = G.s;
  $('arRacers').innerHTML = s.players.map(p => {
    const lp = G.lobby.find(x => x.pid === p.id), speaking = G.speaking && G.speaking.has(p.id), f = Math.round(p.filled / s.total * 100);
    return `<div class="racer ${p.out || p.left ? 'out' : ''}" data-pid="${p.id}">${avatar(p.look, p.tint != null ? p.tint : 0, speaking ? 'speak' : '', p.id)}
      <div class="col grow minw0"><span class="nm">${esc(p.id === pid ? 'You' : p.name)}${lp && lp.mic ? ' 🎙️' : ''}</span><span class="racebar"><i style="width:${f}%"></i></span><span class="st">${p.left ? 'Left' : p.out ? 'Out of hearts' : `${f}% · ${'❤️'.repeat(Math.max(0, AR_HEARTS - p.mistakes))}`}</span></div></div>`;
  }).join('');
}
function onArState(m) {
  G.s = m.s; G.game = 'arrows';
  if (m.s.over && m.t === 'sync') { onArEnd(m); return; }
  if (!G.L || G.L.seed !== m.s.seed || G.L.level !== m.s.level) {
    G.L = arrowLevel(m.s.level, m.s.seed); G.gone = new Set(); G.order = []; G.hearts = AR_HEARTS; G.hints = 3; G.level = m.s.level; G.over = false; G.out = false; G.hint = null;
    enterArrows();
  } else if (current !== 'arrows') enterArrows(); else renderArrows();
  if (m.t === 'start') { sfx('turn'); toast('Go! Same picture for everyone', '#3A2490'); }
}
function onArEnd(m) {
  G.s = m.s; G.over = true;
  const s = m.s, W = s.players.find(p => p.id === s.winner) || s.players[0], iWon = W.id === pid, me = s.players.find(p => p.id === pid);
  if (me) addHistory({ game: 'arrows', mode: 'online', result: iWon ? 'won' : 'lost', of: s.players.length, rank: iWon ? 1 : 2, score: `Race · ${Math.round(me.filled / s.total * 100)}% cleared`,
    opp: s.players.filter(p => p.id !== pid).map(p => ({ id: p.id, name: p.name, look: p.look, tint: p.tint || 0 })) });
  $('winTitle').textContent = iWon ? 'You won the race!' : `${W.name} won!`;
  $('winSub').textContent = s.reason === 'solved' ? `${iWon ? 'You' : W.name} cleared every arrow first` : s.reason === 'others-out' ? 'Everyone else ran out of hearts or left' : 'Most arrows cleared';
  danceStage({ look: W.look, tint: W.tint || 0, name: W.name }, s.players.filter(p => p.id !== W.id).map(p => ({ look: p.look, tint: p.tint || 0 })));
  $('winRest').innerHTML = `<div class="rankchips">${s.players.filter(p => p.id !== W.id).map((p, k) => `<span class="rankchip"><b>${k + 2}</b>${esc(p.name)} · ${Math.round(p.filled / s.total * 100)}%</span>`).join('')}</div>`;
  const cc = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0', '#FF4FD8', '#FFFFFF', '#FFC21A'];
  $('winConf').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:${cc[i % 7]};animation-duration:${2.5 + (i % 5) * 0.6}s;animation-delay:${(i % 10) * 0.25}s"></i>`).join('');
  $('winAgain').style.display = G.host ? 'flex' : 'none';
  buzz([60, 40, 60, 40, 120]);
  setTimeout(() => { show('win'); startDance(); }, 600);
}

// ---------- Draw & Guess (online) ----------
const D_COLORS = ['#1d1d1d', '#ffffff', '#e0103a', '#ff8a00', '#e6a800', '#059669', '#1460d6', '#8f3bd6', '#6b3a00', '#ff7aa8'];
const D_SIZES = [5, 12, 24];
const D_BG = '#fffdf6';
function drawMe() { return G.s.players.findIndex(p => p.id === pid); }
const iDraw = () => G && G.s && G.s.phase === 'draw' && G.s.drawer === drawMe();
function onDrawState(m) {
  const before = G.s;
  G.s = m.s; G.game = 'draw';
  if (m.s.left != null) G.dEnds = Date.now() + m.s.left;
  if (m.t === 'sync') { G.dops = m.ops || []; if (m.s.over) { onDrawEnd(m); return; } }
  // New turn: empty canvas.
  if (m.t === 'dturn' && m.s.phase === 'choose') { G.dops = []; G.dmsgs = (G.dmsgs || []).slice(-4); }
  if (current !== 'draw') { G.dmsgs = G.dmsgs || []; G.dtool = G.dtool || { c: '#1d1d1d', w: 12, mode: 'pen' }; show('draw'); setBadges(); syncMicButtons(); music(false); sizeDraw(); }
  renderDraw();
  if (m.t === 'dturn') {
    const s = m.s, d = s.players[s.drawer];
    if (s.phase === 'choose' && s.drawer === drawMe()) { sfx('turn'); buzz([50]); }
    if (s.phase === 'draw' && before && before.phase === 'choose') { sfx('pop'); }
    if (s.phase === 'reveal') sfx(m.why === 'all' ? 'finish' : 'turn');
    void d;
  }
}
function sizeDraw() {
  const c = $('dCanvas'), box = $('dBox'), w = box.clientWidth || 360, dpr = Math.min(2, window.devicePixelRatio || 1);
  c.width = Math.round(w * dpr); c.height = Math.round(w * dpr); c.style.width = w + 'px'; c.style.height = w + 'px';
  G.dscale = c.width / 1000;
  redrawAll();
}
window.addEventListener('resize', () => { if (G && G.game === 'draw' && current === 'draw') sizeDraw(); });
function ctx2() { return $('dCanvas').getContext('2d'); }
function redrawAll() {
  if (!G || !G.dscale) return;
  const g = ctx2(), c = $('dCanvas');
  g.fillStyle = D_BG; g.fillRect(0, 0, c.width, c.height);
  (G.dops || []).forEach(op => drawOp(op, 0));
}
function drawOp(op, from) {
  const g = ctx2(), k = G.dscale;
  if (op.t === 's') {
    const pts = op.pts; if (!pts.length) return;
    g.strokeStyle = op.c; g.fillStyle = op.c; g.lineWidth = op.w * k; g.lineCap = 'round'; g.lineJoin = 'round';
    if (from === 0) { g.beginPath(); g.arc(pts[0][0] * k, pts[0][1] * k, op.w * k / 2, 0, 7); g.fill(); }
    if (pts.length === 1) return;
    g.beginPath(); const s0 = Math.max(0, from - 1); g.moveTo(pts[s0][0] * k, pts[s0][1] * k);
    for (let i = s0 + 1; i < pts.length; i++) g.lineTo(pts[i][0] * k, pts[i][1] * k);
    g.stroke();
  } else if (op.t === 'fill') floodFill(op.x * k, op.y * k, op.c);
}
function floodFill(x, y, color) {
  const c = $('dCanvas'), g = ctx2(), W = c.width, H = c.height;
  x = Math.floor(x); y = Math.floor(y); if (x < 0 || y < 0 || x >= W || y >= H) return;
  const img = g.getImageData(0, 0, W, H), d = img.data;
  const tr = parseInt(color.slice(1, 3), 16), tg = parseInt(color.slice(3, 5), 16), tb = parseInt(color.slice(5, 7), 16);
  const i0 = (y * W + x) * 4, sr = d[i0], sg = d[i0 + 1], sb = d[i0 + 2];
  if (Math.abs(sr - tr) + Math.abs(sg - tg) + Math.abs(sb - tb) < 10) return;
  const near = i => Math.abs(d[i] - sr) + Math.abs(d[i + 1] - sg) + Math.abs(d[i + 2] - sb) < 90;
  const stack = [x, y], seen = new Uint8Array(W * H);
  while (stack.length) {
    const py = stack.pop(), px = stack.pop(); let xl = px;
    while (xl >= 0 && !seen[py * W + xl] && near((py * W + xl) * 4)) xl--;
    xl++;
    let up = false, dn = false;
    for (let xx = xl; xx < W && !seen[py * W + xx] && near((py * W + xx) * 4); xx++) {
      const p = py * W + xx, q = p * 4; seen[p] = 1; d[q] = tr; d[q + 1] = tg; d[q + 2] = tb; d[q + 3] = 255;
      if (py > 0) { const u = p - W; if (!seen[u] && near(u * 4)) { if (!up) { stack.push(xx, py - 1); up = true; } } else up = false; }
      if (py < H - 1) { const v = p + W; if (!seen[v] && near(v * 4)) { if (!dn) { stack.push(xx, py + 1); dn = true; } } else dn = false; }
    }
  }
  g.putImageData(img, 0, 0);
}
function onDrawOp(op) {
  if (!G || !G.s || G.s.game !== 'draw') return;
  G.dops = G.dops || [];
  if (op.t === 's') { const old = G.dops.find(o => o.t === 's' && o.id === op.id); if (old) { const from = old.pts.length; old.pts.push(...op.pts); drawOp(old, from); } else { const o = { t: 's', id: op.id, c: op.c, w: op.w, pts: op.pts.slice() }; G.dops.push(o); drawOp(o, 0); } }
  else if (op.t === 'fill') { G.dops.push(op); drawOp(op, 0); }
  else if (op.t === 'clear') { G.dops = []; redrawAll(); }
  else if (op.t === 'undo') { G.dops.pop(); redrawAll(); }
}
function renderDraw() {
  if (!G || !G.s || G.s.game !== 'draw' || current !== 'draw') return;
  const s = G.s, me = drawMe(), drawer = s.players[s.drawer], mine = s.drawer === me;
  $('dTitle').textContent = `Round ${Math.min(s.round, s.rounds)} of ${s.rounds}`;
  // Word / blanks
  if (s.phase === 'draw' && (mine || s.word)) $('dWord').innerHTML = `<span class="lbl">${mine ? 'You are drawing' : 'You guessed it!'}</span><span class="w goldtxt">${esc(s.word.toUpperCase())}</span>`;
  else if (s.phase === 'draw') $('dWord').innerHTML = `<span class="lbl">Guess the word · ${s.hint.filter(c => c !== ' ').length} letters</span><span class="blanks">${s.hint.map(c => c === ' ' ? '<i class="sp"></i>' : `<span>${c === '_' ? '' : esc(c)}</span>`).join('')}</span>`;
  else if (s.phase === 'choose') $('dWord').innerHTML = `<span class="lbl">${mine ? 'Pick a word to draw' : `${esc(drawer.name)} is picking a word...`}</span>`;
  else $('dWord').innerHTML = `<span class="lbl">The word was</span><span class="w goldtxt">${esc((s.word || '').toUpperCase())}</span>`;
  $('dWait').textContent = s.phase === 'choose' && !mine ? `${drawer.name} is picking a word...` : '';
  $('dWait').classList.toggle('show', s.phase === 'choose' && !mine);
  // Tools only for the person drawing
  $('dTools').classList.toggle('show', mine && s.phase === 'draw');
  $('dBox').classList.toggle('mine', mine && s.phase === 'draw');
  const t = G.dtool || { c: '#1d1d1d', w: 12, mode: 'pen' };
  $('dPal').innerHTML = D_COLORS.map(c => `<button class="sw ${t.c === c && t.mode !== 'erase' ? 'on' : ''}" data-dc="${c}" style="background:${c}" aria-label="Colour"></button>`).join('');
  $('dBrush').innerHTML = D_SIZES.map(w => `<button class="bsz ${t.w === w && t.mode === 'pen' ? 'on' : ''}" data-dw="${w}" aria-label="Brush size"><i style="width:${w * 0.7 + 3}px;height:${w * 0.7 + 3}px;background:${t.c}"></i></button>`).join('') +
    `<button class="bsz ${t.mode === 'erase' ? 'on' : ''}" data-dt="erase" aria-label="Eraser">🧽</button><button class="bsz ${t.mode === 'fill' ? 'on' : ''}" data-dt="fill" aria-label="Fill">🪣</button><button class="bsz" data-dt="undo" aria-label="Undo">↶</button><button class="bsz" data-dt="clear" aria-label="Clear">🗑️</button>`;
  // Players and scores
  $('dPlayers').innerHTML = s.players.map((p, i) => {
    const lp = G.lobby.find(x => x.pid === p.id), speaking = G.speaking && G.speaking.has(p.id);
    return `<div class="pchip ${p.left ? 'away' : ''}" data-pid="${p.id}">${i === s.drawer && !s.over ? '<span class="pen">✏️</span>' : ''}${p.guessed ? '<span class="tick">✓</span>' : ''}${avatar(p.look, p.tint != null ? p.tint : i % 4, speaking ? 'speak' : '', p.id)}<b>${esc(p.id === pid ? 'You' : p.name)}${lp && lp.mic ? ' 🎙️' : ''}</b><span>${p.score}${p.gain && s.phase === 'reveal' ? ` <em>+${p.gain}</em>` : ''}</span></div>`;
  }).join('');
  $('dInput').placeholder = mine && s.phase === 'draw' ? 'Chat (only people who guessed see it)' : s.players[me] && s.players[me].guessed && s.phase === 'draw' ? 'You got it! Chat with others who guessed' : 'Type your guess';
  renderDrawChat();
  // Pop-ups: pick a word / the reveal
  if (s.phase === 'choose' && mine && s.choices) {
    $('dPopBox').innerHTML = `<b class="goldtxt big">Your turn to draw</b><span>Pick a word. Don’t say it out loud!</span><div class="col gap10 w100">${s.choices.map((w, k) => `<button class="btn gold" data-pick="${k}">${esc(w)}</button>`).join('')}</div>`;
    $('dPop').classList.add('show');
  } else if (s.phase === 'reveal') {
    const got = s.players.filter((p, i) => i !== s.drawer && p.guessed).length;
    $('dPopBox').innerHTML = `<span>The word was</span><b class="goldtxt big">${esc((s.word || '').toUpperCase())}</b><span>${got ? `${got} player${got > 1 ? 's' : ''} guessed it` : 'Nobody guessed it'}</span>
      <div class="gains">${s.players.filter(p => p.gain).map(p => `<span>${esc(p.id === pid ? 'You' : p.name)} <b>+${p.gain}</b></span>`).join('')}</div>`;
    $('dPop').classList.add('show');
  } else $('dPop').classList.remove('show');
}
function renderDrawChat() {
  const L = (G.dmsgs || []).slice(-30);
  $('dChat').innerHTML = L.map(m => {
    if (m.kind === 'right') return `<div class="gm ok">✓ <b>${esc(m.from === pid ? 'You' : m.name)}</b> guessed the word! +${m.gain}</div>`;
    if (m.kind === 'close') return `<div class="gm close"><b>You</b>${esc(m.text)} <em>· so close!</em></div>`;
    if (m.kind === 'inner') return `<div class="gm inner"><b>${esc(m.from === pid ? 'You' : m.name)}</b>${esc(m.text)}</div>`;
    return `<div class="gm"><b>${esc(m.from === pid ? 'You' : m.name)}</b>${esc(m.text)}</div>`;
  }).join('');
  $('dChat').scrollTop = 1e6;
}
function onDrawMsg(m) {
  G.dmsgs = G.dmsgs || []; G.dmsgs.push(m); if (G.dmsgs.length > 40) G.dmsgs.shift();
  if (m.kind === 'right') { if (m.from === pid) { sfx('win'); buzz([60, 40, 120]); } else sfx('finish'); }
  else if (m.kind === 'close') { sfx('pop'); buzz([30]); }
  renderDrawChat();
  if (m.kind === 'guess' || m.kind === 'chat') sayBubble({ from: m.from, text: m.text });
}
function drawTick() {
  if (!G || !G.s || G.s.game !== 'draw') return;
  const s = G.s, total = s.phase === 'choose' ? CHOOSE_MS : s.phase === 'draw' ? DRAW_MS : REVEAL_MS;
  const left = G.dEnds && !s.over ? Math.max(0, G.dEnds - Date.now()) : 0;
  $('dSec').textContent = Math.ceil(left / 1000);
  $('dRing').setAttribute('stroke-dashoffset', (144.5 * (1 - left / total)).toFixed(1));
  const sec = Math.ceil(left / 1000);
  if (s.phase === 'draw' && sec <= 5 && sec > 0 && sec !== G.lastDTick) { G.lastDTick = sec; sfx('tick'); }
}
// Drawing with a finger
{
  const c = $('dCanvas'); let cur = null, sent = 0, timer = null, sid = 1;
  const pt = e => { const r = c.getBoundingClientRect(); return [Math.round(Math.max(0, Math.min(1000, (e.clientX - r.left) / r.width * 1000))), Math.round(Math.max(0, Math.min(1000, (e.clientY - r.top) / r.height * 1000)))]; };
  const flush = () => { if (!cur || !G || !G.net) return; const pts = cur.pts.slice(sent); if (!pts.length) return; sent = cur.pts.length; G.net.send({ t: 'dop', op: { t: 's', id: cur.id, c: cur.c, w: cur.w, pts } }); };
  c.addEventListener('pointerdown', e => {
    if (!iDraw()) return; e.preventDefault();
    try { c.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
    const t = G.dtool || { c: '#1d1d1d', w: 12, mode: 'pen' }, p = pt(e);
    if (t.mode === 'fill') { const op = { t: 'fill', x: p[0], y: p[1], c: t.c }; onDrawOp(op); G.net.send({ t: 'dop', op }); sfx('pop'); return; }
    cur = { t: 's', id: (Date.now() % 1e8) * 10 + (sid++ % 10), c: t.mode === 'erase' ? D_BG : t.c, w: t.mode === 'erase' ? Math.max(t.w, 24) : t.w, pts: [p] };
    sent = 0; G.dops.push(cur); drawOp(cur, 0);
    clearInterval(timer); timer = setInterval(flush, 60);
  });
  c.addEventListener('pointermove', e => {
    if (!cur) return;
    const p = pt(e), l = cur.pts[cur.pts.length - 1]; if (Math.abs(p[0] - l[0]) + Math.abs(p[1] - l[1]) < 4) return;
    cur.pts.push(p); drawOp(cur, cur.pts.length - 1);
  });
  const end = () => { if (!cur) return; flush(); clearInterval(timer); cur = null; };
  c.addEventListener('pointerup', end); c.addEventListener('pointercancel', end);
}
$('dTools').addEventListener('click', e => {
  if (!iDraw()) return;
  const t = G.dtool = G.dtool || { c: '#1d1d1d', w: 12, mode: 'pen' };
  const c = e.target.closest('[data-dc]'), w = e.target.closest('[data-dw]'), k = e.target.closest('[data-dt]');
  if (c) { t.c = c.dataset.dc; if (t.mode === 'erase') t.mode = 'pen'; }
  else if (w) { t.w = +w.dataset.dw; t.mode = 'pen'; }
  else if (k) {
    const a = k.dataset.dt;
    if (a === 'undo') { if (G.dops.length) { onDrawOp({ t: 'undo' }); G.net.send({ t: 'dop', op: { t: 'undo' } }); } }
    else if (a === 'clear') { onDrawOp({ t: 'clear' }); G.net.send({ t: 'dop', op: { t: 'clear' } }); }
    else t.mode = t.mode === a ? 'pen' : a;
  } else return;
  sfx('click'); renderDraw();
});
$('dPop').addEventListener('click', e => { const b = e.target.closest('[data-pick]'); if (!b || !G || !G.net) return; sfx('click'); G.net.send({ t: 'dpick', i: +b.dataset.pick }); $('dPop').classList.remove('show'); });
$('dForm').addEventListener('submit', e => { e.preventDefault(); const v = $('dInput').value.trim(); if (!v || !G || !G.net) return; G.net.send({ t: 'dguess', text: v }); $('dInput').value = ''; });
$('dBack').onclick = () => leaveGame();
function onDrawEnd(m) {
  G.s = m.s; $('dPop').classList.remove('show');
  const s = m.s, order = s.players.slice().sort((a, b) => b.score - a.score), W = s.players.find(p => p.id === s.winner) || order[0];
  const iWon = W.id === pid, me = s.players.find(p => p.id === pid);
  if (me) addHistory({ game: 'draw', mode: 'online', result: iWon ? 'won' : 'lost', of: s.players.length, rank: order.indexOf(me) + 1, score: `${me.score} points`,
    opp: s.players.filter(p => p.id !== pid).map(p => ({ id: p.id, name: p.name, look: p.look, tint: p.tint || 0 })) });
  $('winTitle').textContent = iWon ? 'You won!' : `${W.name} won!`;
  $('winSub').textContent = s.reason === 'left' ? 'Everyone else left the game' : `${W.score} points after ${s.rounds} rounds`;
  danceStage({ look: W.look, tint: W.tint || 0, name: W.name }, order.filter(p => p.id !== W.id).map(p => ({ look: p.look, tint: p.tint || 0 })));
  $('winRest').innerHTML = `<div class="rankchips">${order.filter(p => p.id !== W.id).map((p, k) => `<span class="rankchip"><b>${k + 2}</b>${esc(p.name)} · ${p.score}</span>`).join('')}</div>`;
  const cc = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0', '#FF4FD8', '#FFFFFF', '#FFC21A'];
  $('winConf').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:${cc[i % 7]};animation-duration:${2.5 + (i % 5) * 0.6}s;animation-delay:${(i % 10) * 0.25}s"></i>`).join('');
  $('winAgain').style.display = G.host ? 'flex' : 'none';
  buzz([60, 40, 60, 40, 120]);
  setTimeout(() => { show('win'); startDance(); }, 900);
}

// ---------- Helix Drop ----------
function ensureHBoard() {
  if (hboard && hboard.dead) hboard = null;
  if (!hboard) hboard = new Helix3D(freshCanvas('hxCanvas'));
  else hboard.resize();
  hboard.paused = false;
  hboard.on = hxEvent;
  return hboard;
}
function startHelix(level, seed) {
  G = { mode: 'solo', game: 'helix' };
  hxLoad(level, seed);
}
function hxLoad(level, seed) {
  G.level = level; G.seed = seed || 0; G.score = G.score || 0; G.falls = G.falls || 0; G.best = G.best || 0; G.over = false;
  dropBoard(); dropCBoard(); dropRBoard();
  show('helix');
  $('hxRace').classList.toggle('show', G.mode === 'online');
  $('hxOver').classList.remove('show');
  setBadges(); syncMicButtons(); syncSpeaker();
  const b = ensureHBoard();
  G.tower = makeTower(level, G.seed);
  b.load(G.tower);
  G.levelScore = 0;
  $('hxHelp').classList.add('show');
  renderHelix(); music(false);
}
function renderHelix() {
  if (!G || G.game !== 'helix') return;
  const total = platformsFor(G.level), passed = hboard ? hboard.passed : 0;
  $('hxA').textContent = G.mode === 'online' ? '' : G.level; $('hxB').textContent = G.mode === 'online' ? '🏁' : G.level + 1;
  $('hxA').classList.toggle('hide', G.mode === 'online');
  $('hxProg').style.width = Math.min(100, passed / total * 100) + '%';
  $('hxScore').textContent = G.mode === 'online' ? `${Math.round(passed / total * 100)}%` : G.score;
  if (G.mode === 'online') renderHxRace();
}
function hxEvent(type, d) {
  if (!G || G.game !== 'helix') return;
  if (type === 'start') { $('hxHelp').classList.remove('show'); return; }
  if (type === 'pass' || type === 'smash') {
    const pts = d.combo || 1; G.score += pts; G.levelScore += pts;
    sfx(type === 'smash' ? 'capture' : 'hop');
    if (type === 'smash') { $('hxCombo').textContent = 'Smash! 💥'; buzz([40]); }
    else $('hxCombo').textContent = d.combo >= 2 ? `+${d.combo} combo! ${d.combo >= 3 ? '🔥' : ''}` : '';
    clearTimeout(hxEvent.t); hxEvent.t = setTimeout(() => { $('hxCombo').textContent = ''; }, 900);
    if (G.mode === 'online') G.net.send({ t: 'hprog', filled: Math.max(G.maxPassed || 0, d.passed), falls: G.falls });
    G.maxPassed = Math.max(G.maxPassed || 0, d.passed);
    renderHelix();
  } else if (type === 'bounce') sfx('step');
  else if (type === 'die') {
    sfx('capture'); buzz([120, 60, 120]); G.falls++;
    if (G.mode === 'online') { G.net.send({ t: 'hprog', filled: G.maxPassed || 0, falls: G.falls }); setTimeout(() => { if (G && G.game === 'helix' && hboard && !G.over) { hboard.reset(); hboard.start(); renderHelix(); toast('Again from the top!', '#3A2490'); } }, 1100); return; }
    G.score -= G.levelScore; G.levelScore = 0;
    setTimeout(() => hxOverlay(`<b class="big" style="color:#ff8ab4">Ball broke!</b><span>Red parts of the platforms break the ball. Fall through the gaps instead.</span>
      <button class="btn gold w100" id="hxNext">Try again</button><button class="btn ghost w100" id="hxHome">Back</button>`, () => { hboard.reset(); renderHelix(); $('hxHelp').classList.add('show'); }), 700);
  } else if (type === 'win') {
    sfx('win'); buzz([60, 40, 120]);
    if (G.mode === 'online') { G.net.send({ t: 'hdone' }); return; }
    G.over = true;
    const best = Math.max(store.get('hxBest', 0), G.score); store.set('hxBest', best);
    soloLevelWin('helix', `Level ${G.level} · ${G.score} pts`);
    if (G.level >= (settings.hxLevel || 1)) { settings.hxLevel = G.level + 1; store.set('settings', settings); }
    hxOverlay(`<b class="goldtxt big">Level ${G.level} done!</b><span>Score ${G.score} · Best ${best}</span>
      <button class="btn gold w100" id="hxNext">Next level</button><button class="btn ghost w100" id="hxHome">Back</button>`, () => hxLoad(G.level + 1));
  }
}
function hxOverlay(html, next) {
  $('hxOverBox').innerHTML = html; $('hxOver').classList.add('show');
  $('hxNext').onclick = () => { sfx('click'); $('hxOver').classList.remove('show'); next(); };
  $('hxHome').onclick = () => { G = null; show('gamehome'); };
}
$('hxBack').onclick = () => leaveGame();
$('hxSound').onclick = () => $('gameSound').onclick();
$('hxChat').onclick = () => { sfx('click'); openChat(); };
$('hxHelp').addEventListener('pointerdown', () => { if (hboard) { hboard.start(); $('hxHelp').classList.remove('show'); } });
// Online race
function renderHxRace() {
  if (!G || !G.s || G.s.game !== 'helix' || current !== 'helix') return;
  const s = G.s;
  $('hxRacers').innerHTML = s.players.map(p => {
    const lp = G.lobby.find(x => x.pid === p.id), speaking = G.speaking && G.speaking.has(p.id), f = Math.round(p.filled / s.total * 100);
    return `<div class="racer ${p.left ? 'out' : ''}" data-pid="${p.id}">${avatar(p.look, p.tint != null ? p.tint : 0, speaking ? 'speak' : '', p.id)}
      <div class="col grow minw0"><span class="nm">${esc(p.id === pid ? 'You' : p.name)}${lp && lp.mic ? ' 🎙️' : ''}</span><span class="racebar"><i style="width:${f}%"></i></span><span class="st">${p.left ? 'Left' : `${f}% · ${p.falls || 0} falls`}</span></div></div>`;
  }).join('');
}
function onHxState(m) {
  G.s = m.s; G.game = 'helix';
  if (m.s.over && m.t === 'sync') { onHxEnd(m); return; }
  if (G.level !== m.s.level || G.seed !== m.s.seed || current !== 'helix') { G.score = 0; G.falls = 0; G.maxPassed = 0; hxLoad(m.s.level, m.s.seed); }
  else renderHelix();
  if (m.t === 'start') { sfx('turn'); toast('Go! Same tower for everyone', '#3A2490'); }
}
function onHxEnd(m) {
  G.s = m.s; G.over = true;
  const s = m.s, W = s.players.find(p => p.id === s.winner) || s.players[0], iWon = W.id === pid, me = s.players.find(p => p.id === pid);
  if (me) addHistory({ game: 'helix', mode: 'online', result: iWon ? 'won' : 'lost', of: s.players.length, rank: iWon ? 1 : 2, score: `Race · ${Math.round(me.filled / s.total * 100)}% down`,
    opp: s.players.filter(p => p.id !== pid).map(p => ({ id: p.id, name: p.name, look: p.look, tint: p.tint || 0 })) });
  $('winTitle').textContent = iWon ? 'You won the race!' : `${W.name} won!`;
  $('winSub').textContent = s.reason === 'solved' ? `${iWon ? 'You' : W.name} reached the bottom first` : 'Everyone else left';
  danceStage({ look: W.look, tint: W.tint || 0, name: W.name }, s.players.filter(p => p.id !== W.id).map(p => ({ look: p.look, tint: p.tint || 0 })));
  $('winRest').innerHTML = `<div class="rankchips">${s.players.filter(p => p.id !== W.id).map((p, k) => `<span class="rankchip"><b>${k + 2}</b>${esc(p.name)} · ${Math.round(p.filled / s.total * 100)}%</span>`).join('')}</div>`;
  const cc = ['#E0103A', '#00C853', '#FFD600', '#1E5EF0', '#FF4FD8', '#FFFFFF', '#FFC21A'];
  $('winConf').innerHTML = Array.from({ length: 40 }, (_, i) => `<i style="left:${(i * 97) % 100}%;background:${cc[i % 7]};animation-duration:${2.5 + (i % 5) * 0.6}s;animation-delay:${(i % 10) * 0.25}s"></i>`).join('');
  $('winAgain').style.display = G.host ? 'flex' : 'none';
  buzz([60, 40, 60, 40, 120]);
  setTimeout(() => { show('win'); startDance(); }, 700);
}

// ---------- Win dance: everyone does bhangra to the dhol ----------
// Sheets: img/dance<character>-<team colour>.webp, 8 frames. The music has a beat every 0.6 s
// starting at 0.55 s; a knee goes up on each beat and lands half a beat later.
const DANCE_T0 = 0.55, DANCE_BEAT = 0.6;
let danceRAF = null, danceClock = 0;
function danceStage(main, others) {
  const back = others.slice(0, 3);
  // Only the winner dances. The others stand at the sides, sad, with a rain cloud over their heads.
  // (On a draw there is no winner, so both dance.)
  const spots = [[14, 112], [86, 112], [50, 250]];
  const sheet = d => `url(img/dance${ch(d.look)}-${d.tint}.webp)`;
  $('winAgain').textContent = 'Play again';
  $('trophy').style.display = 'none';
  $('podium').innerHTML = `<div class="stage${main ? '' : ' nomain'}">
    ${main ? back.map((d, i) => `<div class="loser" style="left:${spots[i][0]}%;bottom:${spots[i][1] - 40}px"><span class="rain">&#127783;&#65039;</span><img src="img/c${ch(d.look)}-${d.tint}.png" alt=""></div>`).join('')
    : back.map((d, i) => `<div class="dancer back" style="left:${[30, 70, 50][i]}%;bottom:40px;background-image:${sheet(d)}"></div>`).join('')}
    ${main ? `<div class="dancer main" style="background-image:${sheet(main)}"></div>` : ''}
    <div class="balle">Balle Balle!</div>
  </div>`;
}
function startDance() {
  stopDance();
  danceClock = performance.now();
  playTrack('sound/bhangra.m4a');
  const els = [...document.querySelectorAll('#podium .dancer')], balle = document.querySelector('#podium .balle');
  const tick = () => {
    const tt = trackTime();
    const t = tt != null ? tt : (performance.now() - danceClock) / 1000;
    const b = (t - DANCE_T0) / DANCE_BEAT;
    const k = b < 0 ? 3 : Math.floor(b * 2) % 8, f = ((b % 1) + 1) % 1;
    const up = b >= 0 && k % 2 === 0;
    const hop = up ? Math.sin(Math.PI * Math.min(1, f / 0.5)) : 0;
    els.forEach(el => {
      const big = el.classList.contains('main');
      el.style.backgroundPosition = `${(k / 7) * 100}% 0`;
      el.style.transform = `translateY(${-hop * (big ? 16 : 9)}px) rotate(${Math.sin(Math.PI * b) * 3}deg)`;
    });
    if (balle) balle.style.transform = `translateX(-50%) scale(${1 + 0.08 * Math.max(0, 1 - f * 4)})`;
    danceRAF = requestAnimationFrame(tick);
  };
  danceRAF = requestAnimationFrame(tick);
}
function stopDance() { if (danceRAF) cancelAnimationFrame(danceRAF); danceRAF = null; stopTrack(); }

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

// "Your turn" on the phone when Pitara is in the background during an online game.
function myOnlineTurn() {
  const s = G && G.s; if (!s || s.over || G.viewer) return false;
  try {
    if (s.game === 'chess') return chessPlayer(s, s.turn).id === pid;
    if (s.game === 'carrom' || s.game === 'patta') return s.players[s.turn].id === pid;
    if (['sudoku', 'arrows', 'draw', 'helix'].includes(s.game)) return s.game === 'draw' && s.players[s.drawer] && s.players[s.drawer].id === pid && s.phase === 'choose';
    return playerOf(s, s.turn).id === pid;
  } catch (e) { return false; }
}
function turnAlert() {
  if (!document.hidden || !G || G.mode !== 'online' || !window.LDNative || !window.LDNative.notify) return;
  const k = G.s ? G.s.game + ':' + G.s.seq : '';
  if (myOnlineTurn() && G.alerted !== k) { G.alerted = k; window.LDNative.notify('Your turn! 🎲', `${GAME_NAME[G.s.game || 'ludo'] || 'Pitara'} · Room ${G.code}`, 'turn'); }
}
function openRoom(code) {
  if (window.LDNative && window.LDNative.askNotify && !store.get('askedNotify', false)) { store.set('askedNotify', true); window.LDNative.askNotify(); }
  if (G && G.net) endOnline();
  G = { mode: 'online', game: GAME, code, lobby: [], host: false, s: null, busy: false, speaking: new Set(), q: Promise.resolve(), chat: [], unread: 0 };
  store.set('room', { code, game: GAME, at: Date.now() });
  setBadges();
  G.net = new Net({
    message: m => {
      const g = G; if (!g || !g.net) return;
      if (m.t === 'pong') return;
      // Voice messages never wait in (or block) the game's queue.
      if (m.t === 'rtc') { if (g.voice) g.voice.signal(m.from, m.data).catch(() => {}); return; }
      // A full resync replaces whatever was still waiting, so a stuck animation can't block the game.
      if (m.t === 'sync') { board && board.clearHighlight(); stopDiceSpin(); g.q = Promise.resolve(); }
      g.q = g.q.then(() => onNet(m)).then(turnAlert).catch(err => console.error(err));
    },
    status: st => { if (st !== 'online' && G) G.wasOffline = true; setNetState(st); if (st === 'online') setTimeout(sendMyPhoto, 50); }
  });
  G.voice = new Voice((to, data) => G && G.net && G.net.send({ t: 'rtc', to, data }), (who, on) => { if (!G) return; if (on) G.speaking.add(who); else G.speaking.delete(who); if (current === 'lobby') renderLobby(); else renderCards(); });
  G.voice.setListen(settings.listen);
  G.voice.setVoiceVolume(vol.voice / 100); G.voice.setMicVolume(vol.mic / 50);
  G.voice.onState = () => { if (current === 'lobby') renderLobby(); else if (PLAY_SCREENS.includes(current)) renderCards(); };
  G.net.join(code, { pid, name: profile.name, look: profile.look, tint: profile.color, game: GAME, mode: GAME === 'sudoku' ? settings.sdLevel : GAME === 'ludo' ? settings.ludoMode : settings.carromMode, pw: '', watch: false, fr: eco.use.fr, fc: hub.me ? hub.me.code : null });
  roomPhotos.clear();
  $('lobbyCode').textContent = code;
  renderLobby(); show('lobby');
  loadIce(Net.serverBase()).then(() => G && G.voice ? G.voice.start(pid, settings.automic) : false).then(ok => {
    if (!G) return;
    if (!ok) toast('Mic not allowed. You can still listen.', '#3A2490');
    G.net.send({ t: 'mic', on: ok && settings.automic });
    syncMicButtons();
  });
}
// The "Waiting for network" banner shows only if reconnecting takes more than 2.5 seconds,
// so a quick switch between Wi-Fi and mobile data does not flash it.
function setNetState(st) {
  clearTimeout(setNetState.t);
  if (st === 'online') $('netBanner').classList.remove('show');
  else setNetState.t = setTimeout(() => { if (G && G.net) $('netBanner').classList.add('show'); }, 2500);
  const el = $('netState');
  el.textContent = st === 'online' ? 'Online' : 'Reconnecting...';
  el.className = 'pill ' + (st === 'online' ? 'ok' : 'bad');
}
function endOnline() {
  if (!G) return;
  closeChat();
  clearTimeout(setNetState.t);
  store.set('room', null);
  if (G.net) G.net.close();
  if (G.voice) G.voice.stop();
  roomPhotos.clear();
  $('netBanner').classList.remove('show');
  G.net = null;
}

function syncMicButtons() {
  if (!G || !G.voice) return;
  const on = G.voice.hasMic() && !G.voice.muted;
  ['lobbyMic', 'gameMic', 'cMic', 'rMic', 'pMic', 'sdMic', 'arMic', 'dMic', 'hxMic'].forEach(id => { $(id).innerHTML = on ? MIC : MIC_OFF; $(id).classList.toggle('on', on); });
}
['lobbyMic', 'gameMic', 'cMic', 'rMic', 'pMic', 'sdMic', 'arMic', 'dMic', 'hxMic'].forEach(id => $(id).onclick = async () => {
  if (!G || !G.voice) return;
  if (!G.voice.hasMic()) { const ok = await G.voice.start(pid, true); if (!ok) { toast('Allow the mic in phone settings', '#3A2490'); return; } }
  else G.voice.setMuted(!G.voice.muted);
  sfx('click');
  G.net.send({ t: 'mic', on: !G.voice.muted });
  syncMicButtons();
});

function renderLobby() {
  if (!G) return;
  const L = G.lobby, max = G.game === 'chess' || G.game === 'carrom' ? 2 : G.game === 'draw' ? 6 : 4;
  $('lobbyTitle').textContent = (G.game === 'carrom' ? CTYPE_NAME[G.ctype || 'classic'] : G.game === 'sudoku' ? 'Sudoku race · ' + (SD_NAME[G.ctype] || 'Medium') : G.game === 'arrows' ? 'Arrow race' : G.game === 'helix' ? 'Helix race' : G.game === 'draw' ? 'Draw & Guess' : G.game === 'ludo' && G.ctype && G.ctype !== 'classic' ? LMODE_NAME[G.ctype] || 'Ludo' : GAME_NAME[G.game || 'ludo']) + (['sudoku', 'arrows', 'helix'].includes(G.game) ? '' : ' room');
  $('lobbyCount').textContent = `Players (${L.length}/${max})`;
  const cols = seatColors(Math.max(2, L.length));
  const rows = L.map((p, i) => {
    const c = (L.length >= 2 && L.length <= 4 ? cols[i] : i) % 4;
    const sp = G.speaking.has(p.pid);
    let st = !p.connected ? 'Waiting for network...' : sp ? 'Speaking...' : p.host ? 'Host' : 'Ready';
    if (p.pid !== pid && p.connected) st += ' \u00b7 ' + voiceText(p.pid);
    return `<div class="pcard">${avatar(p.look, c, sp ? 'speak' : '', p.pid)}
      <div class="col grow"><span class="nm">${esc(p.name)}${p.pid === pid ? ' (You)' : ''}</span><span class="st">${st}</span></div>
      <span class="mic ${p.mic ? 'on' : ''}">${p.mic ? MIC : MIC_OFF}</span>${G.host && p.pid !== pid ? `<button class="kick" data-kick="${p.pid}" aria-label="Remove ${esc(p.name)}">✕</button>` : ''}</div>`;
  });
  $('voiceInfo').textContent = !G.voice.hasMic() ? 'Your mic is not allowed. Others can\u2019t hear you.' : (VoiceMod.RELAY ? 'Voice relay: on' : 'Voice relay: off (voice may fail on mobile data)');
  for (let i = L.length; i < max; i++) rows.push(`<div class="pcard"><div class="av" style="opacity:.4"><div class="in" style="background:#2E1A75"></div></div><div class="col grow"><span class="nm">Empty slot</span><span class="st">Waiting for a friend...</span></div></div>`);
  const V = G.viewers || [];
  if (V.length) rows.push(`<b class="vhead">👁 Watching (${V.length})</b>` + V.map(v => `<div class="pcard vcard">${photoAv(v)}<div class="col grow"><span class="nm">${esc(v.name)}${v.pid === pid ? ' (You)' : ''}</span><span class="st">${v.seat ? 'Wants to play next' : 'Watching'}</span></div>${v.pid !== pid ? `<button class="mic ${v.mic ? 'on' : ''}" data-vdeaf="${v.pid}">${v.mic && !(G.voice && G.voice.deafened.has(v.pid)) ? MIC : MIC_OFF}</button>` : ''}${G.host ? `<button class="kick" data-kick="${v.pid}" aria-label="Remove">✕</button>` : ''}</div>`).join(''));
  $('lobbyPlayers').innerHTML = rows.join('');
  $('lobbySet').style.display = G.host ? '' : 'none';
  $('lobbyPw').style.display = G.opts && G.opts.pw ? '' : 'none';
  const btn = $('lobbyStart');
  if (G.viewer) { btn.textContent = 'You are watching'; btn.disabled = true; }
  else if (G.host && G.game === 'ludo' && G.ctype === 'team') { const n = L.filter(p => p.connected).length; btn.textContent = n === 4 ? 'Start game' : `2 vs 2 needs 4 players (${n}/4)`; btn.disabled = n !== 4; }
  else if (G.host) { btn.textContent = 'Start game'; btn.disabled = L.filter(p => p.connected).length < 2; }
  else { btn.textContent = 'Waiting for host...'; btn.disabled = true; }
}
$('lobbyStart').onclick = () => { if (G && G.host) { sfx('click'); G.net.send({ t: 'start' }); } };
$('lobbyBack').onclick = () => confirmBox('Leave the room?', 'You will leave this room.', 'Leave', 'Stay', () => { endOnline(); G = null; show('gamehome'); });
$('lobbyShare').onclick = () => {
  if (!G) return;
  const text = `Let's play ${GAME_NAME[G.game || 'ludo']} on Pitara! Tap to join my room: ${roomLink(G.code)}\n\nOr open Pitara, tap "Join a room" and enter code: ${G.code}`;
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
      G.lobby = m.players; G.host = m.host === pid; G.viewers = m.viewers || []; G.opts = m.opts || {};
      if (G.viewer && G.voice && !G.opts.vtalk && G.voice.hasMic() && !G.voice.muted) { G.voice.setMuted(true); syncMicButtons(); }
      if (m.game && m.game !== G.game) { G.game = m.game; GAME = m.game; store.set('game', GAME); }
      G.ctype = m.mode || 'classic';
      const live = m.players.filter(p => p.connected && !p.left).map(p => p.pid).concat(G.viewers.map(v => v.pid));
      if (G.wasOffline) { G.wasOffline = false; G.voice.restart(live); }
      else m.players.forEach(p => { if (p.pid !== pid && p.connected && before[p.pid] === false) G.voice.restart([p.pid]); });
      if (G.host && !wasHost && G.hostKnown) toast('You are now the host', '#3A2490');
      G.hostKnown = true;
      if (current === 'win') $('winAgain').style.display = G.host ? 'flex' : 'none';
      G.voice.sync(live);
      if (current === 'lobby') renderLobby();
      if (PLAY_SCREENS.includes(current)) renderCards();
      updateVStrip();
      break;
    }
    case 'viewer':
      G.viewer = !!m.on; if (G.net.hello) G.net.hello.watch = G.viewer;
      if (!m.on) { toast('You got a seat! You play in this game.', '#1E9E5A'); sfx('turn'); if (current === 'lobby') renderLobby(); }
      updateVStrip(); break;
    case 'react': floatReact(m.e, m.from); break;
    case 'err':
      if (m.code === 'full' || m.code === 'pw') { askWatchOrPw(m); break; }
      modal(`<h3>Oops</h3><p>${esc(m.msg)}</p><button class="btn gold" id="mOk">OK</button>`);
      $('mOk').onclick = () => { closeModal(); if (m.fatal) { endOnline(); G = null; show('gamehome'); } };
      break;
    case 'start':
    case 'sync':
      if (m.s && m.s.game === 'chess') { onChessState(m); break; }
      if (m.s && m.s.game === 'carrom') { onCarromState(m); break; }
      if (m.s && m.s.game === 'patta') { onPattaState(m); break; }
      if (m.s && m.s.game === 'sudoku') { onRaceState(m); break; }
      if (m.s && m.s.game === 'arrows') { onArState(m); break; }
      if (m.s && m.s.game === 'draw') { onDrawState(m); break; }
      if (m.s && m.s.game === 'helix') { onHxState(m); break; }
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
    case 'rshot': await onCarromShot(m); break;
    case 'pev': await onPattaEv(m); break;
    case 'sprog': onRaceProg(m); break;
    case 'send': onRaceEnd(m); break;
    case 'aprog': G.s = m.s; renderArRace(); break;
    case 'aend': onArEnd(m); break;
    case 'dturn': case 'dhint': case 'dstate': onDrawState(m); break;
    case 'dop': onDrawOp(m.op); break;
    case 'dmsg': onDrawMsg(m); break;
    case 'dend': onDrawEnd(m); break;
    case 'hprog': G.s = m.s; renderHxRace(); break;
    case 'hend': onHxEnd(m); break;
    case 'rend': onCarromEnd(m); break;
    case 'passed':
      if (G.s && G.s.game === 'carrom') { onCarromPassed(m); break; }
      if (m.reason !== 'left-other') { board.clearHighlight(); board.diceIdle(); }
      G.s = m.s; G.turnEnds = m.turnEnds; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
      if (m.reason === 'timeout') note('Time up, turn skipped');
      if (m.reason === 'left') note('Player left the game');
      if (m.reason === 'time') note('Time up!');
      if (m.reason === 'bot') note(`${String(m.who || 'Player').replace(' 🤖', '')} left · the computer plays for them`);
      renderCards(); refreshDice();
      if (G.s.over) { setTimeout(finishGame, 600); break; }
      if (playerOf(G.s, G.s.turn).id === pid) sfx('turn');
      break;
    case 'srolled': {
      G.busy = true; G.rollSent = 0; refreshDice();
      spinDiceFace();
      await board.throwDice(m.ev.dice, sfx);
      stopDiceSpin(m.ev.dice);
      if (board.animateMove && board.kind === 'snakes') await board.animateMove(m.ev, m.s.pos, sfx);
      board.diceIdle();
      G.s = m.s; G.turnEnds = m.turnEnds; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
      snakeNotes(m.ev, playerOf(G.s, m.ev.color));
      G.busy = false; renderCards(); refreshDice();
      if (G.s.over) setTimeout(finishGame, 900);
      else if (playerOf(G.s, G.s.turn).id === pid) sfx('turn');
      break;
    }
    case 'cmoved': await onChessMoved(m); break;
    case 'cend': onChessEnd(m); break;
    case 'chat': onChat(m); break;
    case 'photo':
      if (m.img) roomPhotos.set(m.pid, m.img); else roomPhotos.delete(m.pid);
      if (current === 'lobby') renderLobby(); else if (PLAY_SCREENS.includes(current)) renderCards();
      break;
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
const QUICK = ['Jaldi karo!', 'Kya chaal hai! 🔥', 'Bach gaya 😅', 'Ab dekh!', 'Mast khela!', 'Arre yaar!', 'GG 👏', 'Ruk ja zara', 'Good luck!', 'Haha'];
// Stickers are sent as chat messages "::s:<key>" and shown big and animated.
const STICKERS = { lol: ['🤣', 'Hahaha'], fire: ['🔥', 'Aag laga di'], clap: ['👏', 'Waah!'], cry: ['😭', 'Ro dunga'], angry: ['😤', 'Gussa'], party: ['🥳', 'Jeet gaye!'], cool: ['😎', 'Cool hai'], pray: ['🙏', 'Bacha lo'], think: ['🤔', 'Sochne do'], bye: ['👋', 'Chalo bye'] };
const stickerOf = t => { const m = /^::s:(\w+)$/.exec(t || ''); return m && STICKERS[m[1]] ? STICKERS[m[1]] : null; };
$('chatQuick').innerHTML = `<div class="stkrow">${Object.entries(STICKERS).map(([k, v]) => `<button type="button" class="stkb" data-q="::s:${k}"><i>${v[0]}</i><small>${v[1]}</small></button>`).join('')}</div>`
  + QUICK.map(q => `<button type="button" data-q="${esc(q)}">${esc(q)}</button>`).join('');
function openChat() {
  if (!G || G.mode !== 'online') return;
  G.unread = 0; setBadges();
  renderChat(); $('chat').classList.add('show');
}
function closeChat() { $('chat').classList.remove('show'); $('chatInput').blur(); }
$('emojiBtn').onclick = () => { sfx('click'); openChat(); };
$('lobbyChat').onclick = () => { sfx('click'); openChat(); };
$('cChat').onclick = () => { sfx('click'); openChat(); };
$('chatClose').onclick = closeChat;
$('chat').addEventListener('click', e => { if (e.target.id === 'chat') closeChat(); });
$('chatQuick').addEventListener('click', e => { const b = e.target.closest('[data-q]'); if (b) sendChat(b.dataset.q); });
$('chatForm').addEventListener('submit', e => { e.preventDefault(); const v = $('chatInput').value.trim(); if (v) { sendChat(v); $('chatInput').value = ''; } });
function sendChat(text) { if (G && G.net) G.net.send({ t: 'chat', text: text.slice(0, 120) }); }
const isBig = t => /^\p{Extended_Pictographic}{1,3}$/u.test(t);
function renderChat() {
  if (!G) return;
  const list = G.chat || [];
  $('chatList').innerHTML = list.length ? list.map(m => {
    const st = stickerOf(m.text), who = m.from === pid ? '' : `<b style="color:${m.viewer ? '#9fe3ff' : UI_EDGE[colorOf(m.from)] || '#C9C1F0'}">${m.viewer ? '👁 ' : ''}${esc(m.name)}</b>`;
    if (st) return `<div class="msg stkmsg ${m.from === pid ? 'me' : ''}">${who}<span class="stkbig">${st[0]}</span><small>${esc(st[1])}</small></div>`;
    return `<div class="msg ${m.from === pid ? 'me' : ''} ${isBig(m.text) ? 'big' : ''}">${m.from === pid || isBig(m.text) ? '' : who}${esc(m.text)}</div>`;
  }).join('') : '<div class="chatempty">Say hi to your friends!</div>';
  $('chatList').scrollTop = 1e6;
}
function colorOf(id) {
  if (G && G.s) { const p = G.s.players.find(x => x.id === id); if (p) return p.color; }
  if (G && G.lobby) { const i = G.lobby.findIndex(x => x.pid === id); if (i >= 0) return seatColors(Math.max(2, G.lobby.length))[i]; }
  return 0;
}
function setBadges() {
  const n = (G && G.unread) || 0;
  ['chatBadge', 'lobbyBadge', 'cBadge', 'rBadge', 'pBadge', 'sdBadge', 'arBadge', 'hxBadge'].forEach(id => { $(id).textContent = n > 9 ? '9+' : n; $(id).classList.toggle('show', n > 0); });
}
function onChat(m) {
  G.chat = G.chat || []; G.chat.push(m); if (G.chat.length > 60) G.chat.shift();
  if ($('chat').classList.contains('show')) renderChat();
  else if (m.from !== pid) { G.unread = (G.unread || 0) + 1; setBadges(); sfx('pop'); }
  const st = stickerOf(m.text);
  if (st) popSticker(st, m.name, m.from === pid);
  else if (PLAY_SCREENS.includes(current)) sayBubble(m);
}
function sayBubble(m) {
  const card = document.querySelector(`#${current} [data-pid="${m.from}"]`);
  if (!card) return;
  const r = card.getBoundingClientRect(), g = { left: 0, top: 0, width: innerWidth, height: innerHeight };
  const el = document.createElement('div'); el.className = 'saybub' + (isBig(m.text) ? ' big' : ''); el.textContent = m.text;
  el.style.left = Math.max(8, Math.min(g.width - 180, r.left - g.left + 46)) + 'px';
  const below = r.top - g.top < g.height / 2;
  el.style.top = (below ? r.bottom - g.top + 6 : r.top - g.top - 40) + 'px';
  $('bubbles').appendChild(el); setTimeout(() => el.remove(), 3300);
}

// ---------- Settings: sound & vibration ----------
const VOL_ROWS = [
  ['master', '🔊', 'Master volume', 'All sounds in the app'],
  ['music', '🎵', 'Menu music', 'Music on the home screens'],
  ['sfx', '🎲', 'Game sounds', 'Dice, moves, coins, clicks'],
  ['win', '🥁', 'Win music', 'Bhangra dhol when someone wins'],
  ['voice', '🗣️', 'Friends’ voice', 'Voice chat in online rooms'],
  ['mic', '🎙️', 'My mic', 'How loud others hear you'],
  ['vib', '📳', 'Vibration strength', 'Captures, fouls and wins']
];
const SET_ROWS = [
  ['queenBuzz', '👑', 'Strong buzz for the Queen', 'Phone vibrates hard when the Queen goes in'],
  ['automic', '🎤', 'Auto mic on', 'Mic turns on when you join a room'],
  ['listen', '🎧', 'Voice chat', 'Hear other players during the game']
];
function pct(k) { return k === 'mic' ? Math.round(vol.mic * 2) : vol[k]; }
function renderVol() {
  $('setVol').innerHTML = `<div class="ptitle">Volume</div>` + VOL_ROWS.map(r => `<div class="vrow"><div class="vic">${r[1]}</div><div class="grow minw0"><div class="t">${r[2]}</div><div class="s">${r[3]}</div>
    <div class="gslider ${vol[r[0]] ? '' : 'zero'}" data-v="${r[0]}" role="slider" aria-label="${r[2]}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${vol[r[0]]}" tabindex="0"><i style="width:${vol[r[0]]}%"></i><b style="left:${vol[r[0]]}%"></b></div></div>
    <div class="vpct" data-p="${r[0]}">${pct(r[0])}%</div></div>`).join('');
}
function openSettings() {
  renderVol();
  $('setRows').innerHTML = `<div class="ptitle">Vibration and voice</div>` + SET_ROWS.map(r => `<label class="setrow"><div class="vic">${r[1]}</div><div class="col grow"><span class="t">${r[2]}</span><span class="s">${r[3]}</span></div><span class="switch"><input type="checkbox" data-k="${r[0]}" ${settings[r[0]] ? 'checked' : ''}><span></span></span></label>`).join('');
  $('ver').textContent = (window.LD_CONFIG && window.LD_CONFIG.version) || '1.0';
  show('settings');
}
// Turn the volume numbers into the sound engine, voice chat and on/off switches.
function applyVol() {
  prefs.vol = vol; applyVolumes();
  if (G && G.voice) { G.voice.setVoiceVolume(vol.voice / 100); G.voice.setMicVolume(vol.mic / 50); }
}
let volSave = null;
function setVol(k, v, el) {
  v = Math.round(Math.max(0, Math.min(100, v)));
  if (vol[k] === v) return;
  vol[k] = v;
  el.querySelector('i').style.width = v + '%'; el.querySelector('b').style.left = v + '%'; el.classList.toggle('zero', !v); el.setAttribute('aria-valuenow', v);
  const p = document.querySelector(`[data-p="${k}"]`); if (p) p.textContent = pct(k) + '%';
  if (k === 'music') { const on = v > 0; if (on !== settings.music) { settings.music = on; prefs.music = on; music(on); } }
  if (k === 'sfx' && (v > 0) !== settings.sound) { settings.sound = v > 0; prefs.sound = settings.sound; }
  if (k === 'vib') { settings.vibrate = v > 0; prefs.vibrate = settings.vibrate; }
  applyVol(); syncSpeaker();
  clearTimeout(volSave); volSave = setTimeout(() => { store.set('vol', vol); store.set('settings', settings); }, 250);
}
let volDrag = null;
$('setVol').addEventListener('pointerdown', e => {
  const el = e.target.closest('.gslider'); if (!el) return;
  e.preventDefault(); volDrag = el; try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ }
  unlock(); const r = el.getBoundingClientRect(); setVol(el.dataset.v, (e.clientX - r.left) / r.width * 100, el);
});
$('setVol').addEventListener('pointermove', e => { if (!volDrag) return; const r = volDrag.getBoundingClientRect(); setVol(volDrag.dataset.v, (e.clientX - r.left) / r.width * 100, volDrag); });
const volEnd = () => {
  if (!volDrag) return; const k = volDrag.dataset.v; volDrag = null;
  if (k === 'vib') buzz([120]);
  else if (k === 'sfx' || k === 'master') sfx('turn');
  else if (k === 'win') { playTrack('sound/bhangra.m4a'); clearTimeout(volEnd.t); volEnd.t = setTimeout(stopTrack, 2200); }
};
$('setVol').addEventListener('pointerup', volEnd); $('setVol').addEventListener('pointercancel', volEnd);
$('setVol').addEventListener('keydown', e => {
  const el = e.target.closest('.gslider'); if (!el) return;
  const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 5 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -5 : 0;
  if (d) { e.preventDefault(); setVol(el.dataset.v, vol[el.dataset.v] + d, el); }
});
$('setRows').addEventListener('change', e => {
  const k = e.target.dataset.k; if (!k) return;
  settings[k] = e.target.checked; store.set('settings', settings);
  if (k === 'listen' && G && G.voice) G.voice.setListen(settings.listen);
  if (k === 'queenBuzz' && settings.queenBuzz) buzz([400, 100, 400], true);
  sfx('click');
});
$('setBack').onclick = () => show('home');
$('setProfile').onclick = () => openProfile();
$('setRules').onclick = () => {
  modal(`<h3>How to play Ludo</h3><ul>
  <li>Roll a 6 to bring a player out of home.</li>
  <li>Land on another player to send them back home. They need a 6 to come out again.</li>
  <li>Star squares and start squares are safe. No one can be captured there.</li>
  <li>You get another turn for a 6, a capture, or a player reaching the centre.</li>
  <li>You need the exact number to reach the centre.</li>
  <li>Get all 4 of your players to the centre to win.</li></ul>
  <h3>How to play Snakes & Ladders</h3><ul>
  <li>Roll the dice and walk that many squares.</li>
  <li>Land at the bottom of a ladder: climb up. Land on a snake’s head: slide down to its tail.</li>
  <li>A 6 gives you another roll.</li>
  <li>You need the exact number to land on 100. First to 100 wins!</li></ul>
  <h3>How to play Carrom</h3><ul>
  <li>Slide the striker along your base line, then pull back on the board and let go to shoot.</li>
  <li>The arrow shows your shot. With Aim help on, a yellow arrow shows where the coin you hit will go.</li>
  <li>Pocket your own coins (white or black). Pocket one and you shoot again.</li>
  <li>The red Queen: after pocketing her, pocket one of your coins in your next shot to keep her (cover). If you don’t, she goes back to the centre.</li>
  <li>Striker in a pocket is a foul: one of your coins comes back.</li>
  <li>First to pocket all 9 coins (after the Queen is covered) wins. 20 seconds for each shot.</li></ul>
  <h3>How to play Chess</h3><ul>
  <li>White moves first, then you take turns.</li>
  <li>Tap a piece to pick it. With Move help on, green dots show where it can go and red rings show what it can capture.</li>
  <li>Checkmate the other King (Raja) to win: he is attacked and can't escape.</li>
  <li>Each player has 10 minutes for the whole game. If your time runs out, you lose.</li>
  <li>A pawn (Pyada) that reaches the far side becomes a Queen, Rook, Bishop or Knight.</li></ul>
  <button class="btn gold" id="mOk">Got it</button>`);
  $('mOk').onclick = closeModal;
};

// ---------- Android back button ----------
window.ldBack = () => {
  if ($('modal').classList.contains('show')) { closeModal(); return true; }
  if ($('chat').classList.contains('show')) { closeChat(); return true; }
  if ($('cHint').classList.contains('show')) { hideHint(); if (cboard) cboard.clearMarks(); if (G) G.sel = null; return true; }
  if (PLAY_SCREENS.includes(current)) { leaveGame(); return true; }
  if (current === 'lobby') { $('lobbyBack').onclick(); return true; }
  if (current === 'win') { $('winHome').onclick(); return true; }
  if (current === 'profile' && !profile) return false;
  if (current === 'setup' || current === 'join') { show('gamehome'); return true; }
  if (current !== 'home' && current !== 'splash') { show('home'); return true; }
  return false;
};
document.addEventListener('visibilitychange', () => music(!document.hidden && !PLAY_SCREENS.includes(current)));

window.__ld = () => G; window.__hboard = () => hboard; window.__board = () => board; window.__cboard = () => cboard; window.__rboard = () => rboard; window.__finish = () => finishGame();
splash();

// ---------- Viewers, reactions, stickers, host controls ----------
const REACTS = ['👏', '😂', '🔥', '😮', '😡', '❤️', '🎉', '😭'];
const photoAv = v => avatar(v.look, ch(v.look), '', v.pid);
// Room is full or has a password: offer to watch, or ask for the password.
function askWatchOrPw(m) {
  if (!G || !G.net) return;
  const h = G.net.hello;
  G.net.close();
  const cancel = () => { closeModal(); endOnline(); G = null; show('gamehome'); };
  if (m.code === 'pw') {
    modal(`<div class="sheethead">🔒</div><h3>Room password</h3><p>${esc(m.msg)}</p><input class="input" id="pwIn" maxlength="8" inputmode="numeric" placeholder="Password" autocomplete="off"><div class="row gap10 w100 mt12"><button class="btn ghost grow" id="mNo">Cancel</button><button class="btn gold grow" id="mOk">Join</button></div>`);
    $('pwIn').focus();
    $('mNo').onclick = cancel;
    $('mOk').onclick = () => { const v = $('pwIn').value.trim(); if (!v) return; closeModal(); h.pw = v; G.net.join(G.code, h); };
    return;
  }
  const n = G.lobby ? G.lobby.length : 0;
  modal(`<div class="sheethead eye">👁</div><h3>${esc(m.msg)}</h3><p>You can watch the game live, chat, send reactions and take a seat in the next game.</p>
    <div class="row gap10 w100 mt12"><button class="btn ghost grow" id="mNo">Not now</button><button class="btn gold grow" id="mOk">👁 Watch live</button></div>`);
  void n;
  $('mNo').onclick = cancel;
  $('mOk').onclick = () => { closeModal(); h.watch = true; G.viewer = true; G.net.join(G.code, h); toast('Joining as a viewer...', '#3A2490'); };
}

const vstrip = document.createElement('div'); vstrip.className = 'vstrip'; vstrip.id = 'vstrip'; document.body.appendChild(vstrip);
const vbar = document.createElement('div'); vbar.className = 'vbar'; vbar.id = 'vbar'; document.body.appendChild(vbar);
const rxLayer = document.createElement('div'); rxLayer.className = 'rxlayer'; document.body.appendChild(rxLayer);
function placeVStrip() {
  const scr = $(current), tops = scr ? [...scr.querySelectorAll('.gtop, .cards.top, .sdtop, .sdrace, .hxtop, .dwrap > .row, .dword, .popp.top')] : [];
  const y = tops.reduce((m, el) => { const r = el.getBoundingClientRect(); return r.height && r.top < innerHeight * .4 ? Math.max(m, r.bottom) : m; }, 56);
  vstrip.style.top = Math.round(y + 6) + 'px';
}
const WATCH_SCREENS = () => PLAY_SCREENS.concat(['win']);
function updateVStrip() {
  const on = G && G.mode === 'online' && G.net && WATCH_SCREENS().includes(current);
  const V = (G && G.viewers) || [];
  vstrip.classList.toggle('show', !!(on && V.length));
  document.querySelectorAll('.screen').forEach(x => x.classList.toggle('hasv', !!(on && V.length) && x.id === current));
  document.body.classList.toggle('viewing', !!(on && G.viewer));
  vbar.classList.toggle('show', !!(on && G.viewer && current !== 'win'));
  if (!on) return;
  // Sit just below the top bar / top player cards of whichever game is open.
  placeVStrip(); clearTimeout(updateVStrip.t); updateVStrip.t = setTimeout(placeVStrip, 450);
  if (V.length) {
    vstrip.innerHTML = `<div class="vfaces">${V.slice(0, 5).map(v => `<span class="vf ${G.speaking.has(v.pid) ? 'speak' : ''}">${photoAv(v)}</span>`).join('')}${V.length > 5 ? `<span class="vmore">+${V.length - 5}</span>` : ''}</div><b>👁 ${V.length} watching</b>${G.viewer ? '' : '<button class="vrx" id="vrxBtn" aria-label="Send a reaction">😊</button>'}`;
  }
  if (G.viewer) {
    const me = V.find(v => v.pid === pid), seat = me && me.seat;
    vbar.innerHTML = `<div class="vtop"><span class="vlabel"><i class="dot"></i>👁 You are watching</span><button class="iconbtn sm" id="vLeave" aria-label="Leave">✕</button></div>
      <div class="vrxrow">${REACTS.map(e => `<button data-rx="${e}">${e}</button>`).join('')}</div>
      <div class="row gap10"><button class="micbtn sm" id="vMic" aria-label="Mic" ${G.opts && G.opts.vtalk === false ? 'disabled' : ''}>${G.voice && G.voice.hasMic() && !G.voice.muted ? MIC : MIC_OFF}</button>
      <button class="micbtn chatbtn sm" id="vChat" aria-label="Chat"><svg viewBox="0 0 24 24"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg></button>
      <button class="btn ${seat ? 'ghost' : 'gold'} grow" id="vSeat">${seat ? '✓ You play next game' : '🪑 Play next game'}</button></div>`;
  }
}
vstrip.addEventListener('click', e => {
  if (e.target.closest('#vrxBtn')) { e.stopPropagation(); rxPicker(); return; }
  viewerSheet();
});
function rxPicker() {
  modal(`<h3>Send a reaction</h3><div class="vrxrow big">${REACTS.map(e => `<button data-rx="${e}">${e}</button>`).join('')}</div>`);
  $('modalBox').querySelectorAll('[data-rx]').forEach(b => b.onclick = () => { closeModal(); sendReact(b.dataset.rx); });
}
function viewerSheet() {
  const V = (G && G.viewers) || [];
  modal(`<h3>👁 ${V.length} watching</h3><div class="col gap10 vlist">${V.map(v => `<div class="pcard vcard">${photoAv(v)}<div class="col grow"><span class="nm">${esc(v.name)}${v.pid === pid ? ' (You)' : ''}</span><span class="st">${v.seat ? 'Wants to play next' : 'Watching'}</span></div>
    ${v.pid !== pid ? `<button class="mic ${v.mic ? 'on' : ''}" data-vdeaf="${v.pid}">${v.mic && !(G.voice && G.voice.deafened.has(v.pid)) ? MIC : MIC_OFF}</button>` : ''}${G.host ? `<button class="kick" data-kick="${v.pid}">✕</button>` : ''}</div>`).join('')}</div>
    <button class="btn gold w100 mt12" id="mOk">Close</button>`);
  $('mOk').onclick = closeModal;
}
function sendReact(e) { if (G && G.net) { G.net.send({ t: 'react', e }); sfx('pop'); } }
vbar.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || !G) return;
  if (b.dataset.rx) return sendReact(b.dataset.rx);
  if (b.id === 'vChat') { sfx('click'); openChat(); }
  if (b.id === 'vSeat') { const me = (G.viewers || []).find(v => v.pid === pid); G.net.send({ t: 'seat', on: !(me && me.seat) }); sfx('click'); }
  if (b.id === 'vLeave') confirmBox('Stop watching?', 'You will leave this room.', 'Leave', 'Stay', () => { G.net.send({ t: 'leave' }); endOnline(); G = null; updateVStrip(); show('gamehome'); });
  if (b.id === 'vMic') (async () => {
    if (!G.voice) return;
    if (!G.voice.hasMic()) { const ok = await G.voice.start(pid, true); if (!ok) { toast('Allow the mic in phone settings', '#3A2490'); return; } }
    else G.voice.setMuted(!G.voice.muted);
    G.net.send({ t: 'mic', on: !G.voice.muted }); syncMicButtons(); updateVStrip();
  })();
});
function floatReact(e, from) {
  const el = document.createElement('span'); el.className = 'rx'; el.textContent = e;
  el.style.left = (12 + Math.random() * 70) + '%';
  el.style.animationDuration = (2.2 + Math.random() * .8) + 's';
  rxLayer.appendChild(el); setTimeout(() => el.remove(), 3200);
  if (from !== pid) buzz(15);
}
function popSticker(st, name, mine) {
  const el = document.createElement('div'); el.className = 'stkpop';
  el.innerHTML = `<i>${st[0]}</i><b>${esc(mine ? 'You' : name)}</b><small>${esc(st[1])}</small>`;
  rxLayer.appendChild(el); setTimeout(() => el.remove(), 2400);
  if (!mine) sfx('pop');
}
document.addEventListener('click', e => {
  const k = e.target.closest('[data-kick]');
  if (k && G && G.host) {
    const id = k.dataset.kick, who = (G.lobby || []).concat(G.viewers || []).find(x => x.pid === id);
    confirmBox(`Remove ${who ? who.name : 'this person'}?`, 'They can’t come back to this room.', 'Remove', 'Cancel', () => { G.net.send({ t: 'kick', pid: id }); closeModal(); });
    return;
  }
  const d = e.target.closest('[data-vdeaf]');
  if (d && G && G.voice) { const off = G.voice.toggleDeafen(d.dataset.vdeaf); toast(off ? 'Muted for you' : 'Unmuted', '#3A2490'); if (current === 'lobby') renderLobby(); if ($('modal').classList.contains('show')) viewerSheet(); }
});
// Host room settings
$('lobbySet').onclick = () => {
  if (!G || !G.host) return;
  sfx('click');
  const o = Object.assign({ viewers: true, vtalk: true, bots: true }, G.opts || {});
  const pw = G.myPw || '';
  const tog = (k, t, sub) => `<label class="hrow"><span class="col grow"><b>${t}</b><small>${sub}</small></span><input type="checkbox" class="sw" data-o="${k}" ${o[k] ? 'checked' : ''}></label>`;
  modal(`<h3>⚙ Room settings</h3>
    <label class="hrow"><span class="col grow"><b>🔒 Password</b><small>Friends need it to join. Leave empty for none.</small></span><input class="input pwbox" id="hPw" maxlength="8" inputmode="numeric" value="${esc(pw)}" placeholder="None"></label>
    ${tog('viewers', '👁 Allow viewers', 'People can watch when the room is full')}
    ${tog('vtalk', '🎙 Viewers can talk', 'Players can still mute anyone')}
    ${tog('bots', '🤖 Computer plays for leavers', 'Ludo, Snakes & Ladders and UNO keep going')}
    <button class="btn gold w100 mt12" id="mOk">Save</button>`);
  $('mOk').onclick = () => {
    const opts = { pw: $('hPw').value.replace(/[^0-9A-Za-z]/g, '').slice(0, 8) };
    $('modalBox').querySelectorAll('[data-o]').forEach(c => { opts[c.dataset.o] = c.checked; });
    G.myPw = opts.pw; G.net.send({ t: 'hset', opts }); closeModal(); toast('Room settings saved', '#1E9E5A');
  };
};

// ---------- Coins, daily reward, shop, badges, win card ----------
// Coins are only for fun items in the shop. No real money anywhere.
const eco = Object.assign({ coins: 100, owned: ['fr0', 'dc0', 'st0', 'bd0'], use: { fr: 'fr0', dc: 'dc0', st: 'st0', bd: 'bd0' }, streak: 0, lastDay: '', spunDay: '', badges: {}, bought: 0 }, store.get('eco', {}));
if (settings.striker && !eco.owned.includes('st' + settings.striker)) eco.owned.push('st' + settings.striker); // designs picked before the shop existed stay free
const saveEco = () => store.set('eco', eco);
const SHOP = {
  fr: { name: 'Frames', items: [
    { id: 'fr0', name: 'Royal Gold', price: 0 }, { id: 'fr4', name: 'Emerald', price: 250 }, { id: 'fr1', name: 'Ruby Fire', price: 300 },
    { id: 'fr3', name: 'Holi Colours', price: 400 }, { id: 'fr2', name: 'Diwali Diya', price: 500 }, { id: 'fr5', name: 'Diamond', price: 900 }] },
  dc: { name: 'Dice', items: [
    { id: 'dc0', name: 'Classic', price: 0, st: ['#ffffff', '#1a1050', '#ff1744'] }, { id: 'dc3', name: 'Rose', price: 250, st: ['#ff8ab4', '#ffffff', '#ffffff'] },
    { id: 'dc1', name: 'Golden', price: 300, st: ['#ffd34d', '#6b1a00', '#c4001d'] }, { id: 'dc4', name: 'Emerald', price: 350, st: ['#12a26a', '#ffffff', '#ffe17a'] },
    { id: 'dc2', name: 'Midnight', price: 400, st: ['#22104f', '#ffd34d', '#ff5f93'] }] },
  st: { name: 'Strikers', items: [{ id: 'st0', name: 'Blue', price: 0 }, { id: 'st1', name: 'Gold', price: 300 }, { id: 'st2', name: 'Ruby', price: 400 }] },
  bd: { name: 'Boards', items: [
    { id: 'bd0', name: 'Shahi night', price: 0, art: '🌙✨', th: ['#120a33', '#24135e'] }, { id: 'bd3', name: 'Holi', price: 600, art: '🎨🌈', th: ['#3a0f4f', '#a0286e'] },
    { id: 'bd1', name: 'Diwali night', price: 700, art: '🪔✨', th: ['#2a0c00', '#7a3200'] }, { id: 'bd2', name: 'Cricket stadium', price: 700, art: '🏏🏟️', th: ['#062a1a', '#0e7a46'] }] }
};
const itemOf = id => SHOP[id.slice(0, 2)].items.find(x => x.id === id);
const frameCls = () => 'fr-' + eco.use.fr;
const coinFmt = n => Number(n).toLocaleString('en-IN');
function addCoins(n, why) {
  eco.coins = Math.max(0, eco.coins + n); saveEco(); renderCoins();
  if (n > 0 && why) toast(`+${n} 🪙 ${why}`, '#8a5600');
}
function renderCoins() { document.querySelectorAll('.coinpill b').forEach(b => { b.textContent = coinFmt(eco.coins); }); }
function applyLooks() {
  document.body.className = document.body.className.replace(/\b(fr|bd|dc)-\w+/g, '').trim();
  document.body.classList.add('fr-' + eco.use.fr, 'bd-' + eco.use.bd, 'dc-' + eco.use.dc);
  const d = itemOf(eco.use.dc); if (board && board.setDiceStyle) board.setDiceStyle(d.st);
  const th = itemOf(eco.use.bd).th; [board, cboard, rboard].forEach(b => { if (b && b.setTheme) b.setTheme(th); });
  settings.striker = +eco.use.st.slice(2); store.set('settings', settings);
  if (rboard) rboard.setStrikerStyle(settings.striker);
}

// Daily reward: a 7-day login streak and one free spin a day.
const dayKey = (t = Date.now()) => { const d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const STREAK = [20, 30, 50, 'gift', 80, 100, 'frame'];
const WHEEL = [50, 100, 'gift', 20, 200, 'frame', 30, 500];
const WHEEL_W = [18, 12, 8, 22, 6, 5, 25, 4];
const WHEEL_COL = ['#e5196f', '#5a2ab5', '#ffc21a', '#1565d8', '#e5196f', '#5a2ab5', '#0b9a6a', '#ff8a00'];
const dailyDue = () => eco.lastDay !== dayKey() || eco.spunDay !== dayKey();
function giftPrize(kind) {
  // gift: 150 coins. frame: a frame you don't have yet, or 250 coins if you have them all.
  if (kind === 'frame') {
    const left = SHOP.fr.items.filter(x => !eco.owned.includes(x.id) && x.price <= 500);
    if (left.length) { const f = left[Math.floor(Math.random() * left.length)]; eco.owned.push(f.id); saveEco(); toast(`🖼 New frame: ${f.name}!`, '#8a5600'); checkBadges(); return; }
    return addCoins(250, 'bonus');
  }
  addCoins(150, 'gift box');
}
function renderDaily() {
  const today = dayKey(), claimed = eco.lastDay === today;
  const next = claimed ? eco.streak : (eco.lastDay === dayKey(Date.now() - 864e5) ? eco.streak % 7 + 1 : 1);
  $('dStreak').innerHTML = STREAK.map((r, i) => {
    const n = i + 1, done = n < next || (claimed && n === next), now = !claimed && n === next;
    return `<div class="sday ${done ? 'done' : ''} ${now ? 'now' : ''}"><b>Day ${n}</b><span>${r === 'gift' ? '🎁' : r === 'frame' ? '🖼️' : r}</span>${done ? '<i>✓</i>' : ''}</div>`;
  }).join('');
  $('dClaim').style.display = claimed ? 'none' : '';
  $('dClaim').textContent = `Claim Day ${next} reward`;
  const spun = eco.spunDay === today;
  $('dSpin').disabled = spun; $('dSpin').textContent = spun ? 'Come back tomorrow for a new spin' : 'Spin for free';
  if (!$('wheel').innerHTML) {
    const R = 150, seg = 360 / 8;
    let h = '';
    WHEEL.forEach((w, i) => {
      const a0 = (i * seg - 90) * Math.PI / 180, a1 = ((i + 1) * seg - 90) * Math.PI / 180, am = ((i + .5) * seg - 90) * Math.PI / 180;
      h += `<path d="M160 160 L${160 + R * Math.cos(a0)} ${160 + R * Math.sin(a0)} A${R} ${R} 0 0 1 ${160 + R * Math.cos(a1)} ${160 + R * Math.sin(a1)}Z" fill="${WHEEL_COL[i]}" stroke="#ffe17a" stroke-width="2"/>`;
      h += `<text x="${160 + 98 * Math.cos(am)}" y="${160 + 98 * Math.sin(am) + 9}" text-anchor="middle" font-size="${typeof w === 'number' ? 26 : 30}" font-weight="800" fill="${WHEEL_COL[i] === '#ffc21a' ? '#3a1d00' : '#fff'}" font-family="Baloo 2">${w === 'gift' ? '🎁' : w === 'frame' ? '🖼️' : w}</text>`;
    });
    $('wheel').innerHTML = `<svg viewBox="0 0 320 320"><circle cx="160" cy="160" r="158" fill="#d99100"/><g id="wheelG">${h}</g></svg><button class="wcenter" id="wCenter">SPIN</button><i class="wptr"></i>`;
    $('wCenter').onclick = () => $('dSpin').click();
  }
}
$('dClaim').onclick = () => {
  const today = dayKey(); if (eco.lastDay === today) return;
  eco.streak = eco.lastDay === dayKey(Date.now() - 864e5) ? eco.streak % 7 + 1 : 1;
  eco.lastDay = today; eco.bestStreak = Math.max(eco.bestStreak || 0, eco.streak); saveEco();
  const r = STREAK[eco.streak - 1]; sfx('win'); buzz(40);
  if (typeof r === 'number') addCoins(r, `Day ${eco.streak} reward`); else giftPrize(r);
  checkBadges(); renderDaily(); setDailyDot();
};
let wheelAt = 0;
$('dSpin').onclick = () => {
  if (eco.spunDay === dayKey() || $('dSpin').dataset.busy) return;
  $('dSpin').dataset.busy = '1'; sfx('click');
  let r = Math.random() * WHEEL_W.reduce((a, b) => a + b, 0), k = 0;
  while (r > WHEEL_W[k]) { r -= WHEEL_W[k]; k++; }
  const seg = 45, target = 360 - (k * seg + seg / 2) + (Math.random() - .5) * 30;
  wheelAt = wheelAt - (wheelAt % 360) + 360 * 6 + target;
  const g = $('wheelG'); g.style.transition = 'transform 4.2s cubic-bezier(.12,.7,.15,1)'; g.style.transform = `rotate(${wheelAt}deg)`;
  const tick = setInterval(() => sfx('tick'), 160);
  setTimeout(() => {
    clearInterval(tick); delete $('dSpin').dataset.busy;
    eco.spunDay = dayKey(); saveEco();
    const w = WHEEL[k]; sfx('win'); buzz([40, 30, 80]);
    if (typeof w === 'number') addCoins(w, 'from the wheel'); else giftPrize(w);
    renderDaily(); setDailyDot();
  }, 4300);
};
function setDailyDot() { const b = $('ecoDaily'); if (b) b.classList.toggle('due', dailyDue()); }

// Shop
let shopTab = 'fr';
function shopPreview(it) {
  const k = it.id.slice(0, 2);
  if (k === 'fr') return `<div class="av big fr-${it.id}">${faceImg(profile.look, profile.color, pid)}</div>`;
  if (k === 'dc') return `<div class="dicebtn mini" ${it.id === 'dc0' ? '' : `style="--df:${it.st[0]};--dp:${it.st[1]}"`}>${[0, 2, 4, 6, 8].map(i => '').join('')}<i></i><i class="r"></i><i></i><i class="r"></i><i class="one"></i><i class="r"></i><i></i><i class="r"></i><i></i></div>`;
  if (k === 'st') return `<span class="stk big ${['blue', 'gold', 'ruby'][+it.id.slice(2)]}"></span>`;
  return `<div class="bdart bd-${it.id}">${it.art}</div>`;
}
function renderShop() {
  $('shopTabs').innerHTML = Object.entries(SHOP).map(([k, v]) => `<button class="chip ${k === shopTab ? 'on' : ''}" data-st="${k}">${v.name}</button>`).join('');
  $('shopGrid').className = 'shopgrid' + (shopTab === 'bd' ? ' two' : '');
  $('shopGrid').innerHTML = SHOP[shopTab].items.map(it => {
    const own = eco.owned.includes(it.id), on = eco.use[shopTab] === it.id;
    return `<button class="sitem ${on ? 'on' : ''}" data-it="${it.id}">${on ? '<span class="ontag">ON</span>' : ''}${shopPreview(it)}<b>${it.name}</b>${own ? `<span class="own">${on ? 'Using' : 'Owned · tap to use'}</span>` : `<span class="price"><i class="coin"></i>${coinFmt(it.price)}</span>`}</button>`;
  }).join('');
  renderCoins();
}
$('shopTabs').addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (b) { shopTab = b.dataset.st; sfx('click'); renderShop(); } });
$('shopGrid').addEventListener('click', e => {
  const b = e.target.closest('[data-it]'); if (!b) return;
  const it = itemOf(b.dataset.it), k = it.id.slice(0, 2);
  if (eco.owned.includes(it.id)) { eco.use[k] = it.id; saveEco(); applyLooks(); sfx('click'); renderShop(); return; }
  if (eco.coins < it.price) { modal(`<h3>Not enough coins</h3><p>You need ${coinFmt(it.price - eco.coins)} more coins. Win games and spin the daily wheel to get coins.</p><button class="btn gold" id="mOk">OK</button>`); $('mOk').onclick = closeModal; return; }
  modal(`<div class="buyprev">${shopPreview(it)}</div><h3>Buy ${esc(it.name)}?</h3><p>It costs ${coinFmt(it.price)} coins. You have ${coinFmt(eco.coins)}.</p><button class="btn gold" id="mYes">Buy for ${coinFmt(it.price)} 🪙</button><button class="btn ghost" id="mNo">Not now</button>`);
  $('mNo').onclick = closeModal;
  $('mYes').onclick = () => { closeModal(); eco.coins -= it.price; eco.owned.push(it.id); eco.use[k] = it.id; eco.bought = (eco.bought || 0) + 1; saveEco(); applyLooks(); sfx('win'); toast(`${it.name} is yours!`, '#1E9E5A'); checkBadges(); renderShop(); };
});

// Badges
const BADGES = [
  ['first', '🏆', 'First win', 'Win any game', (L, w) => w.length >= 1],
  ['fire', '🔥', 'On fire', '5 wins in a row', L => bestRun(L) >= 5],
  ['chess', '♞', 'Checkmate!', 'Win at Chess', (L, w) => w.some(h => h.game === 'chess')],
  ['uno', '👑', 'UNO King', 'Win 10 UNO', (L, w) => w.filter(h => h.game === 'patta').length >= 10],
  ['ludo', '🎲', 'Ludo legend', 'Win 25 Ludo', (L, w) => w.filter(h => h.game === 'ludo').length >= 25],
  ['carrom', '🎯', 'Carrom champ', 'Win 10 Carrom', (L, w) => w.filter(h => h.game === 'carrom').length >= 10],
  ['snakes', '🐍', 'Snake charmer', 'Win 5 Snakes & Ladders', (L, w) => w.filter(h => h.game === 'snakes').length >= 5],
  ['sudoku', '🧠', 'Sudoku sage', 'Solve 25 Sudoku', (L, w) => w.filter(h => h.game === 'sudoku').length >= 25],
  ['speedy', '⚡', 'Speedy', 'Solve a Sudoku under 5 min', (L, w) => w.some(h => h.game === 'sudoku' && secsOf(h) && secsOf(h) < 300)],
  ['arrows', '🏹', 'Arrow ace', 'Win 20 Arrow Escape', (L, w) => w.filter(h => h.game === 'arrows').length >= 20],
  ['helix', '🌀', 'Helix hero', 'Win 10 Helix', (L, w) => w.filter(h => h.game === 'helix').length >= 10],
  ['artist', '🎨', 'Artist', 'Win a Draw & Guess', (L, w) => w.some(h => h.game === 'draw')],
  ['social', '🤝', 'Social star', 'Play online with 10 people', L => new Set(L.filter(h => h.mode === 'online').flatMap(h => (h.opp || []).map(o => o.id || o.name))).size >= 10],
  ['allround', '🌈', 'All-rounder', 'Win 6 different games', (L, w) => new Set(w.map(h => h.game)).size >= 6],
  ['century', '💯', 'Century', 'Play 100 games', L => L.length >= 100],
  ['daily', '📅', 'Never miss', '7-day login streak', () => (eco.bestStreak || 0) >= 7],
  ['shop', '🛍️', 'Shopper', 'Buy something in the shop', () => (eco.bought || 0) >= 1],
  ['raja', '🤴', 'Maharaja', 'Reach level 15', (L, w) => levelOf(w.length).lv >= 15]
];
// Longest run of wins anywhere in the history (not only the latest one).
function bestRun(L) {
  let best = 0, run = 0;
  for (let i = L.length - 1; i >= 0; i--) { const r = L[i].result; if (r === 'won') { run++; best = Math.max(best, run); } else if (r === 'lost') run = 0; }
  return best;
}
function checkBadges() {
  const L = history, w = L.filter(h => h.result === 'won');
  const fresh = BADGES.filter(b => !eco.badges[b[0]] && b[4](L, w));
  fresh.forEach(b => { eco.badges[b[0]] = Date.now(); });
  saveEco();
  if (fresh.length) setTimeout(() => { toast(`🏅 New badge: ${fresh[0][2]}${fresh.length > 1 ? ` +${fresh.length - 1}` : ''}`, '#8a5600'); sfx('win'); }, 1200);
}
function renderBadges() {
  const n = BADGES.filter(b => eco.badges[b[0]]).length;
  $('bCount').textContent = `${n} / ${BADGES.length}`;
  $('bGrid').innerHTML = BADGES.map(b => `<div class="badge2 ${eco.badges[b[0]] ? 'got' : ''}"><div class="bcoin">${b[1]}</div><b>${b[2]}</b><span>${b[3]}</span></div>`).join('');
}

// Coins for every finished game.
function rewardGame(h) {
  const won = h.result === 'won', n = won ? (h.mode === 'online' ? 30 : 20) : 5;
  hubCall('result', { won }).catch(() => {});
  if (G && G.tour && h.mode === 'online' && hub.me) { const opp = (G.lobby || []).find(p => p.pid !== pid); const w = won ? hub.me.code : opp && opp.fc; if (w) hubCall('tour/result', { id: G.tour, winner: w }).then(r => { if (r && r.tour) { hub.tours = hub.tours.filter(x => x.id !== r.tour.id).concat(r.tour); if (r.tour.champ === hub.me.code) setTimeout(() => toast('🏆 You are the tournament champion!', '#8a5600'), 2500); } }).catch(() => {}); }
  // Playing online together once makes you friends.
  if (h.mode === 'online' && G && G.lobby) G.lobby.forEach(p => { if (p.fc && p.pid !== pid && hub.me && !hub.friends.some(f => f.code === p.fc)) hubCall('add', { code: p.fc }).then(() => hubPing()).catch(() => {}); });
  eco.lastEarn = { n, at: Date.now(), won, h };
  addCoins(n); checkBadges();
}

// Win card: a picture to share on WhatsApp.
function loadImg(src) { return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; }); }
async function winCard(h) {
  const W = 720, H = 1000, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const x = cv.getContext('2d');
  const rr = (X, Y, w, hh, r) => { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + hh, r); x.arcTo(X + w, Y + hh, X, Y + hh, r); x.arcTo(X, Y + hh, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); };
  let g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#ffe17a'); g.addColorStop(.5, '#d99100'); g.addColorStop(1, '#fff6c4');
  rr(0, 0, W, H, 56); x.fillStyle = g; x.fill();
  g = x.createRadialGradient(W / 2, 380, 40, W / 2, 380, 620); g.addColorStop(0, '#8a3ff0'); g.addColorStop(.55, '#4a16a8'); g.addColorStop(1, '#1c0a48');
  rr(14, 14, W - 28, H - 28, 44); x.fillStyle = g; x.fill();
  // rays
  x.save(); x.translate(W / 2, 420); x.globalAlpha = .08; x.fillStyle = '#fff';
  for (let i = 0; i < 18; i++) { x.rotate(Math.PI / 9); x.beginPath(); x.moveTo(0, 0); x.lineTo(-40, -700); x.lineTo(40, -700); x.fill(); }
  x.restore();
  x.textAlign = 'center';
  x.font = '800 120px "Baloo 2", sans-serif';
  g = x.createLinearGradient(0, 70, 0, 190); g.addColorStop(0, '#fff6c4'); g.addColorStop(1, '#ffb800');
  x.lineWidth = 14; x.strokeStyle = '#4a2200'; x.strokeText('I WON!', W / 2, 180); x.fillStyle = g; x.fillText('I WON!', W / 2, 180);
  x.font = '600 34px "Baloo 2", sans-serif'; x.fillStyle = '#e8dcff';
  const sub = [GAME_NAME[h.game] || h.game, h.score].filter(Boolean).join(' · ');
  x.fillText(sub.length > 40 ? sub.slice(0, 40) + '…' : sub, W / 2, 236);
  const ph = myPhoto ? await loadImg(myPhoto) : null;
  if (ph) {
    x.save(); x.beginPath(); x.arc(W / 2, 470, 170, 0, 7); x.lineWidth = 16; x.strokeStyle = '#ffd34d'; x.stroke(); x.clip(); x.drawImage(ph, W / 2 - 170, 300, 340, 340); x.restore();
  } else {
    const im = await loadImg(`img/c${ch(profile.look)}-${profile.color}.png`);
    if (im) { const hh = 430, ww = im.width * hh / im.height; x.drawImage(im, W / 2 - ww / 2, 262, ww, hh); }
  }
  // "Balle Balle!" ribbon
  x.font = '800 54px "Baloo 2", sans-serif'; const bw = x.measureText('Balle Balle!').width + 70;
  rr(W / 2 - bw / 2, 690, bw, 82, 41); x.fillStyle = '#fff1a8'; x.fill(); rr(W / 2 - bw / 2 + 6, 696, bw - 12, 70, 35); x.fillStyle = '#e5196f'; x.fill();
  x.fillStyle = '#fff'; x.fillText('Balle Balle!', W / 2, 750);
  x.font = '700 32px "Baloo 2", sans-serif'; x.fillStyle = '#fff4d6'; x.fillText(profile.name, W / 2, 815);
  rr(60, 850, W - 120, 110, 26); x.fillStyle = 'rgba(10,4,30,.55)'; x.fill();
  const icon = await loadImg('img/icon.png'); if (icon) { x.save(); rr(80, 865, 80, 80, 18); x.clip(); x.drawImage(icon, 80, 865, 80, 80); x.restore(); }
  x.textAlign = 'left'; x.font = '700 32px "Baloo 2", sans-serif'; x.fillStyle = '#fff'; x.fillText('Play with me on Pitara', 180, 900);
  x.font = '600 26px "Baloo 2", sans-serif'; x.fillStyle = '#ffe17a';
  x.fillText(G && G.mode === 'online' && G.code ? `Room code ${G.code}` : 'Ludo · Carrom · UNO · Chess & more', 180, 940);
  return cv.toDataURL('image/png');
}
async function shareWin() {
  const h = history.find(x => x.result === 'won'); if (!h) return;
  sfx('click');
  modal('<h3>Making your win card...</h3><div class="spinner"></div>');
  const url = await winCard(h);
  const link = 'https://ludo-dhamaal.pitaragames.workers.dev/download';
  const text = `I won at ${GAME_NAME[h.game] || 'Pitara'}! 🏆 Play with me on Pitara${G && G.mode === 'online' && G.code ? ` — room code ${G.code}` : ''}: ${link}`;
  modal(`<h3>Share your win</h3><img class="wincard" src="${url}" alt="Your win card"><div class="row gap10 w100"><button class="btn wa grow" id="wcWa">WhatsApp</button><button class="btn ghost" id="wcMore">More</button></div>`);
  const go = to => { if (window.LDNative && window.LDNative.shareImage) window.LDNative.shareImage(url, text, to); else { const a = document.createElement('a'); a.href = url; a.download = 'pitara-win.png'; a.click(); } closeModal(); };
  $('wcWa').onclick = () => go('whatsapp'); $('wcMore').onclick = () => go('more');
}
$('winShare').onclick = shareWin;
function winExtras() {
  const e = eco.lastEarn, fresh = e && Date.now() - e.at < 60000;
  $('winShare').style.display = fresh && e.won ? '' : 'none';
  $('winCoins').innerHTML = fresh ? `<i class="coin"></i>+${e.n} coins` : '';
  $('winCoins').style.display = fresh ? '' : 'none';
}
// Home: coins, daily reward, shop, badges
$('ecoDaily').onclick = () => { sfx('click'); show('daily'); };
$('ecoShop').onclick = () => { sfx('click'); show('shop'); };
$('ecoBadges').onclick = () => { sfx('click'); show('badges'); };
applyLooks(); checkBadges(); renderCoins(); setDailyDot();

// ---------- Chess daily puzzle ----------
// One puzzle a day, the same for everyone. Every puzzle has exactly one winning first move.
const dayNo = () => Math.floor((Date.now() + 5.5 * 36e5) / 864e5);
const todayPuzzle = () => PUZZLES[dayNo() % PUZZLES.length];
function puzzleCardHtml() {
  const P = todayPuzzle(), done = eco.puzzleDay === dayNo(), side = P.fen.split(' ')[1] === 'w' ? 'White' : 'Black';
  return `<button class="pzcard ${done ? 'done' : ''}" data-puzzle="1"><div class="pzboard">${miniBoard(P.fen)}</div><span class="col grow"><small class="pztag">${done ? '✓ Solved today' : '🧩 Daily puzzle'}</small><b>Mate in ${P.n}</b><small>${side} to play. ${done ? 'Come back tomorrow for a new one' : 'Solve it for +40 coins'}</small>${eco.puzzleRun ? `<small class="pzrun">🔥 ${eco.puzzleRun} day streak</small>` : ''}</span></button>`;
}
function miniBoard(fen) {
  const rows = fen.split(' ')[0].split('/'), G2 = { p: '♟', n: '♞', b: '♝', r: '♜', q: '♛', k: '♚' };
  let h = '';
  rows.forEach((r, y) => { let x = 0; for (const c of r) { if (/\d/.test(c)) { for (let k = 0; k < +c; k++) { h += `<i class="${(x + y) % 2 ? 'd' : ''}"></i>`; x++; } } else { h += `<i class="${(x + y) % 2 ? 'd' : ''}"><b class="${c === c.toUpperCase() ? 'w' : 'k'}">${G2[c.toLowerCase()]}</b></i>`; x++; } } });
  return h;
}
function startPuzzle() {
  const P = todayPuzzle(), side = P.fen.split(' ')[1];
  const me = { id: pid, name: profile.name, kind: 'me', look: profile.look, tint: profile.color };
  const otherLook = [0, 1, 2, 3].find(x => x !== ch(profile.look));
  const them = { id: 'bot1', name: CHAR_NAME[otherLook], kind: 'bot', look: otherLook, tint: (profile.color + 2) % 4 };
  G = { mode: 'bot', game: 'chess', s: newChess(side === 'w' ? [me, them] : [them, me]), busy: false, puzzle: { n: P.n, left: P.n, sol: P.sol, tries: 0, at: Date.now() } };
  G.s.fen = P.fen; G.s.turn = side;
  enterChess(); nextChess();
  note(`Find checkmate in ${P.n} move${P.n > 1 ? 's' : ''}`);
}
// The first move must be the one that forces mate; the last move must give checkmate.
function puzzleOk(mv) {
  const g = new Chess(G.s.fen), r = g.move({ from: mv.from, to: mv.to, promotion: mv.promotion || 'q' });
  if (!r) return false;
  const ok = G.puzzle.left === 1 ? g.in_checkmate() : (r.from + r.to) === G.puzzle.sol[0].slice(0, 4);
  if (!ok) {
    G.puzzle.tries++; cboard.clearMarks(); G.sel = null; buzz([60, 40, 60]); sfx('capture');
    note(G.puzzle.tries >= 3 ? `Hint: move the piece on ${G.puzzle.left === G.puzzle.n ? G.puzzle.sol[0].slice(0, 2) : 'the board that can check'}` : 'Not this one. Try again!');
    return false;
  }
  G.puzzle.left--;
  return true;
}
function puzzleSolved() {
  const first = eco.puzzleDay !== dayNo();
  if (first) {
    eco.puzzleRun = eco.puzzleDay === dayNo() - 1 ? (eco.puzzleRun || 0) + 1 : 1;
    eco.puzzleDay = dayNo(); saveEco();
    G.recorded = false;
    addHistory({ game: 'chess', mode: 'puzzle', result: 'won', of: 1, score: `Daily puzzle · Mate in ${G.puzzle.n}`, opp: [] });
    addCoins(20, 'puzzle bonus');
  }
  sfx('win'); buzz([60, 40, 120]);
  const secs = Math.round((Date.now() - G.puzzle.at) / 1000);
  modal(`<div class="sheethead">🧩</div><h3>Puzzle solved!</h3><p>Checkmate in ${G.puzzle.n} · ${secs}s${G.puzzle.tries ? ` · ${G.puzzle.tries} wrong tr${G.puzzle.tries > 1 ? 'ies' : 'y'}` : ' · first try!'}${first ? '<br>+40 coins' : ''}${eco.puzzleRun > 1 ? `<br>🔥 ${eco.puzzleRun} days in a row` : ''}</p><button class="btn gold" id="mOk">Done</button>`);
  $('mOk').onclick = () => { closeModal(); G = null; show('gamehome'); };
}

// ---------- Friends (friend code, online, invites, this week) ----------
let hubKey = store.get('hubkey', null);
if (!hubKey) { const b = new Uint8Array(18); crypto.getRandomValues(b); hubKey = Array.from(b, x => x.toString(16).padStart(2, '0')).join(''); store.set('hubkey', hubKey); }
const hub = Object.assign({ me: null, friends: [], tours: [], seenInv: {} }, store.get('hubcache', {}));
let frTab = 'list', hubPhotoSent = false;
async function hubCall(path, body) {
  const base = Net.serverBase(); if (!base) throw new Error('offline');
  const r = await fetch(base + '/hub/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.assign({ key: hubKey }, body || {})) });
  return r.json();
}
function myRoomInfo() {
  if (!G || G.mode !== 'online' || !G.code) return null;
  const max = G.game === 'chess' || G.game === 'carrom' ? 2 : G.game === 'draw' ? 6 : 4;
  return { code: G.code, game: G.game, open: !G.s && !G.viewer && (G.lobby || []).length < max, playing: !!G.s };
}
async function hubPing() {
  if (!profile || !Net.serverBase()) return;
  try {
    const body = { name: profile.name, look: profile.look, tint: profile.color, fr: eco.use.fr, room: myRoomInfo() };
    if (!hubPhotoSent) { body.photo = myPhoto ? await squarePhoto(myPhoto, 48).catch(() => null) : null; }
    const r = await hubCall('hello', body);
    if (!r || !r.me) return;
    hubPhotoSent = true;
    hub.me = r.me; hub.friends = r.friends || []; hub.tours = r.tours || [];
    store.set('hubcache', { me: hub.me, friends: hub.friends });
    (r.inbox || []).forEach(gotInvite);
    if (current === 'friends') renderFriends();
  } catch (e) { /* no network: try again later */ }
}
setInterval(() => { if (!document.hidden || (G && G.mode === 'online')) hubPing(); }, 25000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) hubPing(); });
setTimeout(hubPing, 1500);
const ago = t => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : m < 2880 ? 'yesterday' : `${Math.round(m / 1440)} days ago`; };
function friendAv(f, cls) {
  return `<div class="av ${cls || ''} ${f.fr && f.fr !== 'fr0' ? 'fr-' + f.fr : ''}">${f.photo ? `<div class="in photo" style="background:${UI[f.tint || 0]}"><img src="${f.photo}" alt=""></div>` : `<div class="in" style="background:${UI[f.tint || 0]}"><img src="${face(f.look, f.tint || 0)}" alt=""></div>`}</div>`;
}
function friendStatus(f) {
  if (!f.online) return `Last seen ${f.seen ? ago(f.seen) : 'long ago'}`;
  if (f.room && f.room.playing) return `Playing ${GAME_NAME[f.room.game] || 'a game'}`;
  if (f.room) return `In a ${GAME_NAME[f.room.game] || ''} room`;
  return 'In Pitara home';
}
function renderFriends() {
  document.querySelectorAll('#frTabs [data-ft]').forEach(b => b.classList.toggle('on', b.dataset.ft === frTab));
  const code = hub.me ? hub.me.code : '······';
  if (frTab === 'week') return renderWeek();
  if (frTab === 'tour') return renderTours();
  const on = hub.friends.filter(f => f.online), off = hub.friends.filter(f => !f.online);
  const inRoom = myRoomInfo();
  const row = f => `<div class="frow ${f.online ? '' : 'off'}"><div class="favw">${friendAv(f)}${f.online ? '<i class="ondot"></i>' : ''}</div>
    <div class="col grow minw0"><b>${esc(f.name)}</b><small>${friendStatus(f)}</small></div>
    ${f.room && f.room.open && f.online && (!inRoom || inRoom.code !== f.room.code) ? `<button class="btn gold sm" data-fjoin="${f.room.code}" data-fgame="${f.room.game}">Join</button>`
      : inRoom && inRoom.open ? `<button class="btn gold sm" data-finv="${f.code}">Invite</button>`
      : `<button class="btn ghost sm" data-fping="${f.code}">${f.online ? 'Invite' : 'Ping'}</button>`}</div>`;
  $('frBody').innerHTML = `<div class="panel fcode"><i>🔗</i><span class="col grow"><b>Your friend code</b><small>Share it, or play online once together to become friends</small></span><button class="codepill" id="frCopy">${code}</button></div>
    <button class="btn wa" id="frShare"><svg viewBox="0 0 24 24"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.5A8.4 8.4 0 1 1 21 11.5z"/></svg>Share my code on WhatsApp</button>
    ${hub.friends.length ? '' : '<div class="panel empty"><b>No friends yet</b><small>Tap “+ Add” and type a friend’s code, or send them yours.</small></div>'}
    ${on.length ? `<div class="sec">Online now · ${on.length}</div><div class="panel flist">${on.map(row).join('')}</div>` : ''}
    ${off.length ? `<div class="sec">Offline</div><div class="panel flist">${off.map(row).join('')}</div>` : ''}`;
}
function renderWeek() {
  const me = hub.me ? Object.assign({}, hub.me, { name: 'You', photo: myPhoto ? null : null, look: profile.look, tint: profile.color, fr: eco.use.fr, isMe: true }) : null;
  const all = hub.friends.concat(me ? [me] : []).sort((a, b) => b.w - a.w || b.p - a.p);
  const meAv = f => f.isMe ? `<div class="av mine">${faceImg(profile.look, profile.color, pid)}</div>` : friendAv(f);
  const pod = [all[1], all[0], all[2]];
  $('frBody').innerHTML = `<span class="small muted center">Wins this week with friends · starts again on Monday</span>
    <div class="wkpod">${pod.map((f, i) => f ? `<div class="wkcol p${[2, 1, 3][i]}">${i === 1 ? '<span class="wkcrown">👑</span>' : ''}<div class="medal nogem">${meAv(f)}</div><b>${esc(f.name)}</b><div class="wkblock"><span>${[2, 1, 3][i]}</span><small>${f.w} win${f.w === 1 ? '' : 's'}</small></div></div>` : '<div class="wkcol"></div>').join('')}</div>
    ${all.length > 3 ? `<div class="panel flist">${all.slice(3).map((f, i) => `<div class="frow"><b class="rk">${i + 4}</b>${meAv(f)}<b class="grow">${esc(f.name)}</b><b class="gold">${f.w} wins</b></div>`).join('')}</div>` : ''}
    ${hub.friends.length ? '' : '<div class="panel empty"><b>Add friends to compete</b><small>Everyone’s wins this week show up here.</small></div>'}`;
}
$('frTabs').addEventListener('click', e => { const b = e.target.closest('[data-ft]'); if (b) { frTab = b.dataset.ft; sfx('click'); renderFriends(); } });
$('frAddBtn').onclick = () => {
  sfx('click');
  modal(`<h3>Add a friend</h3><p>Type your friend’s 6-letter code. They can find it in their Friends tab.</p><input class="input codein" id="frIn" maxlength="6" placeholder="ABC123" autocapitalize="characters" autocomplete="off"><p class="err" id="frErr"></p><button class="btn gold" id="mOk">Add friend</button><button class="btn ghost" id="mNo">Cancel</button>`);
  $('frIn').focus(); $('mNo').onclick = closeModal;
  $('mOk').onclick = async () => {
    const c = $('frIn').value.trim().toUpperCase(); if (c.length !== 6) { $('frErr').textContent = 'The code has 6 letters or numbers'; return; }
    try { const r = await hubCall('add', { code: c }); if (r.error) { $('frErr').textContent = r.error; return; } closeModal(); toast(`${r.friend.name} is now your friend!`, '#1E9E5A'); sfx('win'); await hubPing(); }
    catch (e) { $('frErr').textContent = 'No internet. Try again.'; }
  };
};
$('frBody').addEventListener('click', async e => {
  if (e.target.closest('#frCopy')) { if (window.LDNative && window.LDNative.copy) window.LDNative.copy(hub.me.code); else if (navigator.clipboard) navigator.clipboard.writeText(hub.me.code).catch(() => {}); toast('Code copied', '#3A2490'); return; }
  if (e.target.closest('#frShare')) { const t = `Add me on Pitara! My friend code: ${hub.me ? hub.me.code : ''}\nOpen Pitara → Friends → + Add\n\nGet Pitara: https://ludo-dhamaal.pitaragames.workers.dev/download`; if (window.LDNative && window.LDNative.shareWhatsApp) window.LDNative.shareWhatsApp(t); else location.href = 'https://wa.me/?text=' + encodeURIComponent(t); return; }
  const j = e.target.closest('[data-fjoin]'); if (j) { sfx('click'); joinFriendRoom(j.dataset.fjoin, j.dataset.fgame); return; }
  const iv = e.target.closest('[data-finv]'); if (iv) { sendInvite(iv.dataset.finv, iv); return; }
  const pg = e.target.closest('[data-fping]'); if (pg) { sendInvite(pg.dataset.fping, pg); return; }
});
async function sendInvite(code, btn) {
  const r = myRoomInfo();
  try { await hubCall('invite', { to: code, room: r && r.open ? r.code : null, game: r ? r.game : GAME }); sfx('pop'); if (btn) { btn.textContent = 'Sent ✓'; btn.disabled = true; } toast(r && r.open ? 'Invite sent' : 'Ping sent: they’ll see you want to play', '#1E9E5A'); }
  catch (e) { toast('No internet. Try again.', '#E0103A'); }
}
function joinFriendRoom(code, game, tour) {
  if (game && GAME_NAME[game]) { GAME = game; store.set('game', GAME); }
  if (!netReady()) return;
  openRoom(code);
  if (tour) G.tour = tour;
}
// An invite arrives: show it (or a phone notification if Pitara is in the background).
function gotInvite(iv) {
  const key = iv.from + (iv.room || '') + iv.at; if (hub.seenInv[key]) return; hub.seenInv[key] = 1;
  const what = iv.room ? `${GAME_NAME[iv.game] || 'a game'} room` : 'a game';
  const title = iv.tour && !iv.room ? `${iv.name} started a tournament!` : iv.tour ? `${iv.name}: your tournament match` : iv.room ? `${iv.name} invited you` : `${iv.name} wants to play!`;
  if (document.hidden && window.LDNative && window.LDNative.notify) { window.LDNative.notify(title, iv.room ? `Tap to join the ${what}` : 'Open Pitara and play together', iv.room ? 'room:' + iv.room : ''); return; }
  sfx('turn'); buzz([60, 40, 60]);
  $('navFriendsDot').textContent = '!'; $('navFriendsDot').classList.add('show');
  if (G && (PLAY_SCREENS.includes(current) || current === 'lobby')) { toast(`${title} · ${what}`, '#8a5600'); return; }
  modal(`<div class="sheethead">🎮</div><h3>${esc(title)}</h3><p>${iv.room ? `Join their ${esc(what)} now?` : iv.tour ? `A ${esc(GAME_NAME[iv.game] || '')} knockout. See your match in Friends → Tournament.` : 'Open a room and invite them, or say hi.'}</p>
    ${iv.room ? '<button class="btn gold" id="mOk">Join</button>' : '<button class="btn gold" id="mOk">Open Friends</button>'}<button class="btn ghost" id="mNo">Later</button>`);
  $('mNo').onclick = closeModal;
  $('mOk').onclick = () => { closeModal(); if (iv.room) joinFriendRoom(iv.room, iv.game, iv.tour); else { if (iv.tour) frTab = 'tour'; show('friends'); } };
}
// Invite from the room
$('lobbyInvite').onclick = () => {
  sfx('click');
  if (!hub.friends.length) { modal('<h3>No friends yet</h3><p>Add friends in the Friends tab (their 6-letter code), or share the room on WhatsApp.</p><button class="btn gold" id="mOk">OK</button>'); $('mOk').onclick = closeModal; return; }
  const list = hub.friends.slice().sort((a, b) => b.online - a.online);
  modal(`<h3>Invite friends</h3><div class="panel flist vlist">${list.map(f => `<div class="frow ${f.online ? '' : 'off'}"><div class="favw">${friendAv(f)}${f.online ? '<i class="ondot"></i>' : ''}</div><div class="col grow minw0"><b>${esc(f.name)}</b><small>${friendStatus(f)}</small></div><button class="btn gold sm" data-inv2="${f.code}">Invite</button></div>`).join('')}</div><button class="btn ghost mt12" id="mOk">Done</button>`);
  $('mOk').onclick = closeModal;
  $('modalBox').querySelectorAll('[data-inv2]').forEach(b => b.onclick = () => sendInvite(b.dataset.inv2, b));
};

// ---------- Language ----------
function renderLangPick() { $('setLang').innerHTML = LANGS.map(l => `<button class="lvlbtn ${(settings.lang || 'en') === l[0] ? 'on' : ''}" data-lang="${l[0]}">${l[1]}</button>`).join(''); }
renderLangPick();
$('setLang').addEventListener('click', e => {
  const b = e.target.closest('[data-lang]'); if (!b || b.dataset.lang === (settings.lang || 'en')) return;
  settings.lang = b.dataset.lang; store.set('settings', settings); sfx('click');
  location.reload();
});
setLang(settings.lang || 'en');

// ---------- Friends tournament (knockout) ----------
const TOUR_GAMES = ['chess', 'carrom', 'ludo', 'patta', 'snakes'];
const tName = (t, c) => { if (hub.me && c === hub.me.code) return 'You'; const p = t.players.find(x => x.code === c); return p ? p.name : '?'; };
const roundName = (n, i) => (n - i === 1 ? 'Final' : n - i === 2 ? 'Semi-finals' : 'Quarter-finals');
function myMatch(t) { if (!hub.me || t.champ) return null; const r = t.rounds[t.rounds.length - 1]; return r.find(m => !m.w && (m.a === hub.me.code || m.b === hub.me.code)) || null; }
function renderTours() {
  const T = (hub.tours || []).slice().reverse();
  const total = t => Math.log2(t.players.length);
  $('frBody').innerHTML = `<button class="btn gold" id="tNew">🏆 Start a tournament</button>
    ${T.length ? '' : '<div class="panel empty"><b>No tournament yet</b><small>Pick 3 or 7 friends and a game. Winners go to the next round until one champion is left.</small></div>'}
    ${T.map(t => {
      const n = total(t), m = myMatch(t), opp = m ? (m.a === hub.me.code ? m.b : m.a) : null, of = opp ? hub.friends.find(f => f.code === opp) : null;
      const rounds = [];
      for (let i = 0; i < n; i++) { const r = t.rounds[i] || Array(t.players.length / 2 ** (i + 1)).fill(null); rounds.push(r); }
      return `<div class="panel tour"><div class="row between"><b class="ttl">${GAME_NAME[t.game]} tournament</b><small class="muted">${t.players.length} players</small></div>
        ${t.champ ? `<div class="champ"><span>🏆</span><b>${esc(tName(t, t.champ))}</b><small>Champion</small></div>` : ''}
        <div class="bracket">${rounds.map((r, i) => `<div class="bcol"><small>${roundName(n, i)}</small>${r.map(x => x ? `<div class="bm"><span class="${x.w === x.a ? 'w' : x.w ? 'l' : ''}">${esc(tName(t, x.a))}</span><span class="${x.w === x.b ? 'w' : x.w ? 'l' : ''}">${esc(tName(t, x.b))}</span></div>` : '<div class="bm tbd"><span>?</span><span>?</span></div>').join('')}</div>`).join('')}</div>
        ${m ? (m.a === hub.me.code ? `<button class="btn gold" data-tplay="${t.id}">Play your match vs ${esc(tName(t, opp))}</button>`
          : of && of.room && of.room.open ? `<button class="btn gold" data-tjoin="${t.id}" data-room="${of.room.code}">Join ${esc(of.name)}’s room</button>`
          : `<small class="muted center">Waiting for ${esc(tName(t, opp))} to open the room. You’ll get an invite.</small>`) : ''}
      </div>`;
    }).join('')}`;
}
$('frBody').addEventListener('click', e => {
  if (e.target.closest('#tNew')) return newTourSheet();
  const p = e.target.closest('[data-tplay]'); if (p) {
    const t = hub.tours.find(x => x.id === p.dataset.tplay), m = t && myMatch(t); if (!m) return;
    sfx('click'); GAME = t.game; store.set('game', GAME);
    if (!netReady()) return;
    Net.newCode().then(code => { openRoom(code); G.tour = t.id; const opp = m.a === hub.me.code ? m.b : m.a; hubCall('invite', { to: opp, room: code, game: t.game, tour: t.id }).catch(() => {}); toast('Room ready. Your opponent got an invite', '#1E9E5A'); })
      .catch(() => toast('Could not create the room. Try again.', '#E0103A'));
    return;
  }
  const j = e.target.closest('[data-tjoin]'); if (j) { sfx('click'); const t = hub.tours.find(x => x.id === j.dataset.tjoin); joinFriendRoom(j.dataset.room, t && t.game, t && t.id); }
});
function newTourSheet() {
  sfx('click');
  if (hub.friends.length < 3) { modal('<h3>Need 3 friends</h3><p>A tournament needs 4 or 8 players: you and 3 or 7 friends. Add friends with their code first.</p><button class="btn gold" id="mOk">OK</button>'); $('mOk').onclick = closeModal; return; }
  let game = 'chess';
  const pick = new Set();
  const draw = () => {
    modal(`<h3>🏆 New tournament</h3><b class="lbl">Game</b><div class="chips wrap">${TOUR_GAMES.map(g => `<button class="chip ${g === game ? 'on' : ''}" data-tg="${g}">${GAME_NAME[g]}</button>`).join('')}</div>
      <b class="lbl mt12">Pick 3 or 7 friends (${pick.size} picked)</b><div class="panel flist vlist">${hub.friends.map(f => `<label class="frow"><div class="favw">${friendAv(f)}${f.online ? '<i class="ondot"></i>' : ''}</div><b class="grow">${esc(f.name)}</b><input type="checkbox" class="sw" data-tp="${f.code}" ${pick.has(f.code) ? 'checked' : ''}></label>`).join('')}</div>
      <p class="err" id="tErr"></p><button class="btn gold" id="mOk" ${pick.size === 3 || pick.size === 7 ? '' : 'disabled'}>Start with ${pick.size + 1} players</button><button class="btn ghost" id="mNo">Cancel</button>`);
    $('mNo').onclick = closeModal;
    $('modalBox').querySelectorAll('[data-tg]').forEach(b => b.onclick = () => { game = b.dataset.tg; draw(); });
    $('modalBox').querySelectorAll('[data-tp]').forEach(c => c.onchange = () => { if (c.checked) pick.add(c.dataset.tp); else pick.delete(c.dataset.tp); draw(); });
    $('mOk').onclick = async () => {
      try { const r = await hubCall('tour/new', { game, players: [...pick] }); if (r.error) { $('tErr').textContent = r.error; return; } closeModal(); sfx('win'); toast('Tournament started! Everyone got a message', '#1E9E5A'); hub.tours = (hub.tours || []).concat(r.tour); frTab = 'tour'; renderFriends(); }
      catch (e) { $('tErr').textContent = 'No internet. Try again.'; }
    };
  };
  draw();
}

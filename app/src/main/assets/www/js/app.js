import { newGame, roll, move, passTurn, botChoice, seatColors, playerOf, FINISH } from './rules.js';
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
const settings = Object.assign({ sound: true, music: true, vibrate: true, automic: false, listen: true, chessHelp: true, carromHelp: true, queenBuzz: true, carromMode: 'classic', carrom3d: false, striker: 0 }, store.get('settings', {}));
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
const avatar = (look, color, cls, id) => `<div class="av ${cls || ''}">${faceImg(look, color, id)}</div>`;

// ---------- Screens ----------
let current = 'splash';
function show(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  current = id;
  if (id !== 'win') stopDance();
  if (board) board.paused = id !== 'game';
  if (cboard) cboard.paused = id !== 'chess';
  if (rboard) rboard.paused = id !== 'carrom';
  if (id === 'home') renderHome();
  if (id === 'gamehome') renderModes();
  if (id === 'history') renderHistory();
  const nav = ['home', 'history'].includes(id) || (id === 'profile' && !!profile);
  $('bnav').classList.toggle('show', nav);
  document.querySelectorAll('#bnav [data-nav]').forEach(b => b.classList.toggle('on', b.dataset.nav === id));
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
function addHistory(h) {
  if (!G || G.recorded) return;
  G.recorded = true;
  history.unshift(Object.assign({ at: Date.now() }, h));
  if (history.length > 120) history.length = 120;
  store.set('history', history);
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
      if (current === 'history') renderHistory();
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
const GAME_ICON = { ludo: '🎲', chess: '&#9822;', carrom: '🎯', snakes: '🐍' };
function statsHtml(st, profileView) {
  const four = profileView
    ? [['gold', st.played, 'Played'], ['green', st.won, 'Won'], ['', st.rate + '%', 'Win rate'], ['', (st.streak ? '🔥' : '') + st.streak, 'Streak']]
    : [['gold', st.played, 'Games'], ['green', st.won, 'Wins'], ['', st.lost, 'Losses'], ['', st.best ? `<span class="${st.best === 'chess' ? 'gl' : ''}">${GAME_ICON[st.best]}</span>` : '–', st.best ? 'Best at ' + GAME_NAME[st.best].split(' ')[0] : 'Best game']];
  return four.map(x => `<div class="stat"><b class="${x[0]}">${x[1]}</b><span>${x[2]}</span></div>`).join('');
}
let hFilter = 'all';
function dayLabel(t) {
  const d = new Date(t), now = new Date(), a = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  if (t >= a) return 'Today';
  if (t >= a - 864e5) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: d.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}
const MODE_TEXT = { online: 'online', bot: 'vs computer', local: 'pass & play' };
const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);
function renderHistory() {
  $('hStats').innerHTML = statsHtml(stats(), false);
  $('hFilters').innerHTML = [['all', 'All'], ['ludo', 'Ludo'], ['chess', 'Chess'], ['carrom', 'Carrom'], ['snakes', 'Snakes']].map(f => `<button class="chip ${hFilter === f[0] ? 'on' : ''}" data-f="${f[0]}">${f[1]}</button>`).join('');
  const L = history.filter(h => hFilter === 'all' || h.game === hFilter);
  if (!L.length) { $('hList').innerHTML = `<div class="panel hempty"><b>No games yet</b>Play a game and it will show up here.</div>`; return; }
  const groups = [];
  L.forEach(h => { const k = dayLabel(h.at); let g = groups[groups.length - 1]; if (!g || g.k !== k) groups.push(g = { k, list: [] }); g.list.push(h); });
  $('hList').innerHTML = groups.map(g => `<div class="hday">${g.k}</div><div class="panel hgroup" style="padding:0">${g.list.map(h => {
    const rib = h.result === 'won' ? '<span class="rib w">WON</span>' : h.result === 'draw' ? '<span class="rib d">DRAW</span>' : `<span class="rib l">${h.rank && h.of > 2 ? ordinal(h.rank) + ' place' : 'LOST'}</span>`;
    const opp = (h.opp || []).map(o => o.name);
    const vs = opp.length ? (opp.length > 2 ? `${opp.length + 1} players` : 'vs ' + opp.map(esc).join(', ')) : '';
    const time = new Date(h.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
    const parts = [h.score ? esc(h.score) : '', vs, MODE_TEXT[h.mode] || '', time].filter(Boolean);
    return `<div class="hitem"><div class="gbadge ${h.game}">${GAME_ICON[h.game] || '🎲'}</div><div class="grow minw0"><div class="t">${GAME_NAME[h.game].replace(' & Ladders', '')} ${rib}</div><div class="s">${parts.join(', ')}</div></div>
      <div class="minis">${(h.opp || []).slice(0, 3).map(o => { const fp = o.id && friendPhotos[o.id]; return `<div class="mini" style="background:${UI[o.tint || 0]}"><img src="${fp ? fp.img : face(o.look, o.tint || 0)}" alt=""${fp ? ' style="object-position:center"' : ''}></div>`; }).join('')}</div></div>`;
  }).join('')}</div>`).join('');
}
$('hFilters').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { hFilter = b.dataset.f; sfx('click'); renderHistory(); } });

// ---------- Home ----------
// The game picked on the Pitara home screen: 'ludo' or 'chess'.
let GAME = store.get('game', 'ludo');
const GAME_NAME = { ludo: 'Ludo', chess: 'Chess', snakes: 'Snakes & Ladders', carrom: 'Carrom' };
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
  const arch = (g, gem, count, art, name, sub, cls) => `<button class="arch ${g}" data-game="${g}"><div class="inner"></div>${ARCH.replace('GEM', gem)}<span class="count">${count}</span><div class="art">${art}</div><div class="name"><b class="${cls || ''}">${name}</b><span>${sub}</span></div></button>`;
  const pk = (l, t) => `<i style="${l};background:${t}"></i>`;
  $('games').innerHTML =
    arch('ludo', '#e5196f', '2-4 players', body(0, 0, 138) + body(3, 3, 148), 'Ludo', 'Walk your team home') +
    arch('chess', '#0fb5a5', '2 players', '<span class="glyph w">&#9819;</span><span class="glyph g">&#9822;</span>', 'Chess', 'With move help') +
    arch('carrom', '#e5196f', '2 players', `<div class="cboard3">${pk('left:2px;top:2px', '#120a06')}${pk('right:2px;top:2px', '#120a06')}${pk('left:2px;bottom:2px', '#120a06')}${pk('right:2px;bottom:2px', '#120a06')}${pk('left:39px;top:39px;box-shadow:0 2px 0 #6a0010', '#d9142e')}${pk('left:22px;top:41px;box-shadow:0 2px 0 #9b8a5a', '#f6efdc')}${pk('left:57px;top:35px;box-shadow:0 2px 0 #000', '#1f1f1f')}<i style="left:42px;top:60px;width:20px;height:20px;background:#eef;border:3px solid #3d5afe"></i></div>`, 'Carrom', 'Flick and pocket') +
    arch('snakes', '#0fb5a5', '2-4 players', body(2, 2, 146), 'Snakes &amp; Ladders', 'First to 100 wins', 'long');
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
  $('gameLogo').innerHTML = chess ? '<div class="l1">3D</div><div class="l2">Chess</div>' : GAME === 'carrom' ? '<div class="l1">Carrom</div>' : GAME === 'snakes' ? '<div class="l1">Snakes</div><div class="l2">& Ladders</div>' : '<div class="l1">Ludo</div><div class="l2">Dhamaal</div>';
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
  $('modes').innerHTML = GAME === 'carrom' ? carromTypesHtml() + `<div class="modegrid">${list}</div>` : list;
  music(true);
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
  <div class="panel strow"><div class="vic">🎯</div><div class="col grow"><b>Striker</b><small>Your striker design</small></div>${['blue', 'gold', 'ruby'].map((c, i) => `<button class="stk ${c} ${settings.striker === i ? 'on' : ''}" data-stk="${i}" aria-label="${c} striker"></button>`).join('')}</div>`;
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
  const ct = e.target.closest('[data-ctype]'); if (ct) { settings.carromMode = ct.dataset.ctype; store.set('settings', settings); sfx('click'); renderModes(); return; }
  const sk = e.target.closest('[data-stk]'); if (sk) { settings.striker = +sk.dataset.stk; store.set('settings', settings); sfx('click'); if (rboard) rboard.setStrikerStyle(settings.striker); renderModes(); return; }
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
  setupMode = m; setupN = 2;
  $('setupTitle').textContent = m === 'bot' ? 'Play vs computer' : 'Pass & play';
  renderSetup(); show('setup');
}
function setupColors() { return seatColors(setupN).map(c => (c + profile.color) % 4); }
function renderSetup() {
  if (GAME === 'chess') return renderChessSetup();
  if (GAME === 'carrom') return renderCarromSetup();
  $('setupAsk').textContent = 'How many players?';
  $('setupCount').innerHTML = [2, 3, 4].map(n => `<button class="countbtn ${n === setupN ? 'on' : ''}" data-n="${n}">${n}</button>`).join('');
  const cols = setupColors();
  $('setupNames').innerHTML = cols.map((c, i) => {
    const nm = i === 0 ? profile.name : (setupMode === 'bot' ? CHAR_NAME[[0, 1, 2, 3].filter(x => x !== ch(profile.look))[i - 1]] : 'Player ' + (i + 1));
    const ed = setupMode === 'local' && i > 0;
    return `<div class="prow"><span class="dot" style="background:${UI[c]}"></span>${ed ? `<input class="input" data-pn="${i}" maxlength="14" value="${nm}">` : `<b style="font-size:18px">${esc(nm)}</b>`}</div>`;
  }).join('');
}
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
  if (GAME === 'snakes') startSnakes(setupMode, players); else startOffline(setupMode, players);
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
  if (!board) { board = kind === 'snakes' ? new SnakeBoard3D(freshCanvas('board')) : new Board3D(freshCanvas('board')); board.kind = kind; }
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
  if (G.s && G.s.game === 'chess') return renderChessCards();
  if (G.s && G.s.game === 'carrom') return renderCarromCards();
  const s = G.s;
  // Cards sit in the same corner as each player's home (your home is bottom-left).
  const me = s.players.find(p => p.id === pid) || s.players[0];
  const at = k => playerOf(s, (me.color + k) % 4);
  const top = [at(1), at(2)], bottom = [at(0), at(3)];
  const html = p => {
    const snakes = s.game === 'snakes';
    const fin = snakes ? 0 : s.tokens[p.color].filter(x => x === FINISH).length;
    const where = snakes ? (s.pos[p.color] ? `Square ${s.pos[p.color]}` : 'At start') : `Home ${fin}/4`;
    const speaking = G.speaking && G.speaking.has(p.id);
    let st = p.done ? 'Finished!' : where;
    if (G.mode === 'online') {
      const lp = G.lobby.find(x => x.pid === p.id);
      if (lp && lp.left) st = 'Offline';
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
  const av = document.querySelector(`#${screen} .gcard.turn .av`); if (!av) return;
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
  dropCBoard(); dropRBoard();
  show('game');
  const b = ensureBoard(G.s.game === 'snakes' ? 'snakes' : 'ludo');
  syncBoard(b);
  b.diceIdle();
  setDiceFace(0);
  $('gameRoom').textContent = (G.s.game === 'snakes' ? 'Snakes & Ladders · ' : '') + (mode === 'online' ? 'Room ' + G.code : (mode === 'bot' ? 'Vs computer' : 'Pass & play'));
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
  ['gameSound', 'cSound', 'rSound'].forEach(id => {
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
  music(on && !['game', 'chess', 'carrom'].includes(current)); if (on) sfx('click');
  syncSpeaker();
};
syncSpeaker();
function leaveGame() {
  confirmBox('Leave the game?', G && G.mode === 'online' ? 'You can come back with the same room code while the game is on.' : 'This game will end.', 'Leave', 'Stay', () => {
    if (G && G.mode === 'online') endOnline();
    G = null; show('gamehome');
  });
}
$('cLeave').onclick = () => leaveGame();

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
  const s = G.s; renderCards();
  const ranks = s.ranks.slice();
  s.order.forEach(c => { if (!ranks.includes(c)) ranks.push(c); });
  const P = c => playerOf(s, c);
  const me = s.players.find(p => p.id === pid);
  const winner = P(ranks[0]);
  const iWon = me && winner.id === pid;
  $('winTitle').textContent = iWon ? 'You won!' : `${winner.name} won!`;
  $('winSub').textContent = iWon ? (s.game === 'snakes' ? 'You reached 100 first!' : 'All 4 of your players made it home') : (s.game === 'snakes' ? `${winner.name} reached 100 first` : 'Good game! Try again?');
  danceStage({ look: winner.look, tint: winner.color, name: winner.name }, ranks.slice(1).map(c => ({ look: P(c).look, tint: P(c).color })));
  if (me) {
    const rank = ranks.indexOf(me.color) + 1;
    addHistory({ game: s.game === 'snakes' ? 'snakes' : 'ludo', mode: G.mode, result: rank === 1 ? 'won' : 'lost', rank, of: ranks.length,
      score: s.game === 'snakes' ? (rank === 1 ? 'Reached 100' : `Square ${s.pos[me.color] || 0}`) : `${s.tokens[me.color].filter(x => x === FINISH).length}/4 home`,
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
  if (!cboard) { cboard = new Chess3D(freshCanvas('cboard')); cboard.onTap = chessTap; }
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
  dropBoard(); dropRBoard();
  show('chess');
  const b = ensureCBoard();
  b.setPosition(G.s.fen); b.clearMarks();
  b.setLast(G.s.last); setChessCheck();
  b.view(chessViewSide(), false);
  $('cRoom').textContent = G.mode === 'online' ? 'Chess · Room ' + G.code : (G.mode === 'bot' ? 'Chess · Vs computer' : 'Chess · Pass & play');
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
  G.turnStart = Date.now(); G.turnEnds = Date.now() + s.clock[s.turn];
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
  if (!rboard) { rboard = new Carrom3D(freshCanvas('rboard')); hookCarromInput(rboard); rboard.setStrikerStyle(settings.striker); rboard.setFlat(!settings.carrom3d); }
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
  dropBoard(); dropCBoard();
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
  const r = $('rSlider').getBoundingClientRect(), f = (sp.x - CLO) / (CHI - CLO);
  const ff = rboard.flipped() ? 1 - f : f;
  $('rKnob').style.left = (24 + ff * Math.max(0, r.width - 48)) + 'px';
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
function slideCarrom(e) {
  if (!canShoot()) return;
  const r = $('rSlider').getBoundingClientRect();
  let f = Math.min(1, Math.max(0, (e.clientX - r.left - 24) / Math.max(1, r.width - 48)));
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

function openRoom(code) {
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
      g.q = g.q.then(() => onNet(m)).catch(err => console.error(err));
    },
    status: st => { if (st !== 'online' && G) G.wasOffline = true; setNetState(st); if (st === 'online') setTimeout(sendMyPhoto, 50); }
  });
  G.voice = new Voice((to, data) => G && G.net && G.net.send({ t: 'rtc', to, data }), (who, on) => { if (!G) return; if (on) G.speaking.add(who); else G.speaking.delete(who); if (current === 'lobby') renderLobby(); else renderCards(); });
  G.voice.setListen(settings.listen);
  G.voice.setVoiceVolume(vol.voice / 100); G.voice.setMicVolume(vol.mic / 50);
  G.voice.onState = () => { if (current === 'lobby') renderLobby(); else if (['game', 'chess', 'carrom'].includes(current)) renderCards(); };
  G.net.join(code, { pid, name: profile.name, look: profile.look, tint: profile.color, game: GAME, mode: settings.carromMode });
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
  ['lobbyMic', 'gameMic', 'cMic', 'rMic'].forEach(id => { $(id).innerHTML = on ? MIC : MIC_OFF; $(id).classList.toggle('on', on); });
}
['lobbyMic', 'gameMic', 'cMic', 'rMic'].forEach(id => $(id).onclick = async () => {
  if (!G || !G.voice) return;
  if (!G.voice.hasMic()) { const ok = await G.voice.start(pid, true); if (!ok) { toast('Allow the mic in phone settings', '#3A2490'); return; } }
  else G.voice.setMuted(!G.voice.muted);
  sfx('click');
  G.net.send({ t: 'mic', on: !G.voice.muted });
  syncMicButtons();
});

function renderLobby() {
  if (!G) return;
  const L = G.lobby, max = G.game === 'chess' || G.game === 'carrom' ? 2 : 4;
  $('lobbyTitle').textContent = (G.game === 'carrom' ? CTYPE_NAME[G.ctype || 'classic'] : GAME_NAME[G.game || 'ludo']) + ' room';
  $('lobbyCount').textContent = `Players (${L.length}/${max})`;
  const cols = seatColors(Math.max(2, L.length));
  const rows = L.map((p, i) => {
    const c = L.length >= 2 ? cols[i] : i;
    const sp = G.speaking.has(p.pid);
    let st = !p.connected ? 'Waiting for network...' : sp ? 'Speaking...' : p.host ? 'Host' : 'Ready';
    if (p.pid !== pid && p.connected) st += ' \u00b7 ' + voiceText(p.pid);
    return `<div class="pcard">${avatar(p.look, c, sp ? 'speak' : '', p.pid)}
      <div class="col grow"><span class="nm">${esc(p.name)}${p.pid === pid ? ' (You)' : ''}</span><span class="st">${st}</span></div>
      <span class="mic ${p.mic ? 'on' : ''}">${p.mic ? MIC : MIC_OFF}</span></div>`;
  });
  $('voiceInfo').textContent = !G.voice.hasMic() ? 'Your mic is not allowed. Others can\u2019t hear you.' : (VoiceMod.RELAY ? 'Voice relay: on' : 'Voice relay: off (voice may fail on mobile data)');
  for (let i = L.length; i < max; i++) rows.push(`<div class="pcard"><div class="av" style="opacity:.4"><div class="in" style="background:#2E1A75"></div></div><div class="col grow"><span class="nm">Empty slot</span><span class="st">Waiting for a friend...</span></div></div>`);
  $('lobbyPlayers').innerHTML = rows.join('');
  const btn = $('lobbyStart');
  if (G.host) { btn.textContent = 'Start game'; btn.disabled = L.filter(p => p.connected).length < 2; }
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
      G.lobby = m.players; G.host = m.host === pid;
      if (m.game && m.game !== G.game) { G.game = m.game; GAME = m.game; store.set('game', GAME); }
      G.ctype = m.mode || 'classic';
      const live = m.players.filter(p => p.connected && !p.left).map(p => p.pid);
      if (G.wasOffline) { G.wasOffline = false; G.voice.restart(live); }
      else m.players.forEach(p => { if (p.pid !== pid && p.connected && before[p.pid] === false) G.voice.restart([p.pid]); });
      if (G.host && !wasHost && G.hostKnown) toast('You are now the host', '#3A2490');
      G.hostKnown = true;
      if (current === 'win') $('winAgain').style.display = G.host ? 'flex' : 'none';
      G.voice.sync(live);
      if (current === 'lobby') renderLobby();
      if (['game', 'chess', 'carrom'].includes(current)) renderCards();
      break;
    }
    case 'err':
      modal(`<h3>Oops</h3><p>${esc(m.msg)}</p><button class="btn gold" id="mOk">OK</button>`);
      $('mOk').onclick = () => { closeModal(); if (m.fatal) { endOnline(); G = null; show('gamehome'); } };
      break;
    case 'start':
    case 'sync':
      if (m.s && m.s.game === 'chess') { onChessState(m); break; }
      if (m.s && m.s.game === 'carrom') { onCarromState(m); break; }
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
    case 'rend': onCarromEnd(m); break;
    case 'passed':
      if (G.s && G.s.game === 'carrom') { onCarromPassed(m); break; }
      if (m.reason !== 'left-other') { board.clearHighlight(); board.diceIdle(); }
      G.s = m.s; G.turnEnds = m.turnEnds; G.s.players.forEach(p => { p.kind = p.id === pid ? 'me' : 'remote'; });
      if (m.reason === 'timeout') note('Time up, turn skipped');
      if (m.reason === 'left') note('Player left the game');
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
      if (current === 'lobby') renderLobby(); else if (['game', 'chess', 'carrom'].includes(current)) renderCards();
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
  ['chatBadge', 'lobbyBadge', 'cBadge', 'rBadge'].forEach(id => { $(id).textContent = n > 9 ? '9+' : n; $(id).classList.toggle('show', n > 0); });
}
function onChat(m) {
  G.chat = G.chat || []; G.chat.push(m); if (G.chat.length > 60) G.chat.shift();
  if ($('chat').classList.contains('show')) renderChat();
  else if (m.from !== pid) { G.unread = (G.unread || 0) + 1; setBadges(); sfx('pop'); }
  if (['game', 'chess', 'carrom'].includes(current)) sayBubble(m);
}
function sayBubble(m) {
  const card = document.querySelector(`.gcard[data-pid="${m.from}"]`);
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
  if (['game', 'chess', 'carrom'].includes(current)) { leaveGame(); return true; }
  if (current === 'lobby') { $('lobbyBack').onclick(); return true; }
  if (current === 'win') { $('winHome').onclick(); return true; }
  if (current === 'profile' && !profile) return false;
  if (current === 'setup' || current === 'join') { show('gamehome'); return true; }
  if (current !== 'home' && current !== 'splash') { show('home'); return true; }
  return false;
};
document.addEventListener('visibilitychange', () => music(!document.hidden && !['game', 'chess', 'carrom'].includes(current)));

window.__ld = () => G; window.__board = () => board; window.__cboard = () => cboard; window.__rboard = () => rboard; window.__finish = () => finishGame();
splash();

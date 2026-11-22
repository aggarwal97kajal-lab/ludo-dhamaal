// Small sound effects made in code (no audio files) + light background music.
let ctx = null, musicTimer = null, master = null, sfxBus = null, musicBus = null, winBus = null;
// Volumes are 0-100. vib scales how long the phone buzzes.
export const prefs = { sound: true, music: true, vibrate: true, vol: { master: 80, music: 60, sfx: 80, win: 90, vib: 70 } };
const v = k => Math.max(0, Math.min(100, prefs.vol[k] == null ? 80 : prefs.vol[k])) / 100;
// Call after changing prefs.vol so playing sounds change at once.
export function applyVolumes() {
  if (!ctx) return;
  master.gain.value = 0.75 * v('master');
  sfxBus.gain.value = v('sfx');
  musicBus.gain.value = v('music');
  winBus.gain.value = v('win');
}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain(); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(master);
    musicBus = ctx.createGain(); musicBus.connect(master);
    winBus = ctx.createGain(); winBus.connect(master);
    applyVolumes();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, start, dur, type, vol, slideTo, bus) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type || 'sine'; o.frequency.setValueAtTime(freq, c.currentTime + start);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + start + dur);
  g.gain.setValueAtTime(0.0001, c.currentTime + start);
  g.gain.exponentialRampToValueAtTime(vol || 0.2, c.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g); g.connect(bus || sfxBus); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
}

function noise(start, dur, vol) {
  const c = ac(); if (!c) return;
  const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 1800; s.buffer = b; g.gain.value = vol || 0.3;
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(c.currentTime + start);
}

export function sfx(name) {
  if (!prefs.sound) return;
  switch (name) {
    case 'dice': for (let i = 0; i < 6; i++) noise(i * 0.12, 0.06, 0.35 - i * 0.04); break;
    case 'hop': tone(520, 0, 0.09, 'triangle', 0.12, 780); break;
    case 'step': tone(260, 0, 0.05, 'sine', 0.07, 200); break;
    case 'tick': tone(1200, 0, 0.04, 'square', 0.04); break;
    case 'capture': tone(900, 0, 0.5, 'sawtooth', 0.12, 120); noise(0, 0.25, 0.25); buzz([60, 40, 90]); break;
    case 'finish': [660, 880, 1100].forEach((f, i) => tone(f, i * 0.09, 0.25, 'sine', 0.18)); break;
    case 'win': [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, i * 0.13, 0.3, 'triangle', 0.2)); break;
    case 'click': tone(700, 0, 0.05, 'sine', 0.1); break;
    case 'tick': tone(1200, 0, 0.025, 'square', 0.05); break;
    case 'turn': tone(880, 0, 0.12, 'sine', 0.12); tone(1320, 0.1, 0.15, 'sine', 0.12); break;
    case 'pop': tone(300, 0, 0.12, 'sine', 0.2, 900); break;
  }
}

// Buzz pattern [on, off, on, ...] in ms. The strength slider makes the "on" parts longer or shorter
// (phones can't change how hard they vibrate, only for how long).
export function buzz(p, full) {
  if (!prefs.vibrate || !navigator.vibrate) return;
  const k = full ? 1 : v('vib') * 1.4;
  if (k <= 0.02) return;
  const q = (Array.isArray(p) ? p : [p]).map((x, i) => i % 2 ? x : Math.max(10, Math.round(x * k)));
  try { navigator.vibrate(q); } catch (e) { /* ignore */ }
}

const SCALE = [262, 294, 330, 392, 440, 523, 587, 659];
export function music(on) {
  if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  if (!on || !prefs.music) return;
  let i = 0;
  musicTimer = setInterval(() => {
    if (!ctx || ctx.state !== 'running') return;
    const n = SCALE[[0, 2, 4, 5, 4, 2, 3, 1][i % 8] + (i % 16 >= 8 ? 1 : 0)];
    tone(n, 0, 0.35, 'triangle', 0.05, null, musicBus);
    if (i % 4 === 0) tone(n / 2, 0, 0.6, 'sine', 0.06, null, musicBus);
    i++;
  }, 380);
}

export function unlock() { ac(); }

// ---------- Win music (bhangra track from a file) ----------
let track = null;
const buffers = {};
// Plays a music file once. Returns at once; trackTime() tells how far it has played.
export async function playTrack(url) {
  stopTrack();
  const c = ac(); if (!c) return;
  const my = track = { start: null };
  if (!prefs.music && !prefs.sound) return;
  try {
    if (!buffers[url]) { const r = await fetch(url); buffers[url] = await c.decodeAudioData(await r.arrayBuffer()); }
    if (track !== my) return;
    const s = c.createBufferSource(), g = c.createGain();
    s.buffer = buffers[url]; g.gain.value = 0.9;
    s.connect(g); g.connect(winBus);
    my.start = c.currentTime + 0.05; my.src = s; s.start(my.start);
  } catch (e) { /* no music, the dance still plays */ }
}
export function stopTrack() { if (track && track.src) { try { track.src.stop(); } catch (e) { /* ignore */ } } track = null; }
export function trackTime() { return track && track.start != null && ctx ? ctx.currentTime - track.start : null; }

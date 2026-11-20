// 3D chess board: pieces, move dots, animations and finger rotate / pinch.
const T = window.THREE;
const FILES = 'abcdefgh';
export const sqPos = sq => [FILES.indexOf(sq[0]) - 3.5, 0, 3.5 - (Number(sq[1]) - 1)];

export class Chess3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.R = new T.WebGLRenderer({ canvas, antialias: true });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; this.lostAt = Date.now(); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; this.restored = Date.now(); });
    this.R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.R.shadowMap.enabled = true; this.R.shadowMap.type = T.PCFSoftShadowMap;
    this.S = new T.Scene(); this.S.background = new T.Color('#120a33'); this.S.fog = new T.Fog('#120a33', 30, 60);
    this.cam = new T.PerspectiveCamera(42, 1, 0.5, 100);
    this.th = 0; this.ph = 0.6; this.rad = 15; this.thTarget = null;
    this.tweens = []; this.pieces = {}; this.tiles = {}; this.marks = []; this.sel = null;
    this.onTap = null; this.paused = true; this.time = 0;
    this.build(); this.controls(); this.resize();
    window.addEventListener('resize', () => this.resize());
    let last = performance.now();
    const loop = n => {
      const dt = Math.min((n - last) / 1000, 0.1); last = n;
      // A removed board still finishes its animations (the game waits for them), but draws nothing.
      if (this.dead && !this.tweens.length) return;
      this.step(dt); if (!this.dead && !this.paused && !this.lost) { try { this.R.render(this.S, this.cam); } catch (e) { /* context gone */ } }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  resize() {
    const w = this.canvas.clientWidth || 360, h = this.canvas.clientHeight || 600;
    this.R.setSize(w, h, false); this.cam.aspect = w / h;
    const half = Math.tan(this.cam.fov * Math.PI / 360) * Math.min(1, w / h);
    this.rad = Math.max(10, Math.min(36, 5.5 / half)); this.fitRad = this.rad;
    this.cam.updateProjectionMatrix(); this.updCam();
  }
  updCam() {
    this.cam.position.set(this.rad * Math.sin(this.ph) * Math.sin(this.th), this.rad * Math.cos(this.ph), this.rad * Math.sin(this.ph) * Math.cos(this.th));
    this.cam.lookAt(Math.sin(this.th) * 0.9, -0.9, Math.cos(this.th) * 0.9);
  }
  // Your side of the board at the bottom. smooth = turn the board around (pass & play).
  view(color, smooth) {
    const t = color === 'b' ? Math.PI : 0;
    if (!smooth) { this.th = t; this.thTarget = null; this.updCam(); return; }
    let d = t - this.th; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.thTarget = this.th + d;
  }

  destroy() {
    this.dead = true;
    try { this.R.dispose(); this.R.forceContextLoss(); } catch (e) { /* ignore */ }
  }

  M(col, o) { return new T.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.35, metalness: 0.05, envMapIntensity: 0.6 }, o || {})); }
  mk(g, m, x, y, z, par) { const o = new T.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; (par || this.S).add(o); return o; }

  build() {
    const S = this.S, M = this.M.bind(this), mk = this.mk.bind(this);
    S.add(new T.HemisphereLight('#ffffff', '#5a3aa0', 0.65));
    const L = new T.DirectionalLight('#ffffff', 1.0); L.position.set(5, 12, 6); L.castShadow = true; L.shadow.mapSize.set(1024, 1024);
    Object.assign(L.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); L.shadow.bias = -0.0005; L.shadow.normalBias = 0.02; S.add(L);
    const pm = new T.PMREMGenerator(this.R), es = new T.Scene(); es.background = new T.Color('#3a2a80');
    [[0, 10, 0, '#fff', 9], [10, 4, 6, '#ffe0b0', 5], [-10, 4, -6, '#a0c4ff', 5]].forEach(a => { const m = new T.Mesh(new T.PlaneGeometry(a[4], a[4]), new T.MeshBasicMaterial({ color: a[3], side: 2 })); m.position.set(a[0], a[1], a[2]); m.lookAt(0, 0, 0); es.add(m); });
    S.environment = pm.fromScene(es, 0.04).texture; pm.dispose();

    this.gold = M('#ffc21a', { metalness: 0.9, roughness: 0.2 });
    // Gold frame top sits above the inner board so the two never share a surface (no flicker).
    mk(new T.BoxGeometry(9.6, 0.5, 9.6), this.gold, 0, -0.27, 0);
    mk(new T.BoxGeometry(8.9, 0.5, 8.9), M('#3b1d8f'), 0, -0.2, 0);
    mk(new T.CylinderGeometry(6.5, 7.5, 0.6, 48), M('#2a1270', { metalness: 0.3 }), 0, -0.85, 0);
    const fl = new T.Mesh(new T.CircleGeometry(40, 48), M('#24135e')); fl.rotation.x = -Math.PI / 2; fl.position.y = -1.15; fl.receiveShadow = true; S.add(fl);
    const tileG = new T.BoxGeometry(0.98, 0.12, 0.98);
    const light = M('#f6efe0', { roughness: 0.4 }), dark = M('#7b4fd1', { roughness: 0.35 });
    for (let f = 0; f < 8; f++) for (let r = 0; r < 8; r++) {
      const sq = FILES[f] + (r + 1), p = sqPos(sq);
      const t = mk(tileG, (f + r) % 2 ? light : dark, p[0], 0, p[2]); t.userData.sq = sq; this.tiles[sq] = t;
    }
    // Letters and numbers around the board
    const lab = (txt, x, z) => {
      const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
      g.fillStyle = '#3a2600'; g.font = 'bold 44px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, 32, 34);
      const m = new T.Mesh(new T.PlaneGeometry(0.3, 0.3), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), transparent: true }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, -0.015, z); S.add(m); return m;
    };
    this.labels = [];
    for (let i = 0; i < 8; i++) {
      this.labels.push(lab(FILES[i], i - 3.5, 4.64), lab(FILES[i], i - 3.5, -4.64));
      this.labels.push(lab(String(i + 1), -4.64, 3.5 - i), lab(String(i + 1), 4.64, 3.5 - i));
    }
    this.WHITE = M('#f4efe6', { roughness: 0.3 }); this.BLACK = M('#2b1d55', { roughness: 0.25, metalness: 0.25 });
    this.dotG = new T.CylinderGeometry(0.14, 0.14, 0.04, 20);
    this.ringG = new T.TorusGeometry(0.4, 0.05, 8, 32); this.ringG.rotateX(Math.PI / 2);
    this.dotM = M('#00e676', { emissive: '#00e676', emissiveIntensity: 0.8 });
    this.capM = M('#ff1744', { emissive: '#ff1744', emissiveIntensity: 0.9 });
    this.selM = M('#ffc21a', { emissive: '#ffb300', emissiveIntensity: 1 });
    const hl = new T.PlaneGeometry(0.98, 0.98); hl.rotateX(-Math.PI / 2);
    const hlM = new T.MeshBasicMaterial({ color: '#ffd54a', transparent: true, opacity: 0.45, depthWrite: false });
    this.lastA = new T.Mesh(hl, hlM); this.lastB = new T.Mesh(hl, hlM);
    [this.lastA, this.lastB].forEach(m => { m.visible = false; S.add(m); });
    this.checkRing = new T.Mesh(new T.TorusGeometry(0.42, 0.07, 8, 32), M('#ff1744', { emissive: '#ff1744', emissiveIntensity: 1.2 }));
    this.checkRing.geometry.rotateX(Math.PI / 2); this.checkRing.visible = false; S.add(this.checkRing);
  }

  piece(type, color) {
    const g = new T.Group(), m = color === 'w' ? this.WHITE : this.BLACK, acc = this.gold;
    const lathe = pts => new T.LatheGeometry(pts.map(p => new T.Vector2(p[0], p[1])), 28);
    const BASE = [[0, 0], [0.34, 0], [0.34, 0.07], [0.3, 0.1], [0.24, 0.13]];
    const add = (geo, mat, y, x, z) => this.mk(geo, mat || m, x || 0, y || 0, z || 0, g);
    if (type === 'p') { add(lathe(BASE.concat([[0.13, 0.32], [0.1, 0.42], [0.18, 0.46], [0.09, 0.5]]))); add(new T.SphereGeometry(0.15, 20, 16), m, 0.62); }
    if (type === 'r') { add(lathe(BASE.concat([[0.2, 0.2], [0.19, 0.62], [0.26, 0.66], [0.26, 0.82], [0, 0.82]]))); for (let i = 0; i < 4; i++) { const b = add(new T.BoxGeometry(0.11, 0.1, 0.11), m, 0.87, Math.cos(i * Math.PI / 2) * 0.18, Math.sin(i * Math.PI / 2) * 0.18); b.rotation.y = i * Math.PI / 2; } }
    if (type === 'b') { add(lathe(BASE.concat([[0.16, 0.3], [0.11, 0.55], [0.2, 0.6], [0.1, 0.65]]))); const h = add(new T.SphereGeometry(0.17, 20, 16), m, 0.8); h.scale.set(0.85, 1.25, 0.85); add(new T.SphereGeometry(0.05, 10, 8), acc, 1.03); }
    if (type === 'q') { add(lathe(BASE.concat([[0.17, 0.35], [0.12, 0.75], [0.24, 0.82], [0.14, 0.9]]))); add(new T.TorusGeometry(0.17, 0.04, 8, 24), acc, 0.98).rotation.x = Math.PI / 2; for (let i = 0; i < 8; i++) add(new T.SphereGeometry(0.045, 8, 6), acc, 1.04, Math.cos(i * Math.PI / 4) * 0.17, Math.sin(i * Math.PI / 4) * 0.17); add(new T.SphereGeometry(0.08, 12, 10), acc, 1.1); }
    if (type === 'k') { add(lathe(BASE.concat([[0.18, 0.35], [0.13, 0.8], [0.25, 0.88], [0.15, 0.98], [0, 1.0]]))); add(new T.BoxGeometry(0.07, 0.26, 0.07), acc, 1.12); add(new T.BoxGeometry(0.2, 0.07, 0.07), acc, 1.15); }
    if (type === 'n') {
      add(lathe(BASE.concat([[0.2, 0.22], [0, 0.24]])));
      const s = new T.Shape();
      s.moveTo(-0.18, 0); s.lineTo(0.2, 0); s.lineTo(0.16, 0.3); s.quadraticCurveTo(0.12, 0.42, 0.24, 0.5); s.lineTo(0.3, 0.6); s.quadraticCurveTo(0.26, 0.72, 0.12, 0.74);
      s.lineTo(0.06, 0.86); s.lineTo(-0.02, 0.76); s.quadraticCurveTo(-0.22, 0.7, -0.22, 0.4); s.quadraticCurveTo(-0.24, 0.18, -0.18, 0);
      const geo = new T.ExtrudeGeometry(s, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 }); geo.translate(0, 0, -0.09);
      const h = add(geo, m, 0.22); h.rotation.y = color === 'w' ? -Math.PI / 2 : Math.PI / 2;
    }
    g.scale.setScalar(0.95); g.userData = { type, color };
    g.traverse(o => { if (o.isMesh) o.userData.owner = g; });
    this.S.add(g); return g;
  }

  // Put every piece where the position (FEN) says.
  setPosition(fen) {
    Object.values(this.pieces).forEach(p => this.S.remove(p));
    this.pieces = {};
    const rows = fen.split(' ')[0].split('/');
    rows.forEach((row, ri) => {
      let fi = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { fi += +ch; continue; }
        const sq = FILES[fi] + (8 - ri), p = sqPos(sq);
        const g = this.piece(ch.toLowerCase(), ch === ch.toUpperCase() ? 'w' : 'b');
        g.position.set(p[0], 0.06, p[2]); this.pieces[sq] = g; fi++;
      }
    });
  }

  setLast(last) {
    if (!last) { this.lastA.visible = this.lastB.visible = false; return; }
    const a = sqPos(last.from), b = sqPos(last.to);
    this.lastA.position.set(a[0], 0.065, a[2]); this.lastB.position.set(b[0], 0.065, b[2]);
    this.lastA.visible = this.lastB.visible = true;
  }
  setCheck(sq) {
    if (!sq) { this.checkRing.visible = false; return; }
    const p = sqPos(sq); this.checkRing.position.set(p[0], 0.1, p[2]); this.checkRing.visible = true;
  }

  clearMarks() { this.marks.forEach(m => this.S.remove(m)); this.marks = []; this.sel = null; }
  // Selected piece gets a gold ring. moves (optional) shows where it can go.
  select(sq, moves) {
    this.clearMarks(); this.sel = sq;
    const p = sqPos(sq); this.marks.push(this.mk(this.ringG, this.selM, p[0], 0.1, p[2]));
    (moves || []).forEach(mv => {
      const q = sqPos(mv.to);
      this.marks.push(mv.captured ? this.mk(this.ringG, this.capM, q[0], 0.1, q[2]) : this.mk(this.dotG, this.dotM, q[0], 0.08, q[2]));
    });
  }

  tween(d, fn) { return new Promise(r => this.tweens.push({ t: 0, d, fn, r })); }
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  // Animate a chess.js move, then the board matches the new position.
  async animate(mv, fen, sfx) {
    this.clearMarks();
    const g = this.pieces[mv.from];
    if (!g) { this.setPosition(fen); return; }
    const a = sqPos(mv.from), b = sqPos(mv.to);
    let capSq = mv.captured ? mv.to : null;
    if (mv.flags.includes('e')) capSq = mv.to[0] + mv.from[1];
    const jump = mv.piece === 'n' ? 0.9 : 0.15;
    if (sfx) sfx('hop');
    await this.tween(0.45, k => { const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; g.position.set(a[0] + (b[0] - a[0]) * e, 0.06 + Math.sin(k * Math.PI) * jump, a[2] + (b[2] - a[2]) * e); });
    if (capSq && this.pieces[capSq] && this.pieces[capSq] !== g) {
      const v = this.pieces[capSq]; if (sfx) sfx('capture');
      this.tween(0.6, k => { v.position.y = 0.06 + Math.sin(k * Math.PI) * 2.2; v.rotation.x = k * 6; v.scale.setScalar(0.95 * (1 - k * 0.9)); }).then(() => this.S.remove(v));
      delete this.pieces[capSq];
    }
    delete this.pieces[mv.from]; this.pieces[mv.to] = g;
    if (mv.flags.includes('k') || mv.flags.includes('q')) {
      const rk = mv.color === 'w' ? '1' : '8', rf = mv.flags.includes('k') ? ['h', 'f'] : ['a', 'd'];
      const rg = this.pieces[rf[0] + rk], ra = sqPos(rf[0] + rk), rb = sqPos(rf[1] + rk);
      if (rg) await this.tween(0.3, k => { rg.position.x = ra[0] + (rb[0] - ra[0]) * k; rg.position.y = 0.06 + Math.sin(k * Math.PI) * 0.2; });
    }
    await this.wait(capSq ? 250 : 30);
    this.setPosition(fen);
  }

  step(dt) {
    this.time += dt;
    for (let i = this.tweens.length - 1; i >= 0; i--) { const t = this.tweens[i]; t.t += dt / t.d; const k = Math.min(1, t.t); t.fn(k); if (k >= 1) { this.tweens.splice(i, 1); t.r(); } }
    if (this.thTarget != null) {
      const d = this.thTarget - this.th;
      if (Math.abs(d) < 0.01) { this.th = this.thTarget; this.thTarget = null; } else this.th += d * Math.min(1, dt * 4);
      this.updCam();
    }
    this.marks.forEach((m, i) => { if (m.geometry === this.ringG) m.scale.setScalar(1 + Math.sin(this.time * 6) * 0.06); else m.position.y = 0.08 + Math.abs(Math.sin(this.time * 4 + i)) * 0.05; });
    if (this.checkRing.visible) this.checkRing.scale.setScalar(1 + Math.sin(this.time * 8) * 0.08);
    if (this.sel && this.pieces[this.sel] && !this.tweens.length) this.pieces[this.sel].position.y = 0.06 + Math.abs(Math.sin(this.time * 5)) * 0.12;
  }

  controls() {
    const c = this.canvas, ray = new T.Raycaster(), ptr = new Map();
    let ld = 0, moved = 0;
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    const tap = e => {
      if (!this.onTap) return;
      const r = c.getBoundingClientRect(), m = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(m, this.cam);
      const hit = ray.intersectObjects(Object.values(this.pieces).concat(Object.values(this.tiles)), true)[0];
      if (!hit) return;
      let sq = hit.object.userData.sq;
      if (!sq) { const own = hit.object.userData.owner; sq = Object.keys(this.pieces).find(k => this.pieces[k] === own); }
      if (sq) this.onTap(sq);
    };
    c.addEventListener('pointerdown', e => { ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { c.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ } moved = 0; });
    c.addEventListener('pointermove', e => {
      if (!ptr.has(e.pointerId)) return;
      const pv = ptr.get(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved += Math.abs(e.clientX - pv.x) + Math.abs(e.clientY - pv.y);
      if (ptr.size === 1) { this.thTarget = null; this.th -= (e.clientX - pv.x) * 0.008; this.ph = cl(this.ph - (e.clientY - pv.y) * 0.006, 0.2, 1.15); }
      else { const q = [...ptr.values()], d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y); if (ld) this.rad = cl(this.rad * ld / d, 7, this.fitRad * 1.3); ld = d; }
      this.updCam();
    });
    const up = e => { const one = ptr.size === 1; ptr.delete(e.pointerId); ld = 0; if (one && moved < 10 && e.type === 'pointerup') tap(e); };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }
}

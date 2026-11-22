// 3D Carrom board: coins, striker, aim arrows and the shot animation.
import { RC, RS, PR, POCKETS, BASE, STEP, physStep, resting, bodies, firstHit } from './carrom.js';

const T = window.THREE;
const W = 10;
const wx = x => (x - 0.5) * W, wz = y => (y - 0.5) * W;

export class Carrom3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.R = new T.WebGLRenderer({ canvas, antialias: true });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; this.lostAt = Date.now(); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; });
    this.R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.R.shadowMap.enabled = true; this.R.shadowMap.type = T.PCFSoftShadowMap;
    this.S = new T.Scene(); this.S.background = new T.Color('#120a33');
    this.cam = new T.PerspectiveCamera(40, 1, 0.5, 100);
    this.side = 0; this.th = 0; this.thTarget = null; this.ph = 0.58; this.zoom = 1; this.camGoal = null; this.tweens = []; this.paused = true; this.time = 0;
    this.meshes = {}; this.anim = null;
    this.build(); this.resize();
    window.addEventListener('resize', () => this.resize());
    let last = performance.now();
    const loop = n => {
      const dt = Math.min(0.05, (n - last) / 1000); last = n;
      if (this.dead && !this.anim) return;
      this.step(dt);
      if (!this.dead && !this.paused && !this.lost) { try { this.R.render(this.S, this.cam); } catch (e) { /* context gone */ } }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  // Board theme from the shop: [sky, floor].
  setTheme(t) { if (!t) return; this.S.background = new T.Color(t[0]); if (this.S.fog) this.S.fog.color.set(t[0]); }

  destroy() { this.dead = true; try { this.R.dispose(); this.R.forceContextLoss(); } catch (e) { /* ignore */ } }

  M(c, o) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.45, metalness: 0.05 }, o || {})); }

  boardTexture() {
    const cv = document.createElement('canvas'); cv.width = cv.height = 1024; const g = cv.getContext('2d'), k = 1024;
    const gr = g.createRadialGradient(512, 512, 100, 512, 512, 720); gr.addColorStop(0, '#f8e2b0'); gr.addColorStop(1, '#e7c27f'); g.fillStyle = gr; g.fillRect(0, 0, k, k);
    g.globalAlpha = 0.07; for (let i = 0; i < 140; i++) { g.strokeStyle = i % 2 ? '#8a5a1c' : '#fff'; g.lineWidth = 1 + Math.random() * 2; g.beginPath(); g.moveTo(0, Math.random() * k); g.bezierCurveTo(300, Math.random() * k, 700, Math.random() * k, k, Math.random() * k); g.stroke(); } g.globalAlpha = 1;
    const base = (y1, y2, vert) => {
      g.strokeStyle = '#2b1606'; g.lineWidth = 4;
      [y1, y2].forEach(y => { g.beginPath(); if (vert) { g.moveTo(y * k, 0.24 * k); g.lineTo(y * k, 0.76 * k); } else { g.moveTo(0.24 * k, y * k); g.lineTo(0.76 * k, y * k); } g.stroke(); });
      [0.24, 0.76].forEach(e => { const cx = vert ? (y1 + y2) / 2 * k : e * k, cy = vert ? e * k : (y1 + y2) / 2 * k; g.fillStyle = '#d0142c'; g.beginPath(); g.arc(cx, cy, (y2 - y1) * k / 2 + 3, 0, 7); g.fill(); g.strokeStyle = '#2b1606'; g.lineWidth = 3; g.stroke(); });
    };
    base(0.815, 0.855); base(0.145, 0.185); base(0.145, 0.185, true); base(0.815, 0.855, true);
    g.strokeStyle = '#2b1606'; g.lineWidth = 4; g.beginPath(); g.arc(512, 512, 0.15 * k, 0, 7); g.stroke();
    g.strokeStyle = '#d0142c'; g.lineWidth = 6; g.beginPath(); g.arc(512, 512, 0.135 * k, 0, 7); g.stroke();
    g.fillStyle = '#d0142c'; g.beginPath(); for (let i = 0; i < 16; i++) { const a = i * Math.PI / 8, r = i % 2 ? 0.05 * k : 0.12 * k; g.lineTo(512 + Math.cos(a) * r, 512 + Math.sin(a) * r); } g.closePath(); g.globalAlpha = 0.85; g.fill(); g.globalAlpha = 1;
    g.fillStyle = '#2b1606'; g.beginPath(); g.arc(512, 512, 0.026 * k, 0, 7); g.fill();
    g.strokeStyle = '#2b1606'; g.lineWidth = 4;
    [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(c => { const sx = c[0] ? -1 : 1, sy = c[1] ? -1 : 1, x0 = c[0] * k + sx * 0.1 * k, y0 = c[1] * k + sy * 0.1 * k; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0 + sx * 0.2 * k, y0 + sy * 0.2 * k); g.stroke(); g.beginPath(); g.arc(x0 + sx * 0.21 * k, y0 + sy * 0.21 * k, 0.03 * k, 0, 7); g.stroke(); });
    POCKETS.forEach(p => { g.fillStyle = '#120a06'; g.beginPath(); g.arc(p[0] * k, p[1] * k, PR * k, 0, 7); g.fill(); g.strokeStyle = '#c9a55a'; g.lineWidth = 5; g.stroke(); });
    const t = new T.CanvasTexture(cv); t.anisotropy = 8; return t;
  }
  coinTex(base, ring, dark) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128; const g = cv.getContext('2d');
    g.fillStyle = base; g.fillRect(0, 0, 128, 128);
    g.strokeStyle = ring; [44, 30, 14].forEach((r, i) => { g.lineWidth = i ? 4 : 6; g.beginPath(); g.arc(64, 64, r, 0, 7); g.stroke(); });
    // Dark rim so light coins stand out on the light board (seen from above).
    g.strokeStyle = dark ? 'rgba(255,255,255,.25)' : 'rgba(70,45,10,.75)'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.stroke();
    g.fillStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(48, 44, 22, 12, -0.6, 0, 7); g.fill();
    return new T.CanvasTexture(cv);
  }

  build() {
    const S = this.S, M = this.M.bind(this);
    S.add(new T.HemisphereLight('#ffffff', '#4a2aa0', 0.75));
    const L = new T.DirectionalLight('#ffffff', 0.9); L.position.set(4, 14, 6); L.castShadow = true; L.shadow.mapSize.set(1024, 1024);
    Object.assign(L.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7 }); L.shadow.bias = -0.0006; S.add(L);
    const side = M('#d9b36c');
    const top = new T.Mesh(new T.BoxGeometry(W, 0.3, W), [side, side, M('#ffffff', { map: this.boardTexture(), roughness: 0.35 }), side, side, side]);
    top.position.y = -0.15; top.receiveShadow = true; S.add(top);
    const wood = M('#5a2a10', { roughness: 0.35, metalness: 0.15 }), gold = M('#ffc21a', { metalness: 0.85, roughness: 0.25 });
    [[0, -W / 2 - 0.45, W + 1.8, 0.9], [0, W / 2 + 0.45, W + 1.8, 0.9]].forEach(f => { const m = new T.Mesh(new T.BoxGeometry(f[2], 0.55, f[3]), wood); m.position.set(f[0], 0.12, f[1]); m.castShadow = m.receiveShadow = true; S.add(m); });
    [[-W / 2 - 0.45, 0], [W / 2 + 0.45, 0]].forEach(f => { const m = new T.Mesh(new T.BoxGeometry(0.9, 0.55, W), wood); m.position.set(f[0], 0.12, f[1]); m.castShadow = m.receiveShadow = true; S.add(m); });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(c => { const m = new T.Mesh(new T.CylinderGeometry(0.22, 0.22, 0.1, 20), gold); m.position.set(c[0] * (W / 2 + 0.45), 0.42, c[1] * (W / 2 + 0.45)); S.add(m); });
    const fl = new T.Mesh(new T.CircleGeometry(40, 48), M('#24135e')); fl.rotation.x = -Math.PI / 2; fl.position.y = -1.2; fl.receiveShadow = true; S.add(fl);
    const leg = new T.Mesh(new T.CylinderGeometry(5, 6.2, 0.9, 40), M('#2a1270', { metalness: 0.3 })); leg.position.y = -0.75; S.add(leg);
    this.MAT = {
      white: [M('#e9dfc5'), M('#ffffff', { map: this.coinTex('#f6efdc', '#c9b98f') }), M('#e9dfc5')],
      black: [M('#151515'), M('#ffffff', { map: this.coinTex('#1f1f1f', '#4a4a4a', true), roughness: 0.3 }), M('#151515')],
      queen: [M('#b0101f'), M('#ffffff', { map: this.coinTex('#d9142e', '#ffb3bd'), roughness: 0.3 }), M('#b0101f')],
      eight: [M('#2a1058'), M('#ffffff', { map: this.coinTex('#3a1866', '#ffd34d', true), roughness: 0.3 }), M('#2a1058')],
      striker: [M('#e8e4ff'), M('#ffffff', { map: this.coinTex('#f4f2ff', '#3d5afe'), roughness: 0.25 }), M('#e8e4ff')]
    };
    this.coinG = new T.CylinderGeometry(RC * W, RC * W, 0.17, 36);
    this.strikerG = new T.CylinderGeometry(RS * W, RS * W, 0.2, 40);
    this.striker = new T.Mesh(this.strikerG, this.MAT.striker); this.striker.castShadow = true; S.add(this.striker);
    // Aim pieces
    const arrowShape = (len, w) => { const s = new T.Shape(); s.moveTo(-w / 2, 0); s.lineTo(-w / 2, len - w * 1.6); s.lineTo(-w * 1.3, len - w * 1.6); s.lineTo(0, len); s.lineTo(w * 1.3, len - w * 1.6); s.lineTo(w / 2, len - w * 1.6); s.lineTo(w / 2, 0); s.closePath(); const g = new T.ShapeGeometry(s); g.rotateX(-Math.PI / 2); g.rotateY(Math.PI); return g; };
    this.arrowMat = new T.MeshBasicMaterial({ color: '#00e676', transparent: true, opacity: 0.95, depthWrite: false });
    this.aimArrow = new T.Mesh(arrowShape(1, 0.24), this.arrowMat); this.aimArrow.renderOrder = 5; S.add(this.aimArrow);
    this.coinArrow = new T.Mesh(arrowShape(1, 0.2), new T.MeshBasicMaterial({ color: '#ffd600', transparent: true, depthWrite: false })); this.coinArrow.renderOrder = 5; S.add(this.coinArrow);
    const dash = c => { const g = new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]); const l = new T.Line(g, new T.LineDashedMaterial({ color: c, dashSize: 0.2, gapSize: 0.11, transparent: true, opacity: 0.9 })); S.add(l); return l; };
    this.pathLine = dash('#ffffff'); this.coinLine = dash('#ffd600');
    this.ghost = new T.Mesh(new T.RingGeometry(RS * W - 0.05, RS * W, 32), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8, side: 2 })); this.ghost.rotation.x = -Math.PI / 2; S.add(this.ghost);
    this.targetRing = new T.Mesh(new T.RingGeometry(RC * W + 0.05, RC * W + 0.15, 32), new T.MeshBasicMaterial({ color: '#ffd600', side: 2 })); this.targetRing.rotation.x = -Math.PI / 2; S.add(this.targetRing);
    this.hideAim();
    // The other player stands behind the far side of the board.
    this.far = new T.Sprite(new T.SpriteMaterial({ transparent: true, depthWrite: false })); this.far.center.set(0.5, 0); this.far.visible = false; S.add(this.far);
  }

  // Striker design: 0 blue, 1 gold, 2 ruby.
  setStrikerStyle(i) {
    const st = [['#f4f2ff', '#3d5afe', '#e8e4ff'], ['#ffe9a0', '#b87800', '#ffd34d'], ['#ffd6e2', '#e5196f', '#ff9ab8']][i] || null; if (!st || this.strikerStyle === i) return;
    this.strikerStyle = i;
    this.MAT.striker[1].map = this.coinTex(st[0], st[1]); this.MAT.striker[1].needsUpdate = true;
    this.MAT.striker[0].color.set(st[2]); this.MAT.striker[2].color.set(st[2]);
  }
  // Flat view: straight down on the board, like a table seen from above. Otherwise 3D.
  setFlat(on) {
    this.flat = !!on; this.camGoal = null; this.thTarget = null;
    this.th = this.side ? Math.PI : 0; this.ph = 0.58; this.zoom = 1;
    this.resize();
  }
  // Who stands at the far side (a cartoon character picture).
  setFar(src) {
    if (!src) { this.far.visible = false; this.farSrc = null; return; }
    if (this.farSrc === src) return; this.farSrc = src;
    new T.TextureLoader().load(src, t => { this.far.material.map = t; this.far.material.needsUpdate = true; const h = 3.2; this.far.scale.set(h * t.image.width / t.image.height, h, 1); this.far.visible = !this.flat; });
  }

  resize() {
    const w = this.canvas.clientWidth || 360, h = this.canvas.clientHeight || 640;
    this.R.setSize(w, h, false); this.cam.aspect = w / h;
    const half = Math.tan(this.cam.fov * Math.PI / 360) * Math.min(1, w / h);
    this.rad = Math.max(12, 6.9 / half);
    // Flat: the whole board with its wooden frame fills the width.
    this.flatH = ((W + 2) / 2) / half + 0.4;
    this.cam.updateProjectionMatrix(); this.updCam();
  }
  updCam() {
    if (this.flat) {
      // Up on the screen is the far side of the board.
      this.cam.up.set(-Math.sin(this.th), 0, -Math.cos(this.th));
      // Shift the board a little up the screen so the player cards don't cover it.
      const H = this.flatH * this.zoom, d = 0.085 * 2 * Math.tan(this.cam.fov * Math.PI / 360) * H;
      const ox = Math.sin(this.th) * d, oz = Math.cos(this.th) * d;
      this.cam.position.set(ox, H, oz); this.cam.lookAt(ox, 0, oz);
      this.far.visible = false; return;
    }
    this.cam.up.set(0, 1, 0);
    if (this.farSrc && this.far.material.map) this.far.visible = true;
    const ph = this.ph, r = this.rad * this.zoom;
    this.cam.position.set(r * Math.sin(ph) * Math.sin(this.th), r * Math.cos(ph), r * Math.sin(ph) * Math.cos(this.th));
    this.cam.lookAt(Math.sin(this.th) * 0.9, 0, Math.cos(this.th) * 0.9);
    const fz = -Math.cos(this.th) * (W / 2 + 1.4), fx = -Math.sin(this.th) * (W / 2 + 1.4);
    this.far.position.set(fx, -0.2, fz);
  }
  // side 0 = your base line at the bottom of the screen; 1 = the board turned around.
  view(side, smooth) {
    this.side = side; const t = side ? Math.PI : 0;
    if (!smooth) { this.th = t; this.thTarget = null; this.updCam(); return; }
    let d = t - this.th; d = Math.atan2(Math.sin(d), Math.cos(d)); this.thTarget = this.th + d;
  }
  // ---- Free camera (360°): turn, tilt and zoom with fingers ----
  // Turn by a (radians) and tilt by b (radians).
  orbit(a, b) {
    if (this.flat) return;
    this.thTarget = null; this.camGoal = null;
    this.th += a;
    this.ph = Math.min(1.12, Math.max(0.12, this.ph + b));
    this.updCam();
  }
  pinch(k) { this.camGoal = null; this.zoom = Math.min(1.45, Math.max(0.55, this.zoom / k)); this.updCam(); }
  // Back to the normal view of your side.
  resetView() {
    const t = this.side ? Math.PI : 0;
    let d = t - this.th; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.thTarget = this.th + d; this.camGoal = { ph: 0.58, zoom: 1 };
  }
  // Is the camera looking from the other side (so left and right are swapped on screen)?
  flipped() { return Math.cos(this.thTarget != null ? this.thTarget : this.th) < 0; }
  moved() { if (this.flat) return false; return Math.abs(Math.atan2(Math.sin(this.th - (this.side ? Math.PI : 0)), Math.cos(this.th - (this.side ? Math.PI : 0)))) > 0.05 || Math.abs(this.ph - 0.58) > 0.03 || Math.abs(this.zoom - 1) > 0.03; }

  // Show the coins where the game says they are.
  setCoins(coins) {
    const seen = {};
    coins.forEach(c => {
      seen[c.id] = 1;
      let m = this.meshes[c.id];
      if (!m) { m = new T.Mesh(this.coinG, this.MAT[c.kind]); m.castShadow = true; m.receiveShadow = true; this.S.add(m); this.meshes[c.id] = m; }
      m.visible = !c.in; m.scale.setScalar(1); m.position.set(wx(c.x), 0.085, wz(c.y));
    });
    Object.keys(this.meshes).forEach(k => { if (!seen[k]) { this.S.remove(this.meshes[k]); delete this.meshes[k]; } });
  }
  // The striker shrinks while it falls into a pocket (foul); always bring it back to full size.
  setStriker(x, y, show) { this.striker.visible = show !== false; this.striker.scale.setScalar(1); this.striker.position.set(wx(x), 0.1, wz(y)); this.strikerAt = { x, y }; }

  hideAim() { [this.aimArrow, this.coinArrow, this.pathLine, this.coinLine, this.ghost, this.targetRing].forEach(m => { m.visible = false; }); }
  // Arrow on the striker, and (with help) where the first coin it hits will go.
  showAim(coins, sx, sy, dx, dy, power, help) {
    this.hideAim(); const y = 0.215;
    this.aimArrow.visible = true; this.aimArrow.position.set(wx(sx), y, wz(sy));
    this.aimArrow.rotation.y = Math.atan2(dx, dy); this.aimArrow.scale.set(1, 1, 0.6 + power * 2.4);
    this.arrowMat.color.setHSL(0.33 - power * 0.33, 1, 0.5);
    if (!help) return;
    const h = firstHit(coins, sx, sy, dx, dy);
    const end = h ? [h.px, h.py] : [sx + dx * 1.2, sy + dy * 1.2];
    this.line(this.pathLine, sx, sy, end[0], end[1], y);
    if (!h) return;
    this.ghost.visible = true; this.ghost.position.set(wx(h.px), 0.21, wz(h.py));
    this.targetRing.visible = true; this.targetRing.position.set(wx(h.coin.x), 0.19, wz(h.coin.y));
    this.coinArrow.visible = true; this.coinArrow.position.set(wx(h.coin.x), 0.2, wz(h.coin.y)); this.coinArrow.rotation.y = Math.atan2(h.ux, h.uy); this.coinArrow.scale.set(1, 1, 1.3);
    // Where that coin travels: straight on to the edge of the board.
    let t = 9; [[(RC - h.coin.x) / h.ux, h.ux < 0], [(1 - RC - h.coin.x) / h.ux, h.ux > 0], [(RC - h.coin.y) / h.uy, h.uy < 0], [(1 - RC - h.coin.y) / h.uy, h.uy > 0]].forEach(a => { if (a[1] && a[0] > 0) t = Math.min(t, a[0]); });
    this.line(this.coinLine, h.coin.x, h.coin.y, h.coin.x + h.ux * t, h.coin.y + h.uy * t, 0.2);
  }
  line(l, x1, y1, x2, y2, y) { l.geometry.setFromPoints([new T.Vector3(wx(x1), y, wz(y1)), new T.Vector3(wx(x2), y, wz(y2))]); l.computeLineDistances(); l.visible = true; }

  // Play a shot on screen with the same physics the rules use. Resolves when everything stops.
  playShot(coins, shot, sfx) {
    this.hideAim();
    const list = bodies(coins, shot), byId = {};
    list.forEach(o => { byId[o.id] = o; });
    this.setStriker(shot.x, shot.y);
    if (sfx) sfx('click');
    return new Promise(res => { this.anim = { list, acc: 0, falling: [], res, sfx, steps: 0 }; });
  }
  stepAnim(dt) {
    const a = this.anim; a.acc += dt;
    let lastClick = 0;
    while (a.acc >= STEP) {
      a.acc -= STEP; a.steps++;
      physStep(a.list, STEP, o => { a.falling.push({ o, t: 0 }); if (a.sfx) a.sfx(o.id === 'S' ? 'capture' : 'pop'); }, v => { if (a.sfx && a.steps - lastClick > 8) { lastClick = a.steps; a.sfx('hop'); } void v; });
    }
    a.list.forEach(o => { const m = o.id === 'S' ? this.striker : this.meshes[o.id]; if (m) m.position.set(wx(o.x), o.id === 'S' ? 0.1 : 0.085, wz(o.y)); });
    a.falling.forEach(f => { f.t = Math.min(1, f.t + dt * 3); const m = f.o.id === 'S' ? this.striker : this.meshes[f.o.id]; if (m) { m.position.set(wx(f.o.px), 0.085 - f.t * 0.6, wz(f.o.py)); m.scale.setScalar(1 - f.t * 0.5); if (f.t >= 1) m.visible = false; } });
    if ((resting(a.list) && a.falling.every(f => f.t >= 1)) || a.steps > 240 * 14) { this.anim = null; a.res(); }
  }

  step(dt) {
    this.time += dt;
    if (this.anim) this.stepAnim(dt);
    if (this.thTarget != null) { const d = this.thTarget - this.th; if (Math.abs(d) < 0.01) { this.th = this.thTarget; this.thTarget = null; } else this.th += d * Math.min(1, dt * 4); this.updCam(); }
    if (this.camGoal) {
      const g = this.camGoal, k = Math.min(1, dt * 5);
      this.ph += (g.ph - this.ph) * k; this.zoom += (g.zoom - this.zoom) * k;
      if (Math.abs(g.ph - this.ph) < 0.003 && Math.abs(g.zoom - this.zoom) < 0.003) { this.ph = g.ph; this.zoom = g.zoom; this.camGoal = null; }
      this.updCam();
    }
    if (this.targetRing.visible) this.targetRing.scale.setScalar(1 + Math.sin(this.time * 7) * 0.08);
    if (this.bob && !this.anim && this.striker.visible && !this.aimArrow.visible) this.striker.position.y = 0.1 + Math.abs(Math.sin(this.time * 4)) * 0.08;
  }

  // Where a finger touches the board, in board units (0..1).
  boardPoint(e) {
    const r = this.canvas.getBoundingClientRect(), ray = new T.Raycaster();
    ray.setFromCamera(new T.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.cam);
    const p = new T.Vector3(); if (!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), -0.2), p)) return null;
    return { x: p.x / W + 0.5, y: p.z / W + 0.5 };
  }
}
export { BASE };

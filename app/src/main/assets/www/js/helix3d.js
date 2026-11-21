// Helix Drop in 3D: a tower of round platforms, a bouncing ball, swipe to turn the tower.
import { SLICES } from './helix.js';
const T = window.THREE;
const GAP = 3.2, R_OUT = 2.3, R_POLE = 0.62, THICK = 0.36, BALL_R = 0.27, BALL_AT = 1.5;
const G_ACC = -30, BOUNCE = 10.2;
const SL = Math.PI * 2 / SLICES;

export class Helix3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.R = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.R.setClearColor(0x000000, 0);
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); this.lost = true; this.lostAt = Date.now(); });
    canvas.addEventListener('webglcontextrestored', () => { this.lost = false; });
    this.R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.S = new T.Scene();
    this.cam = new T.PerspectiveCamera(50, 1, 0.1, 300);
    this.S.add(new T.HemisphereLight('#ffffff', '#6a2a8a', 0.85));
    const L = new T.DirectionalLight('#ffffff', 0.75); L.position.set(3, 8, 6); this.S.add(L);
    this.paused = true; this.rot = 0; this.anims = [];
    this.on = () => {};
    this.resize(); window.addEventListener('resize', () => this.resize());
    this.hookInput();
    let last = performance.now();
    const loop = n => {
      const dt = Math.min(0.033, (n - last) / 1000); last = n;
      if (this.dead) return;
      if (!this.paused) { this.step(dt); if (!this.lost) { try { this.R.render(this.S, this.cam); } catch (e) { /* gone */ } } }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }
  destroy() { this.dead = true; try { this.R.dispose(); this.R.forceContextLoss(); } catch (e) { /* ignore */ } }
  resize() {
    const w = this.canvas.clientWidth || 360, h = this.canvas.clientHeight || 640;
    this.R.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix();
    // Far enough back that the whole width of a platform (plus a little) fits on screen.
    const halfH = Math.tan(this.cam.fov * Math.PI / 360) * Math.min(1, w / h);
    this.dist = Math.max(9, (R_OUT + 0.9) / halfH);
    if (this.ball) this.updCam(1);
  }
  M(c, o) { return new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5, metalness: 0.05 }, o || {})); }

  // Build a tower from a level (see helix.js).
  load(tower) {
    if (this.tower) this.S.remove(this.tower);
    this.anims = [];
    this.data = tower;
    const g = this.tower = new T.Group(); this.S.add(g);
    const hue = tower.hue / 360;
    const safe = this.M(new T.Color().setHSL(hue, 0.75, 0.8)), danger = this.M('#e5196f', { emissive: '#5a0024', roughness: 0.35 });
    const gold = this.M('#ffd34d', { metalness: 0.6, roughness: 0.3, emissive: '#4a2f00' });
    const pole = new T.Mesh(new T.CylinderGeometry(R_POLE, R_POLE, (tower.plats.length + 3) * GAP, 28), this.M('#fff4e6', { roughness: 0.6 }));
    pole.position.y = -(tower.plats.length - 1) * GAP / 2; g.add(pole);
    const geo = new T.CylinderGeometry(R_OUT, R_OUT, THICK, 8, 1, false, 0, SL * 0.985);
    this.plats = tower.plats.map((p, i) => {
      const pg = new T.Group(); pg.position.y = -i * GAP; pg.rotation.y = p.turn; g.add(pg);
      const slices = p.s.map((k, j) => {
        if (!k) return null;
        const m = new T.Mesh(geo, k === 2 ? danger : k === 3 ? gold : safe);
        m.rotation.y = j * SL; pg.add(m); return m;
      });
      return { g: pg, slices, s: p.s, finish: !!p.finish, broken: false };
    });
    if (!this.ball) {
      this.ball = new T.Mesh(new T.SphereGeometry(BALL_R, 24, 18), this.M('#ff2f6d', { roughness: 0.25, emissive: '#5a0020' }));
      this.S.add(this.ball);
      this.shadow = new T.Mesh(new T.CircleGeometry(BALL_R * 0.9, 20), new T.MeshBasicMaterial({ color: '#2a0a3a', transparent: true, opacity: 0.25, depthWrite: false }));
      this.shadow.rotation.x = -Math.PI / 2; this.S.add(this.shadow);
    }
    this.reset();
  }
  reset() {
    this.rot = 0; this.tower.rotation.y = 0;
    this.by = THICK / 2 + BALL_R + 1.6; this.vy = 0;
    this.next = 0; this.combo = 0; this.passed = 0; this.state = 'ready';
    this.ball.visible = true; this.ball.scale.setScalar(1); this.ball.material.color.set('#ff2f6d');
    this.camY = this.by;
    this.ball.position.set(0, this.by, BALL_AT);
    this.plats.forEach(p => { p.broken = false; p.g.visible = true; p.slices.forEach(m => { if (m) { m.position.set(0, 0, 0); m.visible = true; m.material.opacity = 1; } }); });
    this.anims.forEach(a => a.m && a.m.parent && a.m.parent.remove(a.m)); this.anims = [];
    this.splats && this.splats.forEach(s => s.parent && s.parent.remove(s)); this.splats = [];
    this.updCam(1);
  }
  start() { if (this.state === 'ready') { this.state = 'play'; this.vy = 0; } }
  updCam(k) {
    // The camera only goes down, following the ball, looking down on the platforms from above.
    const target = this.by;
    if (target < this.camY) this.camY += (target - this.camY) * Math.min(1, k);
    const d = this.dist || 12;
    this.cam.position.set(0, this.camY + d * 0.62, d * 0.85);
    this.cam.lookAt(0, this.camY - 2.4, 0);
  }
  // Which slice of platform i is under the ball right now?
  sliceUnder(i) {
    const p = this.plats[i];
    let a = (-(this.rot + p.g.rotation.y)) % (Math.PI * 2); if (a < 0) a += Math.PI * 2;
    return Math.floor(a / SL) % SLICES;
  }
  breakPlatform(i, out) {
    const p = this.plats[i]; if (p.broken) return; p.broken = true;
    p.slices.forEach((m, j) => {
      if (!m) return;
      const a = (j + 0.5) * SL + p.g.rotation.y + this.rot;
      m.material = m.material.clone(); m.material.transparent = true;
      this.anims.push({ m, vx: Math.sin(a) * (3 + Math.random() * 2), vz: Math.cos(a) * (3 + Math.random() * 2), vy: 2 + Math.random() * 2 + (out || 0), t: 0 });
    });
  }
  splat(i) {
    const p = this.plats[i];
    const s = new T.Mesh(new T.CircleGeometry(0.32 + Math.random() * 0.1, 14), new T.MeshBasicMaterial({ color: '#ff2f6d', transparent: true, opacity: 0.85, depthWrite: false }));
    s.rotation.x = -Math.PI / 2;
    const a = -(this.rot + p.g.rotation.y);
    s.position.set(Math.sin(a) * BALL_AT, THICK / 2 + 0.01, Math.cos(a) * BALL_AT);
    s.rotation.z = Math.random() * 6;
    p.g.add(s); this.splats.push(s);
    if (this.splats.length > 24) { const o = this.splats.shift(); o.parent && o.parent.remove(o); }
  }
  step(dt) {
    // Flying pieces
    this.anims = this.anims.filter(a => {
      a.t += dt; a.vy -= 12 * dt;
      a.m.position.x += a.vx * dt; a.m.position.z += a.vz * dt; a.m.position.y += a.vy * dt;
      if (a.m.material.opacity != null) a.m.material.opacity = Math.max(0, 1 - a.t * 1.4);
      if (a.t > 0.8) { a.m.visible = false; return false; }
      return true;
    });
    this.tower.rotation.y = this.rot;
    if (this.state === 'play') {
      this.vy += G_ACC * dt; this.by += this.vy * dt;
      const i = this.next, p = this.plats[i];
      if (p && this.vy < 0 && this.by - BALL_R <= p.g.position.y + THICK / 2) {
        const k = p.broken ? 0 : p.s[this.sliceUnder(i)];
        if (k === 0) {
          // Through the gap.
          this.breakPlatform(i); this.next++; this.passed++; this.combo++;
          this.on('pass', { combo: this.combo, passed: this.passed });
        } else if (p.finish) {
          this.by = p.g.position.y + THICK / 2 + BALL_R; this.vy = 0; this.state = 'won';
          this.on('win', {});
        } else if (this.combo >= 3) {
          // Falling fast: smash through anything, red too.
          this.breakPlatform(i, 3); this.next++; this.passed++;
          this.by = p.g.position.y + THICK / 2 + BALL_R; this.vy = BOUNCE * 0.85;
          this.on('smash', { combo: this.combo, passed: this.passed }); this.combo = 0;
        } else if (k === 2) {
          this.by = p.g.position.y + THICK / 2 + BALL_R; this.state = 'dead';
          this.shatter(); this.on('die', {});
        } else {
          this.by = p.g.position.y + THICK / 2 + BALL_R; this.vy = BOUNCE;
          if (this.combo) this.combo = 0;
          this.splat(i); this.on('bounce', {});
        }
      }
    }
    // Squash a little on the bounce
    const sq = this.state === 'play' && this.vy > BOUNCE * 0.8 ? 0.82 : 1;
    this.ball.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
    if (this.state !== 'dead') this.ball.position.set(0, this.by, BALL_AT);
    const below = this.plats[this.next];
    if (below && this.ball.visible) { this.shadow.visible = true; this.shadow.position.set(0, below.g.position.y + THICK / 2 + 0.02, BALL_AT); this.shadow.scale.setScalar(Math.max(0.4, 1 - (this.by - below.g.position.y) / 6)); } else this.shadow.visible = false;
    this.ball.material.color.set(this.combo >= 3 ? '#ffb31a' : '#ff2f6d');
    this.updCam(dt * 6);
  }
  shatter() {
    this.ball.visible = false;
    for (let k = 0; k < 10; k++) {
      const m = new T.Mesh(new T.SphereGeometry(0.08 + Math.random() * 0.06, 8, 6), new T.MeshBasicMaterial({ color: '#ff2f6d', transparent: true }));
      m.position.copy(this.ball.position); this.S.add(m);
      const a = Math.random() * Math.PI * 2;
      this.anims.push({ m, vx: Math.cos(a) * 3, vz: Math.sin(a) * 3, vy: 3 + Math.random() * 3, t: 0 });
    }
  }
  hookInput() {
    const c = this.canvas; let down = null;
    c.addEventListener('pointerdown', e => { down = { x: e.clientX }; try { c.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } if (this.state === 'ready') { this.start(); this.on('start', {}); } });
    c.addEventListener('pointermove', e => { if (!down || this.state !== 'play') return; this.rot += (e.clientX - down.x) * 0.012; down.x = e.clientX; });
    const up = () => { down = null; };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
  }
}

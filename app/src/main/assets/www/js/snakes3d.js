// 3D Snakes & Ladders board. Uses the same characters, dice and effects as the Ludo board.
import { Board3D, TEAM } from './board3d.js';
import { LADDERS, SNAKES, walkPath } from './snakes.js';

const T = window.THREE;
const SQ = 1.45; // size of one square
const COLS = ['#ff3b5c', '#ffcf2e', '#22c55e', '#3d8bff', '#ff8c1a', '#a855f7'];
const START = [[-1.9, 0], [-0.65, 0], [0.65, 0], [1.9, 0]];

// Centre of a square (1..100) on the board. Row 1 is at the front, numbers snake back and forth.
export function sqXZ(n) {
  const row = Math.floor((n - 1) / 10), c = (n - 1) % 10, col = row % 2 ? 9 - c : c;
  return [(col - 4.5) * SQ, (4.5 - row) * SQ];
}

export class SnakeBoard3D extends Board3D {
  get perColor() { return 1; }

  buildBoard() {
    const S = this.S, mk = this.mk.bind(this), M = this.mat.bind(this);
    this.fitW = 8.9;
    this.startZ = 5 * SQ + 1.55;
    // Board base and gold frame (frame top above the squares so nothing shares a surface)
    mk(this.ext(this.rr(15.4, 15.4, 0.6), 0.5, 0.1), M('#3b1d8f', { roughness: 0.3 }), 0, -0.62, 0);
    mk(this.ext(this.frame(16.6, 15.0, 1.0, 0.5), 0.55, 0.1), this.gold, 0, -0.55, 0);
    mk(new T.CylinderGeometry(7.5, 8.6, 0.7, 48), M('#2a1270', { metalness: 0.3 }), 0, -1.1, 0);
    // Start pad in front of square 1
    mk(this.ext(this.rr(5.6, 1.6, 0.5), 0.3, 0.08), M('#ff3b5c', { emissive: '#ff3b5c', emissiveIntensity: 0.15 }), -3.6, -0.3, this.startZ);
    this.startX = -3.6;

    // Squares with numbers, painted once on a picture
    const cv = document.createElement('canvas'); cv.width = cv.height = 1024;
    const g = cv.getContext('2d'), cs = 102.4;
    for (let n = 1; n <= 100; n++) {
      const row = Math.floor((n - 1) / 10), c = (n - 1) % 10, col = row % 2 ? 9 - c : c;
      const x = col * cs, y = (9 - row) * cs;
      g.fillStyle = COLS[(row + col) % COLS.length]; g.fillRect(x, y, cs, cs);
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 4, y + 4, cs - 8, cs * 0.42);
      g.strokeStyle = 'rgba(20,10,60,.35)'; g.lineWidth = 3; g.strokeRect(x + 1.5, y + 1.5, cs - 3, cs - 3);
      g.font = `900 ${n === 100 ? 34 : 38}px "Baloo 2", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 7; g.strokeStyle = '#1a0f4a'; g.strokeText(String(n), x + cs / 2, y + cs / 2 + 3);
      g.fillStyle = '#ffffff'; g.fillText(String(n), x + cs / 2, y + cs / 2 + 3);
    }
    const tex = new T.CanvasTexture(cv); tex.anisotropy = 4;
    const top = new T.Mesh(new T.PlaneGeometry(10 * SQ, 10 * SQ), M('#ffffff', { map: tex, roughness: 0.45 }));
    top.rotation.x = -Math.PI / 2; top.position.y = 0.0; top.receiveShadow = true; S.add(top);
    // Crown on 100
    const c100 = sqXZ(100);
    mk(new T.TorusGeometry(0.42, 0.06, 8, 30), this.gold, c100[0], 0.06, c100[1]).rotation.x = Math.PI / 2;

    this.ladders = {}; this.snakes = {};
    Object.keys(LADDERS).forEach(a => { this.ladders[a] = this.ladder(+a, LADDERS[a]); });
    Object.keys(SNAKES).forEach((h, i) => { this.snakes[h] = this.snake(+h, SNAKES[h], i); });
  }

  // A ladder from square a up to square b. Returns the points to climb along.
  ladder(a, b) {
    const A = sqXZ(a), B = sqXZ(b);
    const dx = B[0] - A[0], dz = B[1] - A[1], L = Math.hypot(dx, dz), px = -dz / L * 0.32, pz = dx / L * 0.32;
    const at = (t, side) => new T.Vector3(A[0] + dx * t + px * side, 0.22 + Math.sin(t * Math.PI) * 0.9, A[1] + dz * t + pz * side);
    const rail = this.mat('#ffb300', { metalness: 0.6, roughness: 0.3 }), rung = this.mat('#8d4a17', { roughness: 0.5 });
    [-1, 1].forEach(side => {
      const pts = []; for (let i = 0; i <= 16; i++) pts.push(at(i / 16, side));
      this.S.add(new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 48, 0.075, 8), rail));
    });
    const n = Math.max(3, Math.round(L / 0.5));
    const rg = new T.CylinderGeometry(0.05, 0.05, 0.64, 8);
    for (let i = 1; i < n; i++) {
      const t = i / n, l = at(t, -1), r = at(t, 1), m = new T.Mesh(rg, rung);
      m.position.copy(l).add(r).multiplyScalar(0.5);
      m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), r.clone().sub(l).normalize());
      this.S.add(m);
    }
    const climb = []; for (let i = 0; i <= 20; i++) { const p = at(i / 20, 0); climb.push([p.x, p.z, p.y + 0.12]); }
    return climb;
  }

  // A cartoon snake from its head (square h) down to its tail (square t).
  snake(h, t, k) {
    const H = sqXZ(h), Tl = sqXZ(t);
    const dx = Tl[0] - H[0], dz = Tl[1] - H[1], L = Math.hypot(dx, dz), px = -dz / L, pz = dx / L;
    const waves = Math.max(1.5, L / 3.2), amp = Math.min(0.75, 0.25 + L * 0.06);
    const pts = [];
    for (let i = 0; i <= 24; i++) { const u = i / 24, o = Math.sin(u * Math.PI * waves) * amp * (1 - u * 0.4); pts.push(new T.Vector3(H[0] + dx * u + px * o, 0.2, H[1] + dz * u + pz * o)); }
    const curve = new T.CatmullRomCurve3(pts);
    const pal = [['#16a34a', '#facc15'], ['#dc2626', '#fde047'], ['#7c3aed', '#22d3ee'], ['#ea580c', '#1e293b'], ['#0ea5e9', '#f472b6'], ['#65a30d', '#f97316'], ['#be185d', '#fbbf24'], ['#0f766e', '#a3e635']][k % 8];
    const count = Math.max(30, Math.round(curve.getLength() / 0.11));
    const geo = new T.SphereGeometry(1, 12, 10);
    const body = new T.InstancedMesh(geo, this.mat('#ffffff', { roughness: 0.35 }), count);
    const m4 = new T.Matrix4(), col = new T.Color();
    for (let i = 0; i < count; i++) {
      const u = i / (count - 1), p = curve.getPoint(u), r = 0.27 - u * 0.2;
      m4.makeScale(r, r * 0.8, r); m4.setPosition(p.x, 0.12 + r * 0.7, p.z);
      body.setMatrixAt(i, m4); body.setColorAt(i, col.set(Math.floor(i / 3) % 2 ? pal[1] : pal[0]));
    }
    body.instanceColor.needsUpdate = true;
    this.S.add(body);
    // Head with eyes and a tongue
    const dir = curve.getTangent(0).multiplyScalar(-1);
    const head = new T.Group(); head.position.set(H[0], 0.32, H[1]); head.rotation.y = Math.atan2(dir.x, dir.z);
    const hm = new T.Mesh(geo, this.mat(pal[0], { roughness: 0.3 })); hm.scale.set(0.36, 0.28, 0.44); head.add(hm);
    [-1, 1].forEach(s => {
      const e = new T.Mesh(geo, this.mat('#ffffff')); e.scale.setScalar(0.11); e.position.set(s * 0.17, 0.17, 0.18); head.add(e);
      const pu = new T.Mesh(geo, this.mat('#111111')); pu.scale.setScalar(0.055); pu.position.set(s * 0.18, 0.2, 0.27); head.add(pu);
    });
    const tg = new T.Mesh(new T.BoxGeometry(0.05, 0.02, 0.3), this.mat('#ff1744', { emissive: '#ff1744', emissiveIntensity: 0.4 })); tg.position.set(0, -0.02, 0.5); head.add(tg);
    this.S.add(head);
    head.userData.tongue = tg; (this.heads = this.heads || []).push(head);
    const slide = []; for (let i = 0; i <= 30; i++) { const p = curve.getPoint(i / 30); slide.push([p.x, p.z, 0.32]); }
    return slide;
  }

  faceColor() { this.th = 0; this.updCam(); }

  // Where a player stands. Players on the same square stand around its centre.
  spot(color, idx, p, pos) {
    if (!p) { const o = START[this.inPlay.indexOf(color) % 4]; return [this.startX + o[0], 0.11, this.startZ + o[1], 0.92]; }
    const c = sqXZ(p);
    const same = pos ? this.inPlay.filter(k => pos[k] === p) : [];
    let x = c[0], z = c[1], sc = 1;
    if (same.length > 1) { const n = same.indexOf(color), a = n / same.length * Math.PI * 2 + 0.6; x += Math.cos(a) * 0.36; z += Math.sin(a) * 0.36; sc = 0.8; }
    return [x, 0.11, z, sc];
  }

  placeAll(pos) {
    this.inPlay.forEach(c => this.people[c].forEach(p => {
      const q = pos[c], s = this.spot(c, 0, q, pos);
      p.position.set(s[0], s[1], s[2]); p.scale.setScalar(s[3]);
      p.userData.base = s[1];
      if (q > 0 && q < 100) { const a = sqXZ(q), b = sqXZ(q + 1); p.userData.yaw = Math.atan2(b[0] - a[0], b[1] - a[1]); }
      else p.userData.yaw = Math.PI; // face the board
    }));
    this.tokens = pos.slice();
  }

  // Move one character along a list of points [x, z, y], with walking steps.
  walkAlong(p, pts, speed, sound, soundName, stepsPer) {
    const u = p.userData, segs = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1], (pts[i][2] - pts[i - 1][2])); segs.push(L); total += L; }
    if (total < 0.001) return Promise.resolve();
    let last = -1;
    return this.tween(Math.max(0.3, total * speed), k => {
      let d = k * total, i = 0;
      while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
      const f = segs[i] > 0 ? Math.min(1, d / segs[i]) : 1, A = pts[i], B = pts[i + 1];
      if (Math.hypot(B[0] - A[0], B[1] - A[1]) > 0.01) u.yaw = Math.atan2(B[0] - A[0], B[1] - A[1]);
      const walked = k * total * (stepsPer || 1.4), ph = walked % 2;
      u.walkRow = ph < 0.5 ? 1 : ph < 1 ? 0 : ph < 1.5 ? 2 : 0;
      p.position.set(A[0] + (B[0] - A[0]) * f, A[2] + (B[2] - A[2]) * f + Math.abs(Math.sin(walked * Math.PI)) * 0.06, A[1] + (B[1] - A[1]) * f);
      const st = Math.floor(walked);
      if (st !== last) { last = st; if (sound && soundName) sound(soundName); }
    });
  }

  async animateMove(ev, posAfter, sound) {
    const p = this.people[ev.color][0], u = p.userData;
    if (ev.stay) { await this.tween(0.5, k => u.pose(1, Math.sin(k * Math.PI * 4) * 0.15)); u.pose(1, 0); this.placeAll(posAfter); return; }
    // 1. Walk square by square
    const pts = [[p.position.x, p.position.z, p.position.y]];
    walkPath(ev.from, ev.to).forEach(q => { const c = sqXZ(q); pts.push([c[0], c[1], 0.11]); });
    await this.walkAlong(p, pts, 0.3, sound, 'step', 1.4);
    u.walkRow = 0;
    this.puff(p.position.x, p.position.z);
    // 2. Ladder up or snake down
    if (ev.via === 'ladder') {
      await this.wait(150);
      if (sound) sound('turn');
      const climb = this.ladders[ev.to];
      await this.walkAlong(p, [[p.position.x, p.position.z, p.position.y]].concat(climb), 0.42, sound, 'hop', 2.4);
      u.walkRow = 0;
      this.burst(p.position.x, 1, p.position.z);
    } else if (ev.via === 'snake') {
      await this.wait(150);
      if (sound) sound('capture');
      this.shake = 0.5;
      const path = this.snakes[ev.to];
      await this.tween(1.1, k => {
        const f = k * (path.length - 1), i = Math.min(path.length - 2, Math.floor(f)), t = f - i, A = path[i], B = path[i + 1];
        p.position.set(A[0] + (B[0] - A[0]) * t, 0.3 + Math.sin(k * Math.PI) * 0.4, A[1] + (B[1] - A[1]) * t);
        u.pose(1, k * Math.PI * 4);
      });
      u.pose(1, 0);
      this.puff(p.position.x, p.position.z);
    }
    if (ev.won) { if (sound) sound('finish'); this.burst(p.position.x, 1, p.position.z); }
    this.placeAll(posAfter);
  }

  step(dt) {
    super.step(dt);
    (this.heads || []).forEach((h, i) => { h.userData.tongue.scale.z = 0.6 + Math.abs(Math.sin(this.time * 6 + i)) * 0.8; h.position.y = 0.32 + Math.sin(this.time * 2 + i) * 0.03; });
  }
}
export { TEAM };

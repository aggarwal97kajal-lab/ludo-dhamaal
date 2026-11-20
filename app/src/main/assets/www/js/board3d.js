// 3D board, cartoon people, dice and animations (Three.js r128, global THREE).
import { TRACK, cellOf, stepsBetween } from './rules.js';

const T = window.THREE;
export const TEAM = ['#e0103a', '#00c853', '#ffd000', '#1e5ef0'];
const TINT = ['#ff8fa3', '#8affc1', '#fff59d', '#9ec2ff'];
const HOME = [[-4.5, -4.5], [4.5, -4.5], [4.5, 4.5], [-4.5, 4.5]];
const SPOTS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const FIN = [[-0.85, 0], [0, -0.85], [0.85, 0], [0, 0.85]];

export const LOOKS = [
  { skin: '#f2c29b', hair: '#2a1406', style: 'short', outfit: 'tshirt', pants: '#2f4b7c' },
  { skin: '#d9a06f', hair: '#1a0f08', style: 'long', outfit: 'tshirt', pants: '#5b7fc0' },
  { skin: '#b97b4c', hair: '#8e8e8e', style: 'cap', outfit: 'kurta', pants: '#f4f4f0' },
  { skin: '#f2c29b', hair: '#0d0d0d', style: 'spiky', outfit: 'tshirt', pants: '#2a2d3a' },
  { skin: '#d9a06f', hair: '#3b2312', style: 'short', outfit: 'tshirt', pants: '#3a3a3a' },
  { skin: '#b97b4c', hair: '#0d0d0d', style: 'long', outfit: 'kurta', pants: '#f4f4f0' },
  { skin: '#f2c29b', hair: '#7a3b12', style: 'long', outfit: 'tshirt', pants: '#2f4b7c' },
  { skin: '#c68642', hair: '#111111', style: 'spiky', outfit: 'tshirt', pants: '#2f4b7c' }
];

const ease = k => 1 - Math.pow(1 - k, 3);
const PS = 1.0; // size of the people on the board
// Pictures: img/c<character>-<team colour>.png (every character exists in all 4 team colours)

// Recolour the clothes on a character sheet to another team colour, keeping the shading.
const CLOTH = [[345, 8], [70, 150], [30, 68], [175, 212]];
const MIN_SAT = [0.55, 0.3, 0.3, 0.3]; // Riya's red jacket: high saturation so brown hair tips stay brown
const TEAM_RGB = [[224, 16, 58], [0, 200, 83], [255, 208, 0], [30, 94, 240]];
function recolorClothes(ctx, ch, color) {
  const W = ctx.canvas.width, H = ctx.canvas.height, cellH = H / 3;
  const d = ctx.getImageData(0, 0, W, H), px = d.data;
  const [h0, h1] = CLOTH[ch], tgt = TEAM_RGB[color];
  const mask = new Uint8Array(W * H), hist = new Uint32Array(256);
  for (let i = 0, n = 0; i < px.length; i += 4, n++) {
    if (px[i + 3] < 8) continue;
    const y = Math.floor(n / W) % cellH;
    if (y < cellH * 0.36) continue;
    const r = px[i], g = px[i + 1], b = px[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), dd = mx - mn;
    if (mx < 46 || dd / (mx || 1) < MIN_SAT[ch]) continue;
    let h = mx === r ? ((g - b) / dd) % 6 : mx === g ? (b - r) / dd + 2 : (r - g) / dd + 4; h *= 60; if (h < 0) h += 360;
    const inBand = h0 > h1 ? (h >= h0 || h <= h1) : (h >= h0 && h <= h1);
    if (!inBand) continue;
    mask[n] = 1; hist[Math.round(0.3 * r + 0.59 * g + 0.11 * b)]++;
  }
  let total = 0; for (let v = 0; v < 256; v++) total += hist[v];
  let acc = 0, med = 128; for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total / 2) { med = v || 1; break; } }
  for (let i = 0, n = 0; i < px.length; i += 4, n++) {
    if (!mask[n]) continue;
    const lum = 0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2];
    const sh = Math.max(0.25, Math.min(1.45, lum / med)), hi = Math.max(0, Math.min(1, (sh - 1) / 0.45)) * 0.35;
    for (let k = 0; k < 3; k++) px[i + k] = Math.min(255, tgt[k] * sh) * (1 - hi) + 255 * hi;
  }
  ctx.putImageData(d, 0, 0);
}

export class Board3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.R = new T.WebGLRenderer({ canvas, antialias: true });
    this.R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.R.shadowMap.enabled = true;
    this.R.shadowMap.type = T.PCFSoftShadowMap;
    this.S = new T.Scene();
    this.S.background = new T.Color('#120a33');
    this.S.fog = new T.Fog('#120a33', 36, 75);
    this.cam = new T.PerspectiveCamera(44, 1, 0.5, 120);
    this.th = 0; this.ph = 0.74; this.rad = 30;
    this.tweens = [];
    this.people = [[], [], [], []];
    this.pickable = [];
    this.rings = [];
    this.onPick = null;
    this.time = 0;
    this.shake = 0;
    this.inPlay = [0, 1, 2, 3];
    this.build();
    this.controls();
    this.resize();
    window.addEventListener('resize', () => this.resize());
    let last = performance.now();
    const loop = n => {
      const dt = Math.min((n - last) / 1000, 0.1); last = n;
      this.step(dt); if (!this.paused) this.R.render(this.S, this.cam);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  resize() {
    const w = this.canvas.clientWidth || 360, h = this.canvas.clientHeight || 360;
    this.R.setSize(w, h, false);
    this.cam.aspect = w / h;
    // Fit the whole board across the screen width.
    const half = Math.tan(this.cam.fov * Math.PI / 360) * Math.min(1, w / h);
    this.rad = Math.max(20, Math.min(48, 8.6 / half));
    this.fitRad = this.rad;
    this.cam.updateProjectionMatrix();
    this.updCam();
  }

  updCam() {
    const s = this.shake * (Math.random() - 0.5);
    this.cam.position.set(this.rad * Math.sin(this.ph) * Math.sin(this.th) + s, this.rad * Math.cos(this.ph) + s, this.rad * Math.sin(this.ph) * Math.cos(this.th));
    // Look a little toward the near side so the board sits higher on the screen.
    this.cam.lookAt(Math.sin(this.th) * 1.6, -0.8, Math.cos(this.th) * 1.6);
  }

  faceColor(color) {
    const h = HOME[color];
    // Your home sits at the bottom-left, like a real Ludo board in front of you.
    this.th = Math.atan2(h[0], h[1]) + Math.PI / 4;
    this.updCam();
  }

  mat(col, o) { return new T.MeshStandardMaterial(Object.assign({ color: col, roughness: 0.35, metalness: 0.05, envMapIntensity: 0.45 }, o || {})); }

  mk(geo, mat, x, y, z, par) {
    const m = new T.Mesh(geo, mat);
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
    (par || this.S).add(m); return m;
  }

  build() {
    const S = this.S;
    S.add(new T.HemisphereLight('#ffffff', '#5a3aa0', 0.6));
    const L = new T.DirectionalLight('#ffffff', 1.05);
    L.position.set(9, 18, 7); L.castShadow = true; L.shadow.mapSize.set(1024, 1024);
    Object.assign(L.shadow.camera, { left: -11, right: 11, top: 11, bottom: -11 });
    L.shadow.bias = -0.0005; L.shadow.normalBias = 0.02; S.add(L);
    HOME.forEach((h, i) => { const p = new T.PointLight(TEAM[i], 0.55, 9); p.position.set(h[0] * 1.35, 1.2, h[1] * 1.35); S.add(p); });
    const pm = new T.PMREMGenerator(this.R), es = new T.Scene();
    es.background = new T.Color('#3a2a80');
    [[0, 10, 0, '#fff', 9], [10, 4, 6, '#ffe0b0', 5], [-10, 4, -6, '#a0c4ff', 5]].forEach(a => {
      const m = new T.Mesh(new T.PlaneGeometry(a[4], a[4]), new T.MeshBasicMaterial({ color: a[3], side: 2 }));
      m.position.set(a[0], a[1], a[2]); m.lookAt(0, 0, 0); es.add(m);
    });
    S.environment = pm.fromScene(es, 0.04).texture;

    const rr = (w, h, r) => { const s = new T.Shape(), x = -w / 2, y = -h / 2; s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s; };
    const ext = (sh, d, b) => { const g = new T.ExtrudeGeometry(sh, { depth: d, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 3, curveSegments: 8 }); g.rotateX(-Math.PI / 2); return g; };
    const frame = (o, i, r1, r2) => { const s = rr(o, o, r1); s.holes.push(rr(i, i, r2)); return s; };
    const mk = this.mk.bind(this), M = this.mat.bind(this);

    const fl = new T.Mesh(new T.CircleGeometry(60, 64), M('#24135e', { roughness: 0.35, metalness: 0.3 }));
    fl.rotation.x = -Math.PI / 2; fl.position.y = -1.4; fl.receiveShadow = true; S.add(fl);
    const gold = M('#ffc21a', { metalness: 0.9, roughness: 0.2 });
    mk(ext(rr(16.6, 16.6, 0.9), 0.5, 0.12), M('#3b1d8f', { roughness: 0.3 }), 0, -0.62, 0);
    mk(ext(frame(17.6, 16.2, 1.2, 0.8), 0.55, 0.1), gold, 0, -0.55, 0); // frame top sits 0.1 above the slab: no shared faces, no flicker
    mk(new T.CylinderGeometry(7, 8, 0.7, 48), M('#2a1270', { metalness: 0.3 }), 0, -1.1, 0);

    const tG = ext(rr(0.86, 0.86, 0.16), 0.06, 0.035), wM = M('#ffffff', { roughness: 0.3 });
    const lane = {}; const sl = (a, b, i) => lane[a + ',' + b] = i;
    sl(1, 6, 0); for (let i = 1; i < 6; i++) sl(i, 7, 0);
    sl(8, 1, 1); for (let i = 1; i < 6; i++) sl(7, i, 1);
    sl(13, 8, 2); for (let i = 9; i < 14; i++) sl(i, 7, 2);
    sl(6, 13, 3); for (let i = 9; i < 14; i++) sl(7, i, 3);
    const lM = TEAM.map(t => M(t, { emissive: t, emissiveIntensity: 0.12, roughness: 0.3 }));
    const star = () => { const s = new T.Shape(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.13 : 0.3, a = i * Math.PI / 5 + Math.PI / 2; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); } return ext(s, 0.03, 0.015); };
    const stG = star(), stars = ['2,8', '6,2', '12,6', '8,12'];
    for (let a = 0; a < 15; a++) for (let b = 0; b < 15; b++) {
      const p = (a >= 6 && a <= 8) || (b >= 6 && b <= 8), ce = a >= 6 && a <= 8 && b >= 6 && b <= 8;
      if (p && !ce) { const k = a + ',' + b; mk(tG, k in lane ? lM[lane[k]] : wM, a - 7, 0, b - 7); if (stars.includes(k)) mk(stG, gold, a - 7, 0.13, b - 7); }
    }
    const ringG = new T.TorusGeometry(0.5, 0.07, 12, 40); ringG.rotateX(Math.PI / 2);
    HOME.forEach((h, i) => {
      const t = TEAM[i];
      mk(ext(rr(5.7, 5.7, 0.7), 0.1, 0.04), M(t, { roughness: 0.25 }), h[0], 0, h[1]);
      mk(ext(rr(4.6, 4.6, 0.5), 0.06, 0.03), M(TINT[i], { roughness: 0.4 }), h[0], 0.1, h[1]);
      mk(ext(frame(5.9, 5, 0.8, 0.5), 0.45, 0.06), M(t, { roughness: 0.2, emissive: t, emissiveIntensity: 0.1 }), h[0], 0, h[1]);
      SPOTS.forEach(o => mk(new T.SphereGeometry(0.28, 20, 14), gold, h[0] + o[0] * 2.9, 0.62, h[1] + o[1] * 2.9));
      SPOTS.forEach(o => {
        mk(new T.CylinderGeometry(0.56, 0.56, 0.06, 32), M('#ffffff', { roughness: 0.2 }), h[0] + o[0], 0.2, h[1] + o[1]);
        mk(ringG, M(t, { emissive: t, emissiveIntensity: 0.6 }), h[0] + o[0], 0.24, h[1] + o[1]);
      });
    });
    const tri = (p, i) => { const s = new T.Shape(); s.moveTo(0, 0); s.lineTo(p[0][0], -p[0][1]); s.lineTo(p[1][0], -p[1][1]); s.lineTo(0, 0); mk(ext(s, 0.08, 0.02), lM[i], 0, 0, 0); };
    mk(ext(rr(3.1, 3.1, 0.2), 0.06, 0.02), wM, 0, 0, 0);
    tri([[-1.45, -1.45], [-1.45, 1.45]], 0); tri([[-1.45, -1.45], [1.45, -1.45]], 1);
    tri([[1.45, -1.45], [1.45, 1.45]], 2); tri([[-1.45, 1.45], [1.45, 1.45]], 3);

    // Dice
    const dtx = v => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 256; const x = cv.getContext('2d');
      x.fillStyle = '#ffffff'; x.fillRect(0, 0, 256, 256); x.strokeStyle = '#e4e6ef'; x.lineWidth = 16; x.strokeRect(0, 0, 256, 256);
      x.fillStyle = v === 1 || v === 4 ? '#ff1744' : '#1a1050';
      const P = { 1: [[128, 128]], 2: [[70, 70], [186, 186]], 3: [[62, 62], [128, 128], [194, 194]], 4: [[70, 70], [186, 70], [70, 186], [186, 186]], 5: [[62, 62], [194, 62], [128, 128], [62, 194], [194, 194]], 6: [[72, 58], [184, 58], [72, 128], [184, 128], [72, 198], [184, 198]] };
      P[v].forEach(d => { x.beginPath(); x.arc(d[0], d[1], v === 1 ? 40 : 25, 0, 6.28); x.fill(); });
      return new T.CanvasTexture(cv);
    };
    this.tx = [null]; for (let v = 1; v <= 6; v++) this.tx.push(dtx(v));
    this.dm = [3, 4, 1, 6, 2, 5].map(v => M('#ffffff', { map: this.tx[v], roughness: 0.2 }));
    this.dice = mk(new T.BoxGeometry(1.05, 1.05, 1.05), this.dm, 0, 2.4, 0);
    this.dm.forEach(m => { m.depthTest = false; m.depthWrite = false; });
    this.diceState = 'idle';

    // Sparkles
    const N = 140, pp = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pp[i * 3] = (Math.random() - 0.5) * 32; pp[i * 3 + 1] = Math.random() * 10 - 1; pp[i * 3 + 2] = (Math.random() - 0.5) * 32; }
    this.pg = new T.BufferGeometry(); this.pg.setAttribute('position', new T.BufferAttribute(pp, 3)); this.pp = pp; this.N = N;
    S.add(new T.Points(this.pg, new T.PointsMaterial({ color: '#ffe066', size: 0.1, transparent: true, opacity: 0.85 })));

    // Dust & confetti pools
    this.dust = [];
    for (let i = 0; i < 14; i++) { const m = new T.Mesh(new T.SphereGeometry(0.07, 8, 6), new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false })); m.renderOrder = 1; S.add(m); this.dust.push({ m, l: 0, vx: 0, vz: 0 }); }
    this.conf = [];
    const cg = new T.PlaneGeometry(0.14, 0.08), cc = ['#ff1744', '#00e676', '#ffd600', '#2979ff', '#ff4fd8', '#ffffff'];
    for (let i = 0; i < 90; i++) { const m = new T.Mesh(cg, new T.MeshBasicMaterial({ color: cc[i % 6], side: 2 })); m.visible = false; S.add(m); this.conf.push({ m, v: new T.Vector3(), l: 0 }); }

    this.ringG = new T.TorusGeometry(0.42, 0.06, 10, 36); this.ringG.rotateX(Math.PI / 2);
    this.shadowG = new T.CircleGeometry(0.34, 24);
    this.shadowM = new T.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.28, depthWrite: false });
    this.baseG = new T.TorusGeometry(0.3, 0.035, 8, 32); this.baseG.rotateX(Math.PI / 2);
    // The board never moves: only people and the dice need to cast shadows.
    S.traverse(o => { if (o.isMesh && o !== this.dice) o.castShadow = false; });
  }

  // ---------- People (cartoon character pictures standing on the board) ----------
  // Each character has one picture sheet: 3 rows (standing, walk step A, walk step B) x
  // 5 views (front, front 3/4, side, back 3/4, back), all facing right. Other team colours
  // are made here by recolouring only the clothes.
  sheetTex(color) {
    this.sheets = this.sheets || {};
    const ch = (this.looks && this.looks[color] != null ? this.looks[color] : color) % 4;
    const key = ch + '-' + color;
    if (!this.sheets[key]) {
      const cv = document.createElement('canvas'); cv.width = 1000; cv.height = 840;
      const tex = new T.CanvasTexture(cv); tex.anisotropy = 4;
      const img = new Image();
      img.onload = () => {
        const x = cv.getContext('2d'); x.drawImage(img, 0, 0, 1000, 840);
        if (ch !== color) recolorClothes(x, ch, color);
        tex.needsUpdate = true;
        (tex._copies || []).forEach(t => { t.needsUpdate = true; });
      };
      img.src = 'img/walk' + ch + '.webp';
      this.sheets[key] = tex;
    }
    return this.sheets[key];
  }

  person(color) {
    const g = new T.Group();
    const shadow = new T.Mesh(this.shadowG, this.shadowM); shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; g.add(shadow);
    const ring = new T.Mesh(this.baseG, this.mat(TEAM[color], { emissive: TEAM[color], emissiveIntensity: 0.35 })); ring.position.y = 0.03; g.add(ring);
    const base = this.sheetTex(color), map = base.clone(); map.needsUpdate = true;
    (base._copies = base._copies || []).push(map);
    map.repeat.set(1 / 5, 1 / 3);
    const mat = new T.SpriteMaterial({ map, alphaTest: 0.08, transparent: true, depthTest: false, depthWrite: false });
    const sp = new T.Sprite(mat); sp.center.set(0.5, 0.02); sp.renderOrder = 10; g.add(sp);
    sp.userData.owner = g;
    const H = 2.15, Wd = H * 200 / 280;
    const u = g.userData = { color, sp, map, ph: Math.random() * 6, hop: 3 + Math.random() * 6, sq: 1, tilt: 0, yaw: 0, row: 0, col: 0, mirror: 1 };
    u.fit = () => { sp.scale.set(Wd * u.mirror / u.sq, H * u.sq, 1); mat.rotation = u.tilt; };
    u.pose = (squash, tilt) => { u.sq = squash; u.tilt = tilt; u.fit(); };
    u.setFrame = (row, col, mirror) => {
      if (row === u.row && col === u.col && mirror === u.mirror) return;
      u.row = row; u.col = col; u.mirror = mirror;
      map.offset.set(col / 5, 1 - (row + 1) / 3); u.fit();
    };
    u.row = -1; u.setFrame(0, 0, 1);
    g.scale.setScalar(PS);
    this.S.add(g);
    return g;
  }

  // Choose which side of the character to show: compare the way it faces with the way
  // the camera looks at it. Views facing left are the right-facing pictures flipped.
  updateViews() {
    const cp = this.cam.position;
    this.inPlay.forEach(c => this.people[c].forEach(p => {
      const u = p.userData;
      const vx = p.position.x - cp.x, vz = p.position.z - cp.z;
      const len = Math.hypot(vx, vz) || 1;
      const fx = Math.sin(u.yaw), fz = Math.cos(u.yaw);
      const toCam = -(fx * vx + fz * vz) / len;            // 1 = facing the camera
      const right = (-fx * vz + fz * vx) / len;            // > 0 = facing screen-right
      const ang = Math.acos(Math.max(-1, Math.min(1, toCam))) * 180 / Math.PI;
      const col = ang < 22.5 ? 0 : ang < 67.5 ? 1 : ang < 112.5 ? 2 : ang < 157.5 ? 3 : 4;
      const mirror = (col === 0 || col === 4) ? 1 : (right >= 0 ? 1 : -1);
      u.setFrame(u.walkRow || 0, col, mirror);
    }));
  }

  setPlayers(colors, looks) {
    this.people.flat().forEach(p => this.S.remove(p));
    this.people = [[], [], [], []];
    this.inPlay = colors;
    this.looks = looks || {};
    colors.forEach(c => {
      for (let i = 0; i < 4; i++) {
        const p = this.person(c);
        p.userData.idx = i;
        this.people[c].push(p);
      }
    });
    this.pickable = this.people.flat();
  }

  // World position for a token, spreading tokens that share a square.
  spot(color, idx, p, tokens) {
    if (p === -1) { const h = HOME[color], o = SPOTS[idx]; return [h[0] + o[0], 0.27, h[1] + o[1], 1]; }
    if (p === 56) { const f = FIN[color]; const o = [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]][idx]; return [f[0] + o[0] * 0.8, 0.14, f[1] + o[1] * 0.8, 0.6]; }
    const cell = cellOf(color, p);
    const same = [];
    if (tokens) {
      this.inPlay.forEach(c => tokens[c].forEach((q, i) => {
        if (q < 0 || q === 56) return;
        const k = cellOf(c, q);
        if (k[0] === cell[0] && k[1] === cell[1]) same.push(c * 4 + i);
      }));
    }
    let x = cell[0] - 7, z = cell[1] - 7, sc = 1;
    if (same.length > 1) {
      const n = same.indexOf(color * 4 + idx), a = n / same.length * Math.PI * 2;
      x += Math.cos(a) * 0.24; z += Math.sin(a) * 0.24; sc = 0.78;
    }
    return [x, 0.11, z, sc];
  }

  placeAll(tokens) {
    this.inPlay.forEach(c => this.people[c].forEach((p, i) => {
      const s = this.spot(c, i, tokens[c][i], tokens);
      p.position.set(s[0], s[1], s[2]); p.scale.setScalar(PS * s[3]);
      p.userData.base = s[1];
      const q = tokens[c][i];
      if (q >= 0 && q < 56) {
        const a = cellOf(c, q), b = cellOf(c, Math.min(q + 1, 55));
        p.userData.yaw = (q === 55 || (a[0] === b[0] && a[1] === b[1])) ? Math.atan2(-s[0], -s[2]) : Math.atan2(b[0] - a[0], b[1] - a[1]);
      } else p.userData.yaw = Math.atan2(-s[0], -s[2]);
    }));
    this.tokens = tokens.map(t => t.slice());
  }

  tween(dur, fn) {
    return new Promise(res => this.tweens.push({ t: 0, dur, fn, res }));
  }

  wait(ms) { return new Promise(r => setTimeout(r, ms)); }

  async throwDice(v, sound) {
    this.dm[2].map = this.tx[v]; this.dm[2].needsUpdate = true;
    this.diceState = 'roll';
    if (sound) sound('dice');
    await this.tween(1.05, k => {
      const e = ease(k);
      this.dice.position.y = 0.65 + Math.abs(Math.cos(k * Math.PI * 2.5)) * 4.5 * Math.pow(1 - k, 2);
      this.dice.rotation.set((1 - e) * 16, (1 - e) * 6, (1 - e) * 12);
    });
    this.shake = 0.2;
    this.diceState = 'shown';
    if (v === 6) this.burst(0, 1.5, 0);
  }

  diceIdle() { this.diceState = 'idle'; }

  // Animate a move event from rules.move(). Returns when all animations end.
  async animateMove(ev, tokensAfter, sound) {
    const p = this.people[ev.color][ev.token];
    const path = stepsBetween(ev.from, ev.to);
    const u = p.userData;
    const pts = [[p.position.x, p.position.z, p.userData.base || 0.11, 1]];
    path.forEach((q, i) => { const sp = this.spot(ev.color, ev.token, q, i === path.length - 1 ? tokensAfter : null); pts.push([sp[0], sp[2], sp[1], sp[3]]); });
    const segs = []; let total = 0;
    for (let i = 1; i < pts.length; i++) { const L = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push(L); total += L; }
    if (total > 0.001) {
      let lastStep = -1;
      await this.tween(Math.max(0.35, total * 0.34), k => {
        let d = k * total, i = 0;
        while (i < segs.length - 1 && d > segs[i]) { d -= segs[i]; i++; }
        const f = segs[i] > 0 ? Math.min(1, d / segs[i]) : 1, A = pts[i], B = pts[i + 1];
        const x = A[0] + (B[0] - A[0]) * f, z = A[1] + (B[1] - A[1]) * f;
        if (segs[i] > 0.01) u.yaw = Math.atan2(B[0] - A[0], B[1] - A[1]);
        const walked = k * total * 2;                      // two steps per square
        const phase = walked % 2;
        u.walkRow = phase < 0.5 ? 1 : phase < 1 ? 0 : phase < 1.5 ? 2 : 0;
        p.position.set(x, A[2] + (B[2] - A[2]) * f + Math.abs(Math.sin(walked * Math.PI)) * 0.06, z);
        const step = Math.floor(walked);
        if (step !== lastStep) { lastStep = step; if (sound) sound('step'); }
      });
    }
    const end = pts[pts.length - 1];
    p.position.set(end[0], end[2], end[1]);
    p.scale.setScalar(PS * end[3]);
    p.userData.base = end[2];
    u.walkRow = 0;
    this.puff(p.position.x, p.position.z);
    u.pose(1, 0);
    if (ev.captured.length) {
      this.shake = 0.6;
      if (sound) sound('capture');
      this.burst(p.position.x, 0.8, p.position.z);
      const flights = ev.captured.map(cp => {
        const v = this.people[cp.color][cp.token];
        const a = [v.position.x, v.position.z];
        const s = this.spot(cp.color, cp.token, -1, tokensAfter);
        v.userData.walkRow = 0;
        return this.tween(1.25, k => {
          v.position.set(a[0] + (s[0] - a[0]) * k, 0.11 + Math.sin(k * Math.PI) * 5.5 + 0.16 * k, a[1] + (s[2] - a[1]) * k);
          v.userData.pose(1, k * Math.PI * 4);
        }).then(() => { v.userData.pose(1, 0); v.position.y = s[1]; v.userData.base = s[1]; v.scale.setScalar(PS); this.puff(s[0], s[2]); });
      });
      const cheer = this.tween(1.25, k => {
        p.position.y = 0.11 + Math.abs(Math.sin(k * Math.PI * 4)) * 0.4;
        u.pose(1 + Math.abs(Math.sin(k * Math.PI * 4)) * 0.12, Math.sin(k * Math.PI * 8) * 0.1);
      }).then(() => { u.pose(1, 0); p.position.y = p.userData.base; });
      await Promise.all(flights.concat([cheer]));
    }
    if (ev.finished) { if (sound) sound('finish'); this.burst(p.position.x, 1, p.position.z); }
    this.placeAll(tokensAfter);
  }

  // Characters ignore the board's depth so walls never hide them; the ones farther from
  // the camera are drawn first so nearer ones correctly stand in front.
  sortPeople() {
    const cp = this.cam.position, list = [];
    this.inPlay.forEach(c => this.people[c].forEach(p => list.push(p)));
    list.push(this.dice);
    list.sort((a, b) => b.position.distanceToSquared(cp) - a.position.distanceToSquared(cp));
    list.forEach((p, i) => { if (p === this.dice) p.renderOrder = 10 + i; else p.userData.sp.renderOrder = 10 + i; });
  }

  highlight(color, idxs, onPick) {
    this.clearHighlight();
    this.onPick = onPick;
    this.hl = idxs.map(i => {
      const p = this.people[color][i];
      const r = new T.Mesh(this.ringG, this.mat('#ffc21a', { emissive: '#ffb300', emissiveIntensity: 1.4 }));
      r.position.set(p.position.x, 0.16, p.position.z); this.S.add(r);
      return { p, r, i };
    });
  }

  clearHighlight() {
    (this.hl || []).forEach(h => this.S.remove(h.r));
    this.hl = []; this.onPick = null;
  }

  puff(x, z) {
    let n = 0;
    this.dust.forEach(d => { if (d.l <= 0 && n < 6) { const a = n * 1.05 + Math.random() * 0.4; d.m.position.set(x + Math.cos(a) * 0.32, 0.13, z + Math.sin(a) * 0.32); d.vx = Math.cos(a) * 1.1; d.vz = Math.sin(a) * 1.1; d.l = 0.35; n++; } });
  }

  burst(x, y, z) {
    this.conf.forEach(o => { o.m.visible = true; o.m.position.set(x, y, z); o.v.set((Math.random() - 0.5) * 7, 4 + Math.random() * 5, (Math.random() - 0.5) * 7); o.l = 2 + Math.random(); });
  }

  controls() {
    const c = this.canvas, ptr = new Map(); let ld = 0, moved = 0, downAt = 0;
    const cl = (v, a, b) => Math.max(a, Math.min(b, v));
    c.addEventListener('pointerdown', e => { ptr.set(e.pointerId, { x: e.clientX, y: e.clientY }); c.setPointerCapture(e.pointerId); moved = 0; downAt = performance.now(); });
    c.addEventListener('pointermove', e => {
      if (!ptr.has(e.pointerId)) return;
      const pv = ptr.get(e.pointerId); ptr.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved += Math.abs(e.clientX - pv.x) + Math.abs(e.clientY - pv.y);
      if (ptr.size === 1) { this.th -= (e.clientX - pv.x) * 0.008; this.ph = cl(this.ph - (e.clientY - pv.y) * 0.006, 0.15, 1.15); }
      else if (ptr.size === 2) { const q = [...ptr.values()], d = Math.hypot(q[0].x - q[1].x, q[0].y - q[1].y); if (ld) this.rad = cl(this.rad * ld / d, 12, (this.fitRad || 36) * 1.15); ld = d; }
      this.updCam();
    });
    const end = e => {
      const single = ptr.size === 1;
      ptr.delete(e.pointerId); ld = 0;
      if (single && moved < 12 && performance.now() - downAt < 500) this.tap(e);
    };
    c.addEventListener('pointerup', end); c.addEventListener('pointercancel', e => { ptr.delete(e.pointerId); ld = 0; });
    c.addEventListener('wheel', e => { e.preventDefault(); this.rad = cl(this.rad * (1 + e.deltaY * 0.001), 12, (this.fitRad || 36) * 1.15); this.updCam(); }, { passive: false });
  }

  tap(e) {
    if (!this.onPick || !this.hl.length) return;
    const r = this.canvas.getBoundingClientRect();
    const m = new T.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    const ray = new T.Raycaster(); ray.setFromCamera(m, this.cam); ray.camera = this.cam;
    const hits = ray.intersectObjects(this.hl.map(h => h.p.userData.sp), false);
    let pick = null;
    if (hits.length) { const own = hits[0].object.userData.owner; pick = this.hl.find(h => h.p === own); }
    if (!pick) {
      // Fall back to the nearest highlighted person on screen.
      let best = 1e9;
      this.hl.forEach(h => {
        const v = h.p.position.clone(); v.y += 0.6; v.project(this.cam);
        const dx = (v.x - m.x) * r.width / 2, dy = (v.y - m.y) * r.height / 2, d = Math.hypot(dx, dy);
        if (d < best && d < 46) { best = d; pick = h; }
      });
    }
    if (pick) { const f = this.onPick; this.clearHighlight(); f(pick.i); }
  }

  step(dt) {
    this.time += dt;
    const T0 = this.time;
    this.shake *= 0.9; this.updCam();
    this.sortPeople();
    this.updateViews();
    for (let i = 0; i < this.N; i++) { this.pp[i * 3 + 1] += dt * 0.35; if (this.pp[i * 3 + 1] > 9) this.pp[i * 3 + 1] = -1; }
    this.pg.attributes.position.needsUpdate = true;
    this.dust.forEach(d => { if (d.l > 0) { d.l -= dt; d.m.position.x += d.vx * dt; d.m.position.z += d.vz * dt; const k = 1 - d.l / 0.35; d.m.scale.set(1 + k * 1.5, 0.5 + k * 0.5, 1 + k * 1.5); d.m.material.opacity = 0.55 * (1 - k); } else d.m.material.opacity = 0; });
    this.conf.forEach(o => { if (o.l > 0) { o.l -= dt; o.v.y -= 9 * dt; o.m.position.addScaledVector(o.v, dt); o.m.rotation.x += dt * 8; o.m.rotation.y += dt * 6; if (o.m.position.y < 0.15) { o.m.position.y = 0.15; o.v.set(0, 0, 0); } if (o.l <= 0) o.m.visible = false; } });
    if (this.diceState === 'idle') { this.dice.position.y = 2.4 + Math.sin(T0 * 2) * 0.15; this.dice.rotation.y += dt * 0.6; this.dice.rotation.x = Math.sin(T0) * 0.15; }
    (this.hl || []).forEach(h => { h.r.scale.setScalar(1 + Math.sin(T0 * 8) * 0.15); h.p.position.y = (h.p.userData.base || 0.11) + Math.abs(Math.sin(T0 * 5)) * 0.18; });
        this.tweens = this.tweens.filter(tw => {
      tw.t += dt / tw.dur; const k = Math.min(tw.t, 1); tw.fn(k);
      if (k >= 1) { tw.res(); return false; } return true;
    });
    if (!this.tweens.length) {
      this.inPlay.forEach(c => this.people[c].forEach(p => {
        const u = p.userData;
        if ((this.hl || []).some(h => h.p === p)) return;
        u.hop -= dt;
        let y = (u.base || 0.11) + Math.abs(Math.sin(T0 * 2.4 + u.ph)) * 0.03;
        if (u.hop < 0) {
          const k = -u.hop / 0.5; y += Math.sin(Math.min(k, 1) * Math.PI) * 0.35;
          u.pose(1 + Math.sin(Math.min(k, 1) * Math.PI) * 0.08, 0);
          if (k >= 1) { u.hop = 4 + Math.random() * 7; u.pose(1, 0); }
        }
        p.position.y = y;
      }));
    }
  }
}

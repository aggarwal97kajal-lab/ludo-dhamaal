// Archery scene drawn as one SVG: sky, hills, trees, the range, the target and the bow.
const W = 390, H = 844, HZ = 470;
export const SCENE = { W, H, HZ };
function rnd(seed) { let x = seed; return () => { x = (x * 16807) % 2147483647; return (x - 1) / 2147483646; }; }
export function targetFace(cx, cy, r, persp, num) {
  const cols = ['#f4f1ea', '#f4f1ea', '#1d1d1f', '#1d1d1f', '#1f6fff', '#1f6fff', '#e5192e', '#e5192e', '#ffd21a', '#ffd21a'];
  let s = '';
  cols.forEach((c, i) => { const rr = r * (10 - i) / 10; s += `<ellipse cx="${cx}" cy="${cy}" rx="${rr}" ry="${rr * persp}" fill="${c}" stroke="${i === 4 ? '#fff' : i < 2 ? '#888' : '#0005'}" stroke-width="${Math.max(0.5, r / 90)}"/>`; });
  s += `<line x1="${cx - r * 0.03}" y1="${cy}" x2="${cx + r * 0.03}" y2="${cy}" stroke="#5a3500" stroke-width="${r / 140}"/><line x1="${cx}" y1="${cy - r * 0.03}" x2="${cx}" y2="${cy + r * 0.03}" stroke="#5a3500" stroke-width="${r / 140}"/>`;
  if (num) for (let k = 0; k < 9; k++) { const rr = r * (9.5 - k) / 10; s += `<text x="${cx + rr}" y="${cy + r * 0.03}" font-size="${r * 0.06}" font-weight="700" text-anchor="middle" fill="${k < 2 || k > 5 ? '#333' : '#fff'}">${k + 1}</text>`; }
  return s;
}
// Target size and place for a distance (metres).
export function targetAt(dist) { const R = Math.round(33 * Math.pow(70 / dist, 0.85)); return { cx: 195, cy: HZ - 6 - R * 0.95, R, persp: 0.95 }; }
export function sceneSvg(dist, windKmh) {
  const T = targetAt(dist), r = rnd(7);
  let s = `<svg id="aqSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style="stroke:none;fill:none">
<defs>
 <linearGradient id="aSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1c4fa8"/><stop offset=".45" stop-color="#5aa9f0"/><stop offset=".78" stop-color="#ffd8a0"/><stop offset="1" stop-color="#ffb070"/></linearGradient>
 <radialGradient id="aSun" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fffef2"/><stop offset=".25" stop-color="#fff1b0"/><stop offset=".6" stop-color="#ffd07a" stop-opacity=".5"/><stop offset="1" stop-color="#ffb060" stop-opacity="0"/></radialGradient>
 <linearGradient id="aM1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fa9d6"/><stop offset="1" stop-color="#c9b6c8"/></linearGradient>
 <linearGradient id="aM2" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5d7cb0"/><stop offset="1" stop-color="#9a93b0"/></linearGradient>
 <linearGradient id="aGrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cbf56"/><stop offset=".3" stop-color="#4f9a3a"/><stop offset="1" stop-color="#1f5a22"/></linearGradient>
 <linearGradient id="aRiser" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#1a1a1e"/><stop offset=".35" stop-color="#5c6270"/><stop offset=".5" stop-color="#d9dde6"/><stop offset=".65" stop-color="#5c6270"/><stop offset="1" stop-color="#121216"/></linearGradient>
 <linearGradient id="aLimb" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0c0c10"/><stop offset=".5" stop-color="#3a3f4a"/><stop offset="1" stop-color="#0c0c10"/></linearGradient>
 <linearGradient id="aGold" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8a5600"/><stop offset=".5" stop-color="#ffe17a"/><stop offset="1" stop-color="#8a5600"/></linearGradient>
 <linearGradient id="aShaft" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#111"/><stop offset=".5" stop-color="#555"/><stop offset="1" stop-color="#111"/></linearGradient>
 <linearGradient id="aStraw" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8b46a"/><stop offset="1" stop-color="#a7803d"/></linearGradient>
 <filter id="aB1"><feGaussianBlur stdDeviation="1.2"/></filter><filter id="aB2"><feGaussianBlur stdDeviation="2.4"/></filter><filter id="aB4"><feGaussianBlur stdDeviation="5"/></filter><filter id="aCl"><feGaussianBlur stdDeviation="7"/></filter>
 <radialGradient id="aVig" cx=".5" cy=".45" r=".75"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".5"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="url(#aSky)"/><circle cx="300" cy="330" r="140" fill="url(#aSun)"/>
<g filter="url(#aCl)" opacity=".9" class="aqclouds"><ellipse cx="80" cy="190" rx="90" ry="22" fill="#fff"/><ellipse cx="140" cy="176" rx="60" ry="20" fill="#fff"/><ellipse cx="320" cy="240" rx="80" ry="16" fill="#fff" opacity=".8"/><ellipse cx="200" cy="300" rx="120" ry="10" fill="#ffe8c8" opacity=".8"/></g>
<path d="M0 400 L40 360 L90 380 L150 320 L210 370 L260 340 L320 372 L390 330 L390 ${HZ} L0 ${HZ}Z" fill="url(#aM1)" opacity=".85"/>
<path d="M0 420 L60 390 L120 410 L180 370 L240 404 L300 384 L360 410 L390 396 L390 ${HZ} L0 ${HZ}Z" fill="url(#aM2)" opacity=".9"/>
<rect x="0" y="380" width="${W}" height="100" fill="#ffd8b0" opacity=".25" filter="url(#aB4)"/>`;
  let t = '', x = -10;
  while (x < W + 10) { const h = 26 + r() * 26, w = 14 + r() * 8; t += `<path d="M${x} ${HZ} L${x + w / 2} ${HZ - h} L${x + w} ${HZ}Z"/>`; x += 7 + r() * 6; }
  s += `<g fill="#28503a" filter="url(#aB1)">${t}</g>`; t = ''; x = -10;
  while (x < W + 10) { t += `<circle cx="${x}" cy="${HZ - 4}" r="${12 + r() * 10}"/>`; x += 14 + r() * 10; }
  s += `<g fill="#356b3f" filter="url(#aB1)">${t}</g><rect x="0" y="${HZ}" width="${W}" height="${H - HZ}" fill="url(#aGrass)"/>`;
  for (let i = -6; i < 8; i++) { const x0 = 195 + i * 26, x1 = 195 + i * 260; s += `<path d="M${x0} ${HZ} L${x0 + 13} ${HZ} L${x1 + 130} ${H} L${x1} ${H}Z" fill="#fff" opacity=".045"/>`; }
  s += `<path d="M180 ${HZ} L-120 ${H} M210 ${HZ} L510 ${H}" stroke="#fff" stroke-width="2" opacity=".55"/>`;
  [[500, '70m'], [560, '50m'], [650, '30m']].forEach(([y, lab]) => { const k = (y - HZ) / (H - HZ), xl = 180 - 300 * k, xr = 210 + 300 * k; s += `<line x1="${xl}" y1="${y}" x2="${xr}" y2="${y}" stroke="#fff" stroke-width="${1 + 3 * k}" opacity=".35"/><text x="${xr - 14}" y="${y - 4}" font-size="${8 + 8 * k}" font-weight="800" fill="#fff" opacity=".6">${lab}</text>`; });
  // Wind flags lean with the wind.
  const lean = Math.max(-1, Math.min(1, windKmh / 9)), fl = (px, h, col, k) => { const d = 22 * lean * k; return `<line x1="${px}" y1="${HZ + 2}" x2="${px}" y2="${HZ - h}" stroke="#ddd" stroke-width="2"/><path class="aqflag" d="M${px} ${HZ - h} Q${px + d * 0.6} ${HZ - h - 4} ${px + d} ${HZ - h + 4} Q${px + d * 0.7} ${HZ - h + 10} ${px + d * 1.05} ${HZ - h + 16} Q${px + d * 0.5} ${HZ - h + 12} ${px} ${HZ - h + 16}Z" fill="${col}" stroke="#0004" stroke-width=".8"/>`; };
  s += fl(300, 62, '#ff3d3d', 1) + fl(84, 48, '#ffd21a', 0.8);
  const { cx, cy, R } = T;
  s += `<ellipse cx="${cx}" cy="${HZ + 12}" rx="${R * 1.4}" ry="${R * 0.16}" fill="#000" opacity=".3" filter="url(#aB2)"/>`;
  s += `<path d="M${cx - R} ${HZ + 12} L${cx - R * 0.3} ${cy - R * 0.9} M${cx + R} ${HZ + 12} L${cx + R * 0.3} ${cy - R * 0.9} M${cx} ${HZ + 14} L${cx} ${cy}" stroke="#6b3e18" stroke-width="${Math.max(3, R / 7)}" stroke-linecap="round"/>`;
  s += `<ellipse cx="${cx}" cy="${cy}" rx="${R * 1.2}" ry="${R * 1.15}" fill="url(#aStraw)" stroke="#7a5520" stroke-width="2"/>`;
  for (let k = 0; k < 6; k++) s += `<ellipse cx="${cx}" cy="${cy}" rx="${R * 1.2 - k * 1.3}" ry="${R * 1.15 - k * 1.3}" fill="none" stroke="#8a6428" stroke-width=".5" opacity=".6"/>`;
  s += targetFace(cx, cy, R, 0.95, R > 50);
  s += `<g id="aqHits"></g>`;
  [[20, 800, 1.4], [360, 790, 1.6], [60, 836, 1.8], [330, 840, 2]].forEach(([gx, gy, sc]) => { s += `<g filter="url(#aB2)" opacity=".9" transform="translate(${gx} ${gy}) scale(${sc})"><path d="M0 0 Q-6 -24 -12 -34 Q-2 -22 2 -2 Q4 -30 0 -44 Q10 -26 6 0 Q14 -22 22 -30 Q14 -14 10 0Z" fill="#1f5a22"/></g>`; });
  s += `<g id="aqFly"></g>
<g id="aqBow" transform="translate(195 860) scale(.8) translate(-195 -844)">
 <g filter="url(#aB1)"><path id="aqLimbL" d="M96 844 Q70 700 118 610 Q150 560 160 540" fill="none" stroke="url(#aLimb)" stroke-width="16" stroke-linecap="round"/><path d="M294 844 Q320 700 272 610 Q240 560 230 540" fill="none" stroke="url(#aLimb)" stroke-width="16" stroke-linecap="round"/>
  <path d="M160 540 Q170 520 160 500" fill="none" stroke="url(#aLimb)" stroke-width="11" stroke-linecap="round"/><path d="M230 540 Q220 520 230 500" fill="none" stroke="url(#aLimb)" stroke-width="11" stroke-linecap="round"/>
  <path d="M108 690 Q96 660 112 628" stroke="#ffd34d" stroke-width="2" fill="none" opacity=".8"/><path d="M282 690 Q294 660 278 628" stroke="#ffd34d" stroke-width="2" fill="none" opacity=".8"/></g>
 <path id="aqString" d="M160 500 L195 790 L230 500" fill="none" stroke="#f4f1ea" stroke-width="2.2"/>
 <rect x="172" y="560" width="46" height="300" rx="14" fill="url(#aRiser)"/><rect x="176" y="600" width="38" height="70" rx="10" fill="#0d0d10" opacity=".85"/>
 <path d="M180 620 h30 M180 636 h30 M180 652 h30" stroke="url(#aGold)" stroke-width="2"/>
 <rect x="168" y="700" width="54" height="110" rx="18" fill="#3a2414" stroke="#1a0f08" stroke-width="2"/>
 <path d="M172 720 Q195 712 218 720 M172 740 Q195 732 218 740 M172 760 Q195 752 218 760 M172 780 Q195 772 218 780" stroke="#5a3a20" stroke-width="3" fill="none"/>
 <path d="M218 586 h40 v6 h-40z" fill="#222"/><rect x="254" y="570" width="14" height="36" rx="3" fill="#111" stroke="url(#aGold)" stroke-width="1.5"/><circle cx="261" cy="588" r="3.5" fill="#39ff7a"/>
 <g id="aqArrow"><line x1="195" y1="790" x2="195" y2="455" stroke="url(#aShaft)" stroke-width="5"/><path d="M195 448 L189 462 L201 462Z" fill="#c9ced8" stroke="#444" stroke-width="1"/>
 <path d="M195 770 l-12 22 l12 -6z M195 770 l12 22 l-12 -6z" fill="#ff3d7a"/><path d="M195 756 l-10 18 l10 -5z M195 756 l10 18 l-10 -5z" fill="#fff"/><rect x="191" y="786" width="8" height="10" rx="2" fill="#ffd34d"/></g>
</g>
<g id="aqRet" transform="translate(195 ${cy + R * 2})"><circle r="18" fill="none" stroke="#fff" stroke-width="2"/><circle r="2.5" fill="#39ff7a"/><path d="M-26 0 h14 M12 0 h14 M0 -26 v14 M0 12 v14" stroke="#fff" stroke-width="2"/></g>
<rect width="${W}" height="${H}" fill="url(#aVig)" pointer-events="none"/></svg>`;
  return s;
}
// A small arrow stuck in the target at (px, py). col: colour of the feathers.
export function stuckArrow(px, py, col, R) {
  const k = Math.max(0.5, R / 40);
  return `<g class="stuck"><circle cx="${px}" cy="${py}" r="${1.6 * k}" fill="#111"/><line x1="${px}" y1="${py}" x2="${px + 9 * k}" y2="${py + 12 * k}" stroke="#222" stroke-width="${1.6 * k}" stroke-linecap="round"/><path d="M${px + 7 * k} ${py + 9 * k} l${4 * k} ${1 * k} l${-1 * k} ${5 * k}z" fill="${col}"/><path d="M${px + 6 * k} ${py + 10 * k} l${-1 * k} ${5 * k} l${4 * k} ${-1 * k}z" fill="#fff"/></g>`;
}

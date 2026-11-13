// Procedural microbes for the hot-seat and the mechanism game. Drawn on a canvas, nothing is an image.
// morph: enveloped | crown | cone | phage | icosa | rod | rodflag | cocci-chain | cocci-cluster | comma | flagellate | ring | yeast | zoospore | fibril
const TAU = Math.PI * 2;

function roundRectPath(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

export function microbe(g, cx, cy, R, morph, t, color = '#7a2d86') {
  g.save(); g.translate(cx, cy);
  g.strokeStyle = color; g.fillStyle = color; g.lineCap = 'round'; g.lineJoin = 'round';
  const lw = Math.max(1.5, R * .035);
  const body = (x, y, r, fill = .28) => { g.globalAlpha = fill; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.globalAlpha = 1; g.lineWidth = lw; g.stroke(); };
  const spikes = (r, n, len, club) => { for (let i = 0; i < n; i++) { const a = i / n * TAU + t * .1; g.beginPath(); g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(Math.cos(a) * (r + len), Math.sin(a) * (r + len)); g.lineWidth = lw; g.stroke(); if (club) { g.beginPath(); g.arc(Math.cos(a) * (r + len), Math.sin(a) * (r + len), len * .32, 0, TAU); g.fill(); } } };
  const rod = (x, y, L, W, ang) => { g.save(); g.translate(x, y); g.rotate(ang); g.globalAlpha = .28; roundRectPath(g, -L / 2, -W / 2, L, W, W / 2); g.fill(); g.globalAlpha = 1; g.lineWidth = lw; roundRectPath(g, -L / 2, -W / 2, L, W, W / 2); g.stroke(); g.restore(); };
  const flag = (x, y, ang, len, waves = 3) => { g.beginPath(); for (let i = 0; i <= 40; i++) { const k = i / 40; const px = x + Math.cos(ang) * len * k, py = y + Math.sin(ang) * len * k; const off = Math.sin(k * waves * TAU - t * 6) * len * .06; i ? g.lineTo(px - Math.sin(ang) * off, py + Math.cos(ang) * off) : g.moveTo(px, py); } g.lineWidth = lw * .8; g.stroke(); };
  switch (morph) {
    case 'enveloped': body(0, 0, R * .55); spikes(R * .55, 22, R * .16, false); for (let i = 0; i < 8; i++) { const a = i * 2.4; g.beginPath(); g.arc(Math.cos(a) * R * .25, Math.sin(a) * R * .25, R * .08, 0, TAU); g.stroke(); } break;
    case 'crown': body(0, 0, R * .5); spikes(R * .5, 18, R * .2, true); break;
    case 'cone': body(0, 0, R * .55); spikes(R * .55, 14, R * .1, true); g.beginPath(); g.moveTo(-R * .1, -R * .28); g.lineTo(R * .14, -R * .28); g.lineTo(R * .22, R * .3); g.lineTo(-R * .22, R * .3); g.closePath(); g.lineWidth = lw; g.stroke(); break;
    case 'phage': {
      const h = R * .3; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU + Math.PI / 6; g.lineTo(Math.cos(a) * h, -R * .4 + Math.sin(a) * h); } g.closePath(); g.globalAlpha = .28; g.fill(); g.globalAlpha = 1; g.lineWidth = lw; g.stroke();
      g.strokeRect(-R * .06, -R * .1, R * .12, R * .45);
      for (const s of [-1, 1]) for (const k of [.4, .8]) { g.beginPath(); g.moveTo(0, R * .35); g.lineTo(s * R * .3 * k + s * R * .1, R * .55); g.lineTo(s * R * .35 * k + s * R * .15, R * .72); g.stroke(); }
      break;
    }
    case 'icosa': { const r = R * .55; g.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } g.closePath(); g.globalAlpha = .28; g.fill(); g.globalAlpha = 1; g.lineWidth = lw; g.stroke(); for (let i = 0; i < 6; i++) { const a = i / 6 * TAU; g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * r, Math.sin(a) * r); g.stroke(); } for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.arc(Math.cos(a) * r * .75, Math.sin(a) * r * .75, R * .05, 0, TAU); g.fill(); } break; }
    case 'rod': for (let i = 0; i < 5; i++) rod(Math.cos(i * 1.7) * R * .45, Math.sin(i * 2.3) * R * .4, R * .55, R * .14, i * .9 + Math.sin(t * .3 + i) * .1); break;
    case 'rodflag': rod(0, 0, R * .8, R * .32, .2); for (let i = 0; i < 6; i++) { const a = .2 + (i % 2 ? 0 : Math.PI) + (i - 2.5) * .3; flag(Math.cos(.2) * R * .2 * (i % 2 ? 1 : -1), Math.sin(.2) * R * .1, a, R * .55); } break;
    case 'cocci-chain': for (let i = -4; i <= 4; i++) { const x = i * R * .2, y = Math.sin(i * .7 + t * .5) * R * .12; body(x, y, R * .1, .35); } break;
    case 'cocci-cluster': { const G = Math.PI * (3 - Math.sqrt(5)); for (let k = 0; k < 18; k++) { const a = k * G, rr = R * .13 * Math.sqrt(k); body(Math.cos(a) * rr, Math.sin(a) * rr, R * .11, .35); } break; }
    case 'comma': g.lineWidth = R * .2; g.globalAlpha = .35; g.beginPath(); g.arc(0, R * .1, R * .35, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.globalAlpha = 1; g.lineWidth = lw; g.beginPath(); g.arc(0, R * .1, R * .45, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); g.beginPath(); g.arc(0, R * .1, R * .25, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); flag(R * .3, -R * .22, -.4, R * .6, 4); break;
    case 'flagellate': { g.beginPath(); for (let i = 0; i <= 40; i++) { const k = i / 40, x = (k - .5) * R * 1.3, w = Math.sin(k * Math.PI) * R * .16, y = Math.sin(k * 6 - t * 3) * R * .1; i ? g.lineTo(x, y - w) : g.moveTo(x, y - w); } for (let i = 40; i >= 0; i--) { const k = i / 40, x = (k - .5) * R * 1.3, w = Math.sin(k * Math.PI) * R * .16, y = Math.sin(k * 6 - t * 3) * R * .1; g.lineTo(x, y + w); } g.closePath(); g.globalAlpha = .28; g.fill(); g.globalAlpha = 1; g.lineWidth = lw; g.stroke(); flag(R * .62, Math.sin(6 - t * 3) * R * .1, 0, R * .35, 3); body(-R * .05, 0, R * .07, .8); break; }
    case 'ring': g.strokeStyle = '#c0001a'; body(0, 0, R * .6, .18); g.strokeStyle = color; g.lineWidth = lw * 1.4; g.beginPath(); g.arc(R * .1, -R * .05, R * .18, 0, TAU); g.stroke(); body(R * .26, -R * .12, R * .06, 1); break;
    case 'yeast': body(-R * .1, R * .05, R * .38); body(R * .32, -R * .26, R * .2); body(-R * .45, -R * .35, R * .13); break;
    case 'zoospore': body(0, 0, R * .5); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + t * .2; const x = Math.cos(a) * R * .8, y = Math.sin(a) * R * .8; body(x, y, R * .07, .6); flag(x, y, a, R * .25, 2); } break;
    case 'fibril': for (let f = 0; f < 5; f++) { g.beginPath(); for (let i = 0; i <= 50; i++) { const k = i / 50, x = (k - .5) * R * 1.6, y = (f - 2) * R * .16 + Math.sin(k * 14 + f) * R * .03; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.lineWidth = lw * 1.8; g.stroke(); } break;
    default: body(0, 0, R * .5);
  }
  g.restore();
}

// Paint every <canvas data-morph> inside root (static, in focus).
export function paintMicrobes(root, color = '#7a2d86') {
  root.querySelectorAll('canvas[data-morph]').forEach(c => {
    const d = Math.min(devicePixelRatio || 1, 2), s = c.clientWidth || 200; c.width = c.height = s * d;
    const g = c.getContext('2d'); g.scale(d, d); microbe(g, s / 2, s / 2, s * .45, c.dataset.morph, 0, color);
  });
}

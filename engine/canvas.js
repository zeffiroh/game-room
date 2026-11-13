// Tiny helpers for the animated games: a canvas that fills its box, and one rAF loop per game.
const loops = new Map();

export function gameCanvas(el) {
  let c = el.querySelector('canvas.game');
  if (!c) { c = document.createElement('canvas'); c.className = 'game'; el.prepend(c); }
  return c;
}
export function fit(c) {
  const d = Math.min(devicePixelRatio || 1, 2), W = c.clientWidth, H = c.clientHeight;
  if (c.width !== Math.round(W * d) || c.height !== Math.round(H * d)) { c.width = Math.round(W * d); c.height = Math.round(H * d); }
  const g = c.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0); g.imageSmoothingEnabled = false;
  return { g, W, H };
}
// draw(g, W, H, t) is called every frame until stopLoop(key)
export function startLoop(key, c, draw) {
  const old = loops.get(key);
  if (old) { old.draw = draw; old.c = c; return; }
  const o = { draw, c, run: true };
  loops.set(key, o);
  const f = (ms) => {
    if (!o.run) return;
    if (o.c.isConnected) { const { g, W, H } = fit(o.c); g.clearRect(0, 0, W, H); try { o.draw(g, W, H, ms / 1000); } catch (e) { console.error(e); } }
    requestAnimationFrame(f);
  };
  requestAnimationFrame(f);
}
export function stopLoop(key) { const o = loops.get(key); if (o) { o.run = false; loops.delete(key); } }

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
// pixel-art rectangle with a black outline
export function block(g, x, y, w, h, fill, line = '#000') {
  g.fillStyle = line; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  const b = Math.max(1, Math.round(Math.min(w, h) * .08));
  g.fillStyle = fill; g.fillRect(Math.round(x) + b, Math.round(y) + b, Math.round(w) - 2 * b, Math.round(h) - 2 * b);
}

// text helper: bold blocky headline text
export function text(g, str, x, y, size = 20, color = '#000', align = 'left', stroke = null) {
  g.font = `900 ${size}px "Arial Black", Arial, sans-serif`; g.textAlign = align; g.textBaseline = 'middle';
  if (stroke) { g.lineWidth = Math.max(3, size * .18); g.strokeStyle = stroke; g.lineJoin = 'round'; g.strokeText(str, x, y); }
  g.fillStyle = color; g.fillText(str, x, y);
}
export const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export const rint = (a, b) => Math.floor(rnd(a, b + 1));
// segmented progress bar (Win95 style)
export function seg(g, x, y, w, h, k, color = '#7a0f1f') {
  g.fillStyle = '#000'; g.fillRect(x, y, w, h); g.fillStyle = '#fff'; g.fillRect(x + 2, y + 2, w - 4, h - 4);
  const n = Math.floor((w - 8) / 10), on = Math.round(n * clamp(k, 0, 1));
  g.fillStyle = color; for (let i = 0; i < on; i++) g.fillRect(x + 4 + i * 10, y + 4, 8, h - 8);
}

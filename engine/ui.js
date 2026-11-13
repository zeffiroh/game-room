// Small UI helpers shared by every view.
import { av } from './blocks.js';
import { now } from './store.js';
import { CREDITS, DONATE_URL } from '../config.js';
import { iconSvg } from './icons.js';

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Re-render el only when key changes; returns true if it re-rendered.
export function keyed(el, key, html, after) {
  if (el.dataset.key === key) return false;
  el.innerHTML = html();
  el.dataset.key = key;
  if (after) after(el);
  return true;
}

export const GLYPHS = ['A', 'B', 'C', 'D'];

// A Win95-style window. title goes in the bar; body is raw HTML.
export function win(title, body, { cls = '', style = '', ctl = true, id = '' } = {}) {
  return `<section class="win ${cls}" style="${style}" ${id ? `id="${id}"` : ''}><header class="tb"><span class="tt">${esc(title)}</span>${ctl ? '<span class="ctl"><i></i><i></i><i class="x"></i></span>' : ''}</header><div class="bd">${body}</div></section>`;
}

// Segmented timer bar driven by CSS; correct even if rendered mid-way.
export function timerBar(startedAt, dur) {
  const elapsed = Math.max(0, now() - startedAt);
  return `<div class="timer" aria-hidden="true"><i style="animation-duration:${dur}ms;animation-delay:-${Math.min(elapsed, dur)}ms"></i></div>`;
}
// Text countdown; the global ticker keeps it current.
export function countdown(endAt) {
  return `<span class="countdown" data-end="${endAt}">${Math.max(0, Math.ceil((endAt - now()) / 1000))}</span>`;
}
setInterval(() => {
  const t = now();
  document.querySelectorAll('[data-end]').forEach(el => {
    const s = Math.max(0, Math.ceil((+el.dataset.end - t) / 1000));
    if (el.textContent !== String(s)) el.textContent = s;
  });
  document.querySelectorAll('[data-clock]').forEach(el => {
    const s = Math.max(0, Math.ceil((+el.dataset.clock - t) / 1000));
    const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    if (el.textContent !== txt) el.textContent = txt;
  });
  document.querySelectorAll('[data-start]').forEach(el => { el.hidden = +el.dataset.start > t; });
}, 200);

export function shuffle(arr, seed) {
  const a = arr.slice();
  let s = seed == null ? Math.random() * 1e9 : seed;
  const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const uid = () => Math.random().toString(36).slice(2, 9);

export function rankPlayers(players) {
  return players.slice().sort((a, b) => b.score - a.score || b.coins - a.coins || a.name.localeCompare(b.name));
}

export function leaderboard(players, n = 6, highlightId = null) {
  const ranked = rankPlayers(players).slice(0, n);
  if (!ranked.length) return `<p class="muted">Scores show up here.</p>`;
  return `<table class="board"><tbody>${ranked.map((p, i) => `
    <tr class="${p.id === highlightId ? 'me' : ''}"><td class="rank">${i + 1}</td><td class="av">${av(p.avatar)}</td><td class="nm">${esc(p.name)}</td><td class="sc">${p.score.toLocaleString()}</td></tr>`).join('')}</tbody></table>`;
}

export function qrInto(el, text, size = 180) {
  if (!el) return;
  el.innerHTML = '';
  const draw = () => {
    if (window.QRCode) new window.QRCode(el, { text, width: size, height: size, colorDark: '#000000', colorLight: '#ffffff' });
    else setTimeout(draw, 300);
  };
  draw();
}

export function present(players, windowMs = 25000) {
  const t = now();
  return players.filter(p => !p.kicked && t - p.seen < windowMs);
}

// Footer on the hub pages: credits and a tiny donate heart. Settings live in config.js.
export function footer() {
  return `<footer class="site-foot">
    <span>Made by ${esc(CREDITS.name)} &middot; <a href="${esc(CREDITS.site)}" target="_blank" rel="noopener">${esc(CREDITS.siteLabel)}</a></span>
    <a class="donate" href="${DONATE_URL ? esc(DONATE_URL) : '#'}" ${DONATE_URL ? 'target="_blank" rel="noopener"' : 'onclick="return false" aria-disabled="true"'}>${iconSvg('heart', { size: 12 })} Donate</a>
  </footer>`;
}

// Blocky avatars. Everything is a rectangle on a pixel grid, generated from a seed,
// so nobody else in the room has your guy.

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s |= 0; s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export function hashStr(str) { let h = 2166136261; for (const c of String(str)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
export function seedOf(avatar) { const m = String(avatar || '').match(/^g:(\d+)$/); return m ? +m[1] : hashStr(avatar); }

const SKIN = ['#f5cd9a', '#e8b07a', '#c68642', '#8d5524', '#5c3a21', '#ffe0bd'];
const SHIRT = ['#c0001a', '#ffd400', '#7a2d86', '#161616', '#ff8c00', '#f4f4f4', '#d8587a', '#8a4b14'];
const PANTS = ['#222222', '#5a1020', '#7a2d86', '#8a6a3a', '#ccaa44', '#555555', '#c0001a', '#e8e8e8'];
const HAIR = ['#111111', '#3a2210', '#8a4b14', '#e8c040', '#c0001a', '#7a2d86', '#dddddd'];
const pick = (R, a) => a[Math.floor(R() * a.length)];

function spec(avatar) {
  const R = rng(seedOf(avatar));
  const s = {
    skin: pick(R, SKIN), shirt: pick(R, SHIRT), pants: pick(R, PANTS), hair: pick(R, HAIR),
    hairType: Math.floor(R() * 6), face: Math.floor(R() * 4), style: Math.floor(R() * 4),
  };
  s.accent = s.shirt === '#ffd400' || s.shirt === '#f4f4f4' ? '#161616' : '#ffd400';
  if (s.pants === s.shirt) s.pants = '#222222';
  return s;
}

const rect = (x, y, w, h, fill) => `<rect x="${x + .5}" y="${y + .5}" width="${w - 1}" height="${h - 1}" fill="${fill}" stroke="#000" stroke-width="1"/>`;
const flat = (x, y, w, h, fill) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;

function art(a, bustOnly) {
  const o = [];
  if (!bustOnly) { o.push(rect(10, 32, 8, 14, a.pants), rect(18, 32, 8, 14, a.pants)); }
  o.push(rect(9, 17, 18, 15, a.shirt));
  if (a.style === 1) o.push(flat(10, 22, 16, 3, a.accent));
  if (a.style === 2) o.push(flat(15, 20, 6, 6, a.accent));
  if (a.style === 3) { o.push(flat(10, 19, 16, 2, a.accent), flat(10, 25, 16, 2, a.accent)); }
  o.push(rect(3, 17, 6, 15, a.skin), rect(27, 17, 6, 15, a.skin));
  if (a.style !== 0) o.push(flat(4, 18, 4, 5, a.shirt), flat(28, 18, 4, 5, a.shirt));
  o.push(rect(12, 4, 12, 12, a.skin));
  // hair
  switch (a.hairType) {
    case 1: o.push(rect(12, 4, 12, 3, a.hair)); break;
    case 2: o.push(rect(12, 4, 12, 3, a.hair), rect(13, 1, 3, 3, a.hair), rect(18, 0, 3, 4, a.hair), rect(22, 1, 2, 3, a.hair)); break;
    case 3: o.push(rect(12, 4, 12, 3, a.hair), rect(11, 4, 2, 11, a.hair), rect(23, 4, 2, 11, a.hair)); break;
    case 4: o.push(rect(11, 3, 14, 4, a.accent), rect(11, 6, 16, 2, a.accent)); break;
    case 5: o.push(rect(10, 1, 16, 6, a.hair)); break;
    default: break;
  }
  // face
  const eye = a.face === 3 ? '' : flat(15, 9, 2, 2, '#000') + flat(20, 9, 2, 2, '#000');
  o.push(eye);
  if (a.face === 0) o.push(flat(15, 12, 1, 1, '#000'), flat(16, 13, 4, 1, '#000'), flat(20, 12, 1, 1, '#000'));
  if (a.face === 1) o.push(flat(16, 13, 4, 1, '#000'));
  if (a.face === 2) o.push(flat(16, 12, 4, 3, '#5a0a0a'));
  if (a.face === 3) o.push(flat(14, 8, 9, 4, '#000'), flat(16, 13, 4, 1, '#000'));
  return o.join('');
}

const cache = new Map();
function url(avatar, bust) {
  const key = (bust ? 'b:' : 'f:') + avatar;
  if (!cache.has(key)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 ${bust ? 33 : 47}" shape-rendering="crispEdges">${art(spec(avatar), bust)}</svg>`;
    cache.set(key, 'data:image/svg+xml,' + encodeURIComponent(svg));
  }
  return cache.get(key);
}
// head + torso, for lists and headers
export const av = (avatar, cls = '') => `<img class="bm bust ${cls}" alt="" src="${url(avatar, true)}">`;
// full body, for the floor and the picker
export const fig = (avatar, cls = '') => `<img class="bm fig ${cls}" alt="" src="${url(avatar, false)}">`;
// a seeded little square stamp for passport slots etc.
export function stampColors(id) { const R = rng(hashStr('stamp:' + id)); return [pick(R, SHIRT), pick(R, SKIN), pick(R, HAIR)]; }

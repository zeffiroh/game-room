// Applies a pack's colors to the CSS variables and sets the page title.
import { isIcon, iconSvg, setFavicon } from './icons.js';

export function applyTheme(pack) {
  const t = pack.theme || {};
  const root = document.documentElement;
  for (const [name, val] of Object.entries(t.colors || {})) root.style.setProperty(`--${name}`, val);
  document.title = pack.title || 'Fun Day';
}

const clean = (v, n) => String(v || '').replace(/[<>&"'`]/g, '').trim().slice(0, n);
// Room name + icon chosen by the host. Lives in room state so every screen and phone shows the same thing.
// icon is a name from engine/icons.js (older rooms may still carry an emoji; that just gets dropped).
export function applyMeta(pack, meta) {
  if (!meta) return;
  const name = clean(meta.name, 30), icon = isIcon(meta.icon) ? meta.icon : '';
  if (name) pack.title = name;
  pack.icon = icon;
  document.title = pack.title || 'Fun Day';
  if (icon) setFavicon(icon);
}
export const cleanMeta = (m) => ({ name: clean(m && m.name, 30), icon: isIcon(m && m.icon) ? m.icon : 'star' });

// Room title with its pixel icon in front. Returns HTML.
export const titleHtml = (pack, size = 28) =>
  (pack.icon && isIcon(pack.icon) ? iconSvg(pack.icon, { size }) + ' ' : '') + String(pack.title || 'Fun Day').replace(/[&<>"']/g, '');

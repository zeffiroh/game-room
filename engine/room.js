// The projector floor: a gray baseplate with studs. Every student is a block guy standing on it.
// A station can supply place(player, i, n, ctx, room) -> {x, y, cls?, mark?} in % of the screen.
import { fig } from './blocks.js';

export class Room {
  constructor(host) {
    this.el = document.createElement('div');
    this.el.className = 'floor';
    host.prepend(this.el);
    this.pawns = new Map();
    this.data = {};
    this.placer = null;
    this.list = [];
  }
  destroy() { this.el.remove(); }

  sync(players, ctx, station) {
    this.placer = station && station.place ? station : null;
    const ids = new Set(players.map(p => p.id));
    for (const [id, pw] of this.pawns) if (!ids.has(id)) { pw.el.remove(); this.pawns.delete(id); }
    this.list = [...players].sort((a, b) => a.name.localeCompare(b.name));
    for (const p of this.list) {
      let pw = this.pawns.get(p.id);
      if (!pw) {
        const el = document.createElement('div');
        el.className = 'pawn';
        el.innerHTML = `<div class="say"></div>${fig(p.avatar)}<div class="tag"></div>`;
        el.style.left = '50%'; el.style.top = '106%';
        this.el.appendChild(el);
        pw = { el, say: el.querySelector('.say'), tag: el.querySelector('.tag'), st: 0 };
        this.pawns.set(p.id, pw);
        void el.offsetWidth; // so the walk-in animates
      }
      pw.p = p;
      const nm = p.name.length > 12 ? p.name.slice(0, 11) + '…' : p.name;
      if (pw.tag.textContent !== nm) pw.tag.textContent = nm;
    }
    this.layout(ctx);
  }

  layout(ctx) {
    const n = this.list.length;
    this.list.forEach((p, i) => {
      const pw = this.pawns.get(p.id); if (!pw) return;
      let r = null;
      try { r = this.placer ? this.placer.place(p, i, n, ctx, this) : null; } catch { r = null; }
      r = r || rowPlace(i, n);
      pw.el.style.left = r.x + '%'; pw.el.style.top = r.y + '%';
      pw.el.style.zIndex = String(10 + Math.round(r.y * 10));
      const cls = 'pawn' + (r.cls ? ' ' + r.cls : '') + (pw.el.classList.contains('hop') ? ' hop' : '');
      if (pw.el.className !== cls) pw.el.className = cls;
      const mark = r.mark || '';
      if (pw.el.dataset.mark !== mark) pw.el.dataset.mark = mark;
      if (r.say !== undefined && r.say !== pw.fixedSay) {
        pw.fixedSay = r.say;
        if (r.say) { pw.say.textContent = r.say; pw.say.className = 'say show ' + (r.sayKind || ''); }
        else if (pw.say.classList.contains('show') && !pw.timed) pw.say.className = 'say';
      }
    });
  }

  // reaction / chat bubble over someone's head
  say(id, text, kind = '') {
    const pw = this.pawns.get(id); if (!pw) return;
    pw.say.textContent = text;
    pw.say.className = 'say show ' + kind;
    pw.timed = true;
    clearTimeout(pw.st);
    pw.st = setTimeout(() => { pw.timed = false; pw.say.className = 'say'; pw.fixedSay = undefined; }, kind === 'chat' ? 5500 : 2400);
    pw.el.classList.add('hop');
    setTimeout(() => pw.el.classList.remove('hop'), 450);
  }
  hop(id) { const pw = this.pawns.get(id); if (!pw) return; pw.el.classList.add('hop'); setTimeout(() => pw.el.classList.remove('hop'), 450); }
}

// Rows of guys along the bottom of the screen, centered.
export function rowPlace(i, n, { y = 84, perRow = 14, gap = 6.2, rowGap = 6.5, cx = 50 } = {}) {
  // balance rows (30 -> 2 rows of 15, not 14+14+2) and pull up when 3 rows would fall off the floor
  const rows = Math.ceil(n / perRow), per = Math.ceil(n / rows);
  const row = Math.floor(i / per), col = i % per, cnt = Math.min(per, n - row * per);
  const g = Math.min(gap, 88 / Math.max(1, cnt));
  const y0 = y - Math.max(0, rows - 2) * rowGap;
  return { x: cx + (col - (cnt - 1) / 2) * g, y: y0 + row * rowGap };
}

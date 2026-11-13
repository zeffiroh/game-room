// Spawn: everybody shows up on the baseplate and can walk around by tapping their phone.
import { fig } from '../engine/blocks.js';
import { esc, keyed, qrInto, win } from '../engine/ui.js';
import { titleHtml } from '../engine/theme.js';

// Guys wander on their own; a tap on a phone ("walk") overrides that for a while.
export function wanderPlace(p, i, n, ctx, room) {
  const d = room.data.walk || (room.data.walk = {});
  const t = performance.now();
  if (!room.data.next || t > room.data.next) {
    room.data.next = t + 5000;
    for (const q of room.list) if (!(d[q.id] && d[q.id].until > t) && Math.random() < .4) d[q.id] = { x: 6 + Math.random() * 88, y: 46 + Math.random() * 44, until: t + 1 };
  }
  if (!d[p.id]) d[p.id] = { x: 10 + Math.random() * 80, y: 50 + Math.random() * 40, until: 0 };
  return { x: d[p.id].x, y: d[p.id].y };
}
export function applyWalk(room, events) {
  const d = room.data.walk || (room.data.walk = {});
  for (const e of events) if (e.k === 'walk') d[e.p] = { x: Math.max(5, Math.min(95, (+e.d.x || .5) * 100)), y: 42 + Math.max(0, Math.min(1, +e.d.y || .5)) * 52, until: performance.now() + 12000 };
}

export default {
  id: 'lobby', title: 'Spawn',
  chat: true,
  setup: () => ({}),
  next: () => null,
  nextLabel: () => 'Start the show',
  place: wanderPlace,
  onScreenEvents(events, ctx) { applyWalk(ctx.room, events); ctx.room.layout(ctx); },

  views: {
    screen(el, ctx) {
      const joinUrl = location.href.split('#')[0] + '#/join?code=' + ctx.code;
      keyed(el, 'lobby', () => `
        <div class="pos-top" style="top:3%">${win('Welcome', `
          <div class="row" style="gap:20px;align-items:center">
            <div class="qr" id="qr"></div>
            <div><h1 class="mega small" style="margin:0">${titleHtml(ctx.pack, 48)}</h1>
            <p style="margin:.4em 0">${esc(ctx.pack.welcome || '')}</p>
            <p class="kick">Open the site and type the code</p><b class="codebig">${esc(ctx.code)}</b>
            <p id="arrived" class="kick"></p></div>
          </div>`, { ctl: false })}</div>`, (root) => qrInto(root.querySelector('#qr'), joinUrl, 150));
      const n = ctx.players.length;
      el.querySelector('#arrived').textContent = n ? `${n} here` : 'Waiting for the first person';
    },
    player(el, ctx) {
      keyed(el, 'lobby', () => `
        ${win('Spawn', `<h2>You're in, ${esc(ctx.me.name)}</h2><p class="muted">Tap the grid to walk your guy around the big screen.</p>
        <div class="plaza" id="plaza" role="button" aria-label="Tap to walk"><span class="me" id="meDot">${fig(ctx.me.avatar)}</span></div>
        <p class="hint">The buttons at the bottom make speech bubbles over your head. Every 10 gets you a coin.</p>`)}`, (root) => {
        const plaza = root.querySelector('#plaza'), dot = root.querySelector('#meDot');
        plaza.onclick = (e) => {
          const r = plaza.getBoundingClientRect();
          const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          dot.style.left = x * 100 + '%'; dot.style.top = y * 100 + '%';
          ctx.fx.haptic(10); ctx.send('walk', { x, y });
        };
      });
    },
    host(el, ctx) {
      el.innerHTML = `<p>${ctx.players.length} joined, ${ctx.present.length} connected right now.</p>
        <p class="hint">Put the projector up, let everyone join and wander, then hit the big button. Everyone here gets the first stamp.</p>`;
    },
  },
};

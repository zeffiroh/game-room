// Break room: no game. Everyone wanders the baseplate, chat is on, the jukebox is where the
// action is. The host sets a timer so people know when it's over.
import { esc, keyed, win } from '../engine/ui.js';
import { wanderPlace, applyWalk } from './lobby.js';

export default {
  id: 'breakroom', title: 'Break room',
  chat: true,
  setup: (ctx) => ({ until: ctx.now() + (ctx.step.minutes || 5) * 60000, minutes: ctx.step.minutes || 5 }),
  next: () => null,
  nextLabel: () => '',
  place: wanderPlace,
  onScreenEvents(events, ctx) { applyWalk(ctx.room, events); ctx.room.layout(ctx); },

  views: {
    screen(el, ctx) {
      const s = ctx.s;
      keyed(el, 'br' + s.until, () => `<div class="pos-top" style="top:3%">${win('Break room', `
        <div class="row" style="gap:24px;align-items:center">
          <div><p class="kick">Back in</p><b class="codebig" data-clock="${s.until}"></b></div>
          <div><p style="margin:0">${esc(ctx.step.intro || 'Stretch. Snack. Argue about songs.')}</p>
          <p class="hint">Add songs to the Jukebox from your phone (Start menu).${ctx.rt && ctx.rt.state.chatOff ? "" : " Chat is on."}</p></div>
        </div>`, { ctl: false })}</div>`);
    },
    player(el, ctx) {
      const s = ctx.s;
      keyed(el, 'br' + s.until, () => win('Break room', `
        <div class="center"><p class="kick">Back in</p><div class="countdown-phone" data-clock="${s.until}"></div></div>
        <p>${esc(ctx.step.intro || 'Stretch. Snack. Argue about songs.')}</p>
        <p class="muted">Open Start, then Jukebox, and add a song. Use the chat box to talk trash about everyone else's songs.</p>`));
    },
    host(el, ctx) {
      const s = ctx.s;
      keyed(el, 'brh' + s.until, () => `<p>Timer is running on every screen.</p><div class="row">
        <button class="btn sm" data-add="-1">-1 min</button><button class="btn sm" data-add="1">+1 min</button><button class="btn sm" data-add="5">+5 min</button></div>`, (root) => {
        root.querySelectorAll('[data-add]').forEach(b => b.onclick = () => ctx.set({ ...ctx.rt.state.s, until: ctx.rt.state.s.until + (+b.dataset.add) * 60000 }));
      });
    },
  },
};

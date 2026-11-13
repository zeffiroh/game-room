// The end: podium, scrolling credits with everybody's name, and each phone keeps its player card.
import { av } from '../engine/blocks.js';
import { esc, keyed, rankPlayers, win } from '../engine/ui.js';
import { rowPlace } from '../engine/room.js';
import { passportHtml } from './passport.js';

export default {
  id: 'closing', title: 'The end',
  chat: true,
  setup: () => ({}),
  next: () => null,
  nextLabel: () => 'End of the show',
  place: (p, i, n) => rowPlace(i, n, { y: 92, perRow: 18, gap: 4.8, rowGap: 5 }),

  views: {
    screen(el, ctx) {
      const ranked = rankPlayers(ctx.players);
      keyed(el, 'closing-' + ctx.players.length, () => `
        <div class="pos-top" style="top:4%;width:min(54%,40em)">${win(ctx.pack.closing?.title || 'The end', `<h2 class="mega small">${esc(ctx.pack.closing?.title || 'The end')}</h2><p>${esc(ctx.pack.closing?.message || '')}</p>`, { ctl: false })}</div>
        <div class="podium">${[1, 0, 2].map(k => ranked[k] ? `<div class="pod p${k + 1}"><span class="av">${av(ranked[k].avatar)}</span><b>${esc(ranked[k].name)}</b><small>${ranked[k].score.toLocaleString()}</small><i>${k + 1}</i></div>` : '').join('')}</div>
        <div class="credits-win">${win('Credits', `<div class="credits"><div class="roll" style="animation-duration:${Math.max(20, ranked.length * 3)}s">
          ${ranked.map(p => `<div><b>${av(p.avatar)} ${esc(p.name)}</b>${(p.stamps || []).length} stamps · ${p.coins} coins${honorsFor(ctx, p).map(h => `<br>${esc(h)}`).join('')}</div>`).join('')}
          <div><b>${esc(ctx.labels.curator || 'The host')}</b>${esc(ctx.pack.closing?.signoff || 'Thanks for playing.')}</div></div></div>`, { ctl: false })}</div>`);
    },
    player(el, ctx) {
      const my = honorsFor(ctx, ctx.me);
      const notes = (ctx.state.honorsLog || []).filter(h => h.note && h.ids.includes(ctx.me.id)).map(h => h.note);
      keyed(el, 'closing', () => `${win(ctx.pack.closing?.title || 'The end', `<p>${esc(ctx.pack.closing?.message || '')}</p>`)}
        <div style="height:10px"></div>
        ${passportHtml(ctx, ctx.me, my.length ? `<div style="margin-top:14px">${my.map(h => `<p style="margin:0 0 4px"><b>${esc(h)}</b></p>`).join('')}${notes.map(n => `<p style="margin:8px 0 0">"${esc(n)}"<br><small>${esc(ctx.labels.curator || 'The host')}</small></p>`).join('')}</div>` : '')}
        <p class="hint center" style="margin-top:12px">Screenshot your card to keep it.</p>`, () => { ctx.fx.sound.play('fanfare'); });
    },
    host(el) { el.innerHTML = '<p>That\'s the show. Nice work.</p><p class="hint">Leave this up while people screenshot their cards.</p>'; },
  },
};

function honorsFor(ctx, p) {
  const log = ctx.state.honorsLog || [];
  return log.filter(h => h.ids.includes(p.id)).map(h => h.title);
}

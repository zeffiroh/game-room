// "My card": your guy, your numbers, and a grid of stamps (one per game you played).
import { av, stampColors } from '../engine/blocks.js';
import { esc, rankPlayers } from '../engine/ui.js';
import { stampsOf } from '../engine/packs.js';

export function stampBox(id, name, got = true) {
  const [a, b] = stampColors(id);
  return `<div class="stamp ${got ? '' : 'empty'}">${got ? `<i style="background:${a}"></i><i style="background:${b}"></i>` : ''}<span>${esc(name)}</span></div>`;
}

export function passportHtml(ctx, me, extra = '') {
  const all = stampsOf(ctx.pack);
  const rank = rankPlayers(ctx.players).findIndex(p => p.id === me.id) + 1;
  return `<div class="passport">
    <div class="who">${av(me.avatar)}<div><h3>${esc(me.name)}</h3><small class="muted">${esc(ctx.pack.passportTitle || 'Player card')}</small></div></div>
    <div class="nums"><span><b>#${rank || '-'}</b>rank</span><span><b>${me.score.toLocaleString()}</b>points</span><span><b>${me.coins}</b>coins</span><span><b>${me.stamps.length}/${all.length}</b>stamps</span></div>
    <div class="stamps">${all.map(s => stampBox(s.id, s.name, me.stamps.includes(s.id))).join('')}</div>${extra}</div>`;
}

// Awards: automatic ones from the pack's metrics, then the teacher's personal shoutouts.
// One at a time: a short pause, then the winners step up onto the middle of the floor.
import { av } from '../engine/blocks.js';
import { esc, keyed, win } from '../engine/ui.js';
import { prefs } from '../engine/store.js';
import { rowPlace } from '../engine/room.js';

function metric(p, key) {
  if (key === 'score') return p.score; if (key === 'coins') return p.coins; if (key === 'stamps') return (p.stamps || []).length;
  if (key.startsWith('stats.')) return +(p.stats[key.slice(6)] || 0);
  return 0;
}
const norm = (s) => String(s || '').trim().toLowerCase();

export function curatorNotes() { return prefs.get('honors', []); }

function build(ctx) {
  const items = [];
  for (const a of ctx.pack.awards || []) {
    const vals = ctx.players.map(p => ({ p, v: metric(p, a.metric) })).filter(x => x.v > 0).sort((x, y) => y.v - x.v);
    if (!vals.length) continue;
    const top = vals[0].v;
    const winners = vals.filter(x => x.v === top).slice(0, 3).map(x => ({ id: x.p.id, name: x.p.name, avatar: x.p.avatar }));
    items.push({ kind: 'auto', title: a.title, blurb: a.blurb, winners, value: top, unit: a.unit || '' });
  }
  for (const n of curatorNotes()) {
    const p = ctx.players.find(x => norm(x.name) === norm(n.name)) || ctx.players.find(x => norm(n.name) && norm(x.name).startsWith(norm(n.name)));
    if (!p || !n.title) continue;
    items.push({ kind: 'curator', title: n.title, blurb: n.note || '', winners: [{ id: p.id, name: p.name, avatar: p.avatar }] });
  }
  // Everyone gets one: anybody with no award or shoutout yet gets a friendly fallback.
  const named = new Set(items.flatMap(it => it.winners.map(w => w.id)));
  const lines = [['Good vibes', 'Showed up and made the room better.'], ['Team player', 'Kept the party moving.'], ['Rising star', 'Everyone noticed.'], ['Steady hand', 'Calm under pressure.'], ['Big brain energy', 'Thinking the whole time.']];
  ctx.players.filter(p => !named.has(p.id)).forEach((p, k) => items.push({ kind: 'curator', title: lines[k % lines.length][0], blurb: lines[k % lines.length][1], winners: [{ id: p.id, name: p.name, avatar: p.avatar }] }));
  return items;
}

export default {
  id: 'honors', title: 'Awards',
  chat: true,
  setup: (ctx) => ({ items: build(ctx), i: -1, at: 0 }),
  nextLabel: (s) => s.i + 1 < s.items.length ? `Next: ${s.items[s.i + 1].title}` : '',
  next(s, ctx) {
    // late joiners: append awards for people who arrived since setup
    const have = new Set(s.items.flatMap(x => x.winners.map(w => w.id)));
    const seen = new Set(s.items.map(x => x.title));
    const extra = build(ctx).filter(x => x.kind === 'curator' ? x.winners.every(w => !have.has(w.id)) : !seen.has(x.title));
    if (extra.length) s = { ...s, items: [...s.items, ...extra] };
    if (s.i + 1 >= s.items.length) return null;
    const it = s.items[s.i + 1];
    ctx.award(it.winners.map(w => ({ id: w.id, coins: 25, stats: { honors: 1 } })));
    if (ctx.rt) ctx.rt.state.honorsLog = [...(ctx.rt.state.honorsLog || []).filter(h => h.title !== it.title), { title: it.title, ids: it.winners.map(w => w.id), note: it.kind === 'curator' ? it.blurb : '' }];
    return { ...s, i: s.i + 1, at: ctx.now() + 2500 };
  },

  place(p, i, n, ctx) {
    const s = ctx.s, it = s.items[s.i];
    if (it && ctx.now() > s.at) {
      const k = it.winners.findIndex(w => w.id === p.id);
      if (k >= 0) return { x: 50 + (k - (it.winners.length - 1) / 2) * 12, y: 62, cls: 'glow' };
    }
    return rowPlace(i, n, { y: 92, perRow: 18, gap: 4.8, rowGap: 5 });
  },

  views: {
    screen(el, ctx) {
      const s = ctx.s, it = s.items[s.i];
      if (!it) {
        keyed(el, 'intro', () => `<div class="pos-top" style="top:10%;width:min(60%,44em)">${win(ctx.step.title, `<h2>${esc(ctx.step.title)}</h2><p>${esc(ctx.step.intro || 'Time for the awards.')}</p><span class="chip">${s.items.length} awards</span>`)}</div>`);
        return;
      }
      const drum = ctx.now() < s.at;
      keyed(el, `h${s.i}-${drum}`, () => drum
        ? `<div class="pos-top" style="top:8%;width:min(60%,44em)">${win('Award', `<p class="kick">${esc(it.kind === 'curator' ? 'Personal shoutout' : 'Next award')}</p><h2 class="mega small">${esc(it.title)}</h2><p>and it goes to…</p>`, { ctl: false })}</div>`
        : `<div class="pos-top" style="top:6%;width:min(66%,50em)">${win('Award', `<p class="kick">${esc(it.kind === 'curator' ? 'Personal shoutout' : 'Award')}</p><h2 class="mega small">${esc(it.title)}</h2>
          <p class="honor-names">${it.winners.map(w => `${av(w.avatar)} ${esc(w.name)}`).join(' &amp; ')}</p>
          <p>${esc(it.blurb)}</p>${it.kind === 'auto' ? `<p class="muted">${it.value} ${esc(it.unit)}</p>` : ''}`, { ctl: false })}</div>`,
        () => { if (drum) setTimeout(() => this.screen(el, ctx), Math.max(50, s.at - ctx.now() + 40)); });
    },
    player(el, ctx) {
      const s = ctx.s, it = s.items[s.i];
      const drum = it && ctx.now() < s.at;
      const mine = it && !drum && it.winners.some(w => w.id === ctx.me.id);
      keyed(el, `h${s.i}-${drum}-${mine}`, () => !it ? win('Awards', `<h2>${esc(ctx.step.title)}</h2><p>Eyes on the big screen.</p>`)
        : drum ? win('Award', `<h2>${esc(it.title)}</h2><p>and it goes to…</p>`)
        : mine ? win('That is you', `<h2>${esc(it.title)}</h2><p>${esc(it.blurb)}</p><p><b>+25 coins</b></p>`)
        : win('Award', `<h2>${esc(it.title)}</h2><p>${it.winners.map(w => esc(w.name)).join(' &amp; ')}</p><p class="muted">Spam the reaction buttons.</p>`), () => {
        if (mine) { ctx.fx.sound.play('fanfare'); ctx.fx.haptic([50, 50, 120]); }
        if (drum) setTimeout(() => ctx.rerender(), Math.max(50, s.at - ctx.now() + 40));
      });
    },
    host(el, ctx) {
      const s = ctx.s;
      el.innerHTML = `<p>${s.items.length} awards queued. ${s.i + 1} shown.</p><ol class="mini-list" style="padding-left:18px">${s.items.map((it, i) => `<li style="${i <= s.i ? 'opacity:.55' : ''}"><b>${esc(it.title)}</b>: ${it.winners.map(w => esc(w.name)).join(' &amp; ')}</li>`).join('')}</ol>
        <p class="hint">Personal shoutouts come from the Shoutouts tab. After editing them, hit "Restart this one" to rebuild the list.</p>`;
    },
  },
};

// Host-side editor for personal shoutouts, saved in this browser. Write them before the party.
export function honorsEditor(el, rt, ctx) {
  if (el.dataset.key === 'honors') return;
  el.dataset.key = 'honors';
  const render = () => {
    const notes = curatorNotes();
    const names = new Set(ctx.players.map(p => norm(p.name)));
    el.innerHTML = `<p class="hint">Write a personal shoutout for anyone. Use the name they'll type when they join. Saved on this device only.</p>
      <div class="mini-list">${notes.map((n, i) => `<div class="mini-item stack">
        <input class="field" data-f="name" data-i="${i}" value="${esc(n.name)}" placeholder="Student name">
        <input class="field" data-f="title" data-i="${i}" value="${esc(n.title)}" placeholder="Award title (e.g. Most likely to argue with the quiz)">
        <textarea class="field" data-f="note" data-i="${i}" rows="2" placeholder="One line for them">${esc(n.note)}</textarea>
        <div class="row between"><span class="hint">${n.name ? (names.has(norm(n.name)) ? 'In the room' : 'Not joined yet') : ''}</span><button class="btn sm" data-del="${i}">Delete</button></div></div>`).join('')}</div>
      <button class="btn sm" id="addH" style="margin-top:8px">Add a shoutout</button>`;
    el.querySelectorAll('[data-f]').forEach(inp => inp.onchange = () => { const all = curatorNotes(); all[+inp.dataset.i][inp.dataset.f] = inp.value; prefs.set('honors', all); });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const all = curatorNotes(); all.splice(+b.dataset.del, 1); prefs.set('honors', all); render(); });
    el.querySelector('#addH').onclick = () => { prefs.set('honors', [...curatorNotes(), { name: '', title: '', note: '' }]); render(); };
  };
  render();
}

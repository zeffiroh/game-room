// Movie night. Before the film: a poll, the host adds a few YouTube links and the class votes.
// During the film: the video plays in a window, chat and reactions scroll across it like live comments,
// a hype meter fills when the room goes loud, and the class can vote to pause or rewind 30 seconds.
import { esc, keyed, win } from '../engine/ui.js';
import { createPlayer, videoId } from '../engine/yt.js';
import { rowPlace } from '../engine/room.js';
import { reactionText } from '../engine/reactions.js';

let player = null, creating = false, errMsg = '', unlocked = false;
let hype = [], wildUntil = 0;

function target(s, now) { return (s.pos || 0) + (s.playing ? Math.max(0, now - s.at) / 1000 : 0); }
const need = (n) => (n <= 2 ? 1 : Math.max(2, Math.ceil(n * .4)));
const tally = (s) => (s.cands || []).map((c, i) => Object.values(s.votes || {}).filter(v => v === i).length);

export default {
  id: 'movie', title: 'Movie night',
  chat: true,
  setup: (ctx) => {
    const url = ctx.step.url || ctx.content.url || '';
    return { url, vid: videoId(url), title: ctx.step.film || ctx.content.title || 'Tonight\'s movie', playing: false, pos: 0, at: 0, cands: ctx.content.cands || [], votes: {}, pv: {}, rv: {}, banner: null };
  },
  next: () => null,
  nextLabel: () => '',
  place: (p, i, n) => rowPlace(i, n, { y: 92, perRow: 18, gap: 4.6, rowGap: 5 }),

  tick(s, ctx) {
    if (s.banner && ctx.now() - s.banner.at > 5000) return { ...s, banner: null };
  },
  onEvent(s, ev, ctx) {
    if (ev.k === 'mv-vote') {
      const i = ev.d.i | 0; if (!s.cands[i] || s.vid) return;
      return { ...s, votes: { ...s.votes, [ev.p]: i } };
    }
    if (!s.vid || !s.playing) return;
    const n = need(ctx.present.length);
    const here = (o) => Object.keys(o).filter(k => ctx.present.some(p => p.id === k)).length;
    if (ev.k === 'mv-pause' && !s.pv[ev.p]) {
      const pv = { ...s.pv, [ev.p]: 1 };
      if (here(pv) >= n) return { ...s, playing: false, pos: target(s, ctx.now()), at: ctx.now(), pv: {}, rv: {}, banner: { text: 'THE CLASS VOTED TO PAUSE', at: ctx.now() } };
      return { ...s, pv };
    }
    if (ev.k === 'mv-rew' && !s.rv[ev.p]) {
      const rv = { ...s.rv, [ev.p]: 1 };
      if (here(rv) >= n) return { ...s, pos: Math.max(0, target(s, ctx.now()) - 30), at: ctx.now(), pv: {}, rv: {}, banner: { text: 'REWIND 30 SECONDS', at: ctx.now() } };
      return { ...s, rv };
    }
  },

  // projector only: live comments scroll across the video, and the hype meter listens
  onScreenEvents(events, ctx) {
    const box = ctx.root.querySelector('.danmaku');
    const t = Date.now();
    for (const e of events) {
      if (e.k !== 'react' && e.k !== 'chat') continue;
      if (e.k === 'chat' && ctx.state.chatOff) continue;
      hype.push(t);
      const p = ctx.players.find(x => x.id === e.p); if (!p || !box) continue;
      const txt = e.k === 'react' ? reactionText(e.d.e) : String(e.d.text || '').slice(0, 60);
      if (!txt) continue;
      const sp = document.createElement('span');
      sp.className = 'dm ' + (e.k === 'react' ? 'r' : '');
      sp.textContent = e.k === 'react' ? txt : `${p.name}: ${txt}`;
      sp.style.top = (4 + Math.random() * 78) + '%'; sp.style.animationDuration = (7 + Math.random() * 3) + 's';
      box.appendChild(sp); setTimeout(() => sp.remove(), 11000);
    }
    hype = hype.filter(x => t - x < 8000);
    if (hype.length >= Math.max(8, ctx.present.length * 1.4) && t > wildUntil) {
      wildUntil = t + 5000; hype = [];
      for (const p of ctx.players) ctx.room.hop(p.id);
      ctx.fx.sound.play('fanfare');
    }
  },

  views: {
    screen(el, ctx) {
      const s = ctx.s;
      if (!s.vid) {
        const tl = tally(s), tot = tl.reduce((a, b) => a + b, 0);
        keyed(el, 'poll' + s.cands.length + JSON.stringify(tl), () => `<div class="pos-top" style="top:5%;width:min(70%,52em)">${win('Movie poll', s.cands.length ? `
          <h2>What are we watching?</h2><p class="muted">Vote on your phone. ${tot} vote${tot === 1 ? '' : 's'} so far.</p>
          ${s.cands.map((c, i) => `<div class="pollrow"><b>${esc(c.title)}</b><div class="pbar"><i style="width:${tot ? tl[i] / tot * 100 : 0}%"></i></div><span>${tl[i]}</span></div>`).join('')}`
          : `<h2>Movie night</h2><p>The host is picking tonight's movie.</p>`, { ctl: false })}</div>`);
        return;
      }
      keyed(el, 'movie', () => `<div class="cinema">${win('Movie night', `<div class="yt-host" id="yth"><div class="danmaku"></div><div class="wild" id="wild" hidden>CROWD GOES WILD</div><button class="btn def" id="unlock" style="position:absolute;inset:auto;left:50%;top:50%;transform:translate(-50%,-50%);z-index:5" hidden>Click once to start with sound</button></div>
        <div class="cap" id="cap"></div><div class="hypebar"><span>HYPE</span><div class="pbar"><i id="hype"></i></div></div>`, { ctl: false })}</div>`, async (root) => {
        if (player || creating) return;
        creating = true;
        try { player = await createPlayer(root.querySelector('#yth'), { onError: (c) => { errMsg = [101, 150, 153].includes(c) ? "This video can't be embedded. Paste a different link in the host panel." : "This video won't play (" + c + "). Try a different link."; } }); }
        catch { errMsg = "YouTube didn't load. Check the connection and reload this page."; }
        creating = false;
      });
      const cap = el.querySelector('#cap');
      if (cap) {
        cap.textContent = errMsg || (s.banner ? s.banner.text : (s.playing ? s.title : `${s.title}: paused`));
        cap.classList.toggle('alert', !!s.banner);
      }
      const hb = el.querySelector('#hype'); if (hb) hb.style.width = Math.min(100, hype.filter(x => Date.now() - x < 8000).length / Math.max(8, ctx.present.length * 1.4) * 100) + '%';
      const w = el.querySelector('#wild'); if (w) w.hidden = Date.now() > wildUntil;
      const ul = el.querySelector('#unlock');
      if (ul) { ul.hidden = unlocked || !player; ul.onclick = () => { unlocked = true; ul.hidden = true; player && (player.volume(100), player.play()); }; }
      if (!player) return;
      if (player.id !== s.vid) { errMsg = ''; player.load(s.vid, target(s, ctx.now()), s.playing); return; }
      const want = target(s, ctx.now()), st = player.state();
      if (s.playing) { if (st !== 1 && st !== 3) player.play(); if (Math.abs(player.time() - want) > 2.5) player.seek(want); }
      else { if (st === 1) player.pause(); if (Math.abs(player.time() - want) > 1.5) player.seek(want); }
    },
    teardown() { if (player) { player.destroy(); player = null; } errMsg = ''; unlocked = false; creating = false; hype = []; },

    player(el, ctx) {
      const s = ctx.s, me = ctx.me.id, n = need(ctx.present.length);
      if (!s.vid) {
        const tl = tally(s), mine = s.votes[me];
        keyed(el, `mp-${s.cands.length}-${mine}-${tl.join()}`, () => win('Movie night', s.cands.length ? `<h2>Vote for the movie</h2>
          <div class="choices">${s.cands.map((c, i) => `<button class="choice c${i % 4} ${mine === i ? 'picked' : ''}" data-i="${i}"><span class="g">${tl[i]}</span>${esc(c.title)}</button>`).join('')}</div>
          <p class="muted center" style="margin-top:10px">${mine != null ? 'Voted. You can change it.' : 'Pick one.'}</p>` : `<h2>Movie starts soon</h2><p>Find a spot on the floor. The host is picking.</p>`), (root) => {
          root.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { ctx.send('mv-vote', { i: +b.dataset.i }); ctx.fx.haptic(15); });
        });
        return;
      }
      const quick = ctx.content.quick || ['No way', 'Called it', 'This is great', 'Rewind that', 'Louder', 'Turn it off'];
      const pc = Object.keys(s.pv).length, rc = Object.keys(s.rv).length;
      keyed(el, `m-${s.vid}-${s.playing}-${pc}-${rc}-${!!s.pv[me]}-${!!s.rv[me]}`, () => win('Movie night', `
        <h2>${esc(s.title)}</h2>
        ${s.playing ? `<div class="row"><button class="btn" data-v="mv-pause" ${s.pv[me] ? 'disabled' : ''}>Vote pause ${pc}/${n}</button><button class="btn" data-v="mv-rew" ${s.rv[me] ? 'disabled' : ''}>Vote rewind 30s ${rc}/${n}</button></div>` : '<p>Paused. Waiting on the host.</p>'}
        <p class="kick" style="margin-top:12px">Say something (shows up over the video)</p>
        <div class="quick">${quick.map(q => `<button class="btn" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>`), (root) => {
        root.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { ctx.send('chat', { text: b.dataset.q }); ctx.fx.haptic(10); ctx.fx.sound.play('tap'); });
        root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { ctx.send(b.dataset.v, {}); b.disabled = true; ctx.fx.haptic(15); });
      });
    },

    host(el, ctx) {
      const s = ctx.s;
      const tl = tally(s);
      keyed(el, 'mh' + s.cands.map(c => c.url).join('|') + !!s.vid, () => `
        <form id="mf" class="stack">
          <label for="mu"><b>YouTube link</b></label><input class="field" id="mu" value="${esc(s.url || '')}" placeholder="https://www.youtube.com/watch?v=...">
          <input class="field" id="mt" value="${esc(s.title || '')}" placeholder="Title shown on screen">
          <div class="row"><button class="btn sm" data-act="load">Play this now</button><button class="btn sm" data-act="cand">Add to poll</button></div></form>
        ${s.cands.length ? `<div class="mini-list" style="margin-top:8px">${s.cands.map((c, i) => `<div class="mini-item"><span><b>${esc(c.title)}</b> <small class="muted"><span data-vc="${i}">${tl[i]}</span> votes</small></span><div class="row"><button class="btn sm" data-play="${i}">Play this</button><button class="btn sm" data-drop="${i}">Remove</button></div></div>`).join('')}</div>
          <button class="btn sm" id="win" style="margin-top:8px">Play the winner</button>` : ''}
        <div class="row" style="margin-top:10px">
          <button class="btn def" id="pp"></button><button class="btn sm" data-j="-30">-30s</button><button class="btn sm" data-j="30">+30s</button><button class="btn sm" data-j="restart">Restart</button></div>
        <p class="hint" id="mstat"></p>`, (root) => {
        const form = root.querySelector('#mf');
        const read = () => { const url = root.querySelector('#mu').value.trim(), vid = videoId(url); return { url, vid, title: root.querySelector('#mt').value.trim() || 'Tonight\'s movie' }; };
        const load = (m) => ctx.set({ ...ctx.rt.state.s, url: m.url, vid: m.vid, title: m.title, playing: false, pos: 0, at: ctx.now(), votes: {}, pv: {}, rv: {} });
        form.onsubmit = (e) => e.preventDefault();
        root.querySelector('[data-act="load"]').onclick = () => { const m = read(); if (!m.vid) return ctx.fx.toast("That doesn't look like a YouTube link"); load(m); ctx.fx.toast('Loaded. Press Play.'); };
        root.querySelector('[data-act="cand"]').onclick = () => { const m = read(); if (!m.vid) return ctx.fx.toast("That doesn't look like a YouTube link"); const cs = ctx.rt.state.s.cands; if (cs.length >= 4) return ctx.fx.toast('Poll is full (4 max)'); if (cs.some(c => videoId(c.url) === m.vid)) return ctx.fx.toast('Already in the poll'); ctx.set({ ...ctx.rt.state.s, cands: [...cs, { url: m.url, title: root.querySelector('#mt').value.trim() || `Option ${cs.length + 1}` }] }); root.querySelector('#mu').value = ''; root.querySelector('#mt').value = ''; ctx.fx.toast('Added to the poll'); };
        root.querySelectorAll('[data-play]').forEach(b => b.onclick = () => { const c = ctx.rt.state.s.cands[+b.dataset.play]; load({ url: c.url, vid: videoId(c.url), title: c.title }); });
        root.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => { const cur = ctx.rt.state.s; ctx.set({ ...cur, cands: cur.cands.filter((_, i) => i !== +b.dataset.drop), votes: {} }); });
        const w = root.querySelector('#win'); if (w) w.onclick = () => { const cur = ctx.rt.state.s, t2 = tally(cur); const i = t2.indexOf(Math.max(...t2)); const c = cur.cands[i]; if (c) load({ url: c.url, vid: videoId(c.url), title: c.title }); };
        root.querySelector('#pp').onclick = () => { const cur = ctx.rt.state.s, t = target(cur, ctx.now()); ctx.set({ ...cur, playing: !cur.playing, pos: t, at: ctx.now(), pv: {}, rv: {} }); };
        root.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { const cur = ctx.rt.state.s, t = target(cur, ctx.now()); const pos = b.dataset.j === 'restart' ? 0 : Math.max(0, t + +b.dataset.j); ctx.set({ ...cur, pos, at: ctx.now() }); });
      });
      el.querySelectorAll('[data-vc]').forEach(x => x.textContent = tl[+x.dataset.vc] || 0);
      el.querySelector('#pp').textContent = s.playing ? 'Pause' : 'Play';
      el.querySelector('#pp').disabled = !s.vid;
      const t = target(s, ctx.now());
      el.querySelector('#mstat').textContent = s.vid ? `${s.playing ? 'Playing' : 'Paused'} at ${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}. Pause votes ${Object.keys(s.pv).length}, rewind votes ${Object.keys(s.rv).length}.` : 'Add a few links to the poll, or paste one and play it.';
    },
  },
};

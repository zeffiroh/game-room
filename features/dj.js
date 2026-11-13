// Jukebox: everybody picks a song (a title, or a YouTube link). Everyone votes. Spend 10 coins to
// bump a song to the top. Fair play: people who haven't had a song played yet go first.
// 40% of the room can vote to skip a song. The host plays them (or they auto-advance when a song ends);
// the projector's corner player streams the music and pauses itself during the movie.
import { esc } from '../engine/ui.js';
import { now } from '../engine/store.js';
import { videoId, createPlayer } from '../engine/yt.js';

const BOOST = 10;
const music = (rt) => {
  const m = rt.state.music || (rt.state.music = {});
  return Object.assign(m, { queue: m.queue || [], now: m.now || null, playing: !!m.playing, at: m.at || 0, pos: m.pos || 0, played: m.played || {}, skips: m.skips || [], hist: m.hist || [], dur: m.dur || 0 });
};
// fair order: people with fewer songs played go first, then bumps, then votes, then who asked first
const order = (q, played = {}) => q.slice().sort((a, b) => (played[a.by] || 0) - (played[b.by] || 0) || (b.boost || 0) - (a.boost || 0) || b.votes.length - a.votes.length || a.at - b.at);
const skipNeeded = (n) => Math.max(1, Math.ceil(n * .4));

export function onEvent(rt, ev, p) {
  const m = music(rt);
  if (ev.k === 'dj-req') {
    const title = String(ev.d.title || '').trim().slice(0, 80), vid = videoId(ev.d.url);
    if (!title && !vid) return;
    if (m.queue.filter(x => x.by === p.id).length >= 2) return;
    if (m.queue.some(x => x.id === ev.id)) return;
    m.queue = [...m.queue, { id: ev.id, title: title || 'YouTube song', vid, by: p.id, name: p.name, votes: [p.id], at: ev.t, boost: 0 }];
    if (!m.now && vid) { advance(rt); return; } // idle jukebox: start the first playable song on its own
  } else if (ev.k === 'dj-vote') {
    m.queue = m.queue.map(x => x.id === ev.d.id && !x.votes.includes(p.id) ? { ...x, votes: [...x.votes, p.id] } : x);
  } else if (ev.k === 'dj-boost') {
    if (p.coins < BOOST) return;
    const item = m.queue.find(x => x.id === ev.d.id); if (!item) return;
    rt.award([{ id: p.id, coins: -BOOST, stats: { boosts: 1 } }]);
    m.queue = m.queue.map(x => x.id === ev.d.id ? { ...x, boost: (x.boost || 0) + 1 } : x);
  } else if (ev.k === 'dj-skip') {
    if (!m.now || m.skips.includes(p.id) || m.now.by === p.id) return;
    m.skips = [...m.skips, p.id];
    if (m.skips.length >= skipNeeded(rt.ctx().present.length)) { advance(rt); rt.announce('The room voted to skip that one.'); return; }
  }
  rt.mark();
}

export function play(rt, item) {
  const m = music(rt);
  if (!item) return;
  m.queue = m.queue.filter(x => x.id !== item.id);
  if (m.now) m.hist = [m.now.title, ...m.hist].slice(0, 8);
  m.now = item; m.playing = !!item.vid; m.at = now(); m.pos = 0; m.skips = []; m.dur = 0;
  if (item.by && item.by !== 'host') m.played = { ...m.played, [item.by]: (m.played[item.by] || 0) + 1 };
  rt.mark();
}
// next playable song in fair order, or stop
export function advance(rt) {
  const m = music(rt);
  const nx = order(m.queue, m.played).find(x => x.vid);
  if (nx) play(rt, nx);
  else { if (m.now) m.hist = [m.now.title, ...m.hist].slice(0, 8); m.now = null; m.playing = false; m.skips = []; rt.mark(); }
}

// Host side: a muted, hidden player reads the song length so the queue can advance on its own.
let hp = null, hpBox = null, hpMaking = false;
export async function hostTick(rt) {
  const m = music(rt);
  if (!m.now || !m.now.vid || !m.playing) return;
  if (!hp && !hpMaking) {
    hpMaking = true;
    hpBox = document.createElement('div'); hpBox.style.cssText = 'position:fixed;left:-9999px;top:0;width:220px;height:140px;opacity:0;pointer-events:none';
    document.body.appendChild(hpBox);
    try { hp = await createPlayer(hpBox, {}); hp.volume(0); } catch { hp = null; }
    hpMaking = false;
  }
  if (!hp) return;
  if (hp.id !== m.now.vid) { hp.load(m.now.vid, 0, false); return; }
  const d = hp.dur();
  if (d > 5 && m.dur !== d) m.dur = d;
  if (m.dur) {
    const at = (m.pos || 0) + (now() - m.at) / 1000;
    if (at >= m.dur - 1) advance(rt);
  }
}
export function hostStop() { if (hp) { try { hp.destroy(); } catch {} hp = null; } if (hpBox) { hpBox.remove(); hpBox = null; } }

export function hostPanel(el, rt) {
  const m = music(rt);
  const key = 'djh' + JSON.stringify([m.queue.map(x => [x.id, x.votes.length, x.boost, x.vid]), m.now && m.now.id, m.playing, m.skips.length]);
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  el.innerHTML = `
    <div class="mini-item live"><b>Now playing</b>
      <span>${m.now ? `${esc(m.now.title)} <small class="muted">(${esc(m.now.name || 'host')})</small>` : 'Nothing yet'}</span>
      ${m.now ? `<small class="muted">Skip votes ${m.skips.length} of ${skipNeeded(rt.ctx().present.length)}${m.dur ? ' · auto-advances at the end' : ''}</small>` : ''}
      <div class="row"><button class="btn sm" id="djpp" ${m.now && m.now.vid ? '' : 'disabled'}>${m.playing ? 'Pause' : 'Play'}</button><button class="btn sm" id="djskip">Next song</button></div></div>
    <form id="djadd" class="row" style="margin:10px 0"><input class="field" id="djurl" placeholder="Paste a YouTube link to play now"><button class="btn sm">Play</button></form>
    <div class="mini-list">${order(m.queue, m.played).map(x => `<div class="mini-item"><span><b>${esc(x.title)}</b> <small class="muted">by ${esc(x.name)} · ${x.votes.length} votes${x.boost ? ` · bumped ${x.boost}x` : ''}</small></span>
      <div class="row">${x.vid ? `<button class="btn sm" data-play="${x.id}">Play</button>` : `<a class="btn sm" target="_blank" rel="noopener" href="https://www.youtube.com/results?search_query=${encodeURIComponent(x.title)}">Find it</a><input class="field" style="flex:1;min-width:120px;padding:.3em" data-link="${x.id}" placeholder="paste link">`}
      <button class="btn sm" data-drop="${x.id}">Remove</button></div></div>`).join('') || '<p class="muted">No requests yet.</p>'}</div>`;
  el.querySelector('#djpp').onclick = () => { const t = m.pos + (m.playing ? (now() - m.at) / 1000 : 0); m.playing = !m.playing; m.pos = t; m.at = now(); rt.mark(); };
  el.querySelector('#djskip').onclick = () => advance(rt);
  el.querySelector('#djadd').onsubmit = (e) => { e.preventDefault(); const vid = videoId(el.querySelector('#djurl').value); if (!vid) return; play(rt, { id: 'h' + Date.now(), title: 'Host pick', vid, name: 'host', by: 'host', votes: [] }); };
  el.querySelectorAll('[data-play]').forEach(b => b.onclick = () => play(rt, m.queue.find(x => x.id === +b.dataset.play)));
  el.querySelectorAll('[data-drop]').forEach(b => b.onclick = () => { m.queue = m.queue.filter(x => x.id !== +b.dataset.drop); rt.mark(); });
  el.querySelectorAll('[data-link]').forEach(inp => inp.onchange = () => { const vid = videoId(inp.value); if (vid) { m.queue = m.queue.map(x => x.id === +inp.dataset.link ? { ...x, vid } : x); rt.mark(); } });
}

export function playerSheet(el, ctx) {
  const m = ctx.state.music || { queue: [] };
  const played = m.played || {}, skips = m.skips || [];
  const me = ctx.me;
  const mineN = m.queue.filter(x => x.by === me.id).length;
  const need = skipNeeded(ctx.present.length);
  const key = 'dj' + JSON.stringify(m.queue.map(x => [x.id, x.votes.length, x.boost])) + (m.now && m.now.id) + me.coins + skips.length + (played[me.id] || 0);
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  const ord = order(m.queue, played);
  el.innerHTML = `
    <div class="why" style="margin:0 0 10px"><b>Now playing</b>${m.now ? `${esc(m.now.title)}<br><small class="muted">picked by ${esc(m.now.name || 'the host')}</small>` : 'nothing yet'}
      ${m.now && m.now.by !== me.id ? `<div style="margin-top:8px"><button class="btn sm" id="skip" ${skips.includes(me.id) ? 'disabled' : ''}>Vote skip (${skips.length}/${need})</button></div>` : ''}</div>
    ${mineN < 2 ? `<form id="req" class="stack"><input class="field" id="rt" maxlength="80" placeholder="Song and artist"><input class="field" id="ru" placeholder="YouTube link (optional, plays faster)"><button class="btn def">Add to the jukebox</button></form>` : '<p class="hint">You have 2 songs in the queue. Vote on the others.</p>'}
    <p class="hint">Fair play: people who haven't had a song played yet go first. You've had ${played[me.id] || 0} played.</p>
    <div class="mini-list">${ord.map((x, i) => `<div class="mini-item"><span><b>${i + 1}. ${esc(x.title)}</b> <small class="muted">by ${esc(x.name)}</small></span>
      <div class="row"><button class="btn sm" data-vote="${x.id}" ${x.votes.includes(me.id) ? 'disabled' : ''}>Vote ${x.votes.length}</button>
      <button class="btn sm" data-boost="${x.id}" ${me.coins < BOOST ? 'disabled' : ''}>Bump ${BOOST} coins</button></div></div>`).join('') || '<p class="muted">Empty. Be the first.</p>'}</div>`;
  const f = el.querySelector('#req');
  if (f) f.onsubmit = (e) => { e.preventDefault(); const title = el.querySelector('#rt').value.trim(), url = el.querySelector('#ru').value.trim(); if (!title && !url) return; ctx.send('dj-req', { title, url }); ctx.fx.toast('Added'); el.querySelector('#rt').value = ''; el.querySelector('#ru').value = ''; };
  const sk = el.querySelector('#skip'); if (sk) sk.onclick = () => { ctx.send('dj-skip', {}); sk.disabled = true; ctx.fx.haptic(15); };
  el.querySelectorAll('[data-vote]').forEach(b => b.onclick = () => { ctx.send('dj-vote', { id: +b.dataset.vote }); b.disabled = true; ctx.fx.haptic(10); });
  el.querySelectorAll('[data-boost]').forEach(b => b.onclick = () => { ctx.send('dj-boost', { id: +b.dataset.boost }); b.disabled = true; ctx.fx.toast('Bumped'); });
}

// projector corner: now-playing card with an equalizer and the next few songs
let yt = null, ytBox = null, creating = false;
export async function screenMini(el, ctx) {
  const m = music({ state: ctx.state, mark() {} });
  const movieOn = ctx.step.station === 'movie' && ctx.s.vid;
  const shouldPlay = m.now && m.now.vid && m.playing && !movieOn && ctx.started;
  if (!el.dataset.ready) {
    el.dataset.ready = 1;
    el.innerHTML = `<section class="win now-playing" id="npc" hidden><header class="tb"><span class="tt">Jukebox</span></header><div class="bd">
      <div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div class="yt" id="ytbox"></div><div style="min-width:0"><div class="eq" id="eq"><i></i><i></i><i></i><i></i><i></i><i></i></div><b id="npt"></b><small id="npb"></small><small id="nps"></small></div></div>
      <div class="upnext" id="npq"></div></div></section>`;
    ytBox = el.querySelector('#ytbox');
  }
  const card = el.querySelector('#npc');
  card.hidden = !(m.now && !movieOn);
  if (m.now) {
    el.querySelector('#npt').textContent = m.now.title;
    el.querySelector('#npb').textContent = m.now.name && m.now.name !== 'host' ? `picked by ${m.now.name}` : 'host pick';
    el.querySelector('#nps').textContent = m.skips.length ? `skip votes ${m.skips.length}/${skipNeeded(ctx.present.length)}` : '';
    el.querySelector('#eq').classList.toggle('on', !!shouldPlay);
    const up = order(m.queue, m.played).slice(0, 3);
    el.querySelector('#npq').innerHTML = up.length ? `<small>UP NEXT</small>${up.map((x, i) => `<div>${i + 1}. ${x.title.replace(/[&<>]/g, '')} <i>${x.name.replace(/[&<>]/g, '')}</i></div>`).join('')}` : '';
  }
  if (!m.now || !m.now.vid) { if (yt) yt.pause(); return; }
  if (!yt && !creating) { creating = true; yt = await createPlayer(ytBox, { onEnd: () => {} }); creating = false; }
  if (!yt) return;
  const want = (m.pos || 0) + (m.playing ? (now() - m.at) / 1000 : 0);
  if (yt.id !== m.now.vid) { yt.load(m.now.vid, want, shouldPlay); return; }
  const st = yt.state();
  if (shouldPlay) { if (st !== 1 && st !== 3) yt.play(); if (Math.abs(yt.time() - want) > 4) yt.seek(want); }
  else if (st === 1) yt.pause();
}

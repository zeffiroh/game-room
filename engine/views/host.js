// Host panel: run of show, the big Next button, game controls, players, pop-ups, jukebox, shoutouts, settings.
import { av } from '../blocks.js';
import { db, isDemoCode } from '../db.js';
import { identity, connect, prefs } from '../store.js';
import { loadPack } from '../packs.js';
import { applyTheme, applyMeta, titleHtml } from '../theme.js';
import { HostRuntime } from '../host-runtime.js';
import { esc, leaderboard, win } from '../ui.js';
import { fx } from '../fx.js';
import * as popups from '../../features/popups.js';
import * as dj from '../../features/dj.js';
import { honorsEditor } from '../../features/honors.js';

export async function mount(app, params) {
  const code = (params.get('code') || '').toUpperCase();
  let token = identity.hostToken(code);
  if (!token) {
    app.innerHTML = `<div class="desk"><div class="desk-in narrow"><form id="f">${win('Host room ' + code, `
      <p>This browser doesn't have the host key for this room. Paste the key from the original host device (Host panel, Settings tab).</p>
      <input class="field" id="k" placeholder="Host key" required><button class="btn def block" style="margin-top:10px">Take over hosting</button>`)}</form></div></div>`;
    app.querySelector('#f').onsubmit = (e) => { e.preventDefault(); identity.setHostToken(code, app.querySelector('#k').value.trim()); location.reload(); };
    return;
  }

  let first;
  try { first = await db.poll(code, -1, null); }
  catch { app.innerHTML = `<div class="desk"><div class="desk-in narrow">${win('Error', `<h2>Room ${esc(code)} not found</h2><a class="btn def block" href="#/party">Make a new room</a>`)}</div></div>`; return; }
  const pack = await loadPack(first.room.pack);
  applyTheme(pack);
  let pendingMeta = null; try { pendingMeta = JSON.parse(localStorage.getItem('party.meta.' + code)); } catch {}
  applyMeta(pack, first.room.state?.meta || pendingMeta);

  const base = location.href.split('#')[0];
  const screenUrl = `${base}#/screen?code=${code}`;
  const joinUrl = `${base}#/join?code=${code}`;
  let tab = prefs.get('hostTab', 'players');
  if (tab === 'popups') tab = 'players';

  app.innerHTML = `
  <div class="host">
    <header class="hs-top">
      <span class="code" title="Room code">${esc(code)}</span>
      <span class="ttl">${titleHtml(pack, 18)}</span>
      ${isDemoCode(code) ? '<span class="chip" title="Demo rooms only work in this browser">DEMO</span>' : ''}
      <span class="sp"></span>
      <span class="chip" id="count">0 here</span>
      <a class="btn sm" href="${esc(screenUrl)}" target="_blank" rel="noopener">Open projector screen</a>
      <button class="btn sm" id="copyJoin">Copy join link</button>
      <button class="btn sm" id="mute"></button>
    </header>
    <div class="hs-grid">
      <nav aria-label="Run of show">${win('Run of show', `<ol class="runsheet" id="runsheet"></ol><p class="hint">Click a row twice to jump there.</p>`, { ctl: false })}</nav>
      <section class="hs-center">
        ${win('Now playing', `
          <div class="kick" id="pav"></div>
          <h2 id="stTitle"></h2>
          <div id="stHost"></div>
          <div class="next-sticky"><button class="btn def next-btn" id="next"></button></div>
          <div class="row"><button class="btn sm" id="restart">Restart this one</button><button class="btn sm" id="skip">Skip ahead</button></div>`, { ctl: false })}
        <form id="annForm" style="margin-top:12px">${win('Announce to everyone', `
          <div class="row"><input class="field" id="ann" maxlength="160" placeholder="Pizza is here. Five minute break."><button class="btn def">Send</button></div>`, { ctl: false })}</form>
      </section>
      <aside>${win('Tools', `
        <div class="tabs" role="tablist">
          ${['players', 'dj', 'popups', 'honors', 'settings'].map(t => `<button role="tab" data-tab="${t}" aria-selected="${t === tab}">${{ players: 'Players', popups: 'Pop-ups', dj: 'Jukebox', honors: 'Shoutouts', settings: 'Settings' }[t]}</button>`).join('')}
        </div>
        <div id="tabBody"></div>`, { ctl: false })}</aside>
    </div>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const setMute = () => { $('#mute').textContent = fx.sound.muted ? 'Sound off' : 'Sound on'; };
  setMute(); $('#mute').onclick = () => { fx.sound.muted = !fx.sound.muted; setMute(); };
  $('#copyJoin').onclick = async () => { try { await navigator.clipboard.writeText(joinUrl); fx.toast('Join link copied'); } catch { fx.toast(joinUrl, 8000); } };

  let raf = null, ready = false;
  function schedule() { if (ready && !raf) raf = requestAnimationFrame(() => { raf = null; render(); }); }
  const rt = new HostRuntime({
    code, token, pack,
    onChange: () => schedule(),
    onError: (e) => { if (e.code === 'NOT_HOST') fx.toast('This browser lost its host key. Use Settings on the original device.'); else fx.toast('Connection hiccup. Retrying.'); },
  });
  let pending = null; try { pending = JSON.parse(localStorage.getItem('party.show.' + code)); } catch {}
  await rt.init(first.room, first.players, pending, pendingMeta);
  ready = true;

  let armed = null;
  function render() {
    const c = rt.ctx();
    const step = c.step;
    $('#count').textContent = `${c.present.length} here`;
    $('#pav').textContent = `Step ${rt.state.step + 1} of ${pack.show.length}`;
    $('#stTitle').textContent = step.title || rt.station.title;
    const label = rt.station.nextLabel ? rt.station.nextLabel(c.s, c) : 'Next';
    const isLast = rt.state.step >= pack.show.length - 1;
    $('#next').innerHTML = `${esc(label || 'Next up')}<small>${label ? '' : (isLast ? 'End of the show' : 'Next: ' + esc(pack.show[rt.state.step + 1].title))}</small>`;
    $('#runsheet').innerHTML = pack.show.map((s, i) => `<li class="${i === rt.state.step ? 'current' : ''} ${rt.state.done[i] ? 'done' : ''}">
      <button data-step="${i}"><span>${esc(s.title)}<small>${armed === i ? 'Click again to jump here' : ''}</small></span></button></li>`).join('');
    try { rt.station.views.host($('#stHost'), c); } catch (e) { console.error(e); }
    renderTab(c);
  }

  function renderTab(c) {
    const body = $('#tabBody');
    if (tab === 'players') {
      const here = new Set(c.present.map(p => p.id));
      body.dataset.key = '';
      body.innerHTML = `<div class="plist">${c.players.slice().sort((a, b) => b.score - a.score).map(p => `
        <div class="prow ${here.has(p.id) ? '' : 'away'}"><span>${av(p.avatar)}</span><span>${esc(p.name)}<br><small class="muted">${p.score} pts · ${p.coins} coins · ${p.stamps.length} stamps</small></span>
        <button class="btn sm" data-coin="${p.id}" title="Give 10 coins">+10</button>
        <button class="btn sm" data-kick="${p.id}" title="Remove from room">Kick</button></div>`).join('') || '<p class="muted">Nobody yet. Put the join code on the projector.</p>'}</div>`;
      body.querySelectorAll('[data-coin]').forEach(b => b.onclick = () => { rt.award([{ id: b.dataset.coin, coins: 10 }]); fx.toast('Sent 10 coins'); schedule(); });
      body.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => {
        if (b.dataset.armed) { rt.kick(b.dataset.kick); fx.toast('Removed'); } else { b.dataset.armed = 1; b.textContent = 'Sure?'; }
      });
    } else if (tab === 'popups') popups.hostPanel(body, rt, c);
    else if (tab === 'dj') dj.hostPanel(body, rt, c);
    else if (tab === 'honors') honorsEditor(body, rt, c);
    else if (tab === 'settings') {
      const key = 'settings' + !!rt.state.chatOff;
      if (body.dataset.key === key) return;
      body.dataset.key = key;
      body.innerHTML = `<label class="check"><input type="checkbox" id="chatOff" ${rt.state.chatOff ? 'checked' : ''}> Turn chat off (reactions still work)</label>
        <h3 style="margin-top:16px">Host key</h3><p class="hint">To host from another device, open the host link there and paste this.</p>
        <input class="field" readonly value="${esc(token)}" onclick="this.select()">
        <h3 style="margin-top:16px">Links</h3><p class="hint">Projector: ${esc(screenUrl)}<br>Players: ${esc(joinUrl)}</p>
        <h3 style="margin-top:16px">Leaderboard</h3>${leaderboard(c.players, 10)}`;
      body.querySelector('#chatOff').onchange = (e) => { rt.state.chatOff = e.target.checked; rt.mark(); };
    }
  }

  app.addEventListener('click', async (e) => {
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; prefs.set('hostTab', tab); app.querySelectorAll('[data-tab]').forEach(x => x.setAttribute('aria-selected', x === t)); $('#tabBody').dataset.key = ''; render(); return; }
    const s = e.target.closest('[data-step]');
    if (s) {
      const i = +s.dataset.step;
      if (armed === i) { armed = null; await rt.goto(i); fx.toast('Jumped to ' + pack.show[i].title); } else { armed = i; setTimeout(() => { if (armed === i) { armed = null; schedule(); } }, 3000); }
      render();
    }
  });
  $('#next').onclick = async () => { $('#next').disabled = true; fx.sound.play('tap'); await rt.next(); $('#next').disabled = false; render(); };
  $('#restart').onclick = async () => { await rt.restart(); fx.toast('Restarted'); };
  $('#skip').onclick = async () => { await rt.goto(rt.state.step + 1); };
  $('#annForm').onsubmit = (e) => { e.preventDefault(); const v = $('#ann').value.trim(); if (v) { rt.announce(v); $('#ann').value = ''; fx.toast('Sent'); } };

  const conn = connect({ code, withEvents: true, cursor: rt.state.cursor || 0, onData: (d) => rt.ingest(d), onError: () => {} });
  render();
  return () => { conn.stop(); rt.stop(); };
}

// Phone shell: title bar, the current game, a chat box (some rooms), a taskbar with a Start menu
// and the quick reaction buttons. Jukebox and your card open as windows.
import { av } from '../blocks.js';
import { db } from '../db.js';
import { identity, connect, alias } from '../store.js';
import { loadPack } from '../packs.js';
import { applyTheme, applyMeta } from '../theme.js';
import { loadStation, makeCtx } from '../stations.js';
import { esc, win } from '../ui.js';
import { fx } from '../fx.js';
import { REACTIONS } from '../reactions.js';
import * as popups from '../../features/popups.js';
import * as dj from '../../features/dj.js';
import { passportHtml, stampBox } from '../../features/passport.js';

export async function mount(app, params) {
  const code = (params.get('code') || '').toUpperCase();
  const me0 = identity.player(code);
  const p = alias() ? `&p=${alias()}` : '';
  if (!me0) { location.hash = `#/join?code=${code}${p}`; return; }

  app.innerHTML = `
  <div class="phone">
    <header class="ph-top tb">
      <span class="tt" id="ttl">Fun Day</span>
      <span class="stat" id="score"><b>0</b> pts</span>
      <span class="stat" id="coins"><b>0</b> coins</span>
    </header>
    <main class="ph-stage" id="stage"><section class="win"><header class="tb"><span class="tt">Fun Day</span></header><div class="bd center"><p>Connecting…</p></div></section></main>
    <div id="overlay"></div>
    <form class="chatbar" id="chatbar" hidden autocomplete="off"><input class="field" id="chatin" maxlength="60" placeholder="Say something"><button class="btn def">Send</button></form>
    <nav class="taskbar" aria-label="Menu and reactions">
      <button class="btn start" id="startBtn" aria-expanded="false">Start</button>
      <div class="reacts" id="reacts">${REACTIONS.map(r => `<button class="btn react" data-e="${r.id}">${r.text}</button>`).join('')}</div>
    </nav>
    <div class="startmenu" id="startMenu" hidden>
      <button data-m="dj">Jukebox</button>
      <button data-m="me">My card</button>
      <button data-m="sound" id="soundBtn"></button>
    </div>
    <div class="scrim" id="scrim" hidden></div>
    <div id="sheet" hidden></div>
    <div id="modal"></div>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const stage = $('#stage');

  let pack = null, station = null, stationId = null, room = null, players = [], me = null;
  let lastCoins = null, lastStamps = null, lastAnnounce = null, sheet = null;
  const locals = {};

  const send = (kind, payload = {}) => db.sendEvent(code, me0.id, me0.secret, kind, { ...payload, run: room?.state?.run })
    .then(r => { if (r && r.limited) fx.toast('Easy there. Try again in a second.'); return r; })
    .catch(e => { if (e.code === 'NOT_IN_ROOM') removed(); else fx.toast('Connection hiccup. Tap again.'); });

  function removed() {
    conn.stop(); identity.clearPlayer(code);
    app.innerHTML = `<div class="desk"><div class="desk-in narrow">${win('Removed', `<h2>You left this room</h2><p>Ask the host if that was a mistake.</p><a class="btn def block" href="#/join?code=${code}${p}">Rejoin</a>`)}</div></div>`;
  }

  function ctx() {
    const c = makeCtx({ role: 'player', code, pack, state: room.state, players, me, extra: { send, rerender: render } });
    c.local = locals[room.state.run] || (locals[room.state.run] = {});
    return c;
  }

  function render() {
    if (!room || !pack || !station) return;
    const c = ctx();
    $('#ttl').textContent = c.step.title || pack.title;
    try { station.views.player(stage, c); } catch (e) { console.error(e); }
    popups.playerOverlay($('#overlay'), c);
    $('#chatbar').hidden = !(station.chat && !room.state.chatOff);
    if (sheet) renderSheet();
  }

  // ---- windows (Jukebox, My card) ----
  function renderSheet() {
    const c = ctx(), body = $('#sheet');
    if (body.dataset.name !== sheet) {
      body.dataset.name = sheet;
      body.innerHTML = `<section class="win sheetwin"><header class="tb"><span class="tt">${sheet === 'dj' ? 'Jukebox' : 'My card'}</span><span class="ctl"><i class="x" data-close></i></span></header><div class="bd" id="sheetInner"></div></section>`;
      body.querySelector('[data-close]').onclick = closeSheet;
    }
    const inner = body.querySelector('#sheetInner');
    if (sheet === 'me') { inner.innerHTML = passportHtml(c, me); } else dj.playerSheet(inner, c);
  }
  function openSheet(name) { sheet = name; $('#sheet').dataset.name = ''; $('#sheet').hidden = false; $('#scrim').hidden = false; closeMenu(); renderSheet(); }
  function closeSheet() { sheet = null; $('#sheet').hidden = true; $('#sheet').innerHTML = ''; $('#scrim').hidden = true; }
  $('#scrim').onclick = () => { closeSheet(); closeMenu(); };

  // ---- start menu ----
  const setSound = () => { $('#soundBtn').textContent = fx.sound.muted ? 'Sound: off' : 'Sound: on'; };
  setSound();
  function closeMenu() { $('#startMenu').hidden = true; $('#startBtn').setAttribute('aria-expanded', 'false'); if (!sheet) $('#scrim').hidden = true; }
  $('#startBtn').onclick = () => { const open = $('#startMenu').hidden; $('#startMenu').hidden = !open; $('#startBtn').setAttribute('aria-expanded', open); $('#scrim').hidden = !open && !sheet; };
  $('#startMenu').onclick = (e) => {
    const b = e.target.closest('[data-m]'); if (!b) return;
    if (b.dataset.m === 'sound') { fx.sound.muted = !fx.sound.muted; setSound(); closeMenu(); }
    else openSheet(b.dataset.m);
  };

  // ---- reactions + chat ----
  $('#reacts').onclick = (ev) => {
    const b = ev.target.closest('[data-e]'); if (!b) return;
    fx.haptic(8); fx.sound.play('tap');
    send('react', { e: b.dataset.e });
  };
  $('#chatbar').onsubmit = (e) => {
    e.preventDefault();
    const v = $('#chatin').value.trim(); if (!v) return;
    send('chat', { text: v }); $('#chatin').value = ''; fx.haptic(8);
  };

  function celebrate() {
    if (lastCoins !== null && me.coins !== lastCoins) {
      const d = me.coins - lastCoins;
      if (d > 0) fx.coinPop(d, $('#coins'));
    }
    if (lastStamps !== null && me.stamps.length > lastStamps.length) {
      const id = me.stamps.find(s => !lastStamps.includes(s));
      const def = (pack.show || []).map(s => s.stamp).find(s => s && s.id === id);
      if (def) showStamp(def);
    }
    lastCoins = me.coins; lastStamps = me.stamps.slice();
    $('#coins b').textContent = me.coins;
    $('#score b').textContent = me.score.toLocaleString();
  }
  function showStamp(def) {
    $('#modal').innerHTML = `<div class="modal" id="stampModal">${win('New stamp', `
      <div class="center">${stampBox(def.id, def.name, true)}<p><b>${esc(def.name)}</b></p><p>${esc(def.line || 'Nice.')}</p>
      <button class="btn def block" id="okStamp">OK</button></div>`)}</div>`;
    fx.sound.play('stamp'); fx.haptic([30, 40, 60]);
    $('#okStamp').onclick = () => { $('#modal').innerHTML = ''; };
    setTimeout(() => { const m = $('#stampModal'); if (m) m.remove(); }, 6000);
  }

  const conn = connect({
    code, playerId: me0.id, withEvents: false,
    async onData(d) {
      room = d.room; players = d.players;
      const row = players.find(x => x.id === me0.id);
      if (!row || row.kicked) return removed();
      me = { ...row, secret: me0.secret };
      if (!pack) { pack = await loadPack(room.pack); applyTheme(pack); }
      if (room.state && room.state.show) pack.show = room.state.show;
      if (room.state && room.state.meta && pack.title !== room.state.meta.name) applyMeta(pack, room.state.meta);
      if (!room.state || !room.state.v) { stage.innerHTML = win('Fun Day', `<div class="center"><h2>Almost ready</h2><p>The host is opening the doors.</p></div>`); return; }
      const sid = pack.show[room.state.step]?.station;
      if (sid !== stationId) { station = await loadStation(sid); stationId = sid; stage.dataset.key = ''; }
      const a = room.state.announce;
      if (a && a.id !== lastAnnounce) { if (lastAnnounce !== null) { fx.toast(a.text, 6000); fx.sound.play('pop'); } lastAnnounce = a.id; }
      else if (lastAnnounce === null) lastAnnounce = a ? a.id : '';
      celebrate();
      render();
    },
    onError(e) { if (e.code === 'ROOM_NOT_FOUND') { stage.innerHTML = win('Over', `<div class="center"><h2>This room is closed</h2><p>That's the show. See you next time.</p></div>`); conn.stop(); } },
  });
  return () => conn.stop();
}

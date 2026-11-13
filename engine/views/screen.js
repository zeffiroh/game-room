// Projector: a gray baseplate with every student standing on it, Win95 windows on top for the
// current game, a chat box, and a taskbar along the bottom that shows the room code.
import { connect } from '../store.js';
import { loadPack } from '../packs.js';
import { applyTheme, applyMeta } from '../theme.js';
import { loadStation, makeCtx } from '../stations.js';
import { esc } from '../ui.js';
import { fx } from '../fx.js';
import { Room } from '../room.js';
import { reactionText } from '../reactions.js';
import * as popups from '../../features/popups.js';
import * as dj from '../../features/dj.js';

export async function mount(app, params) {
  const code = (params.get('code') || '').toUpperCase();
  document.body.className = 'on-screen';
  app.innerHTML = `
  <div class="screen" id="root">
    <div class="stage" id="body"><main class="sc-main" id="main"></main></div>
    <aside class="chatwin" id="chat" hidden></aside>
    <div id="np"></div><div id="popup"></div><div id="announce"></div>
    <footer class="sc-task">
      <span class="start">Fun Day</span><span class="task" id="title"></span><span class="sp"></span>
      <span class="tray">Join code <b>${esc(code)}</b></span><span class="tray" id="clock"></span>
    </footer>
    <div class="start-gate" id="gate"><section class="win" style="width:min(30em,90vw)"><header class="tb"><span class="tt">Fun Day</span></header>
      <div class="bd center"><h2 style="margin:.2em 0 .4em">Start the screen</h2><p>Click once so this window can play sound and video. Then press F11.</p><button class="btn def" id="go">OK</button></div></section></div>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const room = new Room($('#root'));
  let pack, station, stationId, curRun = null, rm, players = [], started = false, annT, lastAnnounce = null;
  const chatLines = [];
  $('#go').onclick = () => { fx.sound.unlock(); $('#gate').remove(); started = true; render(); };
  const clock = setInterval(() => { const d = new Date(); $('#clock').textContent = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }, 1000);
  $('#clock').textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  function ctx() { return makeCtx({ role: 'screen', code, pack, state: rm.state, players, extra: { root: $('#root'), room, started } }); }

  function drawChat() {
    const box = $('#chat');
    const on = station && station.chat && !(rm && rm.state.chatOff);
    box.hidden = !on;
    if (!on) return;
    const key = chatLines.map(l => l.id).join(',');
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.innerHTML = `<header class="tb"><span class="tt">Chat</span></header><div class="bd">${chatLines.slice(-8).map(l => `<p><b>${esc(l.name)}:</b> ${esc(l.text)}</p>`).join('') || '<p class="muted">Say something from your phone.</p>'}</div>`;
    const bd = box.querySelector('.bd'); bd.scrollTop = bd.scrollHeight;
  }

  function render() {
    if (!rm || !pack || !station || !rm.state.v) return;
    const c = ctx();
    const t = c.step.title || pack.title;
    if ($('#title').textContent !== t) $('#title').textContent = t;
    room.sync(c.players, c, station);
    try { station.views.screen($('#main'), c); } catch (e) { console.error(e); }
    popups.screenCard($('#popup'), c);
    dj.screenMini($('#np'), c);
    drawChat();
    const a = rm.state.announce;
    if (a && a.id !== lastAnnounce) {
      const firstSeen = lastAnnounce === null; lastAnnounce = a.id;
      if (!firstSeen || c.now() - a.at < 9000) {
        $('#announce').innerHTML = `<section class="win announce"><header class="tb"><span class="tt">Message</span></header><div class="bd">${esc(a.text)}</div></section>`;
        fx.sound.play('pop');
        clearTimeout(annT); annT = setTimeout(() => { $('#announce').innerHTML = ''; }, 9000);
      }
    }
  }

  const conn = connect({
    code, withEvents: true, cursor: 'now',
    async onData(d) {
      rm = d.room; players = d.players;
      if (!pack) { pack = await loadPack(rm.pack); applyTheme(pack); }
      if (rm.state && rm.state.show) pack.show = rm.state.show;
      if (rm.state && rm.state.meta && pack.title !== rm.state.meta.name) applyMeta(pack, rm.state.meta);
      if (!rm.state.v) { $('#main').innerHTML = `<section class="win pos-center"><header class="tb"><span class="tt">${esc(pack.title)}</span></header><div class="bd center"><h2>${esc(pack.title)}</h2><p>The host is getting things ready.</p></div></section>`; return; }
      const sid = pack.show[rm.state.step]?.station;
      if (sid !== stationId) {
        if (station && station.views.teardown) station.views.teardown($('#root'));
        station = await loadStation(sid); stationId = sid; $('#main').dataset.key = ''; $('#chat').dataset.key = '';
      }
      if (rm.state.run !== curRun) { curRun = rm.state.run; room.data = {}; }
      for (const e of d.fresh) {
        const p = players.find(x => x.id === e.p);
        if (!p) continue;
        if (e.k === 'react') {
          const txt = reactionText(e.d.e);
          room.say(e.p, txt, 'react');
          if (station && station.chat && !rm.state.chatOff) pushChat(p, txt);
        } else if (e.k === 'chat' && !rm.state.chatOff) {
          const txt = String(e.d.text || '').slice(0, 60);
          if (txt) { room.say(e.p, txt, 'chat'); pushChat(p, txt); }
        }
      }
      if (station.onScreenEvents) station.onScreenEvents(d.fresh, ctx());
      render();
    },
  });
  function pushChat(p, text) { chatLines.push({ id: Math.random().toString(36).slice(2), name: p.name, text }); if (chatLines.length > 30) chatLines.shift(); }
  return () => { conn.stop(); clearInterval(clock); room.destroy(); if (station && station.views.teardown) station.views.teardown($('#root')); };
}

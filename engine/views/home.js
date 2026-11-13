// Party mode landing: join with a code, or host. Hosting a real room needs a teacher code
// (config.js / Neon); anyone can run a DEMO room that lives in their own browser.
// The host builds the night from one library: activities, games, and every round on the Quiz Shelf.
import { db, MODE } from '../db.js';
import { listPacks, loadPack } from '../packs.js';
import { identity, prefs } from '../store.js';
import { cleanMeta } from '../theme.js';
import { esc, win, footer } from '../ui.js';
import { ICON_NAMES, iconSvg } from '../icons.js';
import { teacher, lockMode } from '../teacher.js';
import { listQuizPacks, roundStep, resolveShow } from '../quizzes.js';
import { BUY_URL } from '../../config.js';

const BLURBS = {
  lobby: 'Everyone walks around and chats', quiz: 'Quiz round', 'cell-defense': 'Co-op immune system arcade', 'ping-pong': 'Knockout tournament with mind games',
  breakroom: 'Timer, jukebox, chat', 'food-web': 'Teams run an ecosystem', 'cell-cycle-dash': 'Race through the cell cycle', movie: 'Poll, watch, live comments', honors: 'Awards and shoutouts', closing: 'Podium and credits',
};
const blurb = (s) => s.station === 'quiz' ? `${s.questions ? s.questions.length : '?'} questions` : (BLURBS[s.station] || '');

export async function mount(app) {
  let packs = [];
  try { packs = await listPacks(); } catch { packs = []; }
  const chosen = packs[0]?.id;
  const pack = chosen ? await loadPack(chosen) : { show: [], library: [] };
  const fixed = (s) => s.station === 'lobby' || s.station === 'closing';
  const activities = [...pack.show, ...(pack.library || [])].filter(s => !fixed(s) && s.station !== 'quiz')
    .filter((s, i, a) => a.findIndex(x => x.title === s.title) === i);
  let quizzes = { built: [], mine: [] };
  try { quizzes = await listQuizPacks(); } catch {}
  let show = await resolveShow(pack.show.filter(s => !fixed(s)));
  let unlocked = await teacher.isUnlocked();
  let demo = false;

  app.innerHTML = `<div class="desk"><div class="desk-in">
    <div class="row between" style="margin-bottom:10px"><a class="btn sm" href="#/">&larr; Game Room</a></div>
    <h1 class="mega">FUN<br>DAY</h1>
    <p class="sub">Party mode. The teacher runs it on a projector, everyone joins on a phone.</p>
    <div class="grid2">
      ${win('Join.exe', `<form id="join"><label class="kick" for="code">Room code (on the big screen)</label>
        <input class="field code-input" id="code" maxlength="4" autocomplete="off" autocapitalize="characters" placeholder="ABCD" required>
        <button class="btn def block" style="margin-top:12px">Join</button></form>`)}
      <div id="hostWin"></div>
    </div>
    <p class="mode-note" id="note"></p>
    ${footer()}
  </div></div>`;
  const q = (s) => app.querySelector(s);

  q('#join').onsubmit = (e) => {
    e.preventDefault();
    const code = q('#code').value.trim().toUpperCase();
    if (code.length === 4) location.hash = `#/join?code=${code}`;
  };

  function note() {
    q('#note').textContent = demo ? 'Demo room: it lives in this browser only. Open the projector and phone links in other tabs of this same browser.'
      : MODE === 'neon' ? 'Connected to the live database.' : 'Rehearsal mode: everything stays in this browser. Put your Neon link in config.js for the real thing.';
  }

  // ---------- locked: ask for a code, or offer the demo ----------
  function drawLocked(msg = '') {
    q('#hostWin').innerHTML = win('Host.exe', `
      <div class="row" style="gap:12px;align-items:center;margin-bottom:8px">${iconSvg('apple', { size: 40 })}<p style="margin:0"><b>Teachers only.</b> Type the teacher code you got when you bought Game Room. This device remembers it.</p></div>
      <form id="unl"><label class="kick" for="tcode">Teacher code</label>
        <input class="field" id="tcode" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="GR-XXXX-XXXX-XXXX" style="font-family:var(--mono);letter-spacing:.08em">
        <button class="btn def block" style="margin-top:10px">Unlock hosting</button></form>
      <p class="hint" role="alert" id="uerr">${msg}</p>
      <div class="sep"></div>
      <p style="margin:0 0 8px"><b>Just looking?</b> Run a demo room. Everything works, it just stays in this browser.</p>
      <button class="btn block" id="demo">Try the demo</button>
      <p class="hint" style="margin-top:10px">${BUY_URL ? `No code yet? <a href="${esc(BUY_URL)}" target="_blank" rel="noopener">Get lifetime teacher access</a>.` : 'No code yet? Ask the developers (link below) for lifetime teacher access.'}</p>`);
    q('#unl').onsubmit = async (e) => {
      e.preventDefault();
      const b = q('#unl button'); b.disabled = true; b.textContent = 'Checking...';
      const ok = await teacher.unlock(q('#tcode').value);
      if (ok) { unlocked = true; demo = false; drawBuilder(); } else drawLocked('That code did not work. Check for typos (dashes and spaces do not matter).');
    };
    q('#demo').onclick = () => { demo = true; drawBuilder(); };
    note();
  }

  // ---------- unlocked or demo: build the night ----------
  function drawBuilder() {
    const saved = prefs.get('roomMeta', { name: '', icon: 'star' });
    let icon = ICON_NAMES.includes(saved.icon) ? saved.icon : 'star';
    q('#hostWin').innerHTML = win(demo ? 'Host.exe (demo)' : 'Host.exe', `
      ${demo ? '<p class="demo-flag">DEMO. This room only works in this browser.</p>' : '<p>Build tonight\'s room from the library, then create it.</p>'}
      <label class="kick" for="rname">Room name</label>
      <input class="field" id="rname" maxlength="30" placeholder="Fun Day" autocomplete="off" value="${esc(saved.name || '')}">
      <div class="kick" style="margin-top:10px">Icon</div>
      <div class="icon-pick" id="icons" role="radiogroup" aria-label="Room icon"></div>
      <div id="builder"></div>
      <button class="btn def block" id="create" style="margin-top:10px">${demo ? 'Create demo room' : 'Create room'}</button>
      <p class="hint" id="err" role="alert"></p>
      ${demo ? `<button class="btn sm" id="back">I have a teacher code</button>` : (lockMode() === 'off' ? '' : `<button class="btn sm" id="forget">Lock this device</button>`)}`);
    const drawIcons = () => {
      q('#icons').innerHTML = ICON_NAMES.map(n => `<button type="button" role="radio" aria-checked="${n === icon}" aria-label="${n}" title="${n}" data-i="${n}">${iconSvg(n, { size: 24 })}</button>`).join('');
      q('#icons').querySelectorAll('[data-i]').forEach(b => b.onclick = () => { icon = b.dataset.i; drawIcons(); });
    };
    drawIcons();
    drawShow();
    const back = q('#back'); if (back) back.onclick = () => { demo = false; drawLocked(); };
    const forget = q('#forget'); if (forget) forget.onclick = () => { teacher.forget(); unlocked = false; drawLocked('This device is locked again.'); };
    q('#create').onclick = async () => {
      q('#create').disabled = true;
      try {
        const lobby = pack.show.find(s => s.station === 'lobby') || { station: 'lobby', title: 'Spawn' };
        const closing = pack.show.find(s => s.station === 'closing') || { station: 'closing', title: 'The end' };
        const full = [lobby, ...show, closing];
        const meta = cleanMeta({ name: q('#rname').value, icon });
        prefs.set('roomMeta', meta);
        const { code, host_token } = await db.createRoom(chosen, { demo, teacherCode: teacher.code() });
        identity.setHostToken(code, host_token);
        localStorage.setItem('party.show.' + code, JSON.stringify(full));
        localStorage.setItem('party.meta.' + code, JSON.stringify(meta));
        location.hash = `#/host?code=${code}`;
      } catch (e) {
        if (e.code === 'NOT_TEACHER') { teacher.forget(); unlocked = false; drawLocked('That teacher code is no longer active. Contact the developers.'); return; }
        q('#err').textContent = 'Could not make a room. Check your connection (or the Neon link in config.js) and try again.';
        q('#create').disabled = false;
      }
    };
    note();
  }

  function drawShow() {
    const allQ = [...quizzes.built, ...quizzes.mine];
    q('#builder').innerHTML = `
      <div class="row between" style="margin-top:12px"><div class="kick">Your night (top to bottom)</div><button class="btn sm" id="clr">Clear all</button></div>
      <ol class="build" id="bl">${show.map((s, i) => `<li><span class="n">${i + 1}</span><span class="t"><b>${esc(s.title)}</b><small>${esc(blurb(s))}</small></span>
        <button class="btn sm" data-up="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">Up</button><button class="btn sm" data-dn="${i}" ${i === show.length - 1 ? 'disabled' : ''} aria-label="Move down">Down</button><button class="btn sm" data-rm="${i}">Remove</button></li>`).join('') || '<li class="muted">Nothing yet. Add something below.</li>'}</ol>
      <div class="kick" style="margin-top:12px">Activities and games</div>
      <div class="tagrow" style="margin-top:4px">${activities.map((s, i) => `<button class="btn sm" data-add="${i}">+ ${esc(s.title)}</button>`).join('')}</div>
      <div class="kick" style="margin-top:12px">Quiz rounds (from the <a href="#/quiz">Quiz Shelf</a>)</div>
      ${allQ.map((p, pi) => `<details class="qlib"><summary>${iconSvg(p.icon, { size: 16 })} <b>${esc(p.title)}</b> <small>${p.rounds.length} rounds${p.mine ? ', uploaded' : ''}</small></summary>
        <div class="tagrow" style="margin-top:6px">${p.rounds.map((r, ri) => `<button class="btn sm" data-qa="${pi}:${ri}">+ ${esc(r.title)} (${r.questions.length})</button>`).join('')}</div></details>`).join('')}
      <p class="hint">Spawn comes first and the end screen comes last, automatically. Add your own quiz on the <a href="#/quiz">Quiz Shelf</a> (Upload).</p>`;
    const b = q('#builder');
    q('#clr').onclick = () => { show = []; drawShow(); };
    const mv = (i, d) => { const j = i + d; if (j < 0 || j >= show.length) return; [show[i], show[j]] = [show[j], show[i]]; drawShow(); };
    b.querySelectorAll('[data-up]').forEach(x => x.onclick = () => mv(+x.dataset.up, -1));
    b.querySelectorAll('[data-dn]').forEach(x => x.onclick = () => mv(+x.dataset.dn, 1));
    b.querySelectorAll('[data-rm]').forEach(x => x.onclick = () => { show.splice(+x.dataset.rm, 1); drawShow(); });
    b.querySelectorAll('[data-add]').forEach(x => x.onclick = () => { show.push({ ...activities[+x.dataset.add] }); drawShow(); });
    b.querySelectorAll('[data-qa]').forEach(x => x.onclick = () => {
      const [pi, ri] = x.dataset.qa.split(':').map(Number);
      show.push(roundStep(allQ[pi], allQ[pi].rounds[ri])); drawShow();
    });
  }

  if (unlocked) drawBuilder(); else drawLocked();
}

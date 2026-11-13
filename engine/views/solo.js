// Shell for the solo games: a Win95 window with a 960x600 canvas, a start screen, a game over
// screen with your best score and what the game was teaching, and touch buttons for phones.
import { esc, win } from '../ui.js';
import { prefs } from '../store.js';
import { fx } from '../fx.js';
import { byId } from '../../solo/index.js';

const W = 960, H = 600;

export async function mount(app, params) {
  const def = byId(params.get('id'));
  if (!def) { location.hash = '#/'; return; }
  const bestKey = 'best.' + def.id;
  app.innerHTML = `<div class="desk"><div class="desk-in wide">
    <div class="row between" style="margin-bottom:10px"><a class="btn sm" href="#/">&larr; Game Room</a><span class="chip" id="best"></span></div>
    ${win(def.title, `<div class="gwrap" id="gw"><canvas id="gc" width="${W}" height="${H}"></canvas><div class="gov" id="ov"></div></div>
      <div class="touch" id="touch"></div>`)}
  </div></div>`;
  const $ = (s) => app.querySelector(s);
  const cv = $('#gc'), g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;
  const touch = $('#touch');
  const setBest = () => { $('#best').textContent = 'Best: ' + (prefs.get(bestKey, 0)).toLocaleString(); };
  setBest();

  let game = null, state = 'start', raf = 0, last = 0, dead = false;
  const api = {
    W, H, sound: (n) => fx.sound.play(n), haptic: (n) => fx.haptic(n),
    end(score, line = '') { if (state !== 'play') return; state = 'over'; finish(Math.round(score), line); },
  };

  function startScreen() {
    state = 'start';
    $('#ov').innerHTML = `<section class="win ovwin"><header class="tb"><span class="tt">${esc(def.title)}</span></header><div class="bd">
      <p class="big-p">${esc(def.blurb)}</p>
      <ul class="how">${def.how.map(l => `<li>${esc(l)}</li>`).join('')}</ul>
      <button class="btn def block" id="play" style="min-height:56px">PLAY</button></div></section>`;
    $('#ov').hidden = false;
    $('#play').onclick = begin;
  }
  function begin() {
    fx.sound.unlock();
    game = def.create(api);
    state = 'play'; $('#ov').hidden = true; last = performance.now();
    touch.innerHTML = (def.touch || []).map(t => `<button class="btn" data-k="${t.k}">${esc(t.label)}</button>`).join('');
    touch.hidden = !(def.touch || []).length;
    cv.focus();
  }
  function finish(score, line) {
    const best = prefs.get(bestKey, 0), isBest = score > best;
    if (isBest) prefs.set(bestKey, score);
    setBest();
    $('#ov').innerHTML = `<section class="win ovwin"><header class="tb"><span class="tt">Game over</span></header><div class="bd center">
      <div class="kick">${esc(line)}</div><div class="bigscore">${score.toLocaleString()}</div>
      <p>${isBest ? 'New best score.' : 'Best: ' + best.toLocaleString()}</p>
      <div class="why" style="text-align:left"><b>What this was about</b> ${esc(def.learn)}</div>
      <div class="row" style="margin-top:12px;justify-content:center"><button class="btn def" id="again" style="min-width:140px">Play again</button><a class="btn" href="#/">Game Room</a></div></div></section>`;
    $('#ov').hidden = false;
    $('#again').onclick = begin;
  }

  // ---- input ----
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * W / r.width, (e.clientY - r.top) * H / r.height]; };
  const ptr = (type) => (e) => { if (state !== 'play' || !game || !game.pointer) return; const [x, y] = pos(e); game.pointer(x, y, type, e); if (type === 'down') e.preventDefault(); };
  cv.addEventListener('pointerdown', (e) => { try { cv.setPointerCapture(e.pointerId); } catch {} ptr('down')(e); });
  cv.addEventListener('pointermove', ptr('move'));
  cv.addEventListener('pointerup', ptr('up'));
  cv.addEventListener('pointercancel', ptr('up'));
  const kd = (e) => { if (state !== 'play' || !game || !game.key) return; if (e.repeat) return; const k = e.key.toLowerCase(); if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault(); game.key(k === ' ' ? 'space' : k, true); };
  const ku = (e) => { if (state !== 'play' || !game || !game.key) return; const k = e.key.toLowerCase(); game.key(k === ' ' ? 'space' : k, false); };
  window.addEventListener('keydown', kd); window.addEventListener('keyup', ku);
  const tdown = (e) => { const b = e.target.closest('[data-k]'); if (b && game && game.key && state === 'play') { e.preventDefault(); game.key(b.dataset.k, true); } };
  const tup = (e) => { const b = e.target.closest('[data-k]'); if (b && game && game.key && state === 'play') game.key(b.dataset.k, false); };
  touch.addEventListener('pointerdown', tdown); touch.addEventListener('pointerup', tup); touch.addEventListener('pointerleave', tup);

  // ---- loop ----
  function frame(t) {
    if (dead) return;
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    g.clearRect(0, 0, W, H);
    if (state === 'play' && game) { game.update(dt); game.draw(g); }
    else if (game && state === 'over') game.draw(g);
    else def.thumb(g, W, H, t / 1000);
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);
  startScreen();
  return () => { dead = true; cancelAnimationFrame(raf); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); };
}

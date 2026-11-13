// The Game Room: a hub of small, instant games. Pick one and play. No sign-up, no room code.
import { esc, win, footer } from '../ui.js';
import { iconSvg } from '../icons.js';
import { prefs } from '../store.js';
import { GAMES } from '../../solo/index.js';

export async function mount(app) {
  app.innerHTML = `<div class="desk"><div class="desk-in wide">
    <h1 class="mega">GAME<br>ROOM</h1>
    <p class="sub">Small games about how living things actually work. Click one and play.</p>
    <div class="tiles-grid">
      ${GAMES.map(d => `<a class="gtile" href="#/g?id=${d.id}"><section class="win"><header class="tb"><span class="tt">${esc(d.title)}</span><span class="ctl"><i></i><i></i><i class="x"></i></span></header>
        <canvas class="thumb" data-id="${d.id}" width="480" height="300"></canvas>
        <div class="gt-body"><b>${esc(d.title)}</b><span>${esc(d.blurb)}</span><small>Best: ${(prefs.get('best.' + d.id, 0)).toLocaleString()}</small></div></section></a>`).join('')}
      <a class="gtile" href="#/quiz"><section class="win"><header class="tb"><span class="tt">Quiz Shelf</span><span class="ctl"><i></i><i></i><i class="x"></i></span></header>
        <div class="thumb qshelf-thumb">${['dna', 'chart', 'terminal', 'book', 'flask', 'scroll'].map(n => iconSvg(n, { size: 56 })).join('')}</div>
        <div class="gt-body"><b>Quiz Shelf</b><span>Deep AP Bio, AP Stats, bioinformatics, comparative religion. Or upload your own.</span><small>Hard questions, explained</small></div></section></a>
      <a class="gtile" href="#/party"><section class="win"><header class="tb"><span class="tt">Party mode</span><span class="ctl"><i></i><i></i><i class="x"></i></span></header>
        <div class="thumb party-thumb"><b>FUN</b><b>DAY</b></div>
        <div class="gt-body"><b>Party mode</b><span>For a class. A teacher hosts on the projector, everyone joins on a phone.</span><small>Join a room, or host with a teacher code</small></div></section></a>
    </div>
    ${footer()}
  </div></div>`;
  let dead = false;
  const cvs = [...app.querySelectorAll('canvas.thumb')];
  const draw = (t) => {
    if (dead) return;
    for (const c of cvs) { const d = GAMES.find(x => x.id === c.dataset.id); const g = c.getContext('2d'); g.clearRect(0, 0, 480, 300); g.save(); g.scale(.5, .5); try { d.thumb(g, 960, 600, t / 1000); } catch {} g.restore(); }
    requestAnimationFrame(draw);
  };
  requestAnimationFrame(draw);
  return () => { dead = true; };
}

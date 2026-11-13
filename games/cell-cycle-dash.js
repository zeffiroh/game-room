// CELL CYCLE DASH: a race through the cell cycle. Alternate LEFT and RIGHT on your phone to drive your cell.
// Sloppy mashing (same button again and again) only counts a third as much as a clean alternating rhythm.
// S phase is slow (you're copying your whole genome). At each checkpoint (G1/S, G2/M, spindle) the cell
// is scanned: REPAIR the DNA and wait, or PUSH THROUGH. Pushing is faster but risks a mutation, and two
// mutations trigger apoptosis: back to the previous checkpoint. That's cancer in one sentence:
// cells that skip their checkpoints.
// Phones batch taps and send every ~0.9 s; the projector glides cells toward their last known position.
import { esc, keyed, win } from '../engine/ui.js';
import { gameCanvas, startLoop, stopLoop, block, clamp } from '../engine/canvas.js';
import { hashStr } from '../engine/blocks.js';

const CPS = [22, 72, 88];                  // checkpoint positions (out of 100)
const ZONES = [['G1', 0, 22, 1], ['S', 22, 48, .6], ['G2', 48, 72, 1], ['M', 72, 100, .8]];
const CPNAME = ['G1/S', 'G2/M', 'SPINDLE'];
const CPASK = ['Is the DNA undamaged?', 'Is every chromosome fully copied?', 'Is every chromosome attached to the spindle?'];
const ZNOTE = { G1: 'G1: growing and checking supplies.', S: 'S phase: copying the whole genome. Slow on purpose.', G2: 'G2: double-checking the copy.', M: 'M phase: split it up and pinch in two.' };
const K = .36, DUR = 115000, FLUSH = 900;
const COLS = ['#c0001a', '#ffd400', '#7a2d86', '#ff8c00', '#f4f4f4', '#222222', '#ff7aa8', '#8a4b1f'];
const repairMs = (dmg) => 1000 + 1500 * dmg;      // more lesions, longer repair
const risk = (dmg) => .05 + .2 * dmg;             // more lesions, riskier to push
const rollDmg = () => { const r = Math.random(); return r < .25 ? 0 : r < .6 ? 1 : r < .85 ? 2 : 3; };
const zoneOf = (x) => ZONES.find(z => x < z[2]) || ZONES[3];
const colOf = (id) => COLS[hashStr(id) % COLS.length];
const ord = (n) => n + ((n % 100 > 10 && n % 100 < 14) ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
let CX = null, shown = {}, lastRun = '';

const rankList = (s, players) => players.slice().sort((a, b) => {
  const fa = s.finished.indexOf(a.id), fb = s.finished.indexOf(b.id);
  if (fa >= 0 || fb >= 0) return (fa < 0 ? 999 : fa) - (fb < 0 ? 999 : fb);
  return (s.pos[b.id] || 0) - (s.pos[a.id] || 0);
});

function finishAwards(s, ctx) {
  const awards = [];
  rankList(s, ctx.players).forEach((p, i) => {
    const fin = s.finished.includes(p.id);
    const base = fin ? [600, 450, 350][i] || 250 : Math.round(150 + (s.pos[p.id] || 0));
    const pts = Math.max(0, base - 80 * (s.mutTotal[p.id] || 0));
    awards.push({ id: p.id, points: pts, coins: fin ? 8 : 3, stats: { dash: fin ? 1 : 0, mutations: s.mutTotal[p.id] || 0 } });
  });
  ctx.award(awards);
}

export default {
  id: 'cell-cycle-dash', title: 'Cell Cycle Dash',
  setup: () => ({ phase: 'intro', pos: {}, hold: {}, cp: {}, wait: {}, dmg: {}, mut: {}, mutTotal: {}, finished: [], log: [], lastStep: {} }),
  nextLabel: (s) => s.phase === 'intro' ? 'Start the race' : s.phase === 'race' ? 'End the race now' : '',
  next(s, ctx) {
    if (s.phase === 'intro') return { ...s, phase: 'race', startedAt: ctx.now() + 3500 };
    if (s.phase === 'race') { finishAwards(s, ctx); return { ...s, phase: 'done' }; }
    return null;
  },
  tick(s, ctx) {
    if (s.phase !== 'race') return;
    const t = ctx.now();
    // auto-repair if someone sits at a checkpoint without choosing
    let out = null;
    for (const [id, w] of Object.entries(s.wait)) if (t - w > 9000) { out = out || { ...s, wait: { ...s.wait }, hold: { ...s.hold }, cp: { ...s.cp } }; delete out.wait[id]; out.hold[id] = t + repairMs(s.dmg[id] || 0); out.cp[id] = (out.cp[id] || 0) + 1; }
    const all = ctx.present.length > 0 && ctx.present.every(p => s.finished.includes(p.id));
    if (t > s.startedAt + DUR || all) { finishAwards(out || s, ctx); return { ...(out || s), phase: 'done' }; }
    return out;
  },
  onEvent(s, ev, ctx) {
    if (s.phase !== 'race' || ctx.now() < s.startedAt) return;
    const id = ev.p;
    if (s.finished.includes(id)) return;
    if (ev.k === 'step') {
      if (s.wait[id] || (s.hold[id] || 0) > ev.t) return;
      const dt = Math.max(.3, ((ev.t - (s.lastStep[id] || s.startedAt)) / 1000));
      const n = Math.max(0, Math.min(14, ev.d.n | 0, Math.ceil(dt * 9)));
      const alt = Math.max(0, Math.min(n, ev.d.a | 0));
      const eff = alt + (n - alt) * .35;
      let x = s.pos[id] || 0;
      const nextCp = CPS[s.cp[id] || 0];
      x += eff * zoneOf(x)[3] * K;
      const out = { ...s, pos: { ...s.pos }, lastStep: { ...s.lastStep, [id]: ev.t } };
      if (nextCp != null && x >= nextCp) { x = nextCp; out.wait = { ...s.wait, [id]: ev.t }; out.dmg = { ...s.dmg, [id]: rollDmg() }; }
      if (x >= 100) { x = 100; out.finished = [...s.finished, id]; }
      out.pos[id] = x;
      return out;
    }
    if (ev.k === 'cp' && s.wait[id]) {
      const out = { ...s, wait: { ...s.wait }, hold: { ...s.hold }, cp: { ...s.cp, [id]: (s.cp[id] || 0) + 1 }, mut: { ...s.mut }, mutTotal: { ...s.mutTotal }, pos: { ...s.pos } };
      delete out.wait[id];
      const dm = s.dmg[id] || 0;
      if (ev.d.choice === 'repair') { out.hold[id] = ev.t + repairMs(dm); out.log = [...s.log, { id, t: ev.t, kind: 'repair' }].slice(-8); return out; }
      if (Math.random() < risk(dm)) {
        out.mut[id] = (s.mut[id] || 0) + 1; out.mutTotal[id] = (s.mutTotal[id] || 0) + 1;
        if (out.mut[id] >= 2) { // apoptosis: back to the previous checkpoint
          const ci = (s.cp[id] || 0); out.pos[id] = ci === 0 ? 0 : CPS[ci - 1]; out.cp[id] = ci; out.mut[id] = 0; out.hold[id] = ev.t + 3000;
          out.log = [...s.log, { id, t: ev.t, kind: 'apoptosis' }].slice(-8);
        } else out.log = [...s.log, { id, t: ev.t, kind: 'mutation' }].slice(-8);
      } else out.log = [...s.log, { id, t: ev.t, kind: 'clean' }].slice(-8);
      return out;
    }
  },

  // the race itself is drawn on the canvas (one lane per player); the block guys cheer from the bottom
  place(p, i, n) {
    const s = CX ? CX.s : {};
    const place = (s.finished || []).indexOf(p.id);
    return { x: 50 + (i - (n - 1) / 2) * Math.min(4.6, 90 / Math.max(1, n)), y: 95, cls: place >= 0 ? 'glow' : '', mark: place >= 0 ? '#' + (place + 1) : '' };
  },

  views: {
    screen(el, ctx) {
      CX = ctx;
      const s = ctx.s;
      if (ctx.run !== lastRun) { lastRun = ctx.run; shown = {}; }
      keyed(el, 'd' + s.phase, () => s.phase === 'intro'
        ? `<div class="pos-top" style="top:3%;width:min(68%,50em)">${win('Cell Cycle Dash', `<h2>Cell Cycle Dash</h2>
          <p>Alternate <b>LEFT and RIGHT</b> on your phone to drive your cell through <b>G1, S, G2 and M</b>. Same button twice barely counts. S phase is slow: you're copying the genome. At each checkpoint, <b>repair</b> your DNA and wait, or <b>push through</b> and risk a mutation. Two mutations and you undergo apoptosis (back one checkpoint).</p>`, { ctl: false })}</div>`
        : s.phase === 'race' ? `<div class="pos-top" style="top:1.5%;width:min(46%,32em)">${win('Race', `<div class="row between"><span>Time <span data-end="${s.startedAt + DUR}"></span></span><span class="chip" id="fin"></span></div>`, { ctl: false })}</div><div class="big-count" data-countwrap><span data-end="${s.startedAt}"></span></div>`
        : `<div class="pos-top" style="top:3%;width:min(60%,44em)" id="res"></div>`);
      const cw = el.querySelector('[data-countwrap]'); if (cw) cw.hidden = ctx.now() > s.startedAt;
      const fin = el.querySelector('#fin'); if (fin) fin.textContent = `${s.finished.length} finished`;
      const res = el.querySelector('#res');
      if (res && !res.dataset.k) {
        res.dataset.k = 1;
        const top = rankList(s, ctx.players).slice(0, 5), nm = (id) => (ctx.players.find(p => p.id === id) || {}).name || 'Nobody';
        const muts = Object.values(s.mutTotal).reduce((a, b) => a + b, 0);
        const risky = Object.entries(s.mutTotal).sort((a, b) => b[1] - a[1])[0];
        res.innerHTML = win('Results', `<h2>${esc(nm(s.finished[0]))} wins</h2><p>${s.finished.length} cells finished division. ${muts} mutations in total, every one from skipping a checkpoint.${risky && risky[1] > 1 ? ` Most reckless: ${esc(nm(risky[0]))} (${risky[1]}).` : ''}</p>
          <table class="board"><tbody>${top.map((p, i) => `<tr><td class="rank">${i + 1}</td><td class="nm">${esc(p.name)}</td><td class="sc">${s.finished.includes(p.id) ? 'finished' : Math.round(s.pos[p.id] || 0) + '%'}</td></tr>`).join('')}</tbody></table>`, { ctl: false });
      }
      const c = gameCanvas(el);
      startLoop('dash', c, draw);
    },
    teardown() { stopLoop('dash'); shown = {}; lastRun = ''; CX = null; },

    player(el, ctx) {
      const s = ctx.s, me = ctx.me.id, L = ctx.local;
      if (s.phase === 'intro') { keyed(el, 'i', () => win('Cell Cycle Dash', `<h2>Race your cell</h2><p>Alternate LEFT and RIGHT as fast as you can. Same button twice only counts a little. At each checkpoint the cell scans your DNA for lesions. More lesions = longer repair and a riskier push. Two mutations = apoptosis.</p>`)); return; }
      if (s.phase === 'done') {
        clearInterval(L.iv);
        const place = s.finished.indexOf(me), rk = rankList(s, ctx.players).findIndex(p => p.id === me) + 1;
        keyed(el, 'done', () => win('Results', `<div class="result ${place >= 0 ? 'ok' : 'no'}"><span class="pts">${place >= 0 ? '#' + (place + 1) : 'DNF'}</span>${place >= 0 ? 'You finished the cell cycle.' : `Time ran out. You were ${ord(rk)} on the track.`}</div><p>Mutations picked up: ${s.mutTotal[me] || 0}</p>`));
        return;
      }
      const waiting = !!s.wait[me], fin = s.finished.includes(me), dm = s.dmg[me] || 0;
      const ci = s.cp[me] || 0;
      if (waiting || fin) clearInterval(L.iv);
      keyed(el, `r${waiting}${fin}${waiting ? ci : ''}`, () => win('Race', fin ? `<h2>Finished</h2><p>Cytokinesis complete. Watch the screen and heckle the stragglers.</p>` : waiting ? `
        <h2>${CPNAME[ci] || 'Checkpoint'} scan</h2><p class="muted" style="margin:0">${CPASK[ci] || ''}</p><p class="scan"><b>${dm} lesion${dm === 1 ? '' : 's'} found</b></p>
        <button class="btn block" data-cp="repair" style="min-height:70px">REPAIR<br><small>wait ${(repairMs(dm) / 1000).toFixed(1)}s, no risk</small></button>
        <button class="btn def block" data-cp="push" style="min-height:70px;margin-top:10px">PUSH THROUGH<br><small>no wait, ${Math.round(risk(dm) * 100)}% chance of a mutation</small></button>
        <p class="hint">Mutations: ${s.mut[me] || 0} of 2. A second one means apoptosis.</p>`
        : `<div class="kick" id="zone"></div><p class="muted" id="znote" style="margin:0"></p><div class="hpbar"><i id="prog"></i></div><p class="muted" id="mutline"></p>
        <div id="rhythm" style="text-align:center;font-weight:900;min-height:1.4em"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:2px">
          <button class="btn def runbtn" id="runL" style="height:30dvh;min-height:96px;font-size:2.2rem;touch-action:none">LEFT</button>
          <button class="btn def runbtn" id="runR" style="height:30dvh;min-height:96px;font-size:2.2rem;touch-action:none">RIGHT</button></div>`), (root) => {
        root.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => { ctx.send('cp', { choice: b.dataset.cp }); ctx.fx.haptic(25); b.disabled = true; });
        const rl = root.querySelector('#runL');
        if (rl) {
          L.n = 0; L.a = 0; L.last = null; L.rec = [];
          const flush = () => { if (L.n > 0) { ctx.send('step', { n: Math.min(14, L.n), a: Math.min(L.n, L.a) }); L.n = 0; L.a = 0; } };
          clearInterval(L.iv); L.iv = setInterval(flush, FLUSH);
          const tap = (side) => (e) => {
            e.preventDefault(); if (ctx.now() < s.startedAt || (L.hold || 0) > ctx.now()) return;
            const t = performance.now(); L.n++;
            const good = L.last !== null && L.last !== side; if (good) L.a++;
            L.last = side; L.rec.push([t, good]); L.rec = L.rec.filter(r => t - r[0] < 1500);
            ctx.fx.haptic(good ? 8 : 3);
            const r = root.querySelector('#rhythm'), n = L.rec.length, g = L.rec.filter(x => x[1]).length;
            if (r) r.textContent = n < 4 ? 'Alternate!' : g / n > .75 ? (n > 8 ? 'SMOOTH AND FAST' : 'Smooth. Faster!') : 'Sloppy. Switch sides each tap.';
            const b = side ? root.querySelector('#runR') : rl; b.style.transform = 'translateY(3px)'; setTimeout(() => { b.style.transform = ''; }, 60);
          };
          rl.addEventListener('pointerdown', tap(0)); root.querySelector('#runR').addEventListener('pointerdown', tap(1));
        }
      });
      L.hold = s.hold[me] || 0;
      const z = el.querySelector('#zone');
      if (z) { const x = s.pos[me] || 0, zn = zoneOf(x)[0]; z.textContent = ctx.now() < s.startedAt ? 'Get ready' : `${zn} phase`; const note = el.querySelector('#znote'); if (note) note.textContent = ZNOTE[zn]; }
      const pr = el.querySelector('#prog'); if (pr) pr.style.width = (s.pos[me] || 0) + '%';
      const ml = el.querySelector('#mutline');
      if (ml) {
        const rk = rankList(s, ctx.players).findIndex(p => p.id === me) + 1, hold = (s.hold[me] || 0) - ctx.now();
        ml.textContent = hold > 0 ? `Repairing... ${(hold / 1000).toFixed(1)}s` : `${ord(rk)} of ${ctx.players.length}. Mutations: ${s.mut[me] || 0} of 2`;
      }
      if (ctx.now() < s.startedAt || (s.hold[me] || 0) > ctx.now()) setTimeout(() => ctx.rerender(), 500);
    },

    host(el, ctx) {
      const s = ctx.s;
      el.innerHTML = s.phase === 'intro' ? '<p>About two minutes. Everyone needs a phone in hand, thumbs ready.</p>'
        : `<div class="row"><span class="chip">${s.finished.length} finished</span><span class="chip">${Object.keys(s.wait).length} at a checkpoint</span><span class="chip">${Object.values(s.mutTotal).reduce((a, b) => a + b, 0)} mutations</span></div>`;
    },
  },
};

function draw(g, W, H, t) {
  const ctx = CX; if (!ctx) return;
  const s = ctx.s, N = ctx.players.length || 1;
  const x0 = W * .08, w = W * .82, y0 = H * .2, y1 = H * .84, h = y1 - y0;
  ZONES.forEach(([name, a, b], i) => {
    const x = x0 + a / 100 * w, ww = (b - a) / 100 * w;
    g.fillStyle = i % 2 ? 'rgba(255,212,0,.35)' : 'rgba(255,255,255,.35)'; g.fillRect(x, y0, ww, h);
    g.fillStyle = '#000'; g.font = `900 ${Math.max(18, H * .05)}px Arial Black, Arial`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(name, x + ww / 2, y0 - 2);
  });
  CPS.forEach((c, i) => {
    const x = x0 + c / 100 * w;
    for (let y = y0; y < y1; y += 22) { g.fillStyle = (Math.floor((y - y0) / 22) % 2) ? '#000' : '#ffd400'; g.fillRect(x - 5, y, 10, 22); }
    g.fillStyle = '#000'; g.font = `700 ${Math.max(11, H * .022)}px Tahoma, Arial`; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText(CPNAME[i] + ' CHECK', x, y1 + 4);
  });
  const fx = x0 + w;
  for (let y = y0; y < y1; y += 22) { g.fillStyle = (Math.floor((y - y0) / 22) % 2) ? '#000' : '#fff'; g.fillRect(fx, y, 14, 22); }
  if (s.phase === 'intro') return;
  const list = ctx.players.slice().sort((a, b) => a.name.localeCompare(b.name));
  const lh = h / Math.max(N, 1), sz = clamp(lh * .78, 8, 34), showName = lh >= 15;
  const here = new Set(ctx.present.map(p => p.id)), now = ctx.now();
  list.forEach((p, i) => {
    const target = s.pos[p.id] || 0;
    shown[p.id] = (shown[p.id] ?? 0) + (target - (shown[p.id] ?? 0)) * .06;
    const px = x0 + clamp(shown[p.id], 0, 100) / 100 * w;
    const cy = y0 + lh * (i + .5), fin = s.finished.includes(p.id), waiting = !!s.wait[p.id], held = (s.hold[p.id] || 0) > now;
    g.fillStyle = 'rgba(0,0,0,.08)'; g.fillRect(x0, cy + lh * .5 - 1, w, 1);
    const jig = waiting ? Math.sin(t * 20) * 2 : (held ? 0 : Math.sin(t * 9 + i) * (sz * .05));
    g.globalAlpha = here.has(p.id) ? 1 : .35;
    block(g, px - sz / 2 + jig, cy - sz / 2, sz, sz, held ? '#bbb' : colOf(p.id));
    g.fillStyle = '#7a2d86'; g.fillRect(px - sz * .15 + jig, cy - sz * .15, sz * .3, sz * .3); // nucleus
    for (let m = 0; m < (s.mut[p.id] || 0); m++) { g.fillStyle = '#c0001a'; g.fillRect(px + sz * (.15 + m * .2) + jig, cy - sz * .42, sz * .15, sz * .15); }
    if (waiting) { g.fillStyle = '#c0001a'; g.font = `900 ${sz}px Arial Black, Arial`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('!', px + sz * .7, cy); }
    if (fin) { g.fillStyle = '#ffd400'; g.fillRect(px - sz * .4, cy - sz * .9, sz * .8, sz * .3); }
    if (showName) { g.fillStyle = '#000'; g.font = `700 ${Math.min(18, Math.max(9, lh * .6))}px Tahoma, Arial`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(p.name.slice(0, 12), px - sz * .7, cy); }
    g.globalAlpha = 1;
  });
  // leader callouts when there are too many lanes for names
  if (!showName) {
    rankList(s, ctx.players).slice(0, 3).forEach((p, i) => {
      const px = x0 + clamp(shown[p.id] ?? 0, 0, 100) / 100 * w, idx = list.indexOf(p), cy = y0 + lh * (idx + .5);
      g.fillStyle = '#000'; g.font = `900 ${Math.max(12, H * .026)}px Arial Black, Arial`; g.textAlign = 'right'; g.textBaseline = 'middle'; g.fillText(`${i + 1}. ${p.name.slice(0, 10)}`, px - sz, cy);
    });
  }
  // event feed
  const feed = (s.log || []).filter(l => now - l.t < 7000 && l.kind !== 'clean').slice(-3);
  feed.forEach((l, i) => {
    const nm = (ctx.players.find(p => p.id === l.id) || {}).name || '?';
    const txt = l.kind === 'apoptosis' ? `${nm}: APOPTOSIS` : l.kind === 'mutation' ? `${nm}: MUTATION` : `${nm} repairs`;
    g.font = `900 ${Math.max(16, H * .035)}px Arial Black, Arial`; g.textAlign = 'right'; g.textBaseline = 'top'; g.lineWidth = 5; g.strokeStyle = '#000';
    g.fillStyle = l.kind === 'repair' ? '#fff' : '#ffd400'; g.strokeText(txt, W - 14, H * .09 + i * H * .045); g.fillText(txt, W - 14, H * .09 + i * H * .045);
  });
}

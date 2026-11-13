// CELL DEFENSE: co-op arcade built on the adaptive immune response.
// Viruses carry one of four antigens (A-D). You are a B cell: tap the antibody that fits the antigen
// and it neutralizes the nearest matching virus. Antibodies are specific, so wrong taps do nothing.
// Wave 1 is the primary response (slow, one kill per tap). Wave 2 is the secondary response:
// memory cells mean every tap clears two viruses. Don't let the cell get overrun.
//
// The wave is deterministic from a seed, so host (scoring) and screen (animation) agree.
import { av } from '../engine/blocks.js';
import { esc, keyed, GLYPHS, win } from '../engine/ui.js';
import { gameCanvas, startLoop, stopLoop, clamp, block, css } from '../engine/canvas.js';
import { rowPlace } from '../engine/room.js';

const LEAD = 3500, COOLDOWN = 650, DAMAGE = 7;
const WAVES = [
  { name: 'Primary response', dur: 50000, travel: 8000, i0: 1600, i1: 700, perTap: 1 },
  { name: 'Secondary response', dur: 45000, travel: 7000, i0: 1100, i1: 420, perTap: 2 },
];
const VCOL = ['#c0001a', '#ffd400', '#7a2d86', '#222222'];
const VINK = ['#fff', '#000', '#fff', '#fff'];

function mulberry(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const schedCache = new Map();
export function schedule(s) {
  const key = s.seed + ':' + s.wave + ':' + s.n;
  if (schedCache.has(key)) return schedCache.get(key);
  const W = WAVES[s.wave], r = mulberry(s.seed), list = [];
  const crowd = 0.55 + Math.min(30, s.n) * 0.075;
  let t = 600, i = 0;
  while (t < W.dur - W.travel * .6) {
    const c = Math.floor(r() * 4), a = r() * Math.PI * 2, dr = r(), sh = r();
    list.push({ i: i++, t, c, a, c2: s.wave === 1 && dr < .3 ? (c + 1 + Math.floor(sh * 3)) % 4 : null });
    const k = t / W.dur;
    t += (W.i0 + (W.i1 - W.i0) * k) / crowd * (0.7 + r() * 0.6);
  }
  schedCache.set(key, list);
  return list;
}

// antigenic drift: some wave-2 viruses swap their antigen halfway in
export const letter = (v, t, W) => (v.c2 != null && t >= v.t + W.travel * .5 ? v.c2 : v.c);

function applyFire(b, s, pid, c, tf) {
  const W = WAVES[s.wave];
  if (s.abs && s.abs[pid] && !s.abs[pid].includes(c)) return [];
  if (b.last[pid] && tf - b.last[pid] < COOLDOWN) return [];
  b.last[pid] = tf;
  const t = tf - s.startedAt;
  const live = schedule(s).filter(v => letter(v, t, W) === c && v.t <= t && t < v.t + W.travel && b.kills[v.i] == null)
    .sort((x, y) => (t - y.t) - (t - x.t)).slice(0, W.perTap);
  live.forEach(v => { b.kills[v.i] = pid; b.killT[v.i] = tf; });
  return live.map(v => v.i);
}
// complement burst: wipes every virus currently on screen (needs a full meter)
function applyBurst(b, s, pid, tf) {
  const W = WAVES[s.wave], t = tf - s.startedAt;
  const live = schedule(s).filter(v => v.t <= t && t < v.t + W.travel && b.kills[v.i] == null);
  live.forEach(v => { b.kills[v.i] = pid; b.killT[v.i] = tf; });
  return live.map(v => v.i);
}
export function liveLetters(s, kills, at) {
  const W = WAVES[s.wave], t = at - s.startedAt, n = [0, 0, 0, 0];
  for (const v of schedule(s)) if (v.t <= t && t < v.t + W.travel && kills[v.i] == null) n[letter(v, t, W)]++;
  return n;
}
const PAIRS = [[0, 1], [2, 3], [1, 2], [3, 0]];
function health(s, kills, killT, at) {
  const W = WAVES[s.wave], t = at - s.startedAt;
  let leaks = 0;
  for (const v of schedule(s)) if (v.t + W.travel <= t && (kills[v.i] == null || killT[v.i] > s.startedAt + v.t + W.travel)) leaks++;
  return Math.max(0, 100 - leaks * DAMAGE);
}

function startWave(s, ctx, wave) {
  const abs = {};
  ctx.players.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((p, i) => { abs[p.id] = ctx.players.length < 2 ? [0, 1, 2, 3] : PAIRS[i % 4]; });
  return { ...s, abs, charge: 0, bursts: 0, phase: 'play', wave, seed: Math.floor(Math.random() * 1e9), n: Math.max(1, ctx.present.length), startedAt: ctx.now() + LEAD, kills: {}, killT: {}, last: {}, killsBy: {} };
}
function endWave(s, ctx) {
  const end = s.startedAt + WAVES[s.wave].dur;
  const hp = health(s, s.kills, s.killT, end);
  const awards = [];
  for (const p of ctx.players) {
    const k = s.killsBy[p.id] || 0;
    awards.push({ id: p.id, points: k * 60 + (hp > 0 ? 200 : 50), coins: Math.floor(k / 3) + (hp > 0 ? 8 : 2), stats: { neutralized: k } });
  }
  ctx.award(awards);
  return { ...s, phase: 'done', hp, results: [...(s.results || []), { wave: s.wave, hp, total: Object.keys(s.kills).length, spawned: schedule(s).length }] };
}

// ---- screen-side simulation ----
let flash = 0, B = null, shots = [], curKey = '', CX = null, hitSeen = new Set();

export default {
  id: 'cell-defense', title: 'Cell Defense',
  setup: () => ({ phase: 'intro', wave: -1, results: [] }),
  nextLabel: (s) => s.phase === 'intro' ? 'Start wave 1: primary response' : s.phase === 'play' ? 'End this wave now' : (s.wave + 1 < WAVES.length ? 'Start wave 2: secondary response' : ''),
  next(s, ctx) {
    if (s.phase === 'play') return endWave(s, ctx);
    if (s.wave + 1 >= WAVES.length) return null;
    return startWave(s, ctx, s.wave + 1);
  },
  tick(s, ctx) { if (s.phase === 'play' && ctx.now() > s.startedAt + WAVES[s.wave].dur + 500) return endWave(s, ctx); },
  onEvent(s, ev) {
    if (s.phase !== 'play' || ev.d.wave !== s.wave) return;
    if (ev.k === 'burst') {
      if ((s.charge || 0) < 100 || ev.t < s.startedAt) return;
      const bb = { kills: { ...s.kills }, killT: { ...s.killT } };
      const got = applyBurst(bb, s, ev.p, ev.t);
      return { ...s, ...bb, charge: 0, bursts: (s.bursts || 0) + 1, burstBy: ev.p, burstAt: ev.t, killsBy: got.length ? { ...s.killsBy, [ev.p]: (s.killsBy[ev.p] || 0) + Math.min(3, got.length) } : s.killsBy };
    }
    if (ev.k !== 'fire') return;
    const b = { kills: { ...s.kills }, killT: { ...s.killT }, last: { ...s.last } };
    const got = applyFire(b, s, ev.p, ev.d.c | 0, ev.t);
    if (!got.length && b.last[ev.p] === s.last[ev.p]) return;
    return { ...s, ...b, charge: Math.min(100, (s.charge || 0) + got.length * 9), killsBy: got.length ? { ...s.killsBy, [ev.p]: (s.killsBy[ev.p] || 0) + got.length } : s.killsBy };
  },

  place: (p, i, n) => rowPlace(i, n, { y: 93, perRow: 18, gap: 4.8, rowGap: 5 }),

  onScreenEvents(events, ctx) {
    const s = ctx.s;
    if (s.phase !== 'play') return;
    sync(s);
    for (const e of events) {
      if (e.k === 'burst' && e.d.wave === s.wave && e.d.run === ctx.run && (s.charge || 0) >= 100) {
        const got = applyBurst(B, s, e.p, e.t);
        got.forEach(i => shots.push({ i, pid: e.p, t0: performance.now() }));
        flash = performance.now(); ctx.room.say(e.p, 'BURST!', 'react');
        continue;
      }
      if (e.k !== 'fire' || e.d.wave !== s.wave || e.d.run !== ctx.run) continue;
      const before = B.last[e.p];
      const got = applyFire(B, s, e.p, e.d.c | 0, e.t);
      got.forEach(i => shots.push({ i, pid: e.p, t0: performance.now() }));
      if (!got.length && B.last[e.p] !== before) ctx.room.say(e.p, 'MISS', 'react');
    }
  },

  views: {
    screen(el, ctx) {
      CX = ctx;
      const s = ctx.s;
      if (s.phase === 'play') sync(s);
      keyed(el, 'c' + s.phase + s.wave, () => {
        let ui = '';
        if (s.phase === 'intro') ui = `<div class="pos-top" style="top:4%;width:min(64%,48em)">${win(ctx.step.title, `<h2>Cell Defense</h2>
          <p>Viruses are closing in on the cell. Each carries antigen <b>A, B, C or D</b>. Tap the matching antibody on your phone to destroy the nearest one. Each B cell only makes <b>two</b> kinds of antibody (clonal selection), so call out letters to the people who can hit them.</p>
          <div class="tagrow"><span class="chip">Co-op: keep the cell alive</span><span class="chip">Every kill charges the complement burst: first phone to hit it wipes the screen</span><span class="chip">Wave 2: memory cells (2 kills per tap) and antigenic drift (letters change mid-flight)</span></div>`)}</div>`;
        else if (s.phase === 'play') ui = `<div class="pos-top" style="top:2%;width:min(60%,40em)">${win(`Wave ${s.wave + 1}: ${WAVES[s.wave].name}`, `
          <div class="row between"><span>${WAVES[s.wave].perTap > 1 ? 'Memory cells: 2 per tap' : 'Clonal selection is slow'}</span><span>Time <span data-end="${s.startedAt + WAVES[s.wave].dur}"></span></span></div>
          <div class="hpbar"><i id="hp"></i></div>`, { ctl: false })}</div><div class="big-count" data-countwrap><span data-end="${s.startedAt}"></span></div>`;
        else { const r = s.results[s.results.length - 1]; ui = `<div class="pos-top" style="top:4%;width:min(64%,48em)">${win('Result', `<h2>${r.hp > 0 ? 'The cell survived' : 'The cell was overrun'}</h2>
          <p>${r.total} of ${r.spawned} viruses neutralized. Cell health ${r.hp}%.</p>
          <p>${s.wave === 0 ? 'Primary response: slow, because the right B cell clones had to be found and multiplied first. Wave 2 you are memory cells.' : 'Secondary response: memory B cells skip the wait, so one signal clears two viruses. Antigenic drift is why flu shots need updating: mutated antigens no longer fit the old memory cells. Vaccines train memory without the illness.'}</p>${topKillers(s, ctx)}`, { ctl: false })}</div>`; }
        return ui;
      });
      const cw = el.querySelector('[data-countwrap]'); if (cw) cw.hidden = ctx.now() > s.startedAt;
      const c = gameCanvas(el);
      startLoop('cell', c, (g, W, H, t) => draw(g, W, H, t));
    },
    teardown() { stopLoop('cell'); flash = 0; B = null; shots = []; curKey = ''; },

    player(el, ctx) {
      const s = ctx.s, L = ctx.local, me = ctx.me.id;
      if (s.phase === 'intro') {
        keyed(el, 'intro', () => win('Cell Defense', `<h2>You are a B cell</h2>
          <p>Viruses are coming for the cell. When the wave starts, watch the big screen and tap the antibody (A, B, C, D) that matches the virus letter. You only make two of the four antibodies, so shout to your friends when you see a letter you can't hit.</p>`));
        return;
      }
      if (s.phase === 'done') {
        const r = s.results[s.results.length - 1];
        keyed(el, 'done' + s.wave, () => win('Result', `<div class="result ${r.hp > 0 ? 'ok' : 'no'}"><span class="pts">${s.killsBy[me] || 0} destroyed</span>${r.hp > 0 ? 'The cell survived.' : 'The cell was overrun. You still fought hard.'}</div>
          <div class="why"><b>Why</b> ${s.wave === 0 ? 'Each antibody fits one antigen shape, like a lock and key. That specificity is adaptive immunity.' : 'Secondary response: memory cells make more antibodies, faster. Vaccines train this without the illness.'}</div>`));
        return;
      }
      const W = WAVES[s.wave];
      keyed(el, 'play' + s.wave, () => `<div class="cd">
        ${win(`Wave ${s.wave + 1}: ${W.name}`, `<p style="margin:0">Match the virus letter. Drifters change. <b id="mine">0</b> destroyed</p><div class="hpbar"><i id="hpP"></i></div>`, { ctl: false })}
        <p class="kick">Your antibodies: ${(s.abs[me] || [0, 1, 2, 3]).map(i => GLYPHS[i]).join(' and ')}${W.perTap > 1 ? ' (memory cells: 2 kills per tap)' : ''}</p>
        <div class="ab-pad" id="pad">${GLYPHS.map((g, i) => (s.abs[me] || [0, 1, 2, 3]).includes(i) ? `<button class="ab ab${i}" data-c="${i}"><span class="y">Y</span><span class="g">${g}</span></button>` : `<div class="ab off"><span class="g">${g}</span><small>not yours</small></div>`).join('')}</div>
        <div class="reload" id="reload"><i></i></div>
        <div id="radar" style="display:flex;gap:6px;margin:10px 0 6px"></div>
        <button class="btn block" id="burst" style="min-height:62px;font-weight:900" disabled>COMPLEMENT BURST</button>
        <p class="muted center" id="burstmsg" style="margin:4px 0 0"></p></div>`, (root) => {
        root.querySelector('#burst').onclick = () => { ctx.send('burst', { wave: s.wave }); ctx.fx.haptic([30, 30, 60]); ctx.fx.sound.play('tick'); };
        clearInterval(L.rad); L.rad = setInterval(() => ctx.rerender(), 500);
        root.querySelectorAll('[data-c]').forEach(b => b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          const t = performance.now();
          if (L.lastTap && t - L.lastTap < COOLDOWN) { ctx.fx.haptic(5); return; }
          L.lastTap = t;
          b.classList.remove('fired'); void b.offsetWidth; b.classList.add('fired');
          const rl = root.querySelector('#reload i'); rl.style.animation = 'none'; void rl.offsetWidth; rl.style.animation = `reload ${COOLDOWN}ms linear`;
          ctx.fx.sound.play('tick'); ctx.fx.haptic(18);
          ctx.send('fire', { wave: s.wave, c: +b.dataset.c });
        }));
      });
      const rd = el.querySelector('#radar');
      if (rd) {
        const n = liveLetters(s, s.kills || {}, ctx.now()), mineSet = s.abs[me] || [0, 1, 2, 3];
        rd.innerHTML = n.map((c, i) => `<div style="flex:1;text-align:center;padding:4px 0;background:${mineSet.includes(i) ? '#ffe97a' : '#d4d0c8'};box-shadow:var(--sunken);font-weight:900">${GLYPHS[i]}<br><span style="font-size:1.3rem">${c}</span></div>`).join('');
        const ch = s.charge || 0, bb = el.querySelector('#burst');
        bb.disabled = ch < 100 || ctx.now() < s.startedAt; bb.textContent = ch >= 100 ? 'BURST READY: TAP IT!' : `Complement burst ${ch}%`;
        el.querySelector('#burstmsg').textContent = ch >= 100 ? 'First tap clears every virus on screen.' : 'Every kill charges it. Full = wipe the screen.';
      }
      const mine = el.querySelector('#mine'); if (mine) mine.textContent = s.killsBy[me] || 0;
      const hp = health(s, s.kills, s.killT, ctx.now());
      const bar = el.querySelector('#hpP'); if (bar) bar.style.width = hp + '%';
      if (ctx.now() < s.startedAt) setTimeout(() => ctx.rerender(), 400);
    },

    host(el, ctx) {
      const s = ctx.s;
      if (s.phase === 'intro') { el.innerHTML = '<p>Two waves, about a minute each. Make sure everyone can see the projector.</p>'; return; }
      const hp = s.phase === 'play' ? health(s, s.kills, s.killT, ctx.now()) : s.hp;
      el.innerHTML = `<div class="row"><span class="chip">Wave ${s.wave + 1}</span><span class="chip">Cell ${hp}%</span><span class="chip">${Object.keys(s.kills || {}).length} destroyed</span></div>${topKillers(s, ctx)}`;
    },
  },
};

function sync(s) {
  const key = s.seed + ':' + s.wave;
  if (key !== curKey) { curKey = key; B = { kills: {}, killT: {}, last: {} }; shots = []; hitSeen = new Set(); }
  // merge host kills so a reloaded screen is still right
  for (const [i, pid] of Object.entries(s.kills || {})) if (B.kills[i] == null) { B.kills[i] = pid; B.killT[i] = s.killT[i]; shots.push({ i: +i, pid, t0: performance.now() }); }
}

function topKillers(s, ctx) {
  const list = ctx.players.map(p => ({ p, k: (s.killsBy || {})[p.id] || 0 })).filter(x => x.k).sort((a, b) => b.k - a.k).slice(0, 5);
  return list.length ? `<table class="board"><tbody>${list.map((x, i) => `<tr><td class="rank">${i + 1}</td><td class="av">${av(x.p.avatar)}</td><td class="nm">${esc(x.p.name)}</td><td class="sc">${x.k}</td></tr>`).join('')}</tbody></table>` : '<p class="muted">No hits yet.</p>';
}

// ---------------- art: everything is a rectangle ----------------
function geom(W, H) { const u = Math.min(W, H); return { cx: W / 2, cy: H * .46, u, R: u * .17 }; }
function vpos(v, p, W, H) {
  const { cx, cy, u, R } = geom(W, H);
  const far = Math.max(W, H) * .6;
  const r = far - (far - R * 1.25) * p;
  return { x: cx + Math.cos(v.a) * r * (W / H > 1.3 ? 1.5 : 1), y: cy + Math.sin(v.a) * r * .8, size: u * .075 };
}
function draw(g, W, H, t) {
  const ctx = CX; if (!ctx) return;
  const s = ctx.s;
  const { cx, cy, u, R } = geom(W, H);
  const hp = s.phase === 'play' && B ? health(s, B.kills, B.killT, ctx.now()) : (s.hp ?? 100);
  // the cell: a square of cytoplasm, a bilayer of dark blocks, nucleus, mitochondria
  const wob = Math.sin(t * 2) * 2;
  block(g, cx - R - wob, cy - R - wob, R * 2 + wob * 2, R * 2 + wob * 2, hp > 40 ? '#f4d9b0' : '#e8a090', '#000');
  const m = R * .12;
  for (let i = 0; i < 14; i++) {
    const k = i / 14, x = cx - R + k * R * 2, col = hp > 25 ? '#5a1020' : '#c0001a';
    g.fillStyle = col; g.fillRect(x, cy - R - wob - 3, m, 6); g.fillRect(x, cy + R + wob - 3, m, 6); g.fillRect(cx - R - wob - 3, cy - R + k * R * 2, 6, m); g.fillRect(cx + R + wob - 3, cy - R + k * R * 2, 6, m);
  }
  block(g, cx - R * .1, cy - R * .35, R * .5, R * .5, '#7a2d86');
  block(g, cx + R * .05, cy - R * .2, R * .2, R * .2, '#3a0f45');
  for (const [dx, dy] of [[-.7, -.5], [-.6, .45], [.45, .55]]) block(g, cx + dx * R, cy + dy * R, R * .38, R * .2, '#ff8c00');
  if (s.phase !== 'play' || !B) return;
  // viruses
  const Wv = WAVES[s.wave], tm = ctx.now() - s.startedAt;
  for (const v of schedule(s)) {
    if (v.t > tm || tm > v.t + Wv.travel + 500 || B.kills[v.i] != null) continue;
    const p = clamp((tm - v.t) / Wv.travel, 0, 1);
    const { x, y, size } = vpos(v, p, W, H);
    if (p >= 1) { g.fillStyle = 'rgba(192,0,26,.5)'; g.fillRect(x - size, y - size, size * 2, size * 2); continue; }
    const wig = Math.sin(t * 6 + v.i) * 2;
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.fillStyle = '#000'; g.fillRect(x + Math.cos(a) * size * 1.2 - 3, y + Math.sin(a) * size * 1.2 - 3 + wig, 6, 6); }
    const L = letter(v, tm, Wv);
    block(g, x - size / 2, y - size / 2 + wig, size, size, VCOL[L]);
    g.fillStyle = VINK[L]; g.font = `900 ${size * .8}px Arial Black, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(GLYPHS[L], x, y + wig + 1);
    if (v.c2 != null && tm >= v.t + Wv.travel * .5 && tm < v.t + Wv.travel * .62) { g.fillStyle = '#fff'; g.fillRect(x - size, y - size - 4 + wig, size * 2, 4); }
  }
  // incoming tally (what to shout) and burst meter
  const cnt = liveLetters(s, B.kills, ctx.now()), tw = Math.max(46, W * .045), th = tw * 1.25;
  cnt.forEach((c, i) => {
    const yy = H * .24 + i * (th + 8);
    block(g, 10, yy, tw, th, VCOL[i]); g.fillStyle = VINK[i]; g.font = `900 ${tw * .42}px Arial Black, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(GLYPHS[i], 10 + tw / 2, yy + th * .32); g.font = `900 ${tw * .5}px Arial Black, Arial`; g.fillText(String(c), 10 + tw / 2, yy + th * .72);
  });
  const mh = H * .5, mx = W - tw * .7 - 10, my = H * .22, ch = (s.charge || 0) / 100;
  g.fillStyle = '#000'; g.fillRect(mx - 3, my - 3, tw * .7 + 6, mh + 6); g.fillStyle = '#fff'; g.fillRect(mx, my, tw * .7, mh);
  g.fillStyle = ch >= 1 && Math.floor(t * 4) % 2 ? '#ffd400' : '#c0001a'; g.fillRect(mx, my + mh * (1 - ch), tw * .7, mh * ch);
  g.fillStyle = '#000'; g.font = `900 ${Math.max(12, tw * .26)}px Arial Black, Arial`; g.textAlign = 'center'; g.fillText(ch >= 1 ? 'BURST!' : 'BURST', mx + tw * .35, my - 18);
  if (ch >= 1) { g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 6; g.font = `900 ${H * .05}px Arial Black, Arial`; g.strokeText('BURST READY: HIT IT ON YOUR PHONE', W / 2, H * .83); g.fillText('BURST READY: HIT IT ON YOUR PHONE', W / 2, H * .83); }
  if (performance.now() - flash < 350) { g.fillStyle = `rgba(255,255,255,${.7 * (1 - (performance.now() - flash) / 350)})`; g.fillRect(0, 0, W, H); }
  // antibodies in flight: a Y made of blocks
  const keep = [];
  for (const sh of shots) {
    const v = schedule(s)[sh.i]; if (!v) continue;
    const pw = ctx.room.pawns.get(sh.pid);
    const k = (performance.now() - sh.t0) / 450;
    const kt = ((B.killT[sh.i] || ctx.now()) - s.startedAt);
    const vp = vpos(v, clamp((kt - v.t) / Wv.travel, 0, 1), W, H);
    if (k < 1 && pw) {
      const sx = parseFloat(pw.el.style.left) / 100 * W, sy = parseFloat(pw.el.style.top) / 100 * H - 40;
      const x = sx + (vp.x - sx) * k, y = sy + (vp.y - sy) * k;
      g.fillStyle = '#000'; g.fillRect(x - 3, y - 3, 6, 14); g.fillRect(x - 10, y - 12, 6, 6); g.fillRect(x + 4, y - 12, 6, 6);
      g.fillStyle = '#fff'; g.fillRect(x - 2, y - 2, 4, 12); g.fillRect(x - 9, y - 11, 4, 4); g.fillRect(x + 5, y - 11, 4, 4);
      keep.push(sh);
    } else if (!sh.popped) {
      sh.popped = true; ctx.room.hop(sh.pid);
      keep.push({ ...sh, pop: performance.now(), px: vp.x, py: vp.y, popped: true });
    } else if (sh.pop && performance.now() - sh.pop < 350) {
      const q = (performance.now() - sh.pop) / 350;
      g.fillStyle = '#fff';
      for (let a = 0; a < 8; a++) { const ang = a * Math.PI / 4; g.fillRect(sh.px + Math.cos(ang) * q * 30 - 3, sh.py + Math.sin(ang) * q * 30 - 3, 6, 6); }
      keep.push(sh);
    }
  }
  shots = keep;
  const bar = document.getElementById('hp'); if (bar) bar.style.width = hp + '%';
}

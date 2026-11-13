// FOOD WEB: the whole class runs one ecosystem. Three teams: producers (wheat), herbivores (voles),
// carnivores (foxes). Every season each team votes on a strategy. The strategies trade off growth
// against risk, and random events (drought, disease, cold snap) hit the system. The populations
// follow a predator-prey model with logistic growth and ~10% energy transfer between levels.
// Keep all three levels alive for 12 seasons. If any level crashes, the web collapses.
import { esc, keyed, win } from '../engine/ui.js';
import { hashStr } from '../engine/blocks.js';
import { gameCanvas, startLoop, stopLoop, block, clamp } from '../engine/canvas.js';

const K = 1000, EFF = 0.1, START = { P: 600, H: 60, C: 6 }, SEASONS = 12, SEASON_MS = 13000;
const TEAMS = [
  { name: 'Producers', crit: 'wheat', color: '#ffd400', opts: [['Grow fast', 'Grow quickly, but get eaten faster.'], ['Grow tough', 'Grow slower, but graze damage is halved.']] },
  { name: 'Herbivores', crit: 'voles', color: '#f4f4f4', opts: [['Breed', 'More babies, but more exposed to foxes.'], ['Hide', 'Fewer babies, but foxes miss a lot.']] },
  { name: 'Carnivores', crit: 'foxes', color: '#c0001a', opts: [['Hunt hard', 'More kills, but burns more energy.'], ['Conserve', 'Fewer kills, lower energy bill.']] },
];
const EVENTS = {
  mild: ['Mild season', 'Nothing special happens.'],
  drought: ['Drought', 'Wheat grows 40% slower this season.'],
  disease: ['Disease', 'Vole births drop 25% this season.'],
  cold: ['Cold snap', 'Foxes burn 25% more energy this season.'],
};
const EV_LIST = ['mild', 'mild', 'drought', 'disease', 'cold'];
const pickEvent = () => EV_LIST[Math.floor(Math.random() * EV_LIST.length)];

// one season of the model; st = [producer option, herbivore option, carnivore option]
export function sim(p, st, ev) {
  let { P, H, C } = p;
  const rg = [1, .6][st[0]] * (ev === 'drought' ? .6 : 1), graze = [1, .5][st[0]];
  const birth = [1.35, .7][st[1]] * (ev === 'disease' ? .75 : 1), expo = [1.3, .5][st[1]];
  const hunt = [1.4, .7][st[2]], upkeep = [1.3, .7][st[2]] * (ev === 'cold' ? 1.25 : 1);
  // biomass units: only EFF (10%) of the energy eaten becomes new biomass at the next level
  const n = 20, dt = 1 / n;
  for (let i = 0; i < n; i++) {
    const gr = 6 * H * (P / K) * graze, pr = 2 * C * (H / 60) * expo * hunt;
    P += dt * (.55 * rg * P * (1 - P / K) - gr);          // logistic growth toward K, minus grazing
    H += dt * (EFF * birth * gr - .12 * H - pr);
    C += dt * (EFF * pr - .1 * upkeep * C);
    P = Math.max(0, P); H = Math.max(0, H); C = Math.max(0, C);
  }
  return { P, H, C };
}
const collapsed = (p) => p.P < 50 || p.H < 8 || p.C < 1.1;
// rescale biomass to the old 0-100 drawing scale
const vw = (p) => ({ P: p.P / 10, H: p.H / 2, C: p.C * 4 / 3 });

export const teamOf = (s, id) => (s.team && s.team[id] != null ? s.team[id] : hashStr(id) % 3);

// each team's strategy if the vote ended right now (falls back to last season's)
export function leanOf(s) {
  const tally = [[0, 0], [0, 0], [0, 0]];
  for (const [id, v] of Object.entries(s.votes || {})) tally[teamOf(s, id)][v ? 1 : 0]++;
  const prev = s.lastSt || [0, 0, 0];
  return tally.map((t, i) => t[0] === t[1] ? prev[i] : (t[1] > t[0] ? 1 : 0));
}

function resolve(s, ctx) {
  // majority vote per team; ties go to the first option
  const tally = [[0, 0], [0, 0], [0, 0]];
  for (const [id, v] of Object.entries(s.votes)) tally[teamOf(s, id)][v ? 1 : 0]++;
  const prev = s.lastSt || [0, 0, 0], flips = [];
  const st = tally.map((t, i) => { if (t[0] === t[1]) { if (t[0] === 0) return prev[i]; flips.push(i); return Math.random() < .5 ? 1 : 0; } return t[1] > t[0] ? 1 : 0; });
  const cheerTop = [0, 1, 2].sort((a, b) => (s.cheers?.[b] || 0) - (s.cheers?.[a] || 0))[0], hype = (s.cheers?.[cheerTop] || 0) >= 3 ? cheerTop : -1;
  const pops = sim(s.pops, st, s.event);
  const history = [...s.history, { ...pops, st, ev: s.event }];
  const dead = collapsed(pops);
  const done = dead || s.season >= SEASONS;
  const bio = Math.min(60, Math.round((pops.P / 10 + pops.H + pops.C * 5.33) / 6));
  const awards = ctx.players.map(p => ({ id: p.id, points: dead ? 0 : 60 + bio + (done ? 300 : 0) + (hype === teamOf(s, p.id) ? 15 : 0), coins: dead ? 0 : 2, stats: { seasons: dead ? 0 : 1 } }));
  const b = s.pops, d = (k) => (pops[k] - b[k]) / Math.max(1, b[k]);
  const notes = [];
  if (dead) notes.push(pops.P < 50 ? 'The wheat got eaten down to nothing.' : pops.H < 8 ? 'The foxes wiped out the voles.' : 'The foxes starved.');
  else { if (d('H') < -.25) notes.push('Foxes crushed the voles.'); if (d('C') < -.25) notes.push('Foxes are starving.'); if (d('P') < -.15) notes.push('Wheat is getting overgrazed.'); if (d('H') > .25) notes.push('Voles boomed.'); if (d('C') > .3) notes.push('Foxes are thriving.'); if (!notes.length) notes.push('Stable season.'); }
  const summary = (flips.length ? `Tie in ${flips.map(i => TEAMS[i].name).join(' and ')}: coin flip. ` : '') + (hype >= 0 ? `${TEAMS[hype].name} had the loudest cheering (+15). ` : '') + `Wheat ${Math.round(b.P)} to ${Math.round(pops.P)}, voles ${Math.round(b.H)} to ${Math.round(pops.H)}, foxes ${Math.round(b.C)} to ${Math.round(pops.C)}. ${notes.join(' ')}`;
  ctx.award(awards);
  return { ...s, pops, history, summary, lastSt: st, phase: done ? 'done' : 'season', collapsed: dead, season: done ? s.season : s.season + 1,
    event: s.nextEvent || 'mild', nextEvent: pickEvent(), votes: {}, cheers: {}, cheerBy: {}, split: tally, endsAt: ctx.now() + SEASON_MS, resolvedAt: ctx.now() };
}

let CX = null, show = vw(START);

export default {
  id: 'food-web', title: 'Food Web',
  setup: (ctx) => {
    const team = {}; ctx.players.slice().sort((a, b) => a.name.localeCompare(b.name)).forEach((p, i) => { team[p.id] = i % 3; });
    return { phase: 'intro', team, pops: { ...START }, history: [], votes: {}, season: 0, event: 'mild' };
  },
  nextLabel: (s) => s.phase === 'intro' ? 'Start season 1' : s.phase === 'season' ? 'End this season now' : '',
  next(s, ctx) {
    if (s.phase === 'intro') return { ...s, phase: 'season', season: 1, event: 'mild', nextEvent: pickEvent(), cheers: {}, cheerBy: {}, endsAt: ctx.now() + SEASON_MS + 3000 };
    if (s.phase === 'season') return resolve(s, ctx);
    return null;
  },
  tick(s, ctx) {
    if (s.phase !== 'season') return;
    const everyone = ctx.present.length > 0 && ctx.present.every(p => s.votes[p.id] != null);
    if (ctx.now() > s.endsAt || (everyone && ctx.now() > s.endsAt - SEASON_MS + 4000)) return resolve(s, ctx);
  },
  onEvent(s, ev) {
    if (ev.k === 'cheer' && s.phase === 'season' && ev.d.season === s.season) {
      const t = teamOf(s, ev.p), n = (s.cheerBy || {})[ev.p] || 0;
      if (n >= 6) return;
      return { ...s, cheers: { ...s.cheers, [t]: ((s.cheers || {})[t] || 0) + 1 }, cheerBy: { ...s.cheerBy, [ev.p]: n + 1 } };
    }
    if (ev.k !== 'vote' || s.phase !== 'season' || ev.d.season !== s.season) return;
    return { ...s, votes: { ...s.votes, [ev.p]: ev.d.v ? 1 : 0 } };
  },

  place(p, i, n, ctx) {
    const s = ctx.s, t = teamOf(s, p.id);
    const cols = Math.max(1, Math.ceil(n / 3));
    const idx = ctx.players.filter(q => teamOf(s, q.id) === t).sort((a, b) => a.name.localeCompare(b.name)).findIndex(q => q.id === p.id);
    return { x: 14 + t * 36 + (idx % 6) * 5.4 - 8, y: 91 + Math.floor(idx / 6) * 5.5, mark: 'PHC'[t], cls: s.phase === 'season' && s.votes[p.id] != null ? 'glow' : '' };
  },

  views: {
    screen(el, ctx) {
      CX = ctx;
      const s = ctx.s;
      keyed(el, 'f' + s.phase + s.season, () => {
        if (s.phase === 'intro') return `<div class="pos-top" style="top:3%;width:min(70%,52em)">${win('Food Web', `<h2>Food Web</h2>
          <p>You're one ecosystem. <b>Producers</b> grow wheat, <b>herbivores</b> eat it, <b>carnivores</b> eat them. Each season your team votes on a strategy. Random events hit. Keep all three levels alive for ${SEASONS} seasons, or the web collapses.</p>
          <div class="tagrow"><span class="chip">Only ~10% of the energy passes up each level</span><span class="chip">Teams are assigned: look for your letter</span></div>`, { ctl: false })}</div>`;
        if (s.phase === 'done') return `<div class="pos-top" style="top:3%;width:min(66%,48em)">${win('Result', `<h2>${s.collapsed ? 'The web collapsed' : 'The web survived'}</h2>
          <p>${s.collapsed ? `${s.history.length} seasons in, one level crashed. Take out one trophic level and the others follow.` : `All ${SEASONS} seasons. Wheat, voles and foxes are all still here.`}</p>`, { ctl: false })}</div>`;
        const e = EVENTS[s.event];
        return `<div class="pos-top" style="top:2%;width:min(62%,46em)">${win(`Season ${s.season} of ${SEASONS}`, `<div class="row between"><span><b>${e[0]}.</b> ${e[1]}</span><span>Vote <span data-end="${s.endsAt}"></span></span></div>${s.summary ? `<p style="margin:.4em 0"><b>Last season:</b> ${esc(s.summary)}</p>` : ''}<div class="row between"><span class="muted">Coming up: <b>${EVENTS[s.nextEvent || 'mild'][0]}</b></span><span id="votes"></span></div>`, { ctl: false })}</div>`;
      });
      if (s.phase === 'season') {
        const v = [0, 1, 2].map(t => Object.keys(s.votes).filter(id => teamOf(s, id) === t).length + '/' + ctx.players.filter(q => teamOf(s, q.id) === t).length);
        const vb = el.querySelector('#votes'); if (vb) vb.innerHTML = TEAMS.map((t, i) => `<span class="chip">${t.name} ${v[i]}</span>`).join(' ');
      }
      const c = gameCanvas(el);
      startLoop('web', c, draw);
    },
    teardown() { stopLoop('web'); show = vw(START); },

    player(el, ctx) {
      const s = ctx.s, me = ctx.me.id, L = ctx.local, t = teamOf(s, me), T = TEAMS[t];
      if (s.phase === 'intro') { keyed(el, 'i', () => win('Food Web', `<h2>You are a ${T.crit.replace(/s$/, '')} (${T.name})</h2><p>Each season your team votes on a strategy. The majority wins. Keep the whole web alive.</p>`)); return; }
      if (s.phase === 'done') { keyed(el, 'd' + s.collapsed, () => win('Result', `<div class="result ${s.collapsed ? 'no' : 'ok'}"><span class="pts">${s.collapsed ? 'Collapse' : 'Survived'}</span>${s.collapsed ? 'A trophic level crashed.' : `All ${SEASONS} seasons.`}</div>`)); return; }
      const mine = s.votes[me] != null ? s.votes[me] : (L.s === s.season ? L.v : null);
      const e = EVENTS[s.event], p = s.pops;
      const lean = leanOf(s), proj = T.opts.map((_, i) => { const st = lean.slice(); st[t] = i; const r = sim(p, st, s.event); return { r, dead: collapsed(r) }; });
      const cheerLeft = 6 - ((s.cheerBy || {})[me] || 0);
      keyed(el, `s${s.season}-${mine}-${s.history.length}-${lean.join('')}-${cheerLeft}`, () => win(`Season ${s.season}: ${T.name}`, `
        <p style="margin:0"><b>${e[0]}.</b> ${e[1]}</p><p class="muted" style="margin:2px 0">Coming next: ${EVENTS[s.nextEvent || 'mild'][0]}</p>${s.summary ? `<p style="margin:4px 0">${esc(s.summary)}</p>` : ''}
        <div class="pops"><div><i style="width:${clamp(p.P / 10, 0, 100)}%;background:#ffd400"></i>Wheat ${Math.round(p.P)}</div><div><i style="width:${clamp(p.H, 0, 100)}%;background:#f4f4f4"></i>Voles ${Math.round(p.H)}</div><div><i style="width:${clamp(p.C * 5.33, 0, 100)}%;background:#c0001a"></i>Foxes ${Math.round(p.C)}</div></div>
        <div class="choices">${T.opts.map((o, i) => { const r = proj[i].r; return `<button class="choice c${i} ${mine === i ? 'picked' : ''}" data-v="${i}"><span class="g">${i + 1}</span><span><b>${o[0]}</b><br><small>${o[1]}</small><br><small>Forecast with today's votes: wheat ${Math.round(r.P)}, voles ${Math.round(r.H)}, foxes ${Math.round(r.C)}${proj[i].dead ? ' <b>(WEB COLLAPSES)</b>' : ''}</small></span></button>`; }).join('')}</div>
        <p class="muted center" style="margin:8px 0">${mine != null ? 'Voted. You can still change it.' : 'Pick one. The team majority decides; ties are a coin flip.'}</p>
        <button class="btn block" data-cheer ${cheerLeft <= 0 ? 'disabled' : ''} style="min-height:54px">CHEER FOR ${T.name.toUpperCase()} (${Math.max(0, cheerLeft)} left)</button>`), (root) => {
        root.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { L.s = s.season; L.v = +b.dataset.v; ctx.send('vote', { season: s.season, v: +b.dataset.v }); ctx.fx.sound.play('tap'); ctx.fx.haptic(15); ctx.rerender(); });
        const ch = root.querySelector('[data-cheer]'); if (ch) ch.onclick = () => { ctx.send('cheer', { season: s.season }); ctx.fx.sound.play('pop'); ctx.fx.haptic([10, 20, 10]); };
      });
    },

    host(el, ctx) {
      const s = ctx.s, p = s.pops;
      el.innerHTML = s.phase === 'intro' ? '<p>Teams are assigned automatically (P, H, C above each guy). Seasons run on a timer; hit the button to skip one.</p>'
        : `<div class="row"><span class="chip">Season ${s.season}/${SEASONS}</span><span class="chip">Wheat ${Math.round(p.P)}</span><span class="chip">Voles ${Math.round(p.H)}</span><span class="chip">Foxes ${Math.round(p.C)}</span></div>`;
    },
  },
};

function draw(g, W, H, t) {
  const ctx = CX; if (!ctx) return;
  const s = ctx.s, p = vw(s.pops);
  // ease the drawn populations toward the real ones
  for (const k of ['P', 'H', 'C']) show[k] += (p[k] - show[k]) * .04;
  const lean = s.phase === 'season' ? leanOf(s) : (s.lastSt || [0, 0, 0]);
  const px = W * .06, pw = W * .5, base = H * .78, bh = H * .15;
  // energy pyramid: each level is a row of blocks, wider = more individuals
  const rows = [['C', '#c0001a', show.C, 1.2, 4], ['H', '#f4f4f4', show.H, 0.6, 2], ['P', '#ffd400', show.P, 0.28, 1]];
  rows.forEach(([k, col, v, per, kk], ri) => {
    const n = Math.round(v * per * 1.6 + (k === 'C' ? 1 : 0));
    const bs = Math.min(bh * .8, pw / 24), y = base - (ri === 2 ? 0 : ri === 1 ? 0 : 0) - (2 - ri) * (bh + 6) - bh;
    const yy = H * .30 + ri * (bh + 8);
    for (let i = 0; i < n; i++) {
      const cols = Math.floor(pw / (bs * 1.25));
      const cx = px + (i % cols) * bs * 1.25, cy = yy + Math.floor(i / cols) * bs * 1.25;
      if (cy > yy + bh) break;
      // critters act out the team's current lean: breeding voles bounce, hiding voles squat, hunting foxes dash
      const ln = lean[ri === 0 ? 2 : ri === 1 ? 1 : 0];
      const sp = k === 'C' ? (ln === 0 ? 7 : 2) : k === 'H' ? (ln === 0 ? 6 : 1.2) : 0;
      const hop = k === 'P' ? 0 : Math.abs(Math.sin(t * sp + i * 1.7)) * bs * (k === 'H' && ln === 1 ? .15 : .55);
      const dash = k === 'C' && ln === 0 ? Math.sin(t * 5 + i) * bs * .5 : 0;
      const sway = k === 'P' ? Math.sin(t * (ln === 0 ? 3 : 1) + i) * 2 : 0;
      const sq = k === 'H' && ln === 1 ? bs * .25 : 0;
      block(g, cx + dash + sway, cy - hop + sq, bs, bs - sq, col);
      if (k === 'P' && ln === 1) { g.fillStyle = '#000'; g.fillRect(cx + bs * .4, cy, bs * .2, bs); }
      if (k !== 'P') { g.fillStyle = '#000'; g.fillRect(cx + dash + bs * .25, cy - hop + sq + bs * .3, 3, 3); g.fillRect(cx + dash + bs * .6, cy - hop + sq + bs * .3, 3, 3); }
    }
    g.fillStyle = '#000'; g.font = `900 ${Math.max(12, H * .026)}px Arial Black, Arial`; g.textAlign = 'left'; g.textBaseline = 'bottom';
    const low = (k === 'P' && p.P < 15) || (k === 'H' && p.H < 12) || (k === 'C' && p.C < 3);
    g.fillText(`${['FOXES', 'VOLES', 'WHEAT'][ri]}  ${Math.round(s.pops[k])}`, px, yy - 2);
    if (low && Math.floor(t * 3) % 2) { g.fillStyle = '#c0001a'; g.fillText('DANGER', px + W * .2, yy - 2); }
  });
  // history chart
  const cx0 = W * .6, cw = W * .34, cy0 = H * .3, ch = H * .42;
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(cx0, cy0, cw, ch);
  g.strokeStyle = '#808080'; g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(cx0, cy0 + ch * i / 4); g.lineTo(cx0 + cw, cy0 + ch * i / 4); g.stroke(); }
  const series = [['P', '#ffd400', 1], ['H', '#ffffff', 2], ['C', '#c0001a', 4]];
  const pts = [vw(START), ...s.history.map(vw)];
  series.forEach(([k, col, mul]) => {
    g.strokeStyle = '#000'; g.lineWidth = 5; g.beginPath();
    pts.forEach((q, i) => { const x = cx0 + i / SEASONS * cw, y = cy0 + ch - clamp(q[k] * mul, 0, 100) / 100 * ch; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.strokeStyle = col; g.lineWidth = 3; g.beginPath();
    pts.forEach((q, i) => { const x = cx0 + i / SEASONS * cw, y = cy0 + ch - clamp(q[k] * mul, 0, 100) / 100 * ch; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
  });
  g.fillStyle = '#000'; g.font = `700 ${Math.max(11, H * .022)}px Tahoma, Arial`; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('Population by season', cx0 + 4, cy0 + ch + 4);
  // team panels: live vote split + cheer meter
  if (s.phase === 'season') {
    const tally = [[0, 0], [0, 0], [0, 0]]; for (const [id, v] of Object.entries(s.votes || {})) tally[teamOf(s, id)][v ? 1 : 0]++;
    const size = [0, 0, 0]; for (const q of ctx.players) size[teamOf(s, q.id)]++;
    const bw = W * .28, by = H * .765, rh = H * .034;
    TEAMS.forEach((T, ti) => {
      const bx = W * (.04 + ti * .32);
      g.fillStyle = '#000'; g.font = `900 ${Math.max(13, H * .026)}px Arial Black, Arial`; g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillText(`${T.name.toUpperCase()}  ${tally[ti][0] + tally[ti][1]}/${size[ti]}`, bx, by - rh * .7);
      T.opts.forEach((o, oi) => {
        const n = tally[ti][oi], k = size[ti] ? n / size[ti] : 0, y = by + oi * (rh + 3);
        g.fillStyle = '#000'; g.fillRect(bx, y, bw, rh); g.fillStyle = '#fff'; g.fillRect(bx + 2, y + 2, bw - 4, rh - 4);
        g.fillStyle = T.color === '#f4f4f4' ? '#b0b0b0' : T.color; g.fillRect(bx + 2, y + 2, (bw - 4) * k, rh - 4);
        g.fillStyle = '#000'; g.font = `700 ${Math.max(11, rh * .6)}px Tahoma, Arial`; g.fillText(`${o[0]}  ${n}`, bx + 8, y + rh / 2 + 1);
      });
      const ch = (s.cheers || {})[ti] || 0;
      if (ch) { g.fillStyle = '#7a0f1f'; g.font = `900 ${Math.max(11, H * .022)}px Arial Black, Arial`; g.textAlign = 'right'; g.fillText('CHEER ' + '!'.repeat(Math.min(10, ch)), bx + bw, by - rh * .7); }
    });
  }
}

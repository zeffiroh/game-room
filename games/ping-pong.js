// PING PONG: a knockout tournament, first to 5 points. Up to 8 people sit at the table; everybody else
// watches and heckles with reactions.
// Every exchange is a mind game, like a penalty kick. The hitter secretly picks a lane (top / middle /
// bottom) and the receiver secretly picks which lane to cover. Same lane = returned, and now YOU are
// the hitter. Different lane = point for the hitter. Rallies get faster the longer they go.
// Each player gets ONE SMASH per match: a smash that gets past you is worth 2 points, but if the
// receiver reads it they steal a point instead of just returning it.
// The screen shows each player's last few shots. Read their habits.
import { esc, keyed, win } from '../engine/ui.js';
import { gameCanvas, startLoop, stopLoop, block, clamp } from '../engine/canvas.js';
import { rowPlace } from '../engine/room.js';

const WIN = 5, REVEAL_MS = 3000, FLIGHT_MS = 1300;
const LANES = ['TOP', 'MIDDLE', 'BOTTOM'], LET = ['T', 'M', 'B'];
let CX = null;

const nm = (ctx, id) => (ctx.players.find(p => p.id === id) || {}).name || '?';
const rnd3 = () => Math.floor(Math.random() * 3);
const other = (m, id) => (id === m.a ? m.b : m.a);
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const pickMs = (rally) => Math.max(3500, 7000 - 500 * rally);

function newRound(s, ctx) {
  const alive = shuffle(s.won);
  if (alive.length === 1) return { ...s, phase: 'done', champ: alive[0], match: null };
  const todo = [], won = [];
  for (let i = 0; i < alive.length; i += 2) { if (alive[i + 1]) todo.push([alive[i], alive[i + 1]]); else won.push(alive[i]); }
  return startMatch({ ...s, todo, won, round: s.round + 1 }, ctx);
}
function startMatch(s, ctx) {
  if (!s.todo.length) return newRound(s, ctx);
  const [a, b] = s.todo[0];
  return { ...s, phase: 'match', todo: s.todo.slice(1), match: { a, b, sa: 0, sb: 0, hitter: a, phase: 'pick', until: ctx.now() + 7000, rally: 0, aim: null, cov: null, smash: false, smashLeft: { [a]: 1, [b]: 1 }, hist: { [a]: [], [b]: [] }, res: null, absentAt: 0 } };
}
function resolve(s, ctx) {
  const m = s.match, recv = other(m, m.hitter);
  const aim = m.aim ?? rnd3(), cov = m.cov ?? rnd3();
  const ok = aim === cov, smash = m.smash;
  let sa = m.sa, sb = m.sb, by = null, pts = 0;
  if (!ok) { by = m.hitter; pts = smash ? 2 : 1; }
  else if (smash) { by = recv; pts = 1; }           // read a smash: steal a point
  if (by === m.a) sa += pts; else if (by === m.b) sb += pts;
  const hist = { ...m.hist, [m.hitter]: [...m.hist[m.hitter], aim].slice(-6) };
  const over = sa >= WIN || sb >= WIN;
  return { ...s, match: { ...m, sa, sb, hist, phase: over ? 'over' : 'reveal', until: ctx.now() + (over ? 3800 : REVEAL_MS), res: { aim, cov, ok, smash, by, pts, hitter: m.hitter, t0: ctx.now() } } };
}
function nextPick(s, ctx) {
  const m = s.match, r = m.res, total = m.sa + m.sb;
  const returned = r.ok && !r.smash;                       // plain return: receiver hits next, rally speeds up
  const hitter = returned ? other(m, m.hitter) : (Math.floor(total / 2) % 2 === 0 ? m.a : m.b);
  const rally = returned ? m.rally + 1 : 0;
  return { ...s, match: { ...m, phase: 'pick', hitter, rally, until: ctx.now() + pickMs(rally), aim: null, cov: null, smash: false, res: null } };
}

export default {
  id: 'ping-pong', title: 'Ping Pong',
  setup: () => ({ phase: 'intro', seats: [], won: [], todo: [], round: 0, match: null, log: [], champ: null }),
  nextLabel: (s) => s.phase === 'intro' ? 'Open the table' : s.phase === 'signup' ? (s.seats.length >= 2 ? `Everyone's seated: start the tournament (${s.seats.length})` : 'Need 2 players') : s.phase === 'match' ? 'Skip this match (coin flip)' : '',
  next(s, ctx) {
    if (s.phase === 'intro') return { ...s, phase: 'signup' };
    if (s.phase === 'signup') { const here = new Set(ctx.present.map(p => p.id)); const seats = s.seats.filter(id => here.has(id)); if (seats.length < 2) return { ...s, seats }; return newRound({ ...s, seats, won: seats.slice(), round: 0 }, ctx); }
    if (s.phase === 'match' && s.match) return advance(s, ctx, Math.random() < .5 ? s.match.a : s.match.b);
    return null;
  },
  tick(s, ctx) {
    if (s.phase !== 'match' || !s.match) return;
    const m = s.match, t = ctx.now();
    const here = new Set(ctx.present.map(p => p.id));
    if (!here.has(m.a) || !here.has(m.b)) {
      const gone = !here.has(m.a) ? m.a : m.b;
      if (!here.has(m.a) && !here.has(m.b) && m.absentAt && t - m.absentAt > 20000) return advance(s, ctx, Math.random() < .5 ? m.a : m.b);
      if (!m.absentAt) return { ...s, match: { ...m, absentAt: t } };
      if (t - m.absentAt > 20000) return advance(s, ctx, other(m, gone));
    } else if (m.absentAt) return { ...s, match: { ...m, absentAt: 0 } };
    if (m.phase === 'pick' && (t > m.until || (m.aim != null && m.cov != null))) return resolve(s, ctx);
    if (m.phase === 'reveal' && t > m.until) return nextPick(s, ctx);
    if (m.phase === 'over' && t > m.until) return advance(s, ctx, m.sa > m.sb ? m.a : m.b);
  },
  onEvent(s, ev, ctx) {
    if (ev.k === 'pp-join' && s.phase === 'signup' && s.seats.length < 8 && !s.seats.includes(ev.p)) return { ...s, seats: [...s.seats, ev.p] };
    if (ev.k === 'pp-leave' && s.phase === 'signup') return { ...s, seats: s.seats.filter(x => x !== ev.p) };
    if (ev.k !== 'pp-set' || s.phase !== 'match' || !s.match) return;
    const m = s.match, d = ev.d || {};
    if (m.phase !== 'pick' || (ev.p !== m.a && ev.p !== m.b)) return;
    const lane = d.lane | 0;
    if (lane < 0 || lane > 2) return;
    if (ev.p === m.hitter && m.aim == null) {
      const wantSmash = !!d.smash && (m.smashLeft[ev.p] || 0) > 0;
      const nm2 = { ...m, aim: lane, smash: wantSmash, smashLeft: wantSmash ? { ...m.smashLeft, [ev.p]: 0 } : m.smashLeft };
      return { ...s, match: nm2 };
    }
    if (ev.p !== m.hitter && m.cov == null) return { ...s, match: { ...m, cov: lane } };
  },

  place(p, i, n, ctx) {
    const s = ctx.s, m = s.match;
    if (m && s.phase === 'match') {
      if (p.id === m.a) return { x: 6, y: 58, mark: String(m.sa), cls: m.hitter === p.id ? 'glow' : '' };
      if (p.id === m.b) return { x: 94, y: 58, mark: String(m.sb), cls: m.hitter === p.id ? 'glow' : '' };
    }
    return rowPlace(i, n, { y: 92, perRow: 18, gap: 4.8, rowGap: 5 });
  },

  views: {
    screen(el, ctx) {
      CX = ctx;
      const s = ctx.s, m = s.match;
      const hist = (id) => (m.hist[id] || []).map(l => LET[l]).join(' ') || '-';
      keyed(el, `pp${s.phase}-${s.round}-${s.seats.join()}-${m ? m.a + m.b + m.sa + '-' + m.sb + m.phase + m.rally + m.hitter : ''}-${s.champ}`, () => {
        if (s.phase === 'intro') return `<div class="pos-top" style="top:3%;width:min(68%,50em)">${win('Ping Pong', `<h2>Ping Pong</h2><p>Knockout, first to ${WIN}. Every shot is a mind game: the hitter picks a lane, the receiver picks a lane to cover, both in secret. Match = returned. Miss = point. One SMASH each per match. Sign up on your phone when the table opens.</p>`, { ctl: false })}</div>`;
        if (s.phase === 'signup') return `<div class="pos-top" style="top:3%;width:min(68%,50em)">${win('Ping Pong: sign up', `<h2>Who's playing?</h2><p><b>Sit down first, then the host starts the tournament.</b> Up to 8 seats. Tap <b>Sit at the table</b> on your phone.</p><div class="tagrow">${s.seats.map(id => `<span class="chip">${esc(nm(ctx, id))}</span>`).join('') || '<span class="muted">Empty so far</span>'}</div>`, { ctl: false })}</div>`;
        if (s.phase === 'done') return `<div class="pos-top" style="top:3%;width:min(60%,44em)">${win('Champion', `<h2 class="mega small">${esc(nm(ctx, s.champ))}</h2><p>Ping pong champion.</p>`, { ctl: false })}</div>`;
        const r = m.res;
        const msg = m.phase === 'pick' ? `${esc(nm(ctx, m.hitter))} is hitting. Both players: lock in a lane.` :
          r ? (r.ok ? (r.smash ? `${esc(nm(ctx, other(m, r.hitter)))} READ THE SMASH. Steals a point.` : `Covered. ${esc(nm(ctx, other(m, r.hitter)))} hits next.`) : `${esc(nm(ctx, r.hitter))} ${r.smash ? 'SMASHES one past for 2' : 'scores'}.`) : '';
        return `<div class="pos-top" style="top:2%;width:min(64%,48em)">${win(`Round ${s.round}`, `<div class="score"><b>${esc(nm(ctx, m.a))}</b><span class="sc">${m.sa}</span><span>:</span><span class="sc">${m.sb}</span><b>${esc(nm(ctx, m.b))}</b></div>
          <p class="center" style="margin:6px 0 0"><b>${msg}</b></p>
          <div class="row between hist"><span>${esc(nm(ctx, m.a))} shots: ${hist(m.a)}</span><span>${esc(nm(ctx, m.b))} shots: ${hist(m.b)}</span></div>
          <div class="hpbar" style="margin:6px 0 0"><i id="ppt" style="width:100%"></i></div>`, { ctl: false })}</div>`;
      });
      const t = el.querySelector('#ppt');
      if (t && m && m.phase === 'pick') t.style.width = clamp((m.until - ctx.now()) / pickMs(m.rally) * 100, 0, 100) + '%';
      const c = gameCanvas(el);
      startLoop('pp', c, draw);
    },
    teardown() { stopLoop('pp'); },

    player(el, ctx) {
      const s = ctx.s, me = ctx.me.id, L = ctx.local, m = s.match;
      if (s.phase === 'intro') { keyed(el, 'i', () => win('Ping Pong', `<h2>Ping Pong</h2><p>Knockout tournament. Watch the big screen. The table opens in a sec.</p>`)); return; }
      if (s.phase === 'signup') {
        const sat = s.seats.includes(me);
        keyed(el, 'su' + sat + s.seats.length, () => win('Ping Pong', `<h2>${sat ? 'You\'re in' : 'Want a seat?'}</h2><p>${s.seats.length} of 8 seats taken.</p><p class="hint"><b>Sit down first, then the host starts the tournament.</b></p>${!sat && s.seats.length >= 8 ? '<p class="muted">Table is full. You can watch and heckle.</p>' : ''}<button class="btn def block" id="sit" style="min-height:60px">${sat ? 'Stand up' : 'Sit at the table'}</button>`), (r) => { r.querySelector('#sit').onclick = () => { ctx.send(sat ? 'pp-leave' : 'pp-join', {}); ctx.fx.haptic(15); }; });
        return;
      }
      if (s.phase === 'done') { keyed(el, 'dn', () => win('Champion', `<h2>${esc(nm(ctx, s.champ))}</h2><p>${s.champ === me ? 'That\'s you. Take a bow.' : 'Tournament over.'}</p>`)); return; }
      const playing = m && (m.a === me || m.b === me);
      if (!playing) {
        keyed(el, 'w' + (m ? m.a + m.b + m.sa + m.sb + m.phase : ''), () => win('Watching', `<h2>${m ? esc(nm(ctx, m.a)) + ' vs ' + esc(nm(ctx, m.b)) : ''}</h2><p class="muted">Score ${m ? m.sa + ' : ' + m.sb : ''}. Heckle with the buttons below.</p>`));
        return;
      }
      const hitter = m.hitter === me, opp = other(m, me);
      const chosen = hitter ? m.aim : m.cov;
      const mine = (L.pick && L.pick.key === `${m.sa}-${m.sb}-${m.rally}-${m.hitter}`) ? L.pick : null;
      const sel = chosen != null ? chosen : (mine ? mine.lane : null);
      const oppHist = (m.hist[opp] || []).map(l => LET[l]).join(' ') || 'nothing yet';
      const key = `p${m.phase}-${hitter}-${m.rally}-${m.sa}-${m.sb}-${sel}-${m.res ? 'r' : ''}-${mine ? mine.smash : ''}`;
      keyed(el, key, () => {
        const lanes = (dis) => `<div class="lanes">${LANES.map((l, i) => `<button class="btn ${sel === i ? 'def' : ''}" data-lane="${i}" ${dis ? 'disabled' : ''}>${l}</button>`).join('')}</div>`;
        const sc = `${m.sa} : ${m.sb}`;
        if (m.phase === 'pick') {
          const smashLeft = (m.smashLeft[me] || 0) > 0;
          if (hitter) return win(sc, `<h2>You're hitting</h2><p>Pick a lane. Don't be predictable.</p>
            ${smashLeft ? `<button class="btn block ${mine && mine.smash ? 'def' : ''}" data-smash ${sel != null ? 'disabled' : ''}>SMASH: ${mine && mine.smash ? 'ON (2 pts, or they steal 1)' : 'off (1 left)'}</button>` : '<p class="hint">Smash used.</p>'}
            <div style="height:8px"></div>${lanes(sel != null)}${sel != null ? '<p class="muted center" style="margin-top:10px">Locked in. Waiting for them.</p>' : ''}`);
          return win(sc, `<h2>You're covering</h2><p>Guess where ${esc(nm(ctx, opp))} is aiming. Their last shots: <b>${oppHist}</b></p>${lanes(sel != null)}${sel != null ? '<p class="muted center" style="margin-top:10px">Locked in. Waiting for them.</p>' : ''}`);
        }
        if (m.phase === 'reveal') {
          const r = m.res, iWon = r.by === me;
          const txt = r.ok ? (r.smash ? (hitter ? 'They read your smash. They steal a point.' : 'You read the smash. You steal a point.') : (hitter ? 'They covered it.' : 'You covered it. You hit next.')) : (r.by === me ? (r.smash ? 'Smash got through. +2.' : 'Point.') : 'Wrong lane. Point to them.');
          return win(sc, `<div class="result ${iWon || (r.ok && !r.smash && !hitter) ? 'ok' : 'no'}"><span class="pts">${LANES[r.aim]} vs ${LANES[r.cov]}</span>${txt}</div>`);
        }
        return win('Match over', `<div class="result ${((m.sa > m.sb) === (m.a === me)) ? 'ok' : 'no'}"><span class="pts">${((m.sa > m.sb) === (m.a === me)) ? 'You win' : 'You lose'}</span>${m.sa} : ${m.sb}</div>`);
      }, (root) => {
        const k = `${m.sa}-${m.sb}-${m.rally}-${m.hitter}`;
        const cur = () => (L.pick && L.pick.key === k) ? L.pick : (L.pick = { key: k, lane: null, smash: false });
        root.querySelectorAll('[data-lane]').forEach(b => b.onclick = () => {
          const p = cur(); p.lane = +b.dataset.lane; ctx.fx.haptic(15); ctx.fx.sound.play('tap');
          ctx.send('pp-set', { lane: p.lane, smash: p.smash }); ctx.rerender();
        });
        const sm = root.querySelector('[data-smash]'); if (sm) sm.onclick = () => { const p = cur(); p.smash = !p.smash; ctx.rerender(); };
      });
    },

    host(el, ctx) {
      const s = ctx.s, m = s.match;
      el.innerHTML = s.phase === 'intro' ? '<p>Knockout, first to 5. Anyone who sits in signup plays; the rest watch.</p>'
        : s.phase === 'signup' ? `<p><b>Sit down first, then start the tournament.</b> Wait until everyone has sat.</p><p>${s.seats.length} seated: ${s.seats.map(id => esc(nm(ctx, id))).join(', ') || 'nobody'}.</p>`
        : m ? `<div class="row"><span class="chip">Round ${s.round}</span><span class="chip">${esc(nm(ctx, m.a))} ${m.sa} : ${m.sb} ${esc(nm(ctx, m.b))}</span><span class="chip">${s.todo.length} more this round</span></div>` : `<p>Champion: ${esc(nm(ctx, s.champ))}</p>`;
    },
  },
};

function advance(s, ctx, winner) {
  const m = s.match;
  const loser = other(m, winner);
  ctx.award([{ id: winner, points: 150, coins: 6, stats: { pp_wins: 1 } }, { id: loser, points: 60, coins: 2 }]);
  const won = [...s.won, winner];
  const nxt = { ...s, won, match: null, log: [...s.log, { w: winner, l: loser }] };
  if (!nxt.todo.length) {
    if (won.length === 1) { ctx.award([{ id: winner, points: 400, coins: 15 }]); return { ...nxt, phase: 'done', champ: winner }; }
    return newRound({ ...nxt, won }, ctx);
  }
  return startMatch(nxt, ctx);
}

// ---------------- table ----------------
function draw(g, W, H, t) {
  const ctx = CX; if (!ctx) return;
  const s = ctx.s, m = s.match;
  if (s.phase !== 'match' || !m) return;
  const x0 = W * .12, x1 = W * .88, y0 = H * .3, y1 = H * .68, th = y1 - y0;
  g.fillStyle = '#000'; g.fillRect(x0 - 8, y0 - 8, x1 - x0 + 16, th + 16);
  g.fillStyle = '#7a0f1f'; g.fillRect(x0, y0, x1 - x0, th);
  g.fillStyle = '#fff'; g.fillRect(x0, y0 + 3, x1 - x0, 4); g.fillRect(x0, y1 - 7, x1 - x0, 4); g.fillRect((x0 + x1) / 2 - 2, y0, 4, th);
  for (let y = y0; y < y1; y += 14) { g.fillStyle = '#000'; g.fillRect((x0 + x1) / 2 - 8, y, 16, 7); }
  const laneY = (l) => y0 + th * (l + .5) / 3;
  g.fillStyle = 'rgba(255,255,255,.28)'; g.font = `700 ${Math.max(12, H * .022)}px Tahoma, Arial`; g.textAlign = 'left'; g.textBaseline = 'middle';
  for (let l = 0; l < 3; l++) { g.fillText(LANES[l], x0 + 30, laneY(l)); if (l) { g.fillRect(x0, y0 + th * l / 3, x1 - x0, 1); } }
  const r = m.res;
  const recv = other(m, r ? r.hitter : m.hitter), hit = r ? r.hitter : m.hitter;
  const px = (id) => (id === m.a ? x0 - 22 : x1 + 4);
  const k = r ? clamp((ctx.now() - r.t0) / FLIGHT_MS, 0, 1) : 0;
  // paddles: the receiver's lane is only revealed once the ball lands
  for (const id of [m.a, m.b]) {
    let y = (y0 + y1) / 2;
    if (r && id === recv && k >= 1) y = laneY(r.cov);
    if (r && id === hit) y = laneY(r.aim);
    block(g, px(id), y - 28, 18, 56, id === m.a ? '#ffd400' : '#f4f4f4');
  }
  // lock-in indicators while picking (no peeking at the lane, just that they've chosen)
  if (m.phase === 'pick') {
    for (const [id, done] of [[hit, m.aim != null], [recv, m.cov != null]]) {
      g.fillStyle = done ? '#ffd400' : '#fff'; g.font = `900 ${Math.max(14, H * .03)}px Arial Black, Arial`; g.textAlign = id === m.a ? 'left' : 'right';
      g.fillText(done ? 'LOCKED' : 'THINKING...', id === m.a ? x0 + 6 : x1 - 6, y0 - 22 + (id === m.a ? 0 : 0));
    }
    const hx = hit === m.a ? x0 + 12 : x1 - 12;
    block(g, hx - 9, (y0 + y1) / 2 - 9, 18, 18, '#fff');
    return;
  }
  // reveal: ball flies to the chosen lane
  if (r) {
    const fromLeft = hit === m.a;
    const bx = fromLeft ? x0 + (x1 - x0) * k : x1 - (x1 - x0) * k;
    const by = (y0 + y1) / 2 + (laneY(r.aim) - (y0 + y1) / 2) * k;
    const bounce = Math.abs(Math.sin(k * Math.PI * 2)) * 26 * (1 - k * .4);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(bx - 8, by + 6, 16, 5);
    block(g, bx - 9, by - 9 - bounce, 18, 18, r.smash ? '#ffd400' : '#fff');
    if (k >= 1) {
      g.font = `900 ${Math.max(20, H * .06)}px Arial Black, Arial`; g.textAlign = 'center'; g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 6;
      const txt = r.ok ? (r.smash ? 'READ IT!' : 'COVERED') : (r.smash ? 'SMASH! +2' : 'POINT');
      g.strokeText(txt, W / 2, y1 + 50); g.fillText(txt, W / 2, y1 + 50);
    }
  }
}

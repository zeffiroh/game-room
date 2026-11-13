// CELL CYCLE RUNNER: you are a cell running through G1, S, G2 and M.
// Jump (twice, in the air) over DNA damage, duck under UV rays and spindle fibers, collect nutrients to grow.
// At each checkpoint gate the cell stops: hold SPACE to repair the damage (slow, costs time bonus) or press E to
// push through (fast, bonus points, mutation risk). Three mutations is cancer. Too much damage at once triggers
// apoptosis and costs a cell. Finish M and cytokinesis gives you a daughter cell and a faster cycle.
import { block, clamp, text, rnd, rint, seg } from '../engine/canvas.js';

const PX = 220, GY = 450, LENS = [2100, 2300, 1900, 2200], NAMES = ['G1', 'S', 'G2', 'M'];
const GATES = ['G1/S CHECKPOINT', 'S PHASE DONE', 'G2/M CHECKPOINT', 'SPINDLE CHECKPOINT'];
const ENTER = ['G1: GROW AND DODGE THE RED SPIKES', 'S PHASE: COPY THE DNA', 'G2: CHECK THE COPY', 'M PHASE: LINE UP THE CHROMOSOMES'];
const BUDGET = 28, MAXDMG = 6;
const smooth = (k) => { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); };
const lerp = (a, b, k) => a + (b - a) * k;
const TINT = ['#e9cdb4', '#ebc4b0', '#eed3a8', '#dcbcc2'];

function organelles(g, dist, t, par = 1) {
  const O = [[0, 90, 70, 36, '#ff8c00'], [320, 190, 90, 26, '#c0a0b0'], [610, 120, 60, 60, '#d8d0c8'], [880, 240, 80, 34, '#ff8c00'], [1200, 80, 100, 24, '#c0a0b0'], [1500, 200, 70, 50, '#d8d0c8']];
  for (const [ox, oy, w, h, c] of O) { const p = (ox % 2 ? .3 : .5) * par; const x = ((ox - dist * p) % 1700 + 1700) % 1700 - 100; block(g, x, oy + Math.sin(t + ox) * 6, w, h, c); }
}
function chromo(g, x, y, c = '#7a2d86', len = 26) { g.fillStyle = '#000'; g.fillRect(x - 5, y - len / 2 - 2, 10, len + 4); g.fillStyle = c; g.fillRect(x - 3, y - len / 2, 6, len); }
// mp: mitosis progress 0..2 (0-1 running: prophase then metaphase; 1-2 anaphase then telophase)
function bg(g, ph, dist, t, prog, mp) {
  g.fillStyle = TINT[ph]; g.fillRect(0, 0, 960, 600);
  g.fillStyle = 'rgba(122,15,31,.07)'; for (let x = -(dist * .2 % 64); x < 960; x += 64) g.fillRect(x, 0, 2, 600);
  if (ph === 0) {
    organelles(g, dist, t);
    for (let i = 0; i < 4; i++) { const x = ((i * 300 - dist * .15) % 1200 + 1200) % 1200 - 120; g.fillStyle = 'rgba(122,45,134,.18)'; g.fillRect(x, 300, 90, 8); g.fillRect(x + 20, 312, 70, 8); }
  } else if (ph === 1) {
    const fx = 900 - prog * 780;
    for (const s of [-1, 1]) { const dd = (x) => 58 * smooth((fx - x) / 150); for (let x = 0; x < 960; x += 8) { const d = dd(x), yc = 210 + s * d, a = (x + dist * .4) / 38, am = 26; const y1 = yc + Math.sin(a) * am, y2 = yc - Math.sin(a) * am; if (Math.round(x / 8) % 3 === 0) { g.fillStyle = '#c0a0b0'; g.fillRect(x + 3, Math.min(y1, y2) + 4, 2, Math.abs(y1 - y2)); } g.fillStyle = '#7a0f1f'; g.fillRect(x, y1, 8, 8); g.fillStyle = '#ff8c00'; g.fillRect(x, y2, 8, 8); } }
    block(g, fx - 14, 196, 28, 28, '#ffd400'); text(g, 'REPLICATION FORK', clamp(fx, 110, 850), 120, 14, '#7a0f1f', 'center');
    text(g, 'POLYMERASE', clamp(fx, 110, 850), 150, 11, '#000', 'center');
  } else if (ph === 2) {
    organelles(g, dist, t, .6);
    for (const [cx, cy] of [[300, 220], [640, 250]]) { const x = ((cx - dist * .12) % 1100 + 1100) % 1100 - 60; g.strokeStyle = 'rgba(122,45,134,.3)'; g.lineWidth = 3; for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + t * .2; g.beginPath(); g.moveTo(x, cy); g.lineTo(x + Math.cos(a) * 120, cy + Math.sin(a) * 110); g.stroke(); } block(g, x - 10, cy - 10, 20, 20, '#ff8c00'); }
  } else {
    const s1 = smooth(mp / .7), s2 = smooth((mp - 1) / .6);
    for (let i = 0; i < 5; i++) { const x = ((i * 260 - dist * .1) % 1100 + 1100) % 1100 - 80; g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(x, 90 + i * 55 % 220, 40, 10); }
    // poles
    block(g, 36, 250, 28, 40, '#ff8c00'); block(g, 896, 250, 28, 40, '#ff8c00');
    const items = [];
    for (let i = 0; i < 6; i++) {
      const ax = 220 + (i * 131) % 520, ay = 130 + (i * 67) % 200 + Math.sin(t * 2 + i) * 4 * (1 - s1), py = 130 + i * 44;
      for (const h of [-1, 1]) {
        const xb = lerp(ax, 480, s1), yb = lerp(ay, py, s1);
        const x = lerp(xb, 480 + h * 372, s2) + h * 3 * (1 - s2), y = lerp(yb, 270 + (py - 240) * (1 - .55 * s2), s2);
        items.push([x, y, h]);
      }
    }
    g.strokeStyle = `rgba(122,45,134,${.18 + .3 * s1})`; g.lineWidth = 2;
    for (const [x, y, h] of items) { g.beginPath(); g.moveTo(h < 0 ? 64 : 896, 270); g.lineTo(x, y); g.stroke(); }
    const small = lerp(.55, 1, s1);
    for (const [x, y] of items) chromo(g, x, y, '#7a2d86', 26 * small);
    if (mp >= 1.5) { g.fillStyle = 'rgba(122,15,31,.25)'; g.fillRect(468, 120, 24, 300); }
  }
}
function tumor(g, level, t) {
  if (level <= 0) return;
  const w = Math.min(190, 18 + level * 1.6);
  for (let y = -10; y < 470; y += 28) { const wob = Math.sin(t * 2 + y * .1) * 5, ww = w * (.6 + .4 * Math.abs(Math.sin(y * .07))) + wob; block(g, -ww + ww * .55, y, ww, 30, ((y / 28) | 0) % 2 ? '#a03070' : '#5a0f2a'); }
}
function drawCell(g, cx, fy, w, h, o) {
  const x0 = cx - w / 2, y0 = fy - h - 6;
  const run = o.run ? Math.sin(o.leg) : 0, tuck = o.air;
  g.fillStyle = '#000';
  g.fillRect(cx - w * .3 + (tuck ? 4 : run * 7) - 5, fy - 8, 12, 8); g.fillRect(cx + w * .1 - (tuck ? 4 : run * 7) - 5, fy - 8, 12, 8);
  g.fillStyle = '#c4a070'; g.fillRect(cx - w * .3 + (tuck ? 4 : run * 7) - 3, fy - 7, 8, 5); g.fillRect(cx + w * .1 - (tuck ? 4 : run * 7) - 3, fy - 7, 8, 5);
  if (o.cyc) { g.fillStyle = 'rgba(255,140,0,.5)'; g.fillRect(x0 - 8, y0 - 8, w + 16, h + 16); }
  g.fillStyle = '#000'; g.fillRect(x0 - 2, y0 - 2, w + 4, h + 4);
  g.fillStyle = o.flash ? '#fff' : '#f4d9b0'; g.fillRect(x0, y0, w, h);
  g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(x0 + 3, y0 + 3, w * .5, 4); g.fillRect(x0 + 3, y0 + 3, 4, h * .4);
  const nb = Math.abs(run) * 2;
  g.fillStyle = '#000'; g.fillRect(cx - w * .14 - 2, y0 + h * .5 - 2 - nb, w * .3 + 4, w * .3 + 4);
  g.fillStyle = '#7a2d86'; g.fillRect(cx - w * .14, y0 + h * .5 - nb, w * .3, w * .3);
  const blink = Math.sin(o.t * 1.3) > .985 || o.ducking;
  g.fillStyle = '#000';
  if (!blink) { g.fillRect(cx - w * .08, y0 + h * .2, w * .12, w * .14); g.fillRect(cx + w * .2, y0 + h * .2, w * .12, w * .14); g.fillStyle = '#fff'; g.fillRect(cx + w * .02, y0 + h * .22, 3, 3); g.fillRect(cx + w * .3, y0 + h * .22, 3, 3); }
  else { g.fillRect(cx - w * .08, y0 + h * .27, w * .12, 3); g.fillRect(cx + w * .2, y0 + h * .27, w * .12, 3); }
  g.fillStyle = '#000'; if (o.hurt) g.fillRect(cx + w * .02, y0 + h * .82, 8, 8); else g.fillRect(cx + w * .02, y0 + h * .85, w * .24, 3);
}

export default {
  id: 'cell-cycle-runner', title: 'Cell Cycle Runner',
  blurb: 'Run through the cell cycle. Repair your DNA at the checkpoints, or gamble and push through.',
  how: ['SPACE, UP or tap to jump. Press again in the air to double jump. DOWN or S to duck. Red spikes are DNA damage; UV rays and spindle fibers hang from above.', 'At each checkpoint gate you stop. HOLD SPACE to repair (more damage = longer, and the time bonus shrinks). Or press E to push through for bonus points and risk a mutation.', 'Grab nutrients to grow and cyclin to surge through damage. Six damage at once triggers apoptosis and costs a cell. Three mutations is cancer.', 'Finish M and cytokinesis gives you a daughter cell. Then the cycle runs again, faster.'],
  touch: [{ k: 'space', label: 'JUMP / REPAIR' }, { k: 'arrowdown', label: 'DUCK' }, { k: 'e', label: 'PUSH THROUGH' }],
  learn: 'The cell cycle: G1 (grow), S (copy the DNA), G2 (check the copy and prepare), M (divide). Checkpoints stop the cycle until damage is repaired, with p53 as the guard; cyclins and CDKs are what drive the cell forward. A cell with damage too severe to fix is told by p53 to undergo apoptosis. Cancer is what happens when cells skip checkpoints and keep dividing with mutations. Every time you pushed through with damage, you were gambling like a tumor cell.',
  pointerAsSpace: true,
  thumb(g, W, H, t) {
    const prog = (t * .08) % 1;
    bg(g, 1, t * 200, t, prog, 0);
    g.fillStyle = '#6a5a4a'; g.fillRect(0, GY, W, 160); g.fillStyle = '#000'; g.fillRect(0, GY, W, 6);
    for (let i = 0; i < 3; i++) { const x = ((i * 380 - t * 220) % 1100 + 1100) % 1100 - 100; g.fillStyle = '#000'; g.fillRect(x, GY - 38, 40, 40); g.fillStyle = '#c0001a'; g.fillRect(x + 4, GY - 34, 32, 32); }
    const bob = Math.abs(Math.sin(t * 6)) * 60;
    drawCell(g, PX, GY - bob, 40, 40, { run: bob < 2, leg: t * 14, air: bob > 2, t });
    text(g, 'RUN THE CYCLE', W / 2, 90, 54, '#fff', 'center', '#000');
  },
  create(api) {
    let t = 0, dist = 0, v = 0, vy = 0, y = GY, grounded = true, jumpHeld = false, duckHeld = false, jumps = 0, buffer = 0, ph = 0, phStart = 0, phT = 0, mode = 'run', repair = 0, need = 0, tickT = 0;
    let lesions = 0, mut = 0, pushes = 0, score = 0, size = 1, cycle = 0, squash = 0, hurtT = 0, invul = 0, shake = 0, msg = '', msgT = 0, splitT = 0, apopT = 0, nextSpawn = 0, gateOpen = false, gateT = 0;
    let cyc = 0, lives = 2, flash = 0, dustT = 0, leg = 0, swipeY = null, ducking = false, pushBonus = 0;
    let objs = [], parts = [], texts = [];
    const gateX = () => phStart + LENS[ph];
    const prog = () => clamp((dist - phStart) / LENS[ph], 0, 1);
    const say = (m, d = 1.5) => { msg = m; msgT = d; };
    const speed = () => Math.min(540, (285 + cycle * 32 + mut * 16) * (1 + .12 * prog()) * (cyc > 0 ? 1.28 : 1));
    const riskNow = () => Math.min(.9, .15 + .2 * lesions);
    function puff(x, yy, c, n = 8, sp = 160) { for (let i = 0; i < n; i++) parts.push({ x, y: yy, vx: rnd(-sp, sp), vy: rnd(-220, 20), l: rnd(.3, .6), c }); }
    const pop = (s, x, yy) => texts.push({ x, y: yy, s, l: .8 });
    function startRun() {
      // scripted opening: easy, readable, teaches jump, double jump, duck
      objs.push({ k: 'les', x: 600, y: GY - 38, w: 38, h: 38, hint: 'SPACE OR TAP: JUMP' });
      for (let i = 0; i < 3; i++) objs.push({ k: 'nut', x: 880 + i * 44, y: GY - 80, w: 28, h: 28 });
      objs.push({ k: 'les', x: 1180, y: GY - 38, w: 38, h: 38, hint: 'HOLD FOR HIGHER. PRESS AGAIN IN THE AIR: DOUBLE JUMP' });
      objs.push({ k: 'oh', x: 1560, y: 0, w: 26, h: GY - 30, hint: 'DOWN OR S: DUCK' });
      nextSpawn = 1900;
    }
    function group(x) {
      const r = Math.random(), od = .1 + .05 * cycle;
      const les = (xx, w = 38) => objs.push({ k: 'les', x: xx, y: GY - 38, w, h: 38 });
      const oh = (xx) => objs.push({ k: 'oh', x: xx, y: 0, w: 26, h: GY - 30 });
      const pil = (xx) => objs.push({ k: 'pil', x: xx, y: GY - 0, w: 34, h: 0 });
      const nuts = (xx, n, yy, arc) => { for (let i = 0; i < n; i++) objs.push({ k: 'nut', x: xx + i * 44, y: arc ? yy - Math.sin((i + .5) / n * Math.PI) * 50 : yy, w: 28, h: 28 }); };
      const extra = () => {
        const q = Math.random();
        if (cyc <= 0 && q < .07) objs.push({ k: 'cyc', x: x + 60, y: GY - rnd(60, 130), w: 34, h: 34 });
        else if (lesions >= 2 && q < .2) objs.push({ k: 'p53', x: x + 60, y: GY - rnd(60, 120), w: 34, h: 34 });
      };
      let w = 40;
      if (ph === 0) {
        if (r < .38) { les(x); w = 38; } else if (r < .55) { nuts(x, 4, GY - 50); w = 170; } else if (r < .75) { les(x); nuts(x - 40, 3, GY - 100, true); w = 100; } else if (r < .75 + od) { oh(x); w = 26; } else { nuts(x, 3, GY - 120); w = 130; }
      } else if (ph === 1) {
        if (r < .3) { les(x); w = 38; } else if (r < .55) { les(x, 84); w = 84; } else if (r < .72) { les(x); les(x + 118); w = 156; } else if (r < .72 + od) { oh(x); w = 26; } else { les(x); nuts(x - 40, 3, GY - 105, true); w = 100; }
      } else if (ph === 2) {
        if (r < .25) { les(x); w = 38; } else if (r < .5) { oh(x); w = 26; } else if (r < .62) { les(x); oh(x + 330); w = 360; } else if (r < .8) { nuts(x, 4, GY - 55); w = 170; } else { les(x); nuts(x - 40, 3, GY - 105, true); w = 100; }
      } else {
        if (r < .4) { pil(x); w = 34; } else if (r < .55) { pil(x); pil(x + 100); w = 134; } else if (r < .75) { oh(x); w = 26; } else if (r < .85) { les(x); w = 38; } else { nuts(x, 3, GY - 120); w = 130; }
      }
      extra();
      const dens = [1, .85, 1.1, .9][ph];
      nextSpawn = x + w + Math.max(250, speed() * rnd(.88, 1.35)) * dens * (ph === 0 || ph === 2 ? 1.1 : 1);
    }
    function spawnAhead() { const limit = Math.min(dist + 1300, gateX() - 330); while (nextSpawn < limit) group(nextSpawn); }
    // fix chromosome pillars: height varies, drawn as an X
    function fixPil(o) { if (!o.h) { o.h = rint(78, 100); o.y = GY - o.h; } }
    function wantJump() { buffer = .13; }
    function doJump() {
      if (grounded) { vy = -820; grounded = false; jumps = 1; squash = -.25; api.sound('tap'); puff(PX, GY, '#c4a070', 5, 80); return true; }
      if (jumps < 2) { vy = -720; jumps = 2; squash = -.2; api.sound('gentle'); puff(PX, y - 10, '#ffffff', 8, 120); return true; }
      return false;
    }
    function openGate(how) {
      gateOpen = true; mode = 'run';
      const bonus = Math.max(0, Math.round((BUDGET - phT) * 15)); score += bonus; phT = 0;
      if (how === 'clear') { say('ALL CLEAR. +' + bonus, 1.3); api.sound('correct'); }
      else if (how === 'push') {
        pushes++; score += pushBonus; pop('+' + pushBonus, PX, y - 60);
        if (Math.random() < riskNow()) { mut++; hurtT = .6; shake = 14; flash = .3; say('MUTATION! IT IS PERMANENT.', 2.2); api.sound('bonk'); api.haptic(120); if (mut >= 3) return api.end(score, `Cancer after ${cycle} division${cycle === 1 ? '' : 's'}`); }
        else { say('LUCKY. NO MUTATION.', 1.4); api.sound('point'); }
      } else { say('DNA REPAIRED. +' + bonus, 1.3); api.sound('correct'); puff(PX, y - 20, '#ffffff', 14, 200); }
      lesions = 0;
    }
    function damage(label, ox, oy) {
      lesions++; hurtT = .3; invul = .7; shake = 6; api.sound('bonk'); puff(ox, oy, '#c0001a', 12); pop(label, ox, oy - 20); api.haptic(30);
      if (lesions >= MAXDMG) { mode = 'apop'; apopT = 0; jumpHeld = false; api.sound('pop'); say('APOPTOSIS: P53 SHUT THE CELL DOWN', 2.4); }
    }
    startRun(); say(ENTER[0], 3);
    return {
      key(k, down) {
        if (k === 'space' || k === 'arrowup' || k === 'w') { jumpHeld = down; if (down && mode === 'run') wantJump(); }
        else if (k === 'arrowdown' || k === 's') duckHeld = down;
        if (k === 'e' && down && mode === 'gate' && lesions > 0) openGate('push');
      },
      pointer(x, y2, type) {
        if (type === 'down') { jumpHeld = true; swipeY = y2; if (mode === 'run') wantJump(); }
        else if (type === 'move') { if (swipeY !== null && y2 - swipeY > 50) duckHeld = true; }
        else if (type === 'up') { jumpHeld = false; duckHeld = false; swipeY = null; }
      },
      update(dt) {
        t += dt; msgT -= dt; hurtT -= dt; invul -= dt; flash -= dt; shake *= .85; squash *= .85; buffer -= dt; cyc = Math.max(0, cyc - dt);
        for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; p.l -= dt; } parts = parts.filter(p => p.l > 0);
        for (const x of texts) { x.y -= 40 * dt; x.l -= dt; } texts = texts.filter(x => x.l > 0);
        if (mode === 'split') {
          splitT += dt; if (splitT > 3) { splitT = 0; mode = 'run'; cycle++; ph = 0; phStart = dist; objs = []; nextSpawn = dist + 700; size = Math.max(1, size * .8); phT = 0; gateOpen = false; pushes = Math.floor(pushes / 2); say(`CYCLE ${cycle + 1}: FASTER`, 2); invul = 1; }
          return;
        }
        if (mode === 'apop') {
          apopT += dt; v += clamp(0 - v, -900 * dt, 0);
          if (apopT > 2.2) {
            lives--; if (lives <= 0) return api.end(score, 'Apoptosis. No cells left to divide');
            lesions = 0; y = GY; vy = 0; grounded = true; objs = []; dist = phStart; v = 0; nextSpawn = dist + 600; gateOpen = false; mode = 'run'; invul = 2; phT = 0; cyc = 0;
            say('A SPARE CELL TAKES OVER', 2);
          }
          return;
        }
        // movement
        const target = mode === 'gate' ? 0 : speed();
        v += clamp(target - v, -900 * dt, 420 * dt); dist += v * dt;
        if (mode === 'run' || mode === 'gate') phT += dt;
        if (mode === 'run') score += v * dt * .04 * (cyc > 0 ? 2 : 1);
        leg += v * dt * .05;
        // jump + physics
        if (mode === 'run' && buffer > 0 && doJump()) buffer = 0;
        ducking = duckHeld && grounded && mode === 'run';
        let g2 = (vy < 0 && jumpHeld) ? 1200 : 2400; if (!grounded && duckHeld && vy > -200) g2 = 4600;
        vy += g2 * dt; y += vy * dt;
        if (y >= GY) { if (!grounded) { squash = .3; puff(PX, GY, '#c4a070', 5, 90); } y = GY; vy = 0; grounded = true; jumps = 0; if (buffer > 0 && mode === 'run') { doJump(); buffer = 0; } }
        dustT -= dt; if (grounded && mode === 'run' && dustT < 0) { dustT = .09; parts.push({ x: PX - 14, y: GY - 2, vx: -v * .3, vy: rnd(-60, -10), l: .3, c: '#c4a070' }); }
        spawnAhead();
        // collisions
        const s = 40 * size, ph2 = ducking ? 26 : s, pw = ducking ? s * 1.15 : s;
        const L = PX - pw / 2 + 8, R = PX + pw / 2 - 8, T = y - ph2 + 6, B = y;
        for (const o of objs) {
          if (o.k === 'pil') fixPil(o);
          if (o.dead) continue;
          const ox = o.x - dist + PX;
          let hx0 = ox, hx1 = ox + o.w, hy0 = o.y, hy1 = o.y + o.h;
          if (o.k === 'les') { hx0 += 4; hx1 -= 4; hy0 += 8; } else if (o.k === 'oh') { hx0 += 6; hx1 -= 6; } else if (o.k === 'pil') { hx0 += 4; hx1 -= 4; hy0 += 6; }
          if (!(R > hx0 && L < hx1 && B > hy0 && T < hy1)) continue;
          if (o.k === 'nut') { o.dead = true; size = Math.min(1.35, size + .06); score += cyc > 0 ? 20 : 10; api.sound('coin'); puff(ox, o.y, '#ffd400', 6); pop('+' + (cyc > 0 ? 20 : 10), ox, o.y); }
          else if (o.k === 'cyc') { o.dead = true; cyc = 6; score += 50; api.sound('point'); say('CYCLIN SURGE: CDKs ON. SMASH THROUGH!', 1.6); puff(ox, o.y, '#ff8c00', 16, 220); }
          else if (o.k === 'p53') { o.dead = true; lesions = Math.max(0, lesions - 2); score += 30; api.sound('correct'); say('P53 FIXES 2 DAMAGE', 1.3); puff(ox, o.y, '#ffffff', 14, 200); }
          else if (cyc > 0) { o.dead = true; score += 25; api.sound('pop'); puff(ox, (hy0 + hy1) / 2, '#ff8c00', 14, 220); pop('SMASH +25', ox, hy0); shake = 4; }
          else if (invul <= 0) { o.dead = true; damage(o.k === 'oh' ? (ph === 3 ? 'SPINDLE HIT' : 'UV DAMAGE') : 'DNA DAMAGE', ox, Math.max(hy0, y - 30)); if (mode === 'apop') return; }
        }
        objs = objs.filter(o => !o.dead && o.x - dist + PX > -120);
        // gate
        if (mode === 'run' && !gateOpen && gateX() - dist < 150) {
          mode = 'gate'; repair = 0; gateT = 0; need = .8 + .6 * lesions; pushBonus = 100 + 80 * lesions; say(GATES[ph], 1.2); api.sound('reveal');
        }
        if (mode === 'gate') {
          gateT += dt;
          if (lesions === 0) { if (gateT > .8) openGate('clear'); }
          else {
            if (jumpHeld) { repair += dt; tickT -= dt; if (tickT < 0) { tickT = .2; api.sound('tick'); } } else repair = Math.max(0, repair - dt * .5);
            if (repair >= need) openGate('repair');
          }
        }
        if (gateOpen && dist > gateX() + 120) {
          gateOpen = false; phStart = gateX(); phT = 0; nextSpawn = Math.max(nextSpawn, dist + 500);
          if (ph === 3) {
            mode = 'split'; splitT = 0; const b = 200 * (cycle + 1) + Math.max(0, (3 - mut)) * 50; score += b; lives = Math.min(3, lives + 1); ph = 3; objs = [];
            say('CYTOKINESIS! +' + b + '. NEW DAUGHTER CELL', 2.6); api.sound('fanfare'); api.haptic(80); flash = .4;
            for (let i = 0; i < 30; i++) parts.push({ x: PX, y: y - 30, vx: rnd(-300, 300), vy: rnd(-380, -40), l: rnd(.6, 1.2), c: ['#ffd400', '#ff8c00', '#c0001a', '#fff'][i % 4] });
          } else { ph++; flash = .25; say(ENTER[ph], 2); api.sound('reveal'); }
        }
      },
      draw(g) {
        g.save(); if (shake > .5) g.translate(rnd(-shake, shake), rnd(-shake, shake));
        const mp = mode === 'split' ? 1 + splitT / 3 * 1.0 : prog();
        bg(g, ph, dist, t, prog(), ph === 3 ? mp : 0);
        // speed lines
        const sl = clamp((v - 300) / 200, 0, 1) + (cyc > 0 ? .5 : 0);
        if (sl > 0) { g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 7; i++) { const x = ((i * 190 - dist * 1.6) % 1100 + 1100) % 1100 - 100; g.fillRect(x, 100 + (i * 53) % 330, 40 + 60 * sl, 3); } }
        g.fillStyle = '#6a5a4a'; g.fillRect(0, GY, 960, 160); g.fillStyle = '#000'; g.fillRect(0, GY, 960, 6);
        g.fillStyle = 'rgba(0,0,0,.35)'; for (let x = -(dist % 60); x < 960; x += 60) g.fillRect(x, GY + 24, 30, 5);
        g.fillStyle = 'rgba(0,0,0,.2)'; for (let x = -(dist * 1.3 % 90); x < 960; x += 90) g.fillRect(x, GY + 64, 44, 5);
        // gate
        const gx = gateX() - dist + PX;
        if (gx > -80 && gx < 1100 && !(gateOpen && gx < PX - 60)) {
          for (let yy = 40; yy < GY; yy += 30) { g.fillStyle = (Math.floor(yy / 30) % 2) ? '#000' : '#ffd400'; g.fillRect(gx, yy, 44, 30); }
          text(g, GATES[ph], gx + 22, 100, 15, '#000', 'center');
          if (gateOpen) { g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(gx - 4, 36, 52, GY); }
        }
        for (const o of objs) {
          const ox = o.x - dist + PX;
          if (o.k === 'nut') { block(g, ox, o.y + Math.sin(t * 4 + o.x) * 4, 28, 28, '#ffd400'); }
          else if (o.k === 'cyc') { const by = o.y + Math.sin(t * 5) * 5; block(g, ox - 3, by - 3, 40, 40, '#ff8c00'); block(g, ox + 3, by + 3, 28, 28, '#ffd400'); text(g, 'CYC', ox + 17, by + 17, 11, '#000', 'center'); }
          else if (o.k === 'p53') { const by = o.y + Math.sin(t * 5) * 5; block(g, ox - 3, by - 3, 40, 40, '#fff'); text(g, 'p53', ox + 17, by + 17, 13, '#7a2d86', 'center'); }
          else if (o.k === 'les') { g.fillStyle = '#000'; g.fillRect(ox, GY - 38, o.w, 38); g.fillStyle = '#c0001a'; for (let k = 0; k < o.w; k += 19) g.fillRect(ox + k + 3, GY - 34, 13, 34); g.fillStyle = '#000'; for (let k = 0; k < o.w; k += 19) g.fillRect(ox + k + 7, GY - 46, 5, 10); }
          else if (o.k === 'pil') { const h = o.h || 90; chromo(g, ox + 8, GY - h / 2, '#7a2d86', h - 4); chromo(g, ox + 26, GY - h / 2, '#a03070', h - 4); g.fillStyle = '#000'; g.fillRect(ox, GY - h / 2 - 5, 34, 10); g.fillStyle = '#ffd400'; g.fillRect(ox + 2, GY - h / 2 - 3, 30, 6); }
          else if (o.k === 'oh') {
            const col = ph === 3 ? '#7a2d86' : '#ff8c00';
            g.fillStyle = '#000'; g.fillRect(ox + 4, 0, 18, o.h); g.fillStyle = col; g.fillRect(ox + 7, 0, 12, o.h);
            g.fillStyle = 'rgba(255,255,255,.5)'; for (let yy = (t * 120) % 24; yy < o.h; yy += 24) g.fillRect(ox + 11, yy, 4, 10);
            block(g, ox, o.h - 18, 26, 22, '#c0001a');
          }
        }
        tumor(g, mut * 55 + pushes * 12, t);
        // player (splits at cytokinesis)
        const s = 40 * size, sq = 1 + squash * .5, dk = ducking;
        const cw = s * (1 + squash * .3) * (dk ? 1.15 : 1), chh = dk ? 26 : s * sq;
        const co = { run: grounded && mode === 'run' && v > 20, leg, air: !grounded, t, cyc: cyc > 0, ducking: dk, hurt: hurtT > 0 };
        if (cyc > 0 && mode === 'run') for (let i = 1; i < 5; i++) { g.fillStyle = `rgba(255,140,0,${.3 - i * .06})`; g.fillRect(PX - cw / 2 - i * 22, y - chh - 6, cw, chh); }
        if (mode === 'split') {
          const k = clamp(splitT / 1.6, 0, 1);
          for (const d of [-1, 1]) drawCell(g, PX + d * (4 + 46 * k), GY, cw * (1 - .25 * k) * (1 - Math.abs(Math.sin(splitT * 6)) * .02), chh * (1 - .25 * k), { ...co, run: false, air: false });
          g.fillStyle = '#c0001a'; g.fillRect(PX - 3, GY - chh * (1 - .25 * k) - 6, 6, chh * (1 - k * .9));
        } else if (mode === 'apop') {
          const k = clamp(apopT / 1.5, 0, 1);
          for (let i = 0; i < 6; i++) { const a = i * 1.047 + k * 2, r = 10 + k * 46; const bs = 18 * (1 - k * .5); block(g, PX + Math.cos(a) * r - bs / 2, y - 20 + Math.sin(a) * r * .8 - bs / 2, bs, bs, i % 2 ? '#f4d9b0' : '#7a2d86'); }
          const sh = s * (1 - k * .75); drawCell(g, PX, y, sh, sh, { ...co, run: false, air: false, hurt: true });
        } else if (!(invul > 0 && Math.floor(t * 20) % 2 && hurtT <= 0 && cyc <= 0)) drawCell(g, PX, y, cw, chh, { ...co, flash: hurtT > 0 && Math.floor(t * 20) % 2 });
        for (const p of parts) { g.fillStyle = p.c; g.fillRect(p.x, p.y, 6, 6); }
        for (const x of texts) text(g, x.s, x.x, x.y, 16, '#fff', 'center', '#000');
        g.restore();
        if (flash > 0) { g.fillStyle = `rgba(255,255,255,${clamp(flash * 1.6, 0, .5)})`; g.fillRect(0, 0, 960, 600); }
        // hint on nearest upcoming tutorial obstacle
        for (const o of objs) { if (o.hint) { const ox = o.x - dist + PX; if (ox > PX && ox < PX + 520) { text(g, o.hint, 480, 540, 20, '#fff', 'center', '#000'); break; } } }
        // gate prompt
        if (mode === 'gate') {
          if (lesions === 0) { g.fillStyle = '#c0c0c0'; g.fillRect(340, 130, 280, 70); g.fillStyle = '#000'; g.fillRect(340, 130, 280, 3); text(g, 'ALL CLEAR', 480, 158, 26, '#7a0f1f', 'center'); text(g, 'NO DAMAGE TO FIX', 480, 184, 13, '#000', 'center'); }
          else {
            g.fillStyle = '#000'; g.fillRect(168, 96, 624, 196); g.fillStyle = '#c0c0c0'; g.fillRect(171, 99, 618, 190);
            g.fillStyle = '#7a0f1f'; g.fillRect(171, 99, 618, 24); text(g, GATES[ph] + ': ' + lesions + ' DAMAGE', 182, 111, 14, '#fff');
            text(g, 'REPAIR (SAFE, SLOW)', 330, 146, 18, '#000', 'center'); text(g, 'HOLD SPACE OR TAP', 330, 168, 13, '#000', 'center'); seg(g, 190, 182, 280, 22, repair / need);
            text(g, `about ${need.toFixed(1)}s. Time bonus keeps ticking down.`, 330, 224, 12, '#000', 'center');
            g.fillStyle = '#000'; g.fillRect(488, 130, 3, 148);
            text(g, 'PUSH THROUGH (FAST)', 630, 146, 18, '#c0001a', 'center'); text(g, 'PRESS E OR PUSH BUTTON', 630, 168, 13, '#000', 'center');
            text(g, `+${pushBonus} POINTS`, 630, 198, 22, '#000', 'center'); text(g, `${Math.round(riskNow() * 100)}% MUTATION RISK`, 630, 228, 16, '#c0001a', 'center');
            text(g, `Mutations so far: ${mut} of 3`, 630, 256, 12, '#000', 'center');
          }
        }
        // HUD
        g.fillStyle = '#c0c0c0'; g.fillRect(14, 14, 932, 52);
        for (let i = 0; i < 4; i++) { const x = 24 + i * 120; g.fillStyle = '#000'; g.fillRect(x, 22, 112, 36); g.fillStyle = i === ph ? '#7a0f1f' : i < ph ? '#808080' : '#fff'; g.fillRect(x + 2, 24, 108, 32); text(g, NAMES[i], x + 56, 41, 18, i === ph ? '#fff' : '#000', 'center'); }
        text(g, `SCORE ${Math.round(score)}`, 520, 40, 18);
        for (let i = 0; i < 3; i++) { g.fillStyle = '#000'; g.fillRect(740 + i * 34, 24, 28, 32); g.fillStyle = i < mut ? '#5a0f2a' : '#fff'; g.fillRect(742 + i * 34, 26, 24, 28); }
        text(g, 'MUT', 722, 40, 11, '#000', 'right');
        for (let i = 0; i < 3; i++) { g.fillStyle = '#000'; g.fillRect(868 + i * 24, 28, 20, 24); g.fillStyle = i < lives ? '#f4d9b0' : '#808080'; g.fillRect(870 + i * 24, 30, 16, 20); }
        g.fillStyle = '#000'; g.fillRect(14, 70, 932, 28); g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(14, 70, 932, 28);
        seg(g, 22, 76, 240, 16, prog());
        text(g, `CYCLE ${cycle + 1}`, 276, 84, 14, '#fff', 'left');
        const subs = ph === 3 ? (mp < 1 ? (prog() < .45 ? 'PROPHASE' : 'METAPHASE') : mp < 1.5 ? 'ANAPHASE' : 'TELOPHASE') : '';
        if (subs) text(g, subs, 380, 84, 14, '#ffd400', 'left');
        text(g, `DAMAGE ${lesions}/${MAXDMG}`, 560, 84, 14, lesions >= 4 && Math.floor(t * 6) % 2 ? '#ffffff' : lesions >= 4 ? '#ff8c00' : '#fff', 'left');
        for (let i = 0; i < MAXDMG; i++) { g.fillStyle = '#000'; g.fillRect(670 + i * 20, 76, 16, 16); g.fillStyle = i < lesions ? '#c0001a' : '#fff'; g.fillRect(672 + i * 20, 78, 12, 12); }
        text(g, 'CELLS', 820, 84, 11, '#fff', 'right');
        if (cyc > 0) { seg(g, 830, 76, 108, 16, cyc / 6, '#ff8c00'); }
        if (msgT > 0) text(g, msg, 480, 330, msg.length > 26 ? 28 : 38, '#fff', 'center', '#000');
      },
    };
  },
};

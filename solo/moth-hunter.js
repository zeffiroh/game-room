// MOTH HUNTER: you are a bird. Click the moths you can see. The ones you miss have the babies.
// Natural selection with the selection pressure being you. The bark gets sooty and then clean again,
// and the population chases it.
import { clamp, text, rnd, rint, seg } from '../engine/canvas.js';

const N = 36, GEN = 7, T_FACTORY = 48, T_CLEAN = 104, T_END = 158;
const gray = (v, d = 0) => { const L = Math.round(clamp(28 + (v + d) * 205, 0, 255)); return `rgb(${L + 12},${L + 5},${Math.max(0, L - 8)})`; };
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const patches = Array.from({ length: 420 }, () => ({ x: rnd(0, 960), y: rnd(-20, 600), w: rnd(4, 26), h: rnd(24, 110), d: rnd(-.09, .09) }));

function bark(g, v) {
  g.fillStyle = gray(v); g.fillRect(0, 0, 960, 600);
  for (const p of patches) { g.fillStyle = gray(v, p.d); g.fillRect(p.x, p.y, p.w, p.h); }
  g.fillStyle = 'rgba(0,0,0,.18)'; for (let x = 0; x < 960; x += 120) g.fillRect(x + 40 + (x % 7), 0, 3, 600);
}

// wing rows: [y, inner x, outer x] in pixel units, mirrored left/right
const FORE = [[-8, 2, 6], [-6, 2, 9], [-4, 2, 12], [-2, 2, 14], [0, 2, 15], [2, 2, 15], [4, 3, 13]];
const HIND = [[6, 3, 11], [8, 3, 9], [10, 3, 6]];
// A moth drawn from rectangles. s = shade 0..1, k = size, flap = wings spread (0..1), flash = show outline
function moth(g, x, y, s, k = 1, flap = 0, flash = 0) {
  const u = 1.4 * k, sp = flap * 2;
  const R = (px, py, w, h) => g.fillRect(Math.round(x + px * u), Math.round(y + py * u), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u)));
  if (flash > 0) { g.fillStyle = `rgba(255,255,255,${.5 * flash})`; for (const sd of [-1, 1]) for (const [py, a, b] of FORE) R(sd < 0 ? -b - sp - 1 : a + 0, py - 1, b - a + sp + 1, 4); }
  for (const sd of [-1, 1]) {
    const wing = (rows, d) => { g.fillStyle = gray(s, d); for (const [py, a, b] of rows) { const o = b + sp; if (sd < 0) R(-o, py, o - a, 2); else R(a, py, o - a, 2); } };
    wing(HIND, -.05); wing(FORE, 0);
    g.fillStyle = gray(s, -.09); // wing band and eyespot
    if (sd < 0) { R(-12 - sp, -3, 3, 5); R(-8, -7, 2, 3); } else { R(9 + sp, -3, 3, 5); R(6, -7, 2, 3); }
    g.fillStyle = gray(s, .08);
    if (sd < 0) { R(-8 - sp, 0, 3, 3); R(-5, 5, 2, 2); } else { R(5 + sp, 0, 3, 3); R(3, 5, 2, 2); }
    g.fillStyle = gray(s, -.12); // antenna
    if (sd < 0) { R(-4, -15, 1, 3); R(-6, -17, 2, 2); } else { R(3, -15, 1, 3); R(4, -17, 2, 2); }
  }
  g.fillStyle = gray(s, -.14); R(-2, -11, 4, 22); R(-2, -14, 4, 4);
  g.fillStyle = gray(s, .04); R(-1, -8, 2, 3); R(-1, -2, 2, 2); R(-1, 4, 2, 2);
}

export default {
  id: 'moth-hunter', title: 'Moth Hunter',
  blurb: 'You are a bird. Eat the moths you can see. Watch what happens to the ones you cannot.',
  how: ['Click or tap moths to eat them. Eating fills your hunger bar. Missing costs you.', 'Moths blend into the bark. Watch for a twitch or a crawl. The better hidden the moth, the more it is worth.', 'Chain bites for a combo. Wait too long or miss and the chain breaks.', 'The moths you leave alone have the babies. The graph shows the shade of the whole population.', 'Around 50 seconds the factory opens and the bark changes.'],
  learn: 'Natural selection. The moths that were harder to see survived and had babies, so the population drifted toward the shade of the bark. When the bark changed (the real story is the Industrial Revolution in England), selection pushed the other way. Nobody planned it. You were the environment, and the better you hunted, the better hidden your prey became.',
  thumb(g, W, H, t) {
    bark(g, .82);
    [[200, 170, .12], [420, 300, .8], [640, 200, .5], [300, 440, .84], [720, 430, .2], [540, 120, .78]].forEach(([x, y, s], i) => moth(g, x, y + Math.sin(t * 2 + i) * 2, s, 2.2, Math.sin(t * 4 + i) > .6 ? 1 : 0));
    text(g, 'WHICH ONES CAN YOU SEE?', W / 2, 540, 40, '#fff', 'center', '#000');
  },
  create(api) {
    let t = 0, hunger = 100, score = 0, eaten = 0, gen = 1, genT = 0, barkV = .82, barkTarget = .82;
    let banner = null, sub = null, bannerT = 0, ev = 0, shake = 0, flash = 0, flashC = '255,255,255';
    let combo = 0, comboT = 0, best = 0, hintT = 0, firstDone = false, lowT = 0, toast = null, toastT = 0;
    let moths = [], parts = [], texts = [], rings = [], mx = 480, my = 300, prevBins = null, prevMean = .5;
    let missed = 0;
    const free = (x, y) => !(x < 320 && y < 150) && !(x > 690 && y < 205);
    const spot = (cx, cy, r) => { let bx = 480, by = 400, bd = -1; for (let i = 0; i < 30; i++) { const x = clamp(cx == null ? rnd(40, 920) : cx + rnd(-r, r), 36, 924), y = clamp(cy == null ? rnd(60, 570) : cy + rnd(-r, r), 40, 566); if (!free(x, y)) continue; let d = 1e9; for (const m of moths) d = Math.min(d, Math.hypot(m.x - x, m.y - y)); if (d > 46) return [x, y]; if (d > bd) { bd = d; bx = x; by = y; } } return [bx, by]; };
    const mk = (s, cx, cy, r, born) => { const [x, y] = spot(cx, cy, r); return { x, y, s, born: born ? 0 : 1, tw: rnd(1.5, 6), twT: rnd(0, 3), flick: 0, mv: 0, mvT: rnd(1, 6), a: 0, nw: 0 }; };
    // first screen: a spread of shades, with a few obvious dark ones near the middle so the player gets it at once
    for (let i = 0; i < N; i++) moths.push(mk(i < 4 ? rnd(.1, .25) : rnd(.15, .98), i < 4 ? 480 : null, 330, 150, false));
    const say = (m, s) => { banner = m; sub = s || null; bannerT = 3.6; };
    const meanS = () => moths.length ? moths.reduce((a, m) => a + m.s, 0) / moths.length : .5;
    const hid = (m) => clamp(1 - Math.abs(m.s - barkV) / .45, 0, 1);
    const popHid = () => moths.length ? moths.reduce((a, m) => a + hid(m), 0) / moths.length : 0;
    const bins = () => { const b = new Array(10).fill(0); for (const m of moths) b[Math.min(9, Math.floor(m.s * 10))]++; return b; };

    function nextGen(early) {
      prevBins = bins(); prevMean = meanS();
      const before = moths.length;
      gen++; genT = 0;
      moths = moths.filter(() => Math.random() > .12);
      const parents = moths.slice();
      let babies = 0;
      while (moths.length < N) {
        const p = parents.length ? parents[rint(0, parents.length - 1)] : null;
        const b = mk(p ? clamp(p.s + gauss() * .07, 0, 1) : rnd(.15, .95), p ? p.x : null, p ? p.y : null, 70, true);
        moths.push(b); babies++; rings.push({ x: b.x, y: b.y, l: .6, m: .6 });
      }
      const d = meanS() - prevMean;
      toast = `GEN ${gen}: ${before - (before - parents.length) } survivors had ${babies} babies. Population got ${Math.abs(d) < .008 ? 'no different' : d > 0 ? 'lighter' : 'darker'}.`; toastT = 4;
      api.sound('tick'); flash = .25; flashC = '255,230,120';
    }
    return {
      pointer(x, y, type, e) {
        mx = x; my = y;
        if (type !== 'down') return;
        const touchy = e && e.pointerType === 'touch';
        let best1 = null, bd = touchy ? 36 : 26;
        for (const m of moths) { const d = Math.hypot(m.x - x, m.y - y + 2); if (d < bd) { bd = d; best1 = m; } }
        if (best1) {
          const m = best1, h = hid(m);
          moths.splice(moths.indexOf(m), 1); eaten++; combo++; comboT = 3; if (combo > best) best = combo;
          const mult = Math.min(6, 1 + Math.floor(combo / 3));
          const pts = (10 + Math.round(h * 30)) * mult;
          score += pts; hunger = Math.min(100, hunger + 10 + h * 8);
          firstDone = true;
          const sharp = h > .6;
          api.sound(sharp ? 'point' : 'pop'); if (combo > 0 && combo % 5 === 0) api.sound('coin'); if (combo === 10 || combo === 20) api.sound('fanfare');
          api.haptic(15); shake = Math.max(shake, sharp ? 6 : 3);
          for (let i = 0; i < 14; i++) parts.push({ x: m.x, y: m.y, vx: rnd(-200, 200), vy: rnd(-260, 40), l: .7, c: gray(m.s, rnd(-.1, .1)), z: rint(4, 8) });
          rings.push({ x: m.x, y: m.y, l: .35, m: .35 });
          texts.push({ x: m.x, y: m.y - 14, s: `+${pts}`, l: 1, c: sharp ? '#ffd400' : '#fff', z: sharp ? 28 : 22 });
          if (sharp) texts.push({ x: m.x, y: m.y - 42, s: 'SHARP EYE', l: 1, c: '#ffd400', z: 16 });
          if (combo >= 3 && combo % 3 === 0) texts.push({ x: 480, y: 130 + 0, s: `${combo} IN A ROW`, l: 1, c: '#fff', z: 30 });
        } else {
          hunger -= 6; combo = 0; shake = 6; api.sound('bonk'); missed++;
          texts.push({ x, y: y - 8, s: 'MISS', l: .7, c: '#ff5a5a', z: 20 });
          let near = null, nd = 80; for (const m of moths) { const d = Math.hypot(m.x - x, m.y - y); if (d < nd) { nd = d; near = m; } }
          if (near) rings.push({ x: near.x, y: near.y, l: .7, m: .7, hint: true });
        }
      },
      update(dt) {
        t += dt; genT += dt; bannerT -= dt; toastT -= dt; shake *= Math.pow(.02, dt); flash = Math.max(0, flash - dt);
        if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
        if (!firstDone) hintT += dt;
        const calm = t < 5 ? .3 : 1; // gentle start
        hunger -= (3 + Math.min(2.5, t / 40)) * dt * calm;
        if (hunger < 25) { lowT -= dt; if (lowT <= 0) { api.sound('tick'); lowT = .7; } }
        if (hunger <= 0) { api.sound('bonk'); return api.end(score, `${eaten} moths eaten over ${gen} generations. The bird starved.`); }
        if (t >= T_END) {
          const bonus = Math.round(hunger * 5); api.sound('fanfare');
          const gap = Math.abs(meanS() - barkV);
          return api.end(score + bonus, `Season over. ${eaten} moths eaten, best chain ${best}. The moths ended ${gap < .15 ? 'matching the bark' : 'still off from the bark'}.`);
        }
        if (genT >= GEN) nextGen(); else if (moths.length < 9) nextGen(true);
        if (ev === 0 && t > T_FACTORY) { ev = 1; barkTarget = .16; say('THE FACTORY OPENS', 'The bark goes dark. The pale moths now stick out.'); api.sound('reveal'); shake = 10; }
        if (ev === 1 && t > T_CLEAN) { ev = 2; barkTarget = .86; say('CLEAN AIR ACT', 'The trees recover. Now the dark moths stick out.'); api.sound('reveal'); shake = 8; }
        barkV += clamp(barkTarget - barkV, -.04 * dt, .04 * dt);
        for (const m of moths) {
          m.twT += dt; if (m.twT > m.tw) { m.twT = 0; m.tw = rnd(2, 6); m.flick = .3; }
          if (m.flick > 0) m.flick -= dt;
          if (m.born < 1) m.born = Math.min(1, m.born + dt * 3);
          m.mvT -= dt; if (m.mvT <= 0 && m.mv <= 0) { m.mv = rnd(.3, .6); m.a = rnd(0, 6.28); m.mvT = rnd(3, 9); }
          if (m.mv > 0) { m.mv -= dt; const nx = m.x + Math.cos(m.a) * 55 * dt, ny = m.y + Math.sin(m.a) * 55 * dt; if (free(nx, ny) && nx > 30 && nx < 930 && ny > 36 && ny < 570) { m.x = nx; m.y = ny; } }
        }
        for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; p.l -= dt; }
        parts = parts.filter(p => p.l > 0);
        for (const x of texts) { x.y -= 45 * dt; x.l -= dt; } texts = texts.filter(x => x.l > 0);
        for (const r of rings) r.l -= dt; rings = rings.filter(r => r.l > 0);
      },
      draw(g) {
        g.save(); if (shake > .5) g.translate(rnd(-shake, shake), rnd(-shake, shake));
        bark(g, barkV);
        let intro = null, id = 1e9;
        for (const m of moths) {
          const k = m.born < 1 ? m.born : 1;
          moth(g, m.x, m.y, m.s, 1.1 * k, m.flick > 0 || m.mv > 0 ? 1 : 0, 0);
          if (!firstDone && m.s < .3) { const d = Math.hypot(m.x - 480, m.y - 330); if (d < id) { id = d; intro = m; } }
        }
        for (const r of rings) {
          const q = r.l / r.m, sz = (r.hint ? 20 + (1 - q) * 14 : 10 + (1 - q) * 36);
          g.strokeStyle = r.hint ? `rgba(255,212,0,${q})` : `rgba(255,255,255,${q})`; g.lineWidth = 3; g.strokeRect(Math.round(r.x - sz), Math.round(r.y - sz), sz * 2, sz * 2);
        }
        if (intro && t > 1) { const q = (Math.sin(t * 6) + 1) / 2; g.strokeStyle = `rgba(255,212,0,${.4 + q * .6})`; g.lineWidth = 3; const sz = 26 + q * 6; g.strokeRect(Math.round(intro.x - sz), Math.round(intro.y - sz), sz * 2, sz * 2); }
        for (const p of parts) { g.fillStyle = p.c; g.fillRect(Math.round(p.x), Math.round(p.y), p.z, p.z); }
        for (const x of texts) text(g, x.s, x.x, x.y, x.z, x.c, 'center', '#000');
        // beak cursor
        g.fillStyle = '#000'; g.fillRect(mx - 14, my - 3, 28, 6); g.fillRect(mx - 3, my - 14, 6, 28);
        g.fillStyle = '#ffd400'; g.fillRect(mx - 12, my - 1, 24, 2); g.fillRect(mx - 1, my - 12, 2, 24);
        g.restore();
        if (flash > 0) { g.fillStyle = `rgba(${flashC},${flash * .5})`; g.fillRect(0, 0, 960, 600); }
        if (hunger < 25) { const a = (.25 + .25 * Math.sin(t * 8)); g.fillStyle = `rgba(192,0,26,${a})`; g.fillRect(0, 0, 960, 8); g.fillRect(0, 592, 960, 8); g.fillRect(0, 0, 8, 600); g.fillRect(952, 0, 8, 600); }
        // HUD
        g.fillStyle = '#c0c0c0'; g.fillRect(14, 14, 290, 112); g.fillStyle = '#000'; g.fillRect(14, 14, 290, 3);
        text(g, 'HUNGER', 24, 34, 15); seg(g, 100, 24, 192, 20, hunger / 100, hunger < 30 ? '#c0001a' : '#7a0f1f');
        text(g, `SCORE ${score}`, 24, 64, 20); text(g, `GEN ${gen}`, 214, 64, 20);
        text(g, 'SEASON', 24, 94, 13); seg(g, 100, 84, 192, 16, t / T_END, '#555');
        const fx = 100 + 192 * T_FACTORY / T_END, cx = 100 + 192 * T_CLEAN / T_END;
        g.fillStyle = '#000'; g.fillRect(fx, 100, 2, 6); g.fillRect(cx, 100, 2, 6);
        text(g, 'FACTORY', fx, 114, 9, '#000', 'center'); text(g, 'CLEAN', cx, 114, 9, '#000', 'center');
        if (combo >= 2) {
          const mult = Math.min(6, 1 + Math.floor(combo / 3)), pul = 1 + Math.max(0, comboT - 2.6) * .4;
          text(g, `${combo} CHAIN  x${mult}`, 24, 150, Math.round(24 * pul), '#ffd400', 'left', '#000');
          g.fillStyle = '#000'; g.fillRect(24, 166, 130, 8); g.fillStyle = '#ffd400'; g.fillRect(25, 167, 128 * comboT / 3, 6);
        }
        // histogram panel
        const px = 700, py = 14, pw = 246, ph = 178;
        g.fillStyle = '#c0c0c0'; g.fillRect(px, py, pw, ph); g.fillStyle = '#7a0f1f'; g.fillRect(px + 3, py + 3, pw - 6, 22);
        text(g, 'MOTH SHADES', px + 10, py + 14, 13, '#fff'); text(g, `HIDDEN ${Math.round(popHid() * 100)}%`, px + pw - 8, py + 14, 13, '#fff', 'right');
        g.fillStyle = '#fff'; g.fillRect(px + 8, py + 32, pw - 16, ph - 66);
        const b = bins(), bw = (pw - 24) / 10;
        b.forEach((c, i) => { const h = Math.min(1, c / 20) * (ph - 78); g.fillStyle = gray((i + .5) / 10); g.fillRect(px + 12 + i * bw, py + ph - 34 - h, bw - 2, h); g.strokeStyle = '#000'; g.lineWidth = 1; g.strokeRect(px + 12 + i * bw, py + ph - 34 - h, bw - 2, h); });
        if (prevBins) { g.strokeStyle = '#c0001a'; g.lineWidth = 2; g.beginPath(); prevBins.forEach((c, i) => { const h = Math.min(1, c / 20) * (ph - 78), X = px + 12 + i * bw; if (i === 0) g.moveTo(X, py + ph - 34 - h); else g.lineTo(X, py + ph - 34 - h); g.lineTo(X + bw - 2, py + ph - 34 - h); }); g.stroke(); }
        g.fillStyle = '#c0001a'; g.fillRect(px + 12 + barkV * (pw - 24) - 2, py + 34, 4, ph - 70);
        text(g, 'DARK', px + 16, py + ph - 14, 11); text(g, 'LIGHT', px + pw - 16, py + ph - 14, 11, '#000', 'right'); text(g, 'bark', px + 14 + barkV * (pw - 24), py + 38, 11, '#c0001a', 'center');
        if (prevBins) text(g, 'red = last gen', px + pw / 2, py + ph - 14, 9, '#c0001a', 'center');
        // hint and messages
        if (!firstDone && t > 1) text(g, 'CLICK THE MOTHS', 480, 560, 34, '#fff', 'center', '#000');
        else if (t < 12) text(g, 'FAINT MOTHS ARE WORTH MORE', 480, 560, 24, '#fff', 'center', '#000');
        if (bannerT > 0) { const a = Math.min(1, bannerT); g.fillStyle = `rgba(0,0,0,${.55 * a})`; g.fillRect(0, 262, 960, sub ? 100 : 70); text(g, banner, 480, 292, 40, '#fff', 'center', '#000'); if (sub) text(g, sub, 480, 338, 20, '#ffd400', 'center', '#000'); }
        else if (toastT > 0) { g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(0, 548, 960, 36); text(g, toast, 480, 566, 18, '#fff', 'center'); }
      },
    };
  },
};

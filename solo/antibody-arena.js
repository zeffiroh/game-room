// ANTIBODY ARENA: viruses close in on a cell. Pick an antibody (1-4) and click to fire it.
// An antibody only destroys the antigen it fits. The more you use one, the bigger that clone gets:
// faster fire, then memory cells that pierce, then a double shot. Later waves mutate, hide and shift.
import { block, clamp, text, rnd, rint, seg } from '../engine/canvas.js';

const CX = 480, CY = 290, TYPES = [
  { name: 'RED', c: '#c0001a', ink: '#fff' }, { name: 'YELLOW', c: '#ffd400', ink: '#000' },
  { name: 'PURPLE', c: '#7a2d86', ink: '#fff' }, { name: 'BLACK', c: '#2a2a2a', ink: '#fff' },
];
const BASE_CD = .8, NEED = 3;
const cdOf = (l) => BASE_CD * Math.pow(.68, l);

function virusArt(g, x, y, type, wig = 0, scale = 1, label = true) {
  const T = TYPES[type];
  g.save(); g.translate(x, y + wig); g.scale(scale, scale);
  g.fillStyle = '#000';
  // spikes (the antigens): each type has its own silhouette
  const sp = [[-4, -34, 8, 10], [-4, 24, 8, 10], [-34, -4, 10, 8], [24, -4, 10, 8]];
  const wide = [[-24, -26, 8, 10], [16, -26, 8, 10], [-24, 18, 8, 10], [16, 18, 8, 10]];
  const tall = [[-26, -34, 10, 8], [16, -34, 10, 8], [-26, 26, 10, 8], [16, 26, 10, 8]];
  const L = [[-34, -4, 10, 8], [-4, -34, 8, 10], [24, 14, 10, 8], [14, 24, 8, 10]];
  for (const r of [sp, wide, tall, L][type]) g.fillRect(r[0], r[1], r[2], r[3]);
  const [w, h] = [[44, 44], [56, 36], [36, 56], [44, 44]][type];
  block(g, -w / 2, -h / 2, w, h, T.c);
  if (label) text(g, String(type + 1), 0, 2, 24, T.ink, 'center');
  g.restore();
}
function cell(g, hp, t, hurt) {
  const w = 132, s = hurt > 0 ? rnd(-4, 4) : 0;
  block(g, CX - w / 2 + s, CY - w / 2, w, w, hp > 35 ? '#f4d9b0' : '#e8a090');
  g.fillStyle = '#5a1020'; for (let i = 0; i < 12; i++) { const k = i * 11; g.fillRect(CX - w / 2 + k + s, CY - w / 2 - 5, 8, 6); g.fillRect(CX - w / 2 + k + s, CY + w / 2 - 1, 8, 6); g.fillRect(CX - w / 2 - 5 + s, CY - w / 2 + k, 6, 8); g.fillRect(CX + w / 2 - 1 + s, CY - w / 2 + k, 6, 8); }
  block(g, CX - 14 + s, CY - 30, 32, 32, '#7a2d86'); block(g, CX - 4 + s, CY - 20, 12, 12, '#3a0f45');
  g.fillStyle = '#000'; g.fillRect(CX - 36 + s, CY + 12, 8, 14); g.fillRect(CX + 28 + s, CY + 12, 8, 14);
  g.fillRect(CX - 14 + s, CY + (hp > 35 ? 36 : 42), 28, 5);
  block(g, CX - 48 + s, CY - 40, 22, 11, '#ff8c00'); block(g, CX + 26 + s, CY + 30, 22, 11, '#ff8c00');
}

export default {
  id: 'antibody-arena', title: 'Antibody Arena',
  blurb: 'Viruses are coming for the cell. Match the antibody to the antigen, and let your best clones grow.',
  how: ['Keys 1-4 (or the bottom tiles) pick an antibody. Click, tap or hold to fire at the cursor.', 'An antibody only kills the virus with the same number and color. Wrong ones bounce off and break your combo.', 'Every 3 kills a clone levels up: faster fire, memory cells that pierce, then a double shot. Clones you never use stay slow.', 'Fat viruses carry two antigens. Ghosts hide their number until close. Some mutate. Grab V pickups (a vaccine) to pre-level a clone. Big variant every 5th wave.'],
  touch: [{ k: '1', label: '1' }, { k: '2', label: '2' }, { k: '3', label: '3' }, { k: '4', label: '4' }],
  learn: 'The adaptive immune response. Antibodies are specific: each one fits one antigen. When a matching B cell finds its antigen it multiplies (clonal selection), and memory cells make the second response faster and stronger than the first (primary vs secondary response). That is why vaccines work. Antigenic drift is why flu shots change every year.',
  thumb(g, W, H, t) {
    g.fillStyle = '#9b9b9b'; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(0,0,0,.1)'; for (let x = 0; x < W; x += 60) g.fillRect(x, 0, 1, H); for (let y = 0; y < H; y += 60) g.fillRect(0, y, W, 1);
    cell(g, 100, t, 0);
    for (let i = 0; i < 4; i++) { const a = t * .5 + i * 1.57, r = 230 + Math.sin(t * 2 + i) * 20; virusArt(g, CX + Math.cos(a) * r * 1.5, CY + Math.sin(a) * r * .9, i, Math.sin(t * 5 + i) * 3, 1.3); }
    text(g, 'MATCH THE ANTIGEN', W / 2, 540, 44, '#fff', 'center', '#000');
  },
  create(api) {
    let t = 0, hp = 100, score = 0, combo = 0, best = 0, wave = 0, toSpawn = 0, spawnT = 0, gapT = 1.2, sel = 0, aimX = 700, aimY = 200, firing = false, hurt = 0, msg = '', msgT = 0, shake = 0, boss = false, bossSpawned = false, comboT = 0, flashT = 0, tip = 0;
    const lvl = [0, 0, 0, 0], kills = [0, 0, 0, 0], cd = [0, 0, 0, 0];
    let vs = [], ps = [], parts = [], texts = [], pick = [];
    const say = (m, d = 1.6) => { msg = m; msgT = d; };
    const mult = () => Math.min(5, 1 + Math.floor(combo / 5));
    const burst = (x, y, c, n = 12, sp = 220) => { for (let i = 0; i < n; i++) parts.push({ x, y, vx: rnd(-sp, sp), vy: rnd(-sp, sp), l: rnd(.3, .6), c }); };
    const maybeLevel = (ty) => { if (lvl[ty] < 4 && kills[ty] >= NEED * (lvl[ty] + 1)) levelUp(ty); };
    function startWave() {
      wave++; boss = wave % 5 === 0; bossSpawned = false; toSpawn = boss ? 6 : 6 + wave * 3; spawnT = 0;
      say(boss ? `WAVE ${wave}: BIG VARIANT` : `WAVE ${wave}`, 2);
      if (wave === 2) setTimeout(() => say('FAT ONES NEED BOTH ANTIGENS', 2.5), 2300);
      if (wave === 3) setTimeout(() => say('ANTIGENIC DRIFT: THEY MUTATE', 2.5), 2300);
    }
    function spawn() {
      if (boss && !bossSpawned) { bossSpawned = true; vs.push({ kind: 'boss', x: 480, y: -60, hpv: 8 + wave, mx: 8 + wave, type: rint(0, 3), swap: 3, sp: 14, flash: 0, ph: 0, drift: false }); say('ITS ANTIGEN KEEPS SHIFTING', 2.2); return; }
      const nTypes = wave === 1 ? 2 : wave === 2 ? 3 : 4;
      const edge = rint(0, 2); let x, y;
      if (edge === 0) { x = -30; y = rnd(0, 480); } else if (edge === 1) { x = 990; y = rnd(0, 480); } else { x = rnd(0, 960); y = -30; }
      const r = Math.random(); let kind = 'norm';
      if (wave >= 2 && r < .2) kind = 'big'; else if (wave >= 3 && r < .4) kind = 'fast'; else if (wave >= 4 && r < .55) kind = 'stealth';
      const type = rint(0, nTypes - 1);
      const v = { kind, x, y, type, t2: -1, sp: 34 + wave * 4 + rnd(0, 12), drift: wave >= 3 && kind === 'norm' && Math.random() < .3, flash: 0, ph: rnd(0, 6), seen: false, d: 999 };
      if (kind === 'big') { v.t2 = (type + rint(1, 3)) % 4; v.sp *= .7; }
      if (kind === 'fast') v.sp *= 2.1;
      vs.push(v);
    }
    function fire() {
      if (cd[sel] > 0 || aimY > 520) return;
      const dx = aimX - CX, dy = aimY - CY, a = Math.atan2(dy, dx);
      for (const o of lvl[sel] >= 3 ? [-.09, .09] : [0]) ps.push({ x: CX + Math.cos(a + o) * 70, y: CY + Math.sin(a + o) * 70, vx: Math.cos(a + o) * 780, vy: Math.sin(a + o) * 780, type: sel, pierce: lvl[sel] >= 2 ? 1 : 0 });
      cd[sel] = cdOf(lvl[sel]); api.sound('tick');
    }
    function levelUp(ty) {
      lvl[ty]++; const n = lvl[ty];
      say(`${TYPES[ty].name} CLONE LV ${n}${n === 2 ? ': MEMORY CELLS PIERCE' : n === 3 ? ': DOUBLE SHOT' : ''}`, 2); api.sound(n >= 2 ? 'fanfare' : 'correct'); flashT = .25;
    }
    function gain(v, sc) {
      combo++; comboT = 3; best = Math.max(best, combo); const m = mult(); score += sc * m; kills[v.type]++;
      api.sound('pop'); burst(v.x, v.y, TYPES[v.type].c); burst(v.x, v.y, '#fff', 4, 160);
      texts.push({ x: v.x, y: v.y - 20, s: '+' + sc * m, l: .8 }); shake = Math.max(shake, 3);
      if (combo % 5 === 0) { texts.push({ x: CX, y: CY - 100, s: `COMBO x${mult()}`, l: 1 }); api.sound('coin'); }
      maybeLevel(v.type);
    }
    function dropMaybe(v) { if (Math.random() < (v.kind === 'boss' ? 1 : .09)) pick.push({ x: v.x, y: v.y, ty: rint(0, 3), l: 9 }); }
    function wrong(p, v) {
      p.dead = true; combo = 0; api.sound('gentle'); texts.push({ x: p.x, y: p.y, s: 'NO FIT', l: .7 }); burst(p.x, p.y, '#fff', 5, 120);
      v.flash = Math.max(v.flash, .15);
    }
    function hit(v, p) {
      if (v.kind === 'boss') {
        if (v.type !== p.type) return wrong(p, v);
        v.hpv--; v.flash = .12; shake = 5; api.sound('pop'); burst(p.x, p.y, TYPES[p.type].c, 8); combo++; comboT = 3; score += 5 * mult(); kills[p.type]++; maybeLevel(p.type);
        if (v.hpv <= 0) { v.dead = true; score += 300; texts.push({ x: v.x, y: v.y, s: '+300', l: 1.2 }); burst(v.x, v.y, '#fff', 40, 400); burst(v.x, v.y, '#c0001a', 30, 300); shake = 16; api.sound('fanfare'); dropMaybe(v); }
        else { v.type = (v.type + rint(1, 3)) % 4; v.swap = 3; }
        p.dead = true;
        return;
      }
      if (v.kind === 'big') {
        if (p.type === v.type) { v.type = v.t2; v.t2 = -1; } else if (v.t2 >= 0 && p.type === v.t2) v.t2 = -1; else return wrong(p, v);
        v.flash = .15; burst(p.x, p.y, TYPES[p.type].c, 8); api.sound('pop'); score += 5 * mult(); kills[p.type]++; maybeLevel(p.type);
        if (v.type === -1) { v.dead = true; v.type = p.type; combo++; comboT = 3; best = Math.max(best, combo); const m = mult(); score += 25 * m; texts.push({ x: v.x, y: v.y - 20, s: '+' + 25 * m, l: .9 }); burst(v.x, v.y, '#fff', 14); dropMaybe(v); shake = 6; }
        if (p.pierce > 0) p.pierce--; else p.dead = true;
        return;
      }
      if (v.type !== p.type) return wrong(p, v);
      v.dead = true; gain(v, v.kind === 'fast' ? 20 : v.kind === 'stealth' ? 15 : 10); dropMaybe(v);
      if (p.pierce > 0) p.pierce--; else p.dead = true;
    }
    startWave();
    return {
      key(k, down) { if (down && k.length === 1 && '1234'.includes(k)) { sel = +k - 1; api.sound('tap'); } },
      pointer(x, y, type) {
        aimX = x; aimY = y;
        if (type === 'down') {
          if (y > 520) { sel = clamp(Math.floor((x - 140) / 170), 0, 3); api.sound('tap'); return; }
          firing = true; fire();
        }
        if (type === 'up') firing = false;
      },
      update(dt) {
        t += dt; hurt -= dt; msgT -= dt; shake *= .85; flashT -= dt; tip += dt;
        if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
        for (let i = 0; i < 4; i++) cd[i] = Math.max(0, cd[i] - dt);
        if (firing) fire();
        if (toSpawn > 0) { spawnT -= dt; if (spawnT <= 0) { spawn(); toSpawn--; spawnT = boss ? 2.2 : Math.max(.45, 1.7 - wave * .08) * rnd(.7, 1.3); } }
        else if (vs.length === 0) { gapT -= dt; if (gapT <= 0) { const b = 100 * wave; score += b; hp = Math.min(100, hp + 10); say(`WAVE ${wave} CLEAR +${b}`, 1.6); api.sound('coin'); gapT = 1.8; startWave(); } }
        for (const v of vs) {
          const dx = CX - v.x, dy = CY - v.y, d = Math.hypot(dx, dy) || 1;
          v.x += dx / d * v.sp * dt; v.y += dy / d * v.sp * dt; v.flash -= dt; v.d = d;
          if (v.kind === 'stealth' && !v.seen && d < 340) { v.seen = true; v.flash = .4; api.sound('reveal'); }
          if (v.drift && d < 300) { v.drift = false; v.type = (v.type + rint(1, 3)) % 4; v.flash = .5; api.sound('reveal'); }
          if (v.kind === 'boss') { v.swap -= dt; if (v.swap <= 0) { v.type = (v.type + rint(1, 3)) % 4; v.swap = 3; v.flash = .3; api.sound('reveal'); } }
          if (d < (v.kind === 'boss' ? 110 : 80)) { v.dead = true; hp -= v.kind === 'boss' ? 40 : v.kind === 'big' ? 15 : 10; combo = 0; hurt = .35; shake = 10; api.sound('bonk'); api.haptic(60); burst(v.x, v.y, '#c0001a', 14); }
        }
        vs = vs.filter(v => !v.dead);
        for (const p of ps) {
          p.x += p.vx * dt; p.y += p.vy * dt;
          for (const q of pick) if (!p.dead && !q.dead && Math.hypot(q.x - p.x, q.y - p.y) < 30) { q.dead = true; if (lvl[q.ty] < 4) { kills[q.ty] = NEED * (lvl[q.ty] + 1); levelUp(q.ty); } else score += 50; texts.push({ x: q.x, y: q.y, s: 'VACCINE', l: 1 }); }
          for (const v of vs) {
            if (v.dead || p.dead) continue;
            if (Math.hypot(v.x - p.x, v.y - p.y) < (v.kind === 'boss' ? 62 : v.kind === 'big' ? 38 : v.kind === 'fast' ? 26 : 32)) hit(v, p);
          }
          if (p.x < -40 || p.x > 1000 || p.y < -40 || p.y > 640) p.dead = true;
        }
        vs = vs.filter(v => !v.dead); ps = ps.filter(p => !p.dead); pick = pick.filter(q => !q.dead && (q.l -= dt) > 0);
        for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.l -= dt; } parts = parts.filter(p => p.l > 0);
        for (const x of texts) { x.y -= 40 * dt; x.l -= dt; } texts = texts.filter(x => x.l > 0);
        if (hp <= 0) api.end(score, `Wave ${wave}. Best combo ${best}. The cell was overrun.`);
      },
      draw(g) {
        g.save(); if (shake > .5) g.translate(rnd(-shake, shake), rnd(-shake, shake));
        g.fillStyle = '#9b9b9b'; g.fillRect(0, 0, 960, 600); g.fillStyle = 'rgba(0,0,0,.1)'; for (let x = 0; x < 960; x += 60) g.fillRect(x, 0, 1, 600); for (let y = 0; y < 600; y += 60) g.fillRect(0, y, 960, 1);
        const adx = aimX - CX, ady = aimY - CY, ad = Math.hypot(adx, ady) || 1;
        g.fillStyle = TYPES[sel].c; for (let k = 90; k < Math.min(ad, 420); k += 28) g.fillRect(CX + adx / ad * k - 2, CY + ady / ad * k - 2, 4, 4);
        cell(g, hp, t, hurt);
        for (const q of pick) { if (q.l < 3 && Math.floor(t * 8) % 2) continue; block(g, q.x - 16, q.y - 16, 32, 32, TYPES[q.ty].c); text(g, 'V', q.x, q.y + 1, 20, TYPES[q.ty].ink, 'center'); }
        for (const v of vs) {
          const wg = Math.sin(t * 6 + v.ph) * 2;
          if (v.kind === 'boss') {
            virusArt(g, v.x, v.y, v.type, wg, 2.6, false);
            text(g, String(v.type + 1), v.x, v.y + 2, 64, TYPES[v.type].ink, 'center');
            seg(g, v.x - 100, v.y - 100, 200, 16, v.hpv / v.mx, '#7a0f1f');
            g.fillStyle = '#000'; g.fillRect(v.x - 100, v.y + 100, 200, 8); g.fillStyle = '#ffe97a'; g.fillRect(v.x - 98, v.y + 102, 196 * clamp(v.swap / 3, 0, 1), 4);
          } else if (v.kind === 'big') {
            virusArt(g, v.x, v.y, v.type, wg, 1.5, false);
            if (v.t2 >= 0) { g.fillStyle = '#000'; g.fillRect(v.x - 2, v.y - 40, 4, 80); block(g, v.x + 2, v.y - 36, 32, 72, TYPES[v.t2].c); text(g, String(v.t2 + 1), v.x + 18, v.y, 24, TYPES[v.t2].ink, 'center'); text(g, String(v.type + 1), v.x - 24, v.y, 24, TYPES[v.type].ink, 'center'); }
            else text(g, String(v.type + 1), v.x, v.y, 28, TYPES[v.type].ink, 'center');
          } else if (v.kind === 'stealth' && !v.seen) {
            g.globalAlpha = .55; virusArt(g, v.x, v.y, 3, wg, 1, false); g.globalAlpha = 1; text(g, '?', v.x, v.y + 1, 26, '#fff', 'center');
          } else if (v.kind === 'fast') {
            virusArt(g, v.x, v.y, v.type, wg, .8); g.fillStyle = '#000'; const ux = (CX - v.x) / (v.d || 1), uy = (CY - v.y) / (v.d || 1); for (let k = 1; k < 4; k++) g.fillRect(v.x - ux * (24 + k * 12) - 3, v.y - uy * (24 + k * 12) - 3, 6, 6);
          } else virusArt(g, v.x, v.y, v.type, wg);
          if (v.flash > 0) { g.strokeStyle = '#fff'; g.lineWidth = 4; const r = v.kind === 'boss' ? 80 : 36; g.strokeRect(v.x - r, v.y - r, r * 2, r * 2); }
          if (v.drift) text(g, '?', v.x + 30, v.y - 30, 18, '#c0001a', 'center', '#fff');
        }
        for (const p of ps) { const T = TYPES[p.type]; g.fillStyle = '#000'; g.fillRect(p.x - 7, p.y - 7, 14, 14); g.fillStyle = T.c; g.fillRect(p.x - 5, p.y - 5, 10, 10); if (p.pierce) { g.fillStyle = '#fff'; g.fillRect(p.x - 2, p.y - 2, 4, 4); } }
        for (const p of parts) { g.fillStyle = p.c; g.fillRect(p.x, p.y, 6, 6); }
        for (const x of texts) text(g, x.s, x.x, x.y, 18, '#fff', 'center', '#000');
        g.fillStyle = '#000'; g.fillRect(aimX - 16, aimY - 2, 32, 4); g.fillRect(aimX - 2, aimY - 16, 4, 32); g.fillStyle = TYPES[sel].c; g.fillRect(aimX - 14, aimY - 1, 28, 2); g.fillRect(aimX - 1, aimY - 14, 2, 28);
        g.restore();
        if (flashT > 0) { g.fillStyle = `rgba(255,255,255,${flashT})`; g.fillRect(0, 0, 960, 600); }
        if (hurt > 0) { g.fillStyle = `rgba(192,0,26,${hurt * .5})`; g.fillRect(0, 0, 960, 600); }
        g.fillStyle = '#c0c0c0'; g.fillRect(14, 14, 330, 56); text(g, 'CELL', 24, 34, 15); seg(g, 80, 24, 250, 20, hp / 100, hp < 35 ? '#c0001a' : '#7a0f1f');
        text(g, `WAVE ${wave}   SCORE ${score}`, 24, 56, 15);
        if (combo > 1) { text(g, `COMBO ${combo}  x${mult()}`, 946, 30, 22, '#fff', 'right', '#000'); g.fillStyle = '#000'; g.fillRect(746, 46, 200, 8); g.fillStyle = '#ffe97a'; g.fillRect(748, 48, 196 * clamp(comboT / 3, 0, 1), 4); }
        for (let i = 0; i < 4; i++) {
          const x = 140 + i * 170, y = 530, T = TYPES[i], on = sel === i, L = lvl[i];
          g.fillStyle = '#000'; g.fillRect(x - 2, y - 2, 164, 64); g.fillStyle = on ? '#ffe97a' : '#c0c0c0'; g.fillRect(x, y, 160, 60);
          block(g, x + 8, y + 8, 38, 44, T.c); text(g, String(i + 1), x + 27, y + 31, 22, T.ink, 'center');
          text(g, L === 0 ? 'PRIMARY' : L === 1 ? 'LV 1' : L >= 4 ? 'LV MAX' : 'LV ' + L + ' MEMORY', x + 54, y + 18, 13);
          const k = L >= 4 ? 1 : (kills[i] - NEED * L) / NEED; g.fillStyle = '#000'; g.fillRect(x + 54, y + 34, 96, 12); g.fillStyle = '#fff'; g.fillRect(x + 56, y + 36, 92, 8); g.fillStyle = T.c; g.fillRect(x + 56, y + 36, 92 * clamp(k, 0, 1), 8);
          if (cd[i] > 0) { g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x, y, 160 * (cd[i] / cdOf(L)), 60); }
        }
        if (msgT > 0) text(g, msg, 480, 150, 34, '#fff', 'center', '#000');
        if (wave === 1 && tip < 7 && kills[0] + kills[1] === 0) text(g, 'SHOOT THE MATCHING NUMBER', 480, 480, 22, '#fff', 'center', '#000');
      },
    };
  },
};

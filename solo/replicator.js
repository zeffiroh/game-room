// REPLICATOR: you are DNA polymerase. Template bases stream in past the helicase; type the complement (A-T, C-G).
// The leading strand flows smoothly. The lagging strand comes in short Okazaki fragments: primase drops an RNA
// primer, you build BACKWARDS (right to left), then ligase glues the gap. UV lesions need SPACE (repair).
// Five mutations and the cell goes cancerous. SPACE also proofreads the last mistake.
import { block, clamp, text, rnd, rint, seg } from '../engine/canvas.js';

const COMP = { a: 't', t: 'a', c: 'g', g: 'c' };
const COL = { a: ['#c0001a', '#fff'], t: ['#ffd400', '#000'], c: ['#7a2d86', '#fff'], g: ['#222', '#fff'] };
const HIT = 230, TY = 170, NY = 300, SZ = 58, GAP = 86, CHUNKS = 7, LEAD_N = 9, LAG_N = 5, HELI = 520, MID = 264, PULL = 26;
const rb = () => 'atcg'[rint(0, 3)];
const lerp = (a, b, k) => a + (b - a) * k;

function baseArt(g, x, y, l, ghost) {
  if (ghost) { block(g, x - SZ / 2 + 4, y + 4, SZ - 8, SZ - 8, '#a89c8a', '#6a5a4a'); text(g, l.toUpperCase(), x, y + SZ / 2 + 1, 22, '#6a5a4a', 'center'); return; }
  const [bg, fg] = COL[l];
  block(g, x - SZ / 2, y, SZ, SZ, bg); text(g, l.toUpperCase(), x, y + SZ / 2 + 1, 30, fg, 'center');
}
function lesionArt(g, x, y, t) {
  block(g, x - SZ / 2, y, SZ, SZ, '#555'); g.fillStyle = '#ffd400';
  const j = Math.sin(t * 20) > 0 ? 3 : -3;
  g.fillRect(x - 20, y + 10 + j, 8, 8); g.fillRect(x - 8, y + 24 - j, 8, 8); g.fillRect(x + 4, y + 10 + j, 8, 8); g.fillRect(x + 14, y + 32 - j, 8, 8);
  text(g, 'UV', x, y + SZ + 14, 16, '#7a0f1f', 'center');
}

export default {
  id: 'replicator', title: 'Replicator',
  blurb: 'You are DNA polymerase. Copy the strand before the cell falls apart.',
  how: ['Template bases arrive from the helicase on the right. When one reaches the polymerase, press its complement: A pairs with T, C with G. Dead center is PERFECT.', 'The LAGGING strand comes in short Okazaki fragments. Primase drops a primer, then you type RIGHT TO LEFT, fast. Ligase glues the gap.', 'A grey UV lesion needs SPACE (repair). SPACE also proofreads your last mistake (ready every 7 seconds).', 'Five mutations and the cell goes cancerous. Finish all seven chunks for a grade.'],
  touch: [{ k: 'a', label: 'A' }, { k: 't', label: 'T' }, { k: 'c', label: 'C' }, { k: 'g', label: 'G' }, { k: 'space', label: 'FIX' }],
  learn: 'DNA replication. Helicase unzips the double helix, primase lays down an RNA primer, and DNA polymerase adds complementary bases (A with T, C with G), but only in the 5\' to 3\' direction. That is why one strand (leading) is copied in one smooth pass while the other (lagging) is built backwards in short Okazaki fragments that ligase stitches together. Polymerase proofreads, and repair enzymes cut out damage like UV thymine dimers; whatever slips through is a mutation.',
  thumb(g, W, H, t) {
    g.fillStyle = '#c8b6a0'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, TY + 20, W, 22); g.fillRect(0, NY + 20, W, 22);
    const off = (t * 90) % GAP;
    for (let i = 0; i < 12; i++) { const x = 100 + i * GAP - off, l = 'atcgtacgatca'[i]; baseArt(g, x, TY, l); if (x < HIT + 60) baseArt(g, x, NY, COMP[l]); }
    g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(HIT - 50, 120, 100, 300); g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeRect(HIT - 50, 120, 100, 300);
    block(g, 820, MID - 35, 68, 70, '#c0001a');
    text(g, 'COPY THE STRAND', W / 2, 520, 44, '#fff', 'center', '#000');
  },
  create(api) {
    let t = 0, score = 0, combo = 0, mut = 0, copied = 0, perfects = 0, chunk = 0, mode = 'lead', fixT = 0, modeT = 0, lagTimer = 0, lagMax = 7.5, lagIdx = 0, msg = null, msgT = 0, flash = 0, shake = 0, chomp = 0, lastLagT = 0, ligX = 0, primX = 0;
    let strand = [], parts = [], lastBad = null, heliT = 0;
    const total = CHUNKS * (LEAD_N + LAG_N);
    const say = (m, d = 1.6) => { msg = m; msgT = d; };
    function spawnLead() {
      mode = 'lead';
      const les = chunk >= 1 ? rint(3, 6) : -1;
      for (let i = 0; i < LEAD_N; i++) strand.push({ l: i === les ? 't' : rb(), x: (chunk === 0 ? 600 : 740) + i * GAP, st: null, type: 'lead', lesion: i === les });
    }
    function spawnLag() {
      mode = 'prime'; modeT = 1.0; lagMax = Math.max(5, 7.5 - chunk * .4); lagIdx = LAG_N - 1; lastLagT = 0;
      say('LAGGING STRAND: PRIMER, THEN TYPE RIGHT TO LEFT', 2.4);
      for (let i = 0; i < LAG_N; i++) strand.push({ l: rb(), x: 480 - (LAG_N - 1) * GAP / 2 + i * GAP, st: null, type: 'lag', fixed: true });
      primX = 480 - (LAG_N - 1) * GAP / 2 + LAG_N * GAP;
    }
    spawnLead();
    say('TEMPLATE COMES IN FROM THE RIGHT. TYPE THE MATCH: A-T, C-G', 4);
    const speed = () => 96 + chunk * 28;
    const lagBases = () => strand.filter(b => b.type === 'lag' && b.fixed);
    function mistake(b, kind) {
      b.st = kind; mut++; combo = 0; lastBad = b; shake = 6; chomp = 0; api.sound('bonk'); api.haptic(40);
      say(kind === 'miss' ? (b.lesion ? 'UNREPAIRED DAMAGE' : 'MISSED ONE') : 'MISMATCH');
      if (mut >= 5) api.end(score, 'Grade F. The cell went cancerous');
    }
    function good(b, perfect, y) {
      b.st = 'ok'; b.got = COMP[b.l]; copied++; combo++; chomp = 1; if (perfect) perfects++;
      const mult = Math.min(5, 1 + Math.floor(combo / 8)); score += (perfect ? 100 : 50) * mult;
      api.sound(perfect ? 'coin' : 'tick');
      for (let i = 0; i < 7; i++) parts.push({ x: b.x, y: y || NY + 20, vx: rnd(-90, 90), vy: rnd(-170, -20), l: .5, c: COL[b.got][0] });
      if (perfect) say(combo > 0 && combo % 8 === 0 ? 'COMBO x' + Math.min(5, 1 + Math.floor(combo / 8)) : 'PERFECT', .8);
      else say('GOOD', .5);
    }
    function grade() {
      const acc = copied / total;
      const gr = acc >= .97 && mut <= 1 ? 'S' : acc >= .92 ? 'A' : acc >= .85 ? 'B' : acc >= .7 ? 'C' : 'D';
      return { acc, gr };
    }
    return {
      key(k, down) {
        if (!down) return;
        if (k === 'space') {
          const les = strand.find(b => b.lesion && b.st === null && b.type === 'lead' && b.x < HIT + 100 && b.x > HIT - 70);
          if (les) {
            les.st = 'fixed'; les.got = 'a'; copied++; perfects++; score += 250; chomp = 1; flash = .3; api.sound('point'); say('EXCISION REPAIR', 1);
            for (let i = 0; i < 12; i++) parts.push({ x: les.x, y: TY + 30, vx: rnd(-140, 140), vy: rnd(-200, 0), l: .6, c: '#ffd400' });
            return;
          }
          if (fixT <= 0 && lastBad && lastBad.st !== 'ok') { lastBad.st = 'fixed'; lastBad.got = lastBad.lesion ? 'a' : COMP[lastBad.l]; mut = Math.max(0, mut - 1); fixT = 7; lastBad = null; flash = .3; api.sound('correct'); say('PROOFREAD'); }
          else api.sound('tap');
          return;
        }
        if (!'atcg'.includes(k) || k.length !== 1) return;
        if (mode === 'lead') {
          const tg = strand.find(b => b.type === 'lead' && b.st === null && b.x > HIT - 70);
          if (!tg || tg.x - HIT > 110) { api.sound('tap'); return; }
          if (!tg.lesion && k === COMP[tg.l]) good(tg, Math.abs(tg.x - HIT) < 26, NY + 20); else { tg.got = k; mistake(tg, 'bad'); }
        } else if (mode === 'lag' && lagIdx >= 0) {
          const tg = lagBases()[lagIdx];
          if (k === COMP[tg.l]) good(tg, t - lastLagT < .85); else { tg.got = k; mistake(tg, 'bad'); }
          lastLagT = t; lagIdx--;
          if (lagIdx < 0 && mode === 'lag') { api.sound('correct'); say('LIGASE SEALS THE GAP'); modeT = 1; mode = 'seal'; ligX = primX + 50; }
        }
      },
      update(dt) {
        t += dt; fixT -= dt; msgT -= dt; flash -= dt; shake *= .85; chomp = Math.max(0, chomp - dt * 5); heliT += dt;
        const sp = speed();
        for (const b of strand) if (!b.fixed) b.x -= sp * dt;
        for (const p of parts) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 500 * dt; p.l -= dt; } parts = parts.filter(p => p.l > 0);
        strand = strand.filter(b => b.x > -80);
        if (mode === 'lead') {
          for (const b of strand) if (b.type === 'lead' && b.st === null && b.x < HIT - 62) mistake(b, 'miss');
          if (mode !== 'lead') return;
          const pending = strand.some(b => b.type === 'lead' && b.st === null);
          if (!pending && !strand.some(b => b.type === 'lead' && b.x > 900)) spawnLag();
        } else if (mode === 'prime') {
          modeT -= dt; if (modeT < .5 && modeT + dt >= .5) { api.sound('reveal'); }
          if (modeT <= 0) { mode = 'lag'; lagTimer = lagMax; lastLagT = t; api.sound('pop'); }
        } else if (mode === 'lag') {
          lagTimer -= dt;
          if (lagTimer <= 0) { const bs = lagBases(); for (let i = lagIdx; i >= 0; i--) { if (mode === 'over') break; mistake(bs[i], 'miss'); } lagIdx = -1; mode = 'seal'; modeT = 1; ligX = primX + 50; }
        } else if (mode === 'seal') {
          modeT -= dt; ligX -= (primX + 50 - (480 - (LAG_N - 1) * GAP / 2 - 50)) * dt;
          if (modeT <= 0) {
            for (const b of strand) if (b.type === 'lag') { b.fixed = false; b.type = 'done'; b.joint = true; }
            strand.push({ l: 'a', x: primX, st: 'ok', type: 'primer', joint: true });
            chunk++;
            if (chunk >= CHUNKS) {
              const { acc, gr } = grade();
              api.sound('fanfare');
              return api.end(score + Math.max(0, 5 - mut) * 300 + perfects * 10, `Grade ${gr}. ${Math.round(acc * 100)}% copied, ${mut} mutation${mut === 1 ? '' : 's'} left`);
            }
            spawnLead();
          }
        }
      },
      draw(g) {
        g.save(); if (shake > .5) g.translate(rnd(-shake, shake), rnd(-shake, shake));
        g.fillStyle = '#c8b6a0'; g.fillRect(0, 0, 960, 600);
        g.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < 960; x += 48) g.fillRect(x, 0, 1, 600); for (let y = 0; y < 600; y += 48) g.fillRect(0, y, 960, 1);
        const resolved = (b) => b.st !== null || b.type === 'primer';
        const conv = (b) => (resolved(b) && !b.fixed) ? clamp((HIT - 50 - b.x) / 220, 0, 1) : 0;
        const wob = (b, c) => c * Math.sin(b.x * .035 + t * 2.5) * 8;
        const topY = (b) => { if (b.type === 'lead' && b.st === null) return TY + clamp((b.x - HELI) / 110, 0, 1) * PULL; const c = conv(b); return TY + c * 26 + wob(b, c); };
        const botY = (b) => { const c = conv(b); return NY - c * 26 - wob(b, c); };
        // backbones
        g.fillStyle = '#6a5a4a';
        for (const b of strand) {
          if (b.type === 'primer') continue;
          g.fillRect(b.x - GAP / 2, topY(b) + SZ / 2 - 4, GAP, 8);
          if (resolved(b) && b.st !== 'miss') g.fillRect(b.x - GAP / 2, botY(b) + SZ / 2 - 4, GAP, 8);
        }
        const lb = lagBases();
        const cur = mode === 'lag' ? lb[lagIdx] : null;
        for (const b of strand) {
          const ty = topY(b), by = botY(b);
          if (b.type === 'primer') {
            block(g, b.x - SZ / 2, by, SZ, SZ, '#e89aa8'); text(g, 'RNA', b.x, by + SZ / 2, 17, '#000', 'center');
            if (b.joint) { g.fillStyle = '#000'; g.fillRect(b.x - GAP / 2 - 4, by + SZ / 2 - 7, 8, 14); }
            continue;
          }
          // unzipped parental partner hanging on the zipped side of the helicase
          if (b.type === 'lead' && b.st === null && b.x > HELI) {
            const z = clamp((b.x - HELI) / 110, 0, 1), gy = NY - z * PULL;
            g.fillStyle = '#6a5a4a'; g.fillRect(b.x - GAP / 2, gy + SZ / 2 - 4, GAP, 8);
            g.fillStyle = '#000'; g.fillRect(b.x - 3, ty + SZ, 6, gy - ty - SZ);
            baseArt(g, b.x, gy, COMP[b.l], true);
          }
          if (b.lesion && b.st === null) lesionArt(g, b.x, ty, t); else baseArt(g, b.x, ty, b.l);
          if (b.st === 'ok' || b.st === 'fixed') {
            g.fillStyle = '#000'; g.fillRect(b.x - 6, ty + SZ, 4, by - ty - SZ); g.fillRect(b.x + 2, ty + SZ, 4, by - ty - SZ);
            baseArt(g, b.x, by, b.got || COMP[b.l]);
            if (b.joint) { g.fillStyle = '#000'; g.fillRect(b.x - GAP / 2 - 4, by + SZ / 2 - 7, 8, 14); }
          } else if (b.st === 'bad') { baseArt(g, b.x, by, b.got); g.fillStyle = '#c0001a'; g.fillRect(b.x - 30, by - 8, 60, 6); text(g, 'X', b.x, by + 80, 30, '#c0001a', 'center', '#000'); }
          else if (b.st === 'miss') { g.fillStyle = 'rgba(192,0,26,.6)'; g.fillRect(b.x - SZ / 2, by, SZ, SZ); text(g, '?', b.x, by + SZ / 2, 34, '#fff', 'center'); }
          if (b === cur) { g.strokeStyle = '#ffd400'; g.lineWidth = 5; g.strokeRect(b.x - SZ / 2 - 6, TY - 6, SZ + 12, SZ + 12); text(g, '<', b.x - 52 + Math.sin(t * 10) * 4, TY + SZ / 2, 30, '#c0001a', 'center'); }
        }
        // ligase glue joints during seal
        if (mode === 'seal') {
          for (const b of lb) { if (b.x - GAP / 2 > ligX) { g.fillStyle = '#000'; g.fillRect(b.x - GAP / 2 - 4, NY + SZ / 2 - 7, 8, 14); } }
          const lx = ligX, ly = NY + 70;
          block(g, lx - 30, ly, 60, 44, '#7a2d86'); g.fillStyle = '#fff'; g.fillRect(lx - 16, ly + 10, 8, 8); g.fillRect(lx + 6, ly + 10, 8, 8);
          g.fillStyle = '#7a2d86'; g.fillRect(lx - 6, ly - 20, 12, 22);
          text(g, 'LIGASE', lx, ly + 62, 14, '#000', 'center');
        }
        // primer + primase
        if (mode === 'prime') {
          const k = clamp(1 - modeT, 0, 1), up = k < .5 ? k * 2 : 1, down = k > .5 ? (k - .5) * 2 : 0;
          const py = lerp(560, NY + SZ + 40, up) + down * 180 * 0;
          const hop = Math.abs(Math.sin(t * 14)) * 4;
          if (k >= .5) block(g, primX - SZ / 2, NY, SZ, SZ, '#e89aa8'), text(g, 'RNA', primX, NY + SZ / 2, 17, '#000', 'center');
          block(g, primX - 32, py - hop, 64, 52, '#e07a00'); g.fillStyle = '#fff'; g.fillRect(primX - 18, py + 10 - hop, 9, 9); g.fillRect(primX + 8, py + 10 - hop, 9, 9);
          text(g, 'PRIMASE', primX, py + 68 - hop, 14, '#000', 'center');
        } else if (mode === 'lag' || mode === 'seal') {
          block(g, primX - SZ / 2, NY, SZ, SZ, '#e89aa8'); text(g, 'RNA', primX, NY + SZ / 2, 17, '#000', 'center');
        }
        // helicase: unzips the double helix
        {
          const arm = Math.sin(heliT * 6) * 5;
          block(g, HELI - 34, MID - 36, 68, 72, '#c0001a');
          g.fillStyle = '#fff'; g.fillRect(HELI - 20, MID - 20, 11, 11); g.fillRect(HELI + 6, MID - 20, 11, 11);
          g.fillStyle = '#000'; g.fillRect(HELI - 16, MID - 16, 5, 5); g.fillRect(HELI + 10, MID - 16, 5, 5); g.fillRect(HELI - 14, MID + 8, 28, 6);
          block(g, HELI - 34 - 30, MID - 30 - arm, 34, 14, '#8a0014'); block(g, HELI - 34 - 30, MID + 16 + arm, 34, 14, '#8a0014');
          block(g, HELI + 4, MID + 36, 14, 12 + Math.abs(arm), '#8a0014'); block(g, HELI - 20, MID + 36, 14, 12 + Math.abs(-arm), '#8a0014');
          text(g, 'HELICASE', HELI, MID + 70, 14, '#000', 'center');
          for (let i = 0; i < 2; i++) { g.fillStyle = '#ffd400'; g.fillRect(HELI - 50 + ((heliT * 60 + i * 30) % 40), MID + (i ? 4 : -8) , 5, 5); }
        }
        // polymerase machine
        g.fillStyle = flash > 0 ? 'rgba(255,255,255,.7)' : 'rgba(255,255,255,.3)'; g.fillRect(HIT - 52, 110, 104, 330);
        g.strokeStyle = '#000'; g.lineWidth = 5; g.strokeRect(HIT - 52, 110, 104, 330);
        g.fillStyle = '#000'; g.fillRect(HIT - 3, 110, 6, 330);
        const tgt = strand.find(b => b.type === 'lead' && b.st === null && b.x > HIT - 70), ex = tgt ? clamp((tgt.x - HIT) / 300, -1, 1) * 4 : 0;
        block(g, HIT - 56, 104 + chomp * 14, 112, 52, '#f0e6c8'); block(g, HIT - 56, 392 - chomp * 14, 112, 46, '#f0e6c8');
        g.fillStyle = '#fff'; g.fillRect(HIT - 32, 116 + chomp * 14, 22, 20); g.fillRect(HIT + 10, 116 + chomp * 14, 22, 20);
        g.fillStyle = '#000'; g.fillRect(HIT - 26 + ex, 122 + chomp * 14, 10, 10); g.fillRect(HIT + 16 + ex, 122 + chomp * 14, 10, 10);
        g.fillStyle = '#000'; for (let i = 0; i < 4; i++) g.fillRect(HIT - 40 + i * 24, 392 - chomp * 14 + 4, 12, 10);
        text(g, 'POLYMERASE', HIT, 88, 17, '#000', 'center');
        // tutorial prompts
        if (chunk === 0 && mode === 'lead') { const n = strand.find(b => b.type === 'lead' && b.st === null); if (n && n.x < 600) text(g, `${n.l.toUpperCase()} NEEDS ${COMP[n.l].toUpperCase()}`, HIT, 470, 26, '#fff', 'center', '#000'); }
        const ls = strand.find(b => b.lesion && b.st === null && b.x < 520 && b.x > HIT - 60);
        if (ls) text(g, 'DAMAGE! PRESS SPACE', 480, 480, 28, '#ffd400', 'center', '#000');
        if (mode === 'lag') { g.fillStyle = '#c0c0c0'; g.fillRect(480 - 190, 420, 380, 26); seg(g, 480 - 186, 424, 372, 18, lagTimer / lagMax, '#c0001a'); text(g, 'OKAZAKI FRAGMENT: RIGHT TO LEFT', 480, 470, 18, '#000', 'center'); }
        for (const p of parts) { g.fillStyle = p.c; g.fillRect(p.x, p.y, 6, 6); }
        g.restore();
        // HUD
        g.fillStyle = '#c0c0c0'; g.fillRect(14, 14, 932, 50); g.fillStyle = '#fff'; g.fillRect(16, 16, 928, 2);
        text(g, `SCORE ${score}`, 28, 40, 20); text(g, `COMBO x${Math.min(5, 1 + Math.floor(combo / 8))}`, 250, 40, 18, combo > 7 ? '#c0001a' : '#000');
        text(g, `${copied}/${total}`, 400, 40, 18); text(g, 'MUTATIONS', 490, 40, 14);
        for (let i = 0; i < 5; i++) { g.fillStyle = '#000'; g.fillRect(600 + i * 26, 28, 22, 22); g.fillStyle = i < mut ? '#c0001a' : '#fff'; g.fillRect(602 + i * 26, 30, 18, 18); }
        text(g, fixT <= 0 ? 'SPACE = FIX' : `FIX ${Math.ceil(fixT)}s`, 930, 40, 14, fixT <= 0 ? '#7a0f1f' : '#666', 'right');
        text(g, `CHUNK ${Math.min(chunk + 1, CHUNKS)} OF ${CHUNKS}`, 28, 82, 14, '#4a3a2a');
        text(g, 'A=T   C=G', 930, 82, 16, '#4a3a2a', 'right');
        if (msgT > 0) text(g, msg, 480, 548, msg.length > 24 ? 24 : 34, '#fff', 'center', '#000');
      },
    };
  },
};

// Shared multiple-choice engine used by the Trivia rounds and "What's the deal?".
// On the projector: four answer tiles, and at the reveal every guy walks to the tile they picked.
// Right answers glow. Wrong ones go gray.
import { esc, keyed, GLYPHS, timerBar, countdown, leaderboard, win } from '../engine/ui.js';
import { rowPlace } from '../engine/room.js';
import { paintMicrobes } from '../engine/micro.js';

export const ZX = [14.75, 38.25, 61.75, 85.25];
const LEAD_MS = 3200;

export function mcqStation(cfg) {
  const { id, title, seconds = 20, wager = false, statKey = 'quiz_correct', getQuestions, visual = false, passLine } = cfg;
  const qs = (ctx) => getQuestions(ctx) || [];

  function reveal(s, ctx) {
    const q = qs(ctx)[s.qi];
    if (!q) return { ...s, phase: 'reveal', last: {}, revealedAt: ctx.now() };
    const awards = [], last = {}, streak = { ...s.streak };
    for (const p of ctx.players) {
      const a = s.answers[p.id];
      if (!a) { streak[p.id] = 0; continue; }
      if (a.c === q.answer) {
        streak[p.id] = (streak[p.id] || 0) + 1;
        let pts = 500 + Math.round(500 * (1 - a.ms / s.dur));
        if (q.boss) pts *= 2;
        if (a.w && wager) pts *= 2;
        const bonus = Math.min(300, 100 * (streak[p.id] - 1));
        pts += bonus;
        awards.push({ id: p.id, points: pts, coins: 5, stats: { [statKey]: 1 } });
        last[p.id] = { ok: true, pts, streak: streak[p.id], bonus };
      } else {
        streak[p.id] = 0;
        const pts = a.w && wager ? -200 : 0;
        awards.push({ id: p.id, points: pts, coins: 1 });
        last[p.id] = { ok: false, pts };
      }
    }
    ctx.award(awards);
    return { ...s, phase: 'reveal', streak, last, revealedAt: ctx.now() };
  }

  const station = {
    id, title,
    setup: (ctx) => ({ phase: 'intro', qi: -1, n: qs(ctx).length, answers: {}, streak: {}, last: {} }),
    nextLabel: (s) => s.phase === 'intro' ? 'Start question 1' : s.phase === 'q' ? 'Reveal the answer now' : (s.qi + 1 < s.n ? `Next question (${s.qi + 2} of ${s.n})` : ''),
    next(s, ctx) {
      if (s.phase === 'q') return reveal(s, ctx);
      if (s.qi + 1 >= s.n) return null;
      const q = qs(ctx)[s.qi + 1];
      return { ...s, phase: 'q', qi: s.qi + 1, startedAt: ctx.now() + LEAD_MS, dur: (q.seconds || seconds) * 1000, answers: {}, last: {} };
    },
    tick(s, ctx) {
      if (s.phase !== 'q') return;
      const t = ctx.now();
      const answered = Object.keys(s.answers).length;
      const everyone = ctx.present.length > 0 && ctx.present.every(p => s.answers[p.id]);
      if (t > s.startedAt + s.dur + 400 || (everyone && answered > 0 && t > s.startedAt + 1500)) return reveal(s, ctx);
    },
    onEvent(s, ev) {
      if (ev.k !== 'answer' || s.phase !== 'q' || !ev.d || ev.d.qi !== s.qi || s.answers[ev.p]) return;
      const cc = ev.d.c | 0; if (cc < 0 || cc > 3) return;
      if (ev.t < s.startedAt - 300) return;
      const ms = Math.max(0, Math.min(s.dur, ev.t - s.startedAt));
      return { ...s, answers: { ...s.answers, [ev.p]: { c: cc, ms, w: !!ev.d.w } } };
    },

    place(p, i, n, ctx, room) {
      const s = ctx.s, ans = s.answers && s.answers[p.id];
      if (s.phase === 'reveal' && ans) {
        const q = qs(ctx)[s.qi];
        const same = room.list.filter(x => s.answers[x.id] && s.answers[x.id].c === ans.c);
        const j = same.findIndex(x => x.id === p.id);
        return { x: ZX[ans.c] + ((j % 4) - 1.5) * 4.2, y: 80 + Math.floor(j / 4) * 6, cls: ans.c === q.answer ? 'glow' : 'dim' };
      }
      return { ...rowPlace(i, n, { y: 91, perRow: 16, gap: 5, rowGap: 6 }), mark: s.phase === 'q' && ans ? '✓' : '' };
    },

    views: {
      screen(el, ctx) {
        const s = ctx.s, q = qs(ctx)[s.qi];
        if (s.phase === 'intro') {
          keyed(el, 'intro', () => `<div class="pos-top" style="top:8%;width:min(70%,52em)">${win(ctx.step.title, `
            <h2>${esc(ctx.step.title)}</h2><p>${esc(ctx.step.intro || cfg.intro || '')}</p>
            <div class="tagrow"><span class="chip">${s.n} questions</span><span class="chip">Faster = more points</span><span class="chip">Streaks add bonus</span>${wager ? '<span class="chip">Double down if you are sure</span>' : ''}</div>`)}</div>`);
          return;
        }
        const answered = Object.keys(s.answers).length;
        const key = `${s.phase}-${s.qi}`;
        keyed(el, key, () => `
          <div class="qwin" style="${visual ? 'left:3%;width:56%;transform:none' : ''}">${win(`${ctx.step.title}: ${s.qi + 1} of ${s.n}${q.boss ? ' (BOSS: double points)' : ''}`, `
            ${q.scene ? `<p class="scene">${esc(q.scene)}</p>` : ''}
            <p class="qline">${esc(q.q)}</p>
            ${s.phase === 'q' ? `<div data-start="${s.startedAt}">${timerBar(s.startedAt, s.dur)}</div>` : ''}
            <div class="row between"><span class="kick" id="cnt"></span>${s.phase === 'q' ? `<span class="kick">Time <span data-end="${s.startedAt + s.dur}"></span></span>` : ''}</div>
            `)}</div>
          ${visual ? `<div class="scope">${win('Specimen.exe', `<canvas class="specimen ${s.phase === 'q' ? 'focusing' : ''}" style="--dur:${s.dur}ms" data-morph="${esc(q.morph || 'ring')}"></canvas>`, { ctl: false })}</div>` : ''}
          <div class="tiles">${q.choices.map((c, i) => `<div class="tile t${i} ${s.phase === 'reveal' ? (i === q.answer ? 'right' : 'wrong') : ''}"><span class="g">${GLYPHS[i]}</span><span class="tx">${esc(c)}</span>${s.phase === 'reveal' ? `<b class="n">${Object.values(s.answers).filter(a => a.c === i).length}</b>` : ''}</div>`).join('')}</div>
          ${s.phase === 'reveal' && q.why ? `<div class="why why-bar"><b>Why</b> ${esc(q.why)}</div>` : ''}
          ${s.phase === 'q' ? `<div class="big-count" data-countwrap><span data-end="${s.startedAt}"></span></div>` : ''}`,
        (root) => { if (visual) paintMicrobes(root); });
        const cnt = el.querySelector('#cnt'); if (cnt) cnt.textContent = s.phase === 'q' ? `${answered} of ${ctx.present.length} locked in` : '';
        const cw = el.querySelector('[data-countwrap]'); if (cw) cw.hidden = ctx.now() > s.startedAt;
      },

      player(el, ctx) {
        const s = ctx.s, q = qs(ctx)[s.qi], me = ctx.me.id, L = ctx.local;
        if (s.phase === 'intro') {
          keyed(el, 'intro', () => win(ctx.step.title, `<h2>${esc(ctx.step.title)}</h2>
            <p>${esc(ctx.step.intro || cfg.intro || '')}</p><p class="muted">Faster correct answers score more. Streaks add bonus points.</p>
            ${wager ? '<p><b>Double down:</b> tap it before you answer. Right = double points. Wrong = -200.</p>' : ''}<p class="muted">Eyes on the big screen.</p>`));
          return;
        }
        if (s.phase === 'q') {
          const mine = s.answers[me] || (L.sent && L.sent.qi === s.qi ? L.sent : null);
          const waiting = ctx.now() < s.startedAt;
          const key = `q-${s.qi}-${mine ? 'a' + mine.c : 'open'}-${waiting ? 'w' : 'go'}-${L.wager ? 'w' : ''}`;
          keyed(el, key, () => waiting ? win(`Question ${s.qi + 1} of ${s.n}`, `<div class="center"><h2>Get ready</h2><div class="countdown-phone">${countdown(s.startedAt)}</div></div>`) : win(`Question ${s.qi + 1} of ${s.n}${q.boss ? ' (BOSS)' : ''}`, `
              ${q.scene ? `<p class="muted">${esc(q.scene)}</p>` : ''}
              <p class="qtext">${esc(q.q)}</p>${timerBar(s.startedAt, s.dur)}
              ${wager && !mine ? `<button class="btn block ${L.wager ? 'def' : ''}" data-wager style="margin-bottom:10px">${L.wager ? 'DOUBLED DOWN' : 'Double down: x2 or -200'}</button>` : ''}
              <div class="choices ${mine ? 'locked' : ''}">${q.choices.map((c, i) => `<button class="choice c${i} ${mine && mine.c === i ? 'picked' : ''}" data-c="${i}" ${mine ? 'disabled' : ''}><span class="g">${GLYPHS[i]}</span>${esc(c)}</button>`).join('')}</div>
              ${mine ? '<p class="muted center" style="margin-top:12px">Locked in. Watch the big screen.</p>' : ''}`), (root) => {
            root.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
              L.sent = { qi: s.qi, c: +b.dataset.c };
              ctx.fx.sound.play('tap'); ctx.fx.haptic(20);
              ctx.send('answer', { qi: s.qi, c: +b.dataset.c, w: !!L.wager });
              ctx.rerender();
            });
            const wb = root.querySelector('[data-wager]'); if (wb) wb.onclick = () => { L.wager = !L.wager; ctx.fx.haptic(15); ctx.rerender(); };
          });
          if (waiting) setTimeout(() => ctx.rerender(), Math.max(50, s.startedAt - ctx.now() + 30));
          return;
        }
        // reveal
        const r = s.last[me];
        keyed(el, `r-${s.qi}`, () => win('Result', `
          ${r ? (r.ok ? `<div class="result ok"><span class="pts">+${r.pts}</span>${r.streak > 1 ? `Streak x${r.streak}. ` : ''}Correct.</div>`
                     : `<div class="result no"><span class="pts">${r.pts < 0 ? r.pts : 'Nope'}</span>It was ${GLYPHS[q.answer]}: ${esc(q.choices[q.answer])}.</div>`)
              : `<div class="result no"><span class="pts">No answer</span>It was ${GLYPHS[q.answer]}: ${esc(q.choices[q.answer])}.</div>`}
          <div class="why"><b>Why</b> ${esc(q.why || '')}</div>`), () => {
          if (r && r.ok) { ctx.fx.sound.play('correct'); ctx.fx.haptic([20, 40, 20]); } else ctx.fx.sound.play('gentle');
        });
      },

      host(el, ctx) {
        const s = ctx.s, q = qs(ctx)[s.qi];
        if (s.phase === 'intro') { el.innerHTML = `<p>${s.n} questions ready. Hit the big button to start.</p>`; return; }
        const dist = [0, 1, 2, 3].map(i => Object.values(s.answers).filter(a => a.c === i).length);
        const max = Math.max(1, ...dist);
        el.innerHTML = `<p><b>Q${s.qi + 1}.</b> ${esc(q.q)}</p>
          <div class="row"><span class="chip">${Object.keys(s.answers).length} of ${ctx.present.length} answered</span><span class="chip">${s.phase === 'q' ? 'Timer running' : 'Revealed'}</span></div>
          <div class="dist">${q.choices.map((c, i) => `<div><b>${GLYPHS[i]}</b><span><i style="width:${(dist[i] / max) * 100}%"></i>${i === q.answer ? ' (correct) ' : ' '}${esc(c)}</span><b>${dist[i]}</b></div>`).join('')}</div>
          ${s.phase === 'reveal' ? `<p class="hint" style="margin-top:8px">${esc(q.why || '')}</p>` : '<p class="hint">It reveals by itself when time runs out or everyone has answered.</p>'}`;
      },
    },
  };
  return station;
}

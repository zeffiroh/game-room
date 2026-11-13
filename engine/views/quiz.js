// The Quiz Shelf. Solo, no code needed.
//   #/quiz                         every pack on the shelf + upload your own
//   #/quiz?pack=ID                 one pack: its rounds
//   #/quiz?pack=ID&round=RID       play a round (same scoring as the party: speed + streaks, boss x2)
import { esc, win, timerBar, GLYPHS, footer } from '../ui.js';
import { prefs, now } from '../store.js';
import { fx } from '../fx.js';
import { iconSvg } from '../icons.js';
import { listQuizPacks, loadQuizPack, parseQuizText, saveMine, deleteMine } from '../quizzes.js';

const qCount = (p) => p.rounds.reduce((n, r) => n + r.questions.length, 0);
const bestKey = (p, r) => `best.quiz.${p.id}.${r.id}`;
const back = (href, label) => `<div class="row between" style="margin-bottom:10px"><a class="btn sm" href="${href}">&larr; ${label}</a></div>`;

export async function mount(app, params) {
  const packId = params.get('pack'), roundId = params.get('round');
  if (packId && roundId) return play(app, packId, roundId);
  if (packId) return packPage(app, packId);
  return shelf(app);
}

// ---------------- shelf ----------------
async function shelf(app) {
  const card = (p) => `<a class="gtile" href="#/quiz?pack=${encodeURIComponent(p.id)}"><section class="win"><header class="tb"><span class="tt">${esc(p.title)}</span><span class="ctl"><i></i><i></i><i class="x"></i></span></header>
    <div class="qcover">${iconSvg(p.icon, { size: 96 })}<span class="chip">${esc(p.subject || 'Quiz')}</span></div>
    <div class="gt-body"><b>${esc(p.title)}</b><span>${esc(p.blurb || '')}</span><small>${p.rounds.length} rounds &middot; ${qCount(p)} questions${p.mine ? ' &middot; uploaded' : ''}</small></div></section></a>`;
  async function draw(msg = '') {
    const { built, mine } = await listQuizPacks();
    app.innerHTML = `<div class="desk"><div class="desk-in wide">
      ${back('#/', 'Game Room')}
      <h1 class="mega">QUIZ<br>SHELF</h1>
      <p class="sub">Hard questions, explained. Play any round on your own, or a teacher can drop it into a party.</p>
      <div class="tiles-grid">${built.map(card).join('')}${mine.map(card).join('')}</div>
      <div style="margin-top:22px">${win('Upload.exe', `
        <p><b>Bring your own quiz.</b> A JSON or CSV file in the <a href="quizzes/FORMAT.md" target="_blank" rel="noopener">quiz format</a>. It stays in this browser, shows up on this shelf and in the party builder.</p>
        <div class="row"><label class="btn def" for="qf">Choose a file&hellip;</label><input type="file" id="qf" accept=".json,.csv,.txt,.tsv" hidden>
          <a class="btn sm" href="quizzes/_template.json" download>JSON template</a><a class="btn sm" href="quizzes/_template.csv" download>CSV template</a></div>
        <details style="margin-top:10px"><summary class="kick" style="cursor:pointer">Or paste it</summary>
          <textarea class="field" id="qp" rows="6" placeholder='question,a,b,c,d,answer,why&#10;What is 2+2?,3,4,5,22,B,Because.'></textarea>
          <button class="btn sm" id="qpGo" style="margin-top:6px">Add pasted quiz</button></details>
        <p class="hint" id="qmsg" role="status">${msg}</p>
        ${mine.length ? `<div class="kick" style="margin-top:8px">My uploads</div><ul class="mylist">${mine.map(p => `<li><b>${esc(p.title)}</b><span>${qCount(p)} questions</span>
          <button class="btn sm" data-dl="${esc(p.id)}">Download</button><button class="btn sm" data-del="${esc(p.id)}">Delete</button></li>`).join('')}</ul>` : ''}`)}</div>
      ${footer()}
    </div></div>`;
    const $ = (s) => app.querySelector(s);
    const take = (text, name) => {
      try {
        const { pack, count } = parseQuizText(text, name);
        if (!pack.id.startsWith('my-')) pack.id = 'my-' + pack.id;
        saveMine(pack);
        draw(`Added <b>${esc(pack.title)}</b>: ${pack.rounds.length} round${pack.rounds.length > 1 ? 's' : ''}, ${count} questions.`);
      } catch (e) { $('#qmsg').innerHTML = `<b>Could not read that.</b> ${esc(e.message)}`; }
    };
    $('#qf').onchange = async (e) => { const f = e.target.files[0]; if (f) take(await f.text(), f.name); };
    $('#qpGo').onclick = () => take($('#qp').value, 'Pasted quiz');
    app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { deleteMine(b.dataset.del); draw('Deleted.'); });
    app.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => {
      const p = mine.find(x => x.id === b.dataset.dl); if (!p) return;
      const { mine: _m, added: _a, ...clean } = p;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(clean, null, 2)], { type: 'application/json' }));
      a.download = p.id.replace(/^my-/, '') + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
  }
  await draw();
}

// ---------------- one pack ----------------
async function packPage(app, id) {
  let p; try { p = await loadQuizPack(id); } catch { location.hash = '#/quiz'; return; }
  app.innerHTML = `<div class="desk"><div class="desk-in">
    ${back('#/quiz', 'Quiz Shelf')}
    <div class="row" style="gap:16px;align-items:flex-end;margin-bottom:14px"><span class="bigico">${iconSvg(p.icon, { size: 72 })}</span>
      <div><h1 class="mega small" style="margin:0">${esc(p.title)}</h1><p class="sub" style="margin:0">${esc(p.blurb || '')}</p></div></div>
    ${win(`${p.rounds.length} rounds`, `<ol class="build">${p.rounds.map(r => `<li class="rrow"><span class="n">${p.rounds.indexOf(r) + 1}</span>
      <span class="t"><b>${esc(r.title)}</b><small>${r.questions.length} questions${r.questions.some(q => q.boss) ? ' &middot; boss at the end' : ''} &middot; best ${prefs.get(bestKey(p, r), 0).toLocaleString()}</small></span>
      <a class="btn def sm" href="#/quiz?pack=${encodeURIComponent(p.id)}&round=${encodeURIComponent(r.id)}">Play</a></li>`).join('')}</ol>
      <p class="hint" style="margin-top:10px">${p.level ? esc(p.level) + '. ' : ''}Faster right answers score more. Streaks add a bonus. Boss questions count double. Teachers: every round here can be dropped into a party from Party mode.</p>`)}
    ${footer()}
  </div></div>`;
}

// ---------------- play a round ----------------
async function play(app, id, rid) {
  let p; try { p = await loadQuizPack(id); } catch { location.hash = '#/quiz'; return; }
  const round = p.rounds.find(r => r.id === rid);
  if (!round) { location.hash = `#/quiz?pack=${encodeURIComponent(id)}`; return; }
  const Q = round.questions, N = Q.length;
  let i = -1, phase = 'intro', startedAt = 0, dur = 0, pick = null, score = 0, streak = 0, right = 0, last = null, missed = [];
  let dead = false;

  app.innerHTML = `<div class="desk"><div class="desk-in">
    <div class="row between" style="margin-bottom:10px"><a class="btn sm" href="#/quiz?pack=${encodeURIComponent(p.id)}">&larr; ${esc(p.title)}</a><span class="chip" id="sc">0</span></div>
    <div id="stage"></div></div></div>`;
  const stage = app.querySelector('#stage'), sc = app.querySelector('#sc');

  function start(k) {
    i = k; phase = 'q'; pick = null; last = null;
    dur = (Q[i].seconds || 30) * 1000; startedAt = now();
    draw();
  }
  function answer(c) {
    if (phase !== 'q') return;
    const q = Q[i], ms = Math.min(dur, now() - startedAt);
    pick = c; phase = 'reveal';
    if (c === q.answer) {
      streak++; right++;
      let pts = 500 + Math.round(500 * (1 - ms / dur)); if (q.boss) pts *= 2;
      const bonus = Math.min(300, 100 * (streak - 1)); pts += bonus;
      score += pts; last = { ok: true, pts, bonus };
      fx.sound.play('correct'); fx.haptic([20, 40, 20]);
    } else {
      streak = 0; last = { ok: false }; missed.push(i);
      fx.sound.play('gentle');
    }
    draw();
  }
  function next() {
    if (phase === 'intro') { fx.sound.unlock(); return start(0); }
    if (phase !== 'reveal') return;
    if (i + 1 < N) return start(i + 1);
    phase = 'done'; draw();
  }

  function draw() {
    sc.textContent = score.toLocaleString();
    if (phase === 'intro') {
      stage.innerHTML = win(round.title, `<h2>${esc(round.title)}</h2><p>${esc(round.intro || 'Read the setup. Pick the answer.')}</p>
        <div class="tagrow"><span class="chip">${N} questions</span><span class="chip">Faster = more points</span><span class="chip">Streaks add bonus</span></div>
        <p class="hint" style="margin-top:10px">Keyboard: 1-4 or A-D to answer, Enter for next.</p>
        <button class="btn def block" id="go" style="min-height:56px;margin-top:8px">START</button>`);
      stage.querySelector('#go').onclick = next; return;
    }
    if (phase === 'done') {
      const best = prefs.get(bestKey(p, round), 0), isBest = score > best;
      if (isBest) prefs.set(bestKey(p, round), score);
      const nextRound = p.rounds[p.rounds.indexOf(round) + 1];
      stage.innerHTML = win('Round over', `<div class="center"><div class="kick">${right} of ${N} right</div><div class="bigscore">${score.toLocaleString()}</div>
        <p>${isBest ? 'New best score.' : 'Best: ' + best.toLocaleString()}</p></div>
        ${missed.length ? `<div class="kick" style="margin-top:10px">Worth another look</div>${missed.map(k => `<div class="why"><b>${esc(Q[k].q)}</b>Answer: ${GLYPHS[Q[k].answer]}. ${esc(Q[k].choices[Q[k].answer])}. ${esc(Q[k].why)}</div>`).join('')}` : '<p class="center">Clean sweep.</p>'}
        <div class="row" style="margin-top:12px;justify-content:center"><button class="btn def" id="again" style="min-width:140px">Play again</button>
        ${nextRound ? `<a class="btn" href="#/quiz?pack=${encodeURIComponent(p.id)}&round=${encodeURIComponent(nextRound.id)}">Next round</a>` : ''}<a class="btn" href="#/quiz">Quiz Shelf</a></div>`);
      stage.querySelector('#again').onclick = () => { score = streak = right = 0; missed = []; start(0); };
      return;
    }
    const q = Q[i], rev = phase === 'reveal';
    stage.innerHTML = win(`Question ${i + 1} of ${N}${q.boss ? ' (BOSS: double points)' : ''}`, `
      ${q.scene ? `<p class="scene-solo">${esc(q.scene)}</p>` : ''}
      <p class="qtext">${esc(q.q)}</p>
      ${rev ? '' : `<div class="row between"><span class="kick">${streak > 1 ? 'Streak x' + streak : '&nbsp;'}</span><span class="kick">Time <span data-end="${startedAt + dur}"></span></span></div>${timerBar(startedAt, dur)}`}
      <div class="choices ${rev ? 'locked' : ''}">${q.choices.map((c, k) => `<button class="choice c${k} ${rev && k === q.answer ? 'picked' : ''} ${rev && k === pick && k !== q.answer ? 'nope' : ''}" data-c="${k}" ${rev ? 'disabled' : ''}><span class="g">${GLYPHS[k]}</span>${esc(c)}</button>`).join('')}</div>
      ${rev ? `<div class="result ${last.ok ? 'ok' : 'no'}" style="margin-top:12px"><span class="pts">${last.ok ? '+' + last.pts : pick == null ? 'Time' : 'Nope'}</span>${last.ok ? (last.bonus ? `Streak bonus +${last.bonus}.` : 'Correct.') : `It was ${GLYPHS[q.answer]}: ${esc(q.choices[q.answer])}.`}</div>
        ${q.why ? `<div class="why"><b>Why</b> ${esc(q.why)}</div>` : ''}
        <button class="btn def block" id="nx" style="margin-top:12px;min-height:50px">${i + 1 < N ? 'Next question' : 'See score'}</button>` : ''}`);
    stage.querySelectorAll('[data-c]').forEach(b => b.onclick = () => answer(+b.dataset.c));
    const nx = stage.querySelector('#nx'); if (nx) { nx.onclick = next; nx.focus(); }
  }

  const key = (e) => {
    if (e.target.closest('input,textarea')) return;
    const k = e.key.toLowerCase();
    if (phase === 'q') { const c = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'abcd'.indexOf(k); if (c >= 0 && c < Q[i].choices.length) { e.preventDefault(); answer(c); } }
    else if ((k === 'enter' || k === ' ') && phase !== 'done' && !e.target.closest('button')) { e.preventDefault(); next(); }
  };
  window.addEventListener('keydown', key);
  const timer = setInterval(() => { if (!dead && phase === 'q' && now() - startedAt > dur) { pick = null; phase = 'reveal'; streak = 0; last = { ok: false }; missed.push(i); fx.sound.play('gentle'); draw(); } }, 200);
  draw();
  return () => { dead = true; clearInterval(timer); window.removeEventListener('keydown', key); };
}

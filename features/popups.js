// Pop-up cards: the host fires one at any moment, over any game.
//  quick : a fast question; correct answers earn coins (fastest three get double)
//  goal  : a class-wide challenge; if enough of the class gets it, everyone gets bonus coins
//  fact  : a weird fact; tapping it earns a coin
import { esc, uid, GLYPHS, countdown, win } from '../engine/ui.js';
import { now } from '../engine/store.js';

export function launch(rt, i) {
  const card = rt.pack.data.cards?.cards?.[i]; if (!card) return;
  const secs = card.seconds || (card.type === 'fact' ? 12 : 15);
  rt.state.popup = { i, id: uid(), at: now(), until: now() + secs * 1000, answers: {}, closed: false };
  rt.mark();
}

export function onEvent(rt, ev, p) {
  const pop = rt.state.popup;
  if (!pop || pop.closed || !ev.d || ev.d.id !== pop.id || pop.answers[p.id]) return;
  rt.state.popup = { ...pop, answers: { ...pop.answers, [p.id]: { c: ev.d.c | 0, t: ev.t } } };
  rt.mark();
}

function close(rt) {
  const pop = rt.state.popup, card = rt.pack.data.cards?.cards?.[pop.i];
  if (!card) { rt.state.popup = null; rt.mark(); return; }
  const entries = Object.entries(pop.answers).sort((a, b) => a[1].t - b[1].t);
  const awards = [];
  let rain = false, correct = 0;
  if (card.type === 'fact') entries.forEach(([id]) => awards.push({ id, coins: card.coins || 2 }));
  else {
    const right = entries.filter(([, a]) => a.c === card.answer);
    correct = right.length;
    right.forEach(([id], k) => awards.push({ id, coins: (card.coins || 5) * (card.type === 'quick' && k < 3 ? 2 : 1), stats: { popups: 1 } }));
    if (card.type === 'goal') {
      const here = rt.ctx().present.length || 1;
      rain = correct / here >= (card.goal || .75);
      if (rain) rt.ctx().present.forEach(p => awards.push({ id: p.id, coins: card.bonus || 10 }));
    }
  }
  rt.award(awards);
  rt.state.popup = { ...pop, closed: true, rain, correct, closedAt: now() };
  rt.mark();
}

export function tick(rt) {
  const pop = rt.state.popup; if (!pop) return;
  if (!pop.closed && now() > pop.until) close(rt);
  else if (pop.closed && now() > pop.closedAt + 9000) { rt.state.popup = null; rt.mark(); }
}

export function hostPanel(el, rt, ctx) {
  const cards = rt.pack.data.cards?.cards || [];
  const pop = rt.state.popup;
  const key = 'pop-' + (pop ? pop.id + pop.closed : 'none');
  if (el.dataset.key === key) { const n = el.querySelector('#popN'); if (n && pop) n.textContent = Object.keys(pop.answers).length; return; }
  el.dataset.key = key;
  el.innerHTML = `${pop && !pop.closed ? `<div class="mini-item live"><b>Live: ${esc(cards[pop.i].title)}</b><span><span id="popN">${Object.keys(pop.answers).length}</span> answered</span><button class="btn sm" id="closePop">Close now</button></div>` : ''}
    <p class="hint">Fire a card any time. It shows on every phone and the big screen.</p>
    <div class="mini-list">${cards.map((c, i) => `<div class="mini-item"><span><b>${esc({ quick: 'Quick', goal: 'Team', fact: 'Fact' }[c.type] || '')}: ${esc(c.title)}</b><br><small class="muted">${esc(c.text)}</small></span>
      <div class="row"><button class="btn sm" data-pop="${i}">${rt.state.usedPops?.includes(i) ? 'Fire again' : 'Fire'}</button></div></div>`).join('')}</div>`;
  el.querySelectorAll('[data-pop]').forEach(b => b.onclick = () => {
    const i = +b.dataset.pop; launch(rt, i);
    rt.state.usedPops = [...new Set([...(rt.state.usedPops || []), i])];
    el.dataset.key = ''; hostPanel(el, rt, ctx);
  });
  const cp = el.querySelector('#closePop'); if (cp) cp.onclick = () => { close(rt); el.dataset.key = ''; hostPanel(el, rt, ctx); };
}

let rained = null;
export function playerOverlay(el, ctx) {
  const pop = ctx.state.popup;
  if (!pop) { el.innerHTML = ''; el.dataset.key = ''; return; }
  const card = ctx.pack.data.cards.cards[pop.i];
  const mine = pop.answers[ctx.me.id] || ctx.local['pop' + pop.id];
  const dismissed = ctx.local['popx' + pop.id];
  const key = `${pop.id}-${pop.closed}-${mine ? mine.c : 'x'}-${dismissed ? 'd' : ''}`;
  if (el.dataset.key === key) return;
  el.dataset.key = key;
  if (dismissed) { el.innerHTML = ''; return; }
  const kind = { quick: 'Pop quiz. Fastest three get double.', goal: 'Class challenge. Get enough of the room right and everyone wins coins.', fact: 'Weird fact' }[card.type];
  let body;
  if (!pop.closed) {
    body = card.type === 'fact'
      ? `<p>${esc(card.text)}</p><button class="btn def block" data-c="0" ${mine ? 'disabled' : ''}>${mine ? 'Collected' : 'Wow. Tap for a coin'}</button>`
      : `<p><b>${esc(card.text)}</b></p><div class="choices ${mine ? 'locked' : ''}">${card.choices.map((c, i) => `<button class="choice c${i} ${mine && mine.c === i ? 'picked' : ''}" data-c="${i}" ${mine ? 'disabled' : ''}><span class="g">${GLYPHS[i]}</span>${esc(c)}</button>`).join('')}</div>`;
    body += `<p class="muted" style="margin-top:10px">${countdown(pop.until)}s left</p>`;
  } else {
    const ok = card.type === 'fact' ? !!mine : mine && mine.c === card.answer;
    body = `${card.type !== 'fact' ? `<div class="result ${ok ? 'ok' : 'no'}"><span class="pts">${ok ? 'Correct' : 'Nope'}</span>${esc(card.choices[card.answer])}</div>` : ''}
      ${card.type === 'goal' ? `<p><b>${pop.rain ? `${pop.correct} got it. Everyone gets coins.` : `${pop.correct} got it. Not enough this time.`}</b></p>` : ''}
      ${card.why ? `<div class="why">${esc(card.why)}</div>` : ''}<button class="btn block" data-x style="margin-top:10px">Back to the game</button>`;
  }
  el.innerHTML = `<div class="modal">${win(card.title, `<div class="kick">${esc(kind)}</div>${body}`)}</div>`;
  el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
    ctx.local['pop' + pop.id] = { c: +b.dataset.c };
    ctx.send('pop', { id: pop.id, c: +b.dataset.c });
    ctx.fx.haptic(20); ctx.fx.sound.play('tap');
    el.dataset.key = ''; playerOverlay(el, ctx);
  });
  const x = el.querySelector('[data-x]'); if (x) x.onclick = () => { ctx.local['popx' + pop.id] = 1; el.innerHTML = ''; };
  if (!pop.closed) ctx.fx.sound.play('pop');
  if (pop.closed && pop.rain && rained !== pop.id) { rained = pop.id; ctx.fx.coinRain(); }
}

export function screenCard(el, ctx) {
  const pop = ctx.state.popup;
  if (!pop) { el.innerHTML = ''; el.dataset.key = ''; return; }
  const card = ctx.pack.data.cards.cards[pop.i];
  const key = `${pop.id}-${pop.closed}`;
  const n = Object.keys(pop.answers).length;
  if (el.dataset.key !== key) {
    el.dataset.key = key;
    const kind = { quick: 'Quick question', goal: 'Team challenge', fact: 'Weird fact' }[card.type];
    el.innerHTML = win(`${kind}: ${card.title}`, `<p class="big-p">${esc(card.text)}</p>
      ${pop.closed ? (card.type === 'fact' ? '' : `<p><b>Answer:</b> ${esc(card.choices[card.answer])}</p>`) + (card.type === 'goal' ? `<p><b>${pop.rain ? 'Challenge beaten. Coins for everyone.' : `${pop.correct} got it. Not enough.`}</b></p>` : '') + (card.why ? `<p class="muted">${esc(card.why)}</p>` : '')
        : `<p class="muted"><b id="popN">${n}</b> answered · ${countdown(pop.until)}s</p>`}`, { cls: 'popup-card' });
    if (!pop.closed) ctx.fx.sound.play('pop');
  } else { const x = el.querySelector('#popN'); if (x) x.textContent = n; }
}

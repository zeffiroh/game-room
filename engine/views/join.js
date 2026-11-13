// Join: type a name, pick a block guy. Every guy is generated from a seed, so nobody else has yours.
import { db } from '../db.js';
import { identity, alias } from '../store.js';
import { loadPack } from '../packs.js';
import { applyTheme, applyMeta, titleHtml } from '../theme.js';
import { esc, win } from '../ui.js';
import { fig } from '../blocks.js';

const seeds = () => Array.from({ length: 8 }, () => 'g:' + Math.floor(Math.random() * 1e9));

export async function mount(app, params) {
  const code = (params.get('code') || '').toUpperCase();
  const p = alias() ? `&p=${alias()}` : '';
  if (identity.player(code)) { location.hash = `#/play?code=${code}${p}`; return; }

  let pack = null;
  try { const d = await db.poll(code, -1, null); pack = await loadPack(d.room.pack); applyTheme(pack); applyMeta(pack, d.room.state && d.room.state.meta); }
  catch (e) {
    app.innerHTML = `<div class="desk"><div class="desk-in narrow">${win('Error', `<h2>No room called ${esc(code)}</h2><p>Check the code on the big screen.</p><a class="btn def block" href="#/party">Back</a>`)}</div></div>`;
    return;
  }
  let options = seeds(), avatar = options[0];
  app.innerHTML = `
  <div class="desk"><div class="desk-in narrow">
    <h1 class="mega small">${titleHtml(pack, 40)}</h1>
    <p class="sub">${esc(pack.joinLine || '')}</p>
    ${win('New player', `
    <form id="f">
      <label for="nm" class="kick">Name</label>
      <input class="field" id="nm" maxlength="24" autocomplete="given-name" value="${esc(identity.lastName() || alias())}" required>
      <div class="row between" style="margin-top:16px"><span class="kick">Pick your guy</span><button type="button" class="btn sm" id="more">Reroll</button></div>
      <div class="fig-pick" id="pick" role="group" aria-label="Choose your guy"></div>
      <button class="btn def block" style="margin-top:12px">Join</button>
      <p class="hint" id="err" role="alert"></p>
    </form>`)}
  </div></div>`;
  const pick = app.querySelector('#pick');
  const draw = () => {
    pick.innerHTML = options.map(o => `<button type="button" data-a="${o}" aria-pressed="${o === avatar}">${fig(o)}</button>`).join('');
    pick.querySelectorAll('[data-a]').forEach(b => b.onclick = () => { avatar = b.dataset.a; pick.querySelectorAll('[data-a]').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  };
  draw();
  app.querySelector('#more').onclick = () => { options = seeds(); avatar = options[0]; draw(); };
  app.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const name = app.querySelector('#nm').value.trim();
    if (!name) return;
    try {
      const r = await db.joinRoom(code, name, avatar);
      identity.setPlayer(code, { id: r.id, secret: r.secret, name, avatar });
      identity.setLastName(name);
      location.hash = `#/play?code=${code}${p}`;
    } catch (err) {
      app.querySelector('#err').textContent = err.code === 'ROOM_FULL' ? 'This room is full.' : 'Could not join. Check your connection and try again.';
    }
  };
}

// Hidden owner page (#/admin, not linked anywhere): make a lifetime teacher code for someone who paid.
// Gated by the owner code. The generator itself holds no secrets: it makes a random code and its fingerprint.
import { esc, win } from '../ui.js';
import { prefs } from '../store.js';
import { isOwner, fingerprint, normalize, teacher } from '../teacher.js';

const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function makeCode() {
  const r = crypto.getRandomValues(new Uint32Array(12));
  const s = [...r].map(x => A[x % A.length]).join('');
  return `GR-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`;
}

export async function mount(app) {
  document.title = 'Admin · Game Room';
  const remembered = prefs.get('ownerCode', '');
  if (remembered && await isOwner(remembered)) return panel(app);
  app.innerHTML = `<div class="desk"><div class="desk-in narrow"><form id="f">${win('Admin.exe', `
    <label class="kick" for="oc">Owner code</label>
    <input class="field" id="oc" type="password" autocomplete="off" required>
    <button class="btn def block" style="margin-top:10px">Open</button><p class="hint" id="e" role="alert"></p>`)}</form></div></div>`;
  app.querySelector('#f').onsubmit = async (e) => {
    e.preventDefault();
    const v = app.querySelector('#oc').value;
    if (await isOwner(v)) { prefs.set('ownerCode', normalize(v)); teacher.unlock(v); panel(app); }
    else app.querySelector('#e').textContent = 'Not the owner code.';
  };
}

function panel(app) {
  app.innerHTML = `<div class="desk"><div class="desk-in">
    <div class="row between" style="margin-bottom:10px"><a class="btn sm" href="#/">&larr; Game Room</a><button class="btn sm" id="lock">Lock admin on this device</button></div>
    <h1 class="mega small">TEACHER<br>CODES</h1>
    ${win('NewCode.exe', `
      <label class="kick" for="who">Who it is for (only goes in the SQL line and your own log)</label>
      <input class="field" id="who" placeholder="Ms Rivera, Lincoln HS, pay_XXXX, 2026-11-20">
      <div class="row" style="margin-top:10px"><button class="btn def" id="go">Make a code</button>
        <input class="field" id="have" placeholder="or paste an existing code" style="flex:1;min-width:12em"><button class="btn sm" id="fp">Fingerprint it</button></div>
      <div id="res" hidden style="margin-top:14px">
        <div class="kick">1. Send this code to the teacher</div><div class="adm-out big" id="code"></div>
        <div class="kick" style="margin-top:12px">2a. Lock mode 'config': add this line inside TEACHER_CODES in config.js, then push (no names there, it is public)</div><div class="adm-out" id="cfg"></div>
        <div class="kick" style="margin-top:12px">2b. Lock mode 'neon': run this in the Neon SQL Editor instead (no push needed)</div><div class="adm-out" id="sql"></div>
        <div class="kick" style="margin-top:12px">3. Add a row to the customer log in DEVELOPER.md</div><div class="adm-out" id="log"></div>
        <button class="btn sm" id="copy" style="margin-top:10px">Copy all</button>
      </div>`)}
  </div></div>`;
  const $ = (s) => app.querySelector(s);
  const clean = (s) => String(s).replace(/[|\n\r]/g, ' ').trim();
  async function show(code) {
    const who = clean($('#who').value) || 'teacher';
    const f = await fingerprint(code);
    $('#code').textContent = code;
    $('#cfg').textContent = `  '${f}',`;
    $('#sql').textContent = `insert into teacher_codes(code_hash, label) values ('${f}', '${who.replace(/'/g, "''")}');`;
    $('#log').textContent = `| ${new Date().toISOString().slice(0, 10)} | ${who} | | | ${code} | ${f.slice(0, 8)} | active |`;
    $('#res').hidden = false;
  }
  $('#go').onclick = () => show(makeCode());
  $('#fp').onclick = () => { if (normalize($('#have').value).length >= 8) show($('#have').value.trim().toUpperCase()); };
  $('#copy').onclick = () => navigator.clipboard.writeText([$('#code'), $('#cfg'), $('#sql'), $('#log')].map(x => x.textContent).join('\n')).then(() => { $('#copy').textContent = 'Copied'; });
  $('#lock').onclick = () => { prefs.set('ownerCode', ''); location.hash = '#/'; };
}

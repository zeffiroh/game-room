// Data layer. Two interchangeable backends with the same functions:
//  - Neon: the browser calls SECURITY DEFINER functions over HTTPS.
//  - Rehearsal: localStorage, for practicing on one computer with no database.
import { NEON_URL, TEACHER_LOCK } from '../config.js';

export const MODE = NEON_URL ? 'neon' : 'rehearsal';

let sqlPromise = null;
function sql() {
  if (!sqlPromise) {
    sqlPromise = import('https://cdn.jsdelivr.net/npm/@neondatabase/serverless@0.10.4/+esm')
      .then(({ neon }) => neon(NEON_URL));
  }
  return sqlPromise;
}

async function call(fn, sig, args) {
  const s = await sql();
  try {
    const rows = await s(`select public.${fn}(${sig}) as r`, args);
    return rows[0].r;
  } catch (e) {
    throw friendly(e);
  }
}

function friendly(e) {
  const msg = String(e && e.message || e);
  const known = ['ROOM_NOT_FOUND', 'NAME_REQUIRED', 'ROOM_FULL', 'NOT_IN_ROOM', 'NOT_HOST', 'TOO_BIG', 'BAD_PACK', 'NOT_TEACHER'];
  const code = known.find(k => msg.includes(k)) || 'NETWORK';
  const err = new Error(code);
  err.code = code;
  err.detail = msg;
  return err;
}

const neonApi = {
  createRoom: (pack) => call('create_room', '$1::text', [pack]),
  createRoomTeacher: (pack, code) => call('create_room_t', '$1::text,$2::text', [pack, code]),
  checkTeacher: (code) => call('check_teacher', '$1::text', [code]),
  joinRoom: (code, name, avatar, id = null, secret = null) =>
    call('join_room', '$1::text,$2::text,$3::text,$4::uuid,$5::uuid', [code, name, avatar, id, secret]),
  poll: (code, since, player = null) => call('poll', '$1::text,$2::bigint,$3::uuid', [code, since, player]),
  sendEvent: (code, id, secret, kind, payload) =>
    call('send_event', '$1::text,$2::uuid,$3::uuid,$4::text,$5::jsonb', [code, id, secret, kind, JSON.stringify(payload || {})]),
  hostSetState: (code, token, state) => call('host_set_state', '$1::text,$2::uuid,$3::jsonb', [code, token, JSON.stringify(state)]),
  hostAward: (code, token, awards) => call('host_award', '$1::text,$2::uuid,$3::jsonb', [code, token, JSON.stringify(awards)]),
  hostKick: (code, token, player) => call('host_kick', '$1::text,$2::uuid,$3::uuid', [code, token, player]),
};

// ---------------- rehearsal backend (mirrors schema.sql) ----------------
const KEY = 'party-rehearsal-db-v1';
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'x' + Math.random().toString(16).slice(2) + Date.now());
function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { rooms: {}, players: [], events: [], seq: 0 }; }
  catch { return { rooms: {}, players: [], events: [], seq: 0 }; }
}
function save(db) {
  if (db.events.length > 3000) db.events = db.events.slice(-2000);
  localStorage.setItem(KEY, JSON.stringify(db));
}
const fail = (code) => { const e = new Error(code); e.code = code; throw e; };
const wait = () => new Promise(r => setTimeout(r, 30 + Math.random() * 60));

const localApi = {
  async createRoom(pack, demo = false) {
    await wait(); const db = load();
    // Demo codes always contain a digit (real Neon codes never do), so every page knows to look in this browser.
    const A = 'ABCDEFGHJKMNPQRSTUVWXYZ', D = '23456789'; let code;
    const pick = (s) => s[Math.floor(Math.random() * s.length)];
    do { code = demo ? pick(A) + pick(D) + pick(A) + pick(D) : Array.from({ length: 4 }, () => pick(A)).join(''); } while (db.rooms[code]);
    const host_token = uuid();
    for (const [c, r] of Object.entries(db.rooms)) if (Date.now() - (r.created || 0) > 3 * 864e5) delete db.rooms[c];
    db.rooms[code] = { code, pack_id: pack, host_token, state: {}, version: 0, created: Date.now(), demo };
    save(db); return { code, host_token };
  },
  async joinRoom(code, name, avatar, id = null, secret = null) {
    await wait(); const db = load(); code = String(code).trim().toUpperCase();
    if (!db.rooms[code]) fail('ROOM_NOT_FOUND');
    name = String(name || '').trim().slice(0, 24); if (!name) fail('NAME_REQUIRED');
    let p = id && db.players.find(x => x.id === id && x.secret === secret && x.room_code === code && !x.kicked);
    if (p) { p.name = name; p.avatar = avatar || 'g:1'; p.last_seen = Date.now(); }
    else {
      p = { id: uuid(), secret: uuid(), room_code: code, name, avatar: avatar || 'g:1', score: 0, coins: 0, stamps: [], stats: {}, kicked: false, last_seen: Date.now(), created: Date.now() };
      db.players.push(p);
    }
    save(db); return { id: p.id, secret: p.secret };
  },
  async poll(code, since, player = null) {
    await wait(); const db = load(); code = String(code).toUpperCase();
    const room = db.rooms[code]; if (!room) fail('ROOM_NOT_FOUND');
    if (player) { const p = db.players.find(x => x.id === player); if (p) { p.last_seen = Date.now(); save(db); } }
    const evs = db.events.filter(e => e.room_code === code);
    return {
      now: Date.now(),
      max: evs.length ? evs[evs.length - 1].id : 0,
      room: { code, pack: room.pack_id, state: room.state, version: room.version },
      players: db.players.filter(p => p.room_code === code).map(p => ({
        id: p.id, name: p.name, avatar: p.avatar, score: p.score, coins: p.coins, stamps: p.stamps, stats: p.stats, kicked: p.kicked, seen: p.last_seen })),
      events: since >= 0 ? evs.filter(e => e.id > since).slice(0, 300).map(e => ({ id: e.id, p: e.player_id, k: e.kind, d: e.payload, t: e.t })) : [],
    };
  },
  async sendEvent(code, id, secret, kind, payload) {
    await wait(); const db = load(); code = String(code).toUpperCase();
    const p = db.players.find(x => x.id === id && x.secret === secret && x.room_code === code && !x.kicked);
    if (!p) fail('NOT_IN_ROOM');
    const recent = db.events.filter(e => e.player_id === id && e.t > Date.now() - 2000).length;
    if (recent >= 8) return { ok: false, limited: true };
    const ev = { id: ++db.seq, room_code: code, player_id: id, kind, payload: payload || {}, t: Date.now() };
    db.events.push(ev); save(db); return { ok: true, id: ev.id };
  },
  async hostSetState(code, token, state) {
    await wait(); const db = load(); const room = db.rooms[String(code).toUpperCase()];
    if (!room || room.host_token !== token) fail('NOT_HOST');
    room.state = state; room.version++; save(db); return { version: room.version };
  },
  async hostAward(code, token, awards) {
    await wait(); const db = load(); code = String(code).toUpperCase(); const room = db.rooms[code];
    if (!room || room.host_token !== token) fail('NOT_HOST');
    for (const a of awards) {
      const p = db.players.find(x => x.id === a.id && x.room_code === code); if (!p) continue;
      p.score = Math.max(0, p.score + (a.points | 0));
      p.coins = Math.max(0, p.coins + (a.coins | 0));
      if (a.stamp && !p.stamps.includes(a.stamp)) p.stamps.push(a.stamp);
      for (const [k, v] of Object.entries(a.stats || {})) p.stats[k] = (p.stats[k] || 0) + v;
    }
    save(db); return { ok: true };
  },
  async hostKick(code, token, player) {
    await wait(); const db = load(); const room = db.rooms[String(code).toUpperCase()];
    if (!room || room.host_token !== token) fail('NOT_HOST');
    const p = db.players.find(x => x.id === player); if (p) p.kicked = true; save(db); return { ok: true };
  },
};

// Demo rooms (a digit in the code) and rehearsal mode live in this browser; everything else goes to Neon.
export const isDemoCode = (code) => /\d/.test(String(code || ''));
const route = (code) => (MODE === 'neon' && !isDemoCode(code)) ? neonApi : localApi;

export const db = {
  // demo: a throwaway room in this browser, no teacher code needed.
  // Real rooms: TEACHER_LOCK 'neon' makes the database check the code itself.
  createRoom(pack, { demo = false, teacherCode = '' } = {}) {
    if (demo || MODE !== 'neon') return localApi.createRoom(pack, demo);
    return TEACHER_LOCK === 'neon' ? neonApi.createRoomTeacher(pack, teacherCode) : neonApi.createRoom(pack);
  },
  checkTeacher: (code) => neonApi.checkTeacher(code),
  joinRoom: (code, ...a) => route(code).joinRoom(code, ...a),
  poll: (code, ...a) => route(code).poll(code, ...a),
  sendEvent: (code, ...a) => route(code).sendEvent(code, ...a),
  hostSetState: (code, ...a) => route(code).hostSetState(code, ...a),
  hostAward: (code, ...a) => route(code).hostAward(code, ...a),
  hostKick: (code, ...a) => route(code).hostKick(code, ...a),
};

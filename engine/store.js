// Identity (localStorage), server clock, and the polling loop.
import { db } from './db.js';
import { POLL_MS } from '../config.js';

// ?p=alias in the URL keeps separate identities in one browser (for testing / shared devices).
export function alias() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  return (q.get('p') || '').replace(/[^\w-]/g, '').slice(0, 20);
}
const k = (name) => `party.${alias() || 'me'}.${name}`;

function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* private mode */ } }

export const identity = {
  player: (code) => read(k('player.' + code)),
  setPlayer: (code, v) => write(k('player.' + code), v),
  clearPlayer: (code) => { try { localStorage.removeItem(k('player.' + code)); } catch {} },
  lastName: () => read(k('lastName')) || '',
  setLastName: (v) => write(k('lastName'), v),
  hostToken: (code) => read('party.host.' + code),
  setHostToken: (code, t) => write('party.host.' + code, t),
};
export const prefs = {
  get: (name, dflt) => { const v = read('party.pref.' + name); return v === null ? dflt : v; },
  set: (name, v) => write('party.pref.' + name, v),
};

// ---- server clock: all timers use server time so phones agree ----
let offset = 0, bestRtt = Infinity;
export const now = () => Date.now() + offset;
function sampleClock(serverNow, t0, t1) {
  const rtt = t1 - t0;
  if (rtt <= bestRtt * 1.5 || rtt < 400) {
    bestRtt = Math.min(bestRtt, rtt);
    offset = serverNow - (t0 + t1) / 2;
  }
}

// ---- polling ----
// withEvents: host & screen read the event stream; phones skip it.
export function connect({ code, playerId = null, withEvents = false, cursor = 0, onData, onError }) {
  let stopped = false, timer = null, inflight = false;
  let fromNow = cursor === 'now';
  let cur = fromNow ? 0 : cursor;
  let floor = cur;
  const seen = new Set();
  async function tick() {
    if (stopped || inflight) return;
    inflight = true; clearTimeout(timer);
    const t0 = Date.now();
    try {
      const since = withEvents && !fromNow ? Math.max(0, cur - 25) : -1; // small overlap catches out-of-order commits
      const d = await db.poll(code, since, playerId);
      sampleClock(d.now, t0, Date.now());
      if (fromNow) { fromNow = false; cur = floor = d.max; }
      let fresh = [];
      if (withEvents) {
        fresh = d.events.filter(e => !seen.has(e.id) && e.id > floor);
        fresh.forEach(e => seen.add(e.id));
        if (d.events.length) cur = Math.max(cur, d.events[d.events.length - 1].id);
        if (seen.size > 5000) { const keep = [...seen].slice(-2000); seen.clear(); keep.forEach(x => seen.add(x)); }
      }
      d.fresh = fresh;
      if (!stopped) onData(d);
    } catch (e) {
      if (!stopped) onError && onError(e);
    }
    inflight = false;
    if (!stopped) timer = setTimeout(tick, document.hidden ? POLL_MS * 3 : POLL_MS);
  }
  const vis = () => { if (!document.hidden) tick(); };
  document.addEventListener('visibilitychange', vis);
  tick();
  return {
    now: () => tick(),
    stop() { stopped = true; clearTimeout(timer); document.removeEventListener('visibilitychange', vis); },
    get cursor() { return cur; },
  };
}

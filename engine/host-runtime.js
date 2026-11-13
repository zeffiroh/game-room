// The host's browser is the referee: it reads player events, runs the station logic,
// and writes the room state + awards. Players only ever send events.
import { db } from './db.js';
import { loadStation, makeCtx } from './stations.js';
import { now } from './store.js';
import { uid } from './ui.js';
import * as dj from '../features/dj.js';
import * as popups from '../features/popups.js';

const freshState = () => ({
  v: 1, step: -1, run: '', s: {}, cursor: 0, acted: {}, stamped: {}, done: {},
  popup: null, music: { queue: [], now: null, playing: false, at: 0, pos: 0 },
  announce: null,
});

// Quiz rounds carry their questions inside the show. Phones poll the room state every 1.5 s,
// so the state on the wire keeps only the current round (state.q), not every round of the night.
const stripQuestions = (show) => show && show.map(({ questions, ...rest }) => questions ? { ...rest, nq: questions.length } : rest);
const withQuestions = (saved, local) => saved.map((s, i) => {
  const l = local && local[i];
  return !s.questions && l && l.questions && l.station === s.station && l.title === s.title ? { ...s, questions: l.questions } : s;
});

export class HostRuntime {
  constructor({ code, token, pack, onChange, onError }) {
    Object.assign(this, { code, token, pack, onChange, onError });
    this.players = [];
    this.pending = [];
    this.reacts = {}; this.reactCoins = {};
    this.dirty = false; this.saving = false; this.again = false;
  }

  async init(room, players, show = null, meta = null) {
    this.players = players;
    if (room.state && room.state.v) {
      this.state = { ...freshState(), ...room.state };
      // The saved state carries the show without its questions; this device's copy has them.
      if (this.state.show) this.state.show = this.pack.show = withQuestions(this.state.show, show);
      this.station = await loadStation(this.stepDef().station);
    } else {
      this.state = freshState();
      if (show && show.length) { this.state.show = show; this.pack.show = show; }
      if (meta) this.state.meta = meta;
      await this.goto(0);
    }
    this.tickTimer = setInterval(() => this.tick(), 500);
    this.flushTimer = setInterval(() => this.flushReacts(), 5000);
    this.cursorTimer = setInterval(() => { if (this.cursorMoved) { this.cursorMoved = false; this.mark(); } }, 3000);
  }
  stop() { dj.hostStop(); clearInterval(this.tickTimer); clearInterval(this.flushTimer); clearInterval(this.cursorTimer); }

  stepDef(i = this.state.step) { return this.pack.show[i] || this.pack.show[0]; }
  ctx() {
    return makeCtx({
      role: 'host', code: this.code, pack: this.pack, state: this.state, players: this.players,
      extra: { set: (s) => { this.state.s = s; this.mark(); }, award: (a) => this.award(a), rt: this },
    });
  }

  // ---------- incoming ----------
  ingest(d) {
    this.players = d.players;
    for (const ev of d.fresh) {
      if (ev.id > this.state.cursor) { this.state.cursor = ev.id; this.cursorMoved = true; }
      try { this.handle(ev); } catch (e) { console.error('event failed', ev, e); }
    }
    this.onChange();
  }

  handle(ev) {
    const p = this.players.find(x => x.id === ev.p);
    if (!p || p.kicked) return;
    switch (ev.k) {
      case 'react': this.reacts[ev.p] = (this.reacts[ev.p] || 0) + 1; return;
      case 'dj-req': case 'dj-vote': case 'dj-boost': case 'dj-skip': return dj.onEvent(this, ev, p);
      case 'pop': return popups.onEvent(this, ev, p);
    }
    if (ev.d && ev.d.run === this.state.run && this.station && this.station.onEvent) {
      const r = this.station.onEvent(this.state.s, ev, this.ctx());
      if (!this.state.acted[ev.p]) { this.state.acted[ev.p] = 1; this.mark(); }
      if (r) { this.state.s = r; this.mark(); }
    }
  }

  tick() {
    if (!this.station) return;
    if (this.station.tick) {
      const r = this.station.tick(this.state.s, this.ctx());
      if (r) { this.state.s = r; this.mark(); }
    }
    popups.tick(this);
    dj.hostTick(this);
  }

  // ---------- run of show ----------
  async goto(i) {
    i = Math.max(0, Math.min(i, this.pack.show.length - 1));
    const def = this.pack.show[i];
    this.station = await loadStation(def.station);
    this.state.step = i;
    this.state.run = uid();
    this.state.acted = {};
    this.state.q = def.questions || null; // only the current round's questions go to the phones
    this.state.s = {};
    this.state.s = this.station.setup(this.ctx()) || {};
    this.mark();
  }

  async next() {
    const r = this.station.next ? this.station.next(this.state.s, this.ctx()) : null;
    if (r) { this.state.s = r; this.mark(); return; }
    this.finishStep();
    if (this.state.step + 1 < this.pack.show.length) await this.goto(this.state.step + 1);
    else this.mark();
  }

  finishStep() {
    const def = this.stepDef();
    const ctx = this.ctx();
    const awards = (this.station.finish && this.station.finish(this.state.s, ctx)) || [];
    if (def.stamp) {
      const already = new Set(this.state.stamped[def.stamp.id] || []);
      const ids = (def.stamp.all ? ctx.present.map(p => p.id) : Object.keys(this.state.acted)).filter(id => !already.has(id));
      for (const id of ids) awards.push({ id, stamp: def.stamp.id, coins: def.stamp.coins ?? 10 });
      this.state.stamped[def.stamp.id] = [...already, ...ids];
    }
    this.state.done[this.state.step] = true;
    this.award(awards);
  }

  restart() { return this.goto(this.state.step); }

  announce(text) {
    this.state.announce = text ? { text: String(text).slice(0, 160), at: now(), id: uid() } : null;
    this.mark();
  }

  async kick(id) {
    try { await db.hostKick(this.code, this.token, id); } catch (e) { this.onError(e); }
  }

  // ---------- outgoing ----------
  mark() {
    this.dirty = true;
    this.onChange();
    clearTimeout(this.saveT);
    this.saveT = setTimeout(() => this.save(), 60);
  }
  async save() {
    if (this.saving) { this.again = true; return; }
    this.saving = true; this.dirty = false;
    try { await db.hostSetState(this.code, this.token, { ...this.state, show: stripQuestions(this.state.show) }); }
    catch (e) { this.dirty = true; this.onError(e); }
    this.saving = false;
    if (this.again || this.dirty) { this.again = false; setTimeout(() => this.save(), 400); }
  }

  award(list) {
    list = (list || []).filter(a => a && a.id);
    if (!list.length) return;
    // optimistic local update so the host panel is instant
    for (const a of list) {
      const p = this.players.find(x => x.id === a.id); if (!p) continue;
      p.score = Math.max(0, p.score + (a.points | 0)); p.coins = Math.max(0, p.coins + (a.coins | 0));
      if (a.stamp && !p.stamps.includes(a.stamp)) p.stamps = [...p.stamps, a.stamp];
      p.stats = { ...p.stats }; for (const [k, v] of Object.entries(a.stats || {})) p.stats[k] = (p.stats[k] || 0) + v;
    }
    this.pending.push(...list);
    clearTimeout(this.awardT);
    this.awardT = setTimeout(() => this.flushAwards(), 120);
  }
  async flushAwards() {
    const batch = this.pending.splice(0);
    if (!batch.length) return;
    try { await db.hostAward(this.code, this.token, batch); }
    catch (e) { this.pending.unshift(...batch); this.onError(e); setTimeout(() => this.flushAwards(), 1500); }
  }

  flushReacts() {
    const list = [];
    for (const [id, n] of Object.entries(this.reacts)) {
      const before = this.reactCoins[id] || 0;
      const earned = Math.min(30, Math.floor(((this.reactTotals?.[id] || 0) + n) / 10)) - before;
      this.reactTotals = this.reactTotals || {};
      this.reactTotals[id] = (this.reactTotals[id] || 0) + n;
      this.reactCoins[id] = before + Math.max(0, earned);
      list.push({ id, coins: Math.max(0, earned), stats: { reacts: n } });
    }
    this.reacts = {};
    this.award(list);
  }
}

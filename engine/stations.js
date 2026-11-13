// Station registry. A "station" is any step in the run of show: built-in features
// (lobby, quiz, movie, breakroom, honors, closing) and game plug-ins from /games share one contract.
//
//   setup(ctx) -> state        next(s, ctx) -> state|null     nextLabel(s, ctx)
//   tick(s, ctx)               onEvent(s, ev, ctx)            finish(s, ctx) -> awards[]
//   place(p, i, n, ctx, room)  where each block guy stands on the projector floor
//   onScreenEvents(events, ctx) projector-only reactions to raw events
//   chat: true                 phones get a "say something" box here
//   views: { screen(el, ctx), player(el, ctx), host(el, ctx), teardown?() }
import { now } from './store.js';
import { fx } from './fx.js';
import { present } from './ui.js';

const builtins = {
  lobby: () => import('../features/lobby.js'),
  quiz: () => import('../features/quiz.js'),
  movie: () => import('../features/movie.js'),
  breakroom: () => import('../features/breakroom.js'),
  honors: () => import('../features/honors.js'),
  closing: () => import('../features/closing.js'),
};
const cache = new Map();

export function loadStation(id) {
  if (!cache.has(id)) {
    const loader = builtins[id] || (() => import(`../games/${id}.js`));
    cache.set(id, loader().then(m => m.default));
  }
  return cache.get(id);
}

// Everything a station can see. Host adds set/award; players add send/me.
export function makeCtx({ role, pack, state, players, me = null, code = '', extra = {} }) {
  const step = (pack.show || [])[state.step] || { station: 'lobby' };
  const live = players.filter(p => !p.kicked);
  return {
    role, pack, step, state, code,
    s: state.s || {},
    run: state.run,
    content: pack.data[step.content || step.station] || {},
    labels: pack.labels || {},
    players: live,
    present: present(live),
    me,
    now,
    fx,
    ...extra,
  };
}

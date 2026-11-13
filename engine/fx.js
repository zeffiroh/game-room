// Beeps, buzzes, haptics and a message box. Nothing flashy.
import { prefs } from './store.js';

let ctx = null;
export const sound = {
  get muted() { return prefs.get('mute', false); },
  set muted(v) { prefs.set('mute', !!v); },
  unlock() { try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); } catch {} },
  play(name) {
    if (this.muted) return;
    try { this.unlock(); } catch {}
    if (!ctx) return;
    const seq = {
      tap:     [[660, 0, .05, 'square', .06]],
      coin:    [[988, 0, .07, 'square', .06], [1319, .07, .16, 'square', .06]],
      stamp:   [[180, 0, .1, 'square', .1], [120, .06, .16, 'square', .08]],
      correct: [[523, 0, .09, 'square', .07], [659, .09, .09, 'square', .07], [784, .18, .2, 'square', .07]],
      gentle:  [[220, 0, .14, 'square', .06], [165, .14, .24, 'square', .06]],
      pop:     [[880, 0, .06, 'square', .05], [1175, .05, .08, 'square', .05]],
      tick:    [[1200, 0, .03, 'square', .03]],
      reveal:  [[262, 0, .1, 'square', .07], [330, .1, .1, 'square', .07], [392, .2, .1, 'square', .07], [523, .3, .35, 'square', .07]],
      fanfare: [[392, 0, .12, 'square', .06], [523, .12, .12, 'square', .06], [659, .24, .12, 'square', .06], [784, .36, .45, 'square', .07]],
      bonk:    [[300, 0, .05, 'triangle', .2], [200, .04, .08, 'triangle', .15]],
      point:   [[440, 0, .08, 'square', .06], [330, .08, .08, 'square', .06], [440, .16, .2, 'square', .06]],
    }[name] || [];
    const t0 = ctx.currentTime + 0.01;
    for (const [f, at, dur, type, vol] of seq) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(0, t0 + at);
      g.gain.linearRampToValueAtTime(vol, t0 + at + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + at + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t0 + at); o.stop(t0 + at + dur + 0.05);
    }
  },
};
window.addEventListener('pointerdown', () => sound.unlock(), { once: true });

export function haptic(pattern = 15) { try { navigator.vibrate && navigator.vibrate(pattern); } catch {} }

const layer = () => document.getElementById('fx-layer');

// "+5" floats up from an element, like a score popup in an old arcade game
export function floatText(text, { x = innerWidth / 2, y = innerHeight / 2, cls = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'float-text ' + cls; el.textContent = text;
  el.style.left = x + 'px'; el.style.top = y + 'px';
  layer().appendChild(el);
  setTimeout(() => el.remove(), 1500);
}
export function coinPop(n, anchor) {
  const r = anchor ? anchor.getBoundingClientRect() : { left: innerWidth / 2, top: 60, width: 0 };
  floatText(`${n > 0 ? '+' : ''}${n} coins`, { x: r.left + r.width / 2, y: r.top + 10 });
  sound.play('coin'); haptic([10, 30, 10]);
}
// kept so older call sites keep working; these no longer do anything flashy
export const confetti = () => {};
export const emojiBurst = () => {};
export const coinRain = () => { sound.play('fanfare'); };

let toastTimer;
export function toast(text, ms = 3200) {
  let el = document.getElementById('toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = text; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

export const fx = { sound, haptic, confetti, floatText, coinPop, emojiBurst, coinRain, toast };

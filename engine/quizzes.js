// The quiz interface. One format for everything (see quizzes/FORMAT.md):
// built-in packs in quizzes/, packs a teacher uploads (kept in this browser), and rounds dropped into a party.
import { prefs } from './store.js';
import { isIcon } from './icons.js';

const MY_KEY = 'myQuizzes';
const cache = new Map();

// ---------- loading ----------
export async function builtinIds() {
  const r = await fetch('quizzes/index.json', { cache: 'no-cache' });
  return (await r.json()).packs;
}
export const myPacks = () => prefs.get(MY_KEY, []);

export async function listQuizPacks() {
  const ids = await builtinIds();
  const built = (await Promise.all(ids.map(id => loadQuizPack(id).catch(() => null)))).filter(Boolean);
  return { built, mine: myPacks() };
}

export async function loadQuizPack(id) {
  const mine = myPacks().find(p => p.id === id);
  if (mine) return mine;
  if (!cache.has(id)) {
    cache.set(id, fetch(`quizzes/${encodeURIComponent(id)}.json`, { cache: 'no-cache' })
      .then(r => { if (!r.ok) throw new Error('Quiz not found'); return r.json(); })
      .then(raw => ({ ...normalizePack(raw).pack, builtin: true })));
  }
  return cache.get(id);
}

export function saveMine(pack) {
  const list = myPacks().filter(p => p.id !== pack.id);
  list.unshift({ ...pack, mine: true, added: Date.now() });
  prefs.set(MY_KEY, list);
}
export const deleteMine = (id) => prefs.set(MY_KEY, myPacks().filter(p => p.id !== id));

// ---------- validating ----------
const LETTERS = 'ABCD';
const str = (v, n = 600) => String(v ?? '').trim().slice(0, n);
const slug = (s) => str(s, 60).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'quiz';

function normQuestion(raw, where) {
  if (!raw || typeof raw !== 'object') throw new Error(`${where}: not a question`);
  const q = str(raw.q ?? raw.question ?? raw.prompt);
  if (!q) throw new Error(`${where}: the question text is empty`);
  const choices = (raw.choices ?? raw.options ?? raw.answers ?? []).map(c => str(c, 200)).filter(Boolean);
  if (choices.length < 2 || choices.length > 4) throw new Error(`${where}: needs 2 to 4 choices (has ${choices.length})`);
  let a = raw.answer ?? raw.correct;
  if (typeof a === 'string') {
    const t = a.trim();
    if (/^[A-Da-d]$/.test(t)) a = LETTERS.indexOf(t.toUpperCase());
    else if (/^\d$/.test(t)) a = +t;
    else a = choices.findIndex(c => c.toLowerCase() === t.toLowerCase());
  }
  if (!Number.isInteger(a) || a < 0 || a >= choices.length) throw new Error(`${where}: "answer" must be A-D or 0-3`);
  const out = { q, choices, answer: a, why: str(raw.why ?? raw.explanation) };
  const scene = str(raw.scene ?? raw.setup); if (scene) out.scene = scene;
  const sec = +raw.seconds; if (sec) out.seconds = Math.max(10, Math.min(120, Math.round(sec)));
  if (raw.boss === true || raw.boss === 'true') out.boss = true;
  return out;
}

function normRound(raw, i) {
  const qs = Array.isArray(raw) ? raw : raw.questions;
  if (!Array.isArray(qs) || !qs.length) throw new Error(`Round ${i + 1} has no questions`);
  const title = str(raw.title, 80) || `Round ${i + 1}`;
  return {
    id: slug(raw.id || title || 'r' + (i + 1)) + (raw.id ? '' : '-' + (i + 1)),
    title, intro: str(raw.intro, 300),
    questions: qs.map((q, j) => normQuestion(q, `${title}, question ${j + 1}`)),
  };
}

// Accepts a whole pack, one round, or a bare list of questions. Returns { pack, count }.
export function normalizePack(raw, fallbackTitle = 'My quiz') {
  if (Array.isArray(raw)) raw = { title: fallbackTitle, rounds: [{ title: 'Round 1', questions: raw }] };
  else if (raw && Array.isArray(raw.questions) && !raw.rounds) raw = { title: raw.title || fallbackTitle, rounds: [raw] };
  if (!raw || !Array.isArray(raw.rounds) || !raw.rounds.length) throw new Error('No rounds or questions found');
  const title = str(raw.title, 60) || fallbackTitle;
  const rounds = raw.rounds.map(normRound);
  const pack = {
    id: slug(raw.id || title), title,
    subject: str(raw.subject, 40), blurb: str(raw.blurb, 200), level: str(raw.level, 40),
    icon: isIcon(raw.icon) ? raw.icon : 'scroll', rounds,
  };
  return { pack, count: rounds.reduce((n, r) => n + r.questions.length, 0) };
}

// ---------- CSV ----------
function csvRows(text) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === ',' || c === '\t') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim()));
}

function fromCsv(text, title) {
  const rows = csvRows(text);
  if (rows.length < 2) throw new Error('The CSV needs a header row and at least one question');
  const head = rows[0].map(h => h.trim().toLowerCase());
  const col = (...names) => head.findIndex(h => names.includes(h));
  const ci = { q: col('question', 'q'), a: col('a', 'choice a', 'option a'), b: col('b', 'choice b', 'option b'), c: col('c', 'choice c', 'option c'), d: col('d', 'choice d', 'option d'),
    ans: col('answer', 'correct'), why: col('why', 'explanation'), sec: col('seconds', 'time'), scene: col('scene', 'setup'), round: col('round') };
  if (ci.q < 0 || ci.a < 0 || ci.b < 0 || ci.ans < 0) throw new Error('CSV header must include: question, a, b, answer (c, d, why, seconds, scene, round are optional)');
  const rounds = new Map();
  rows.slice(1).forEach((r, i) => {
    const get = (k) => ci[k] >= 0 ? (r[ci[k]] || '').trim() : '';
    const key = ci.round >= 0 ? (get('round') || 'Round 1') : `Round ${Math.floor(i / 10) + 1}`;
    if (!rounds.has(key)) rounds.set(key, []);
    rounds.get(key).push({ q: get('q'), choices: [get('a'), get('b'), get('c'), get('d')].filter(Boolean), answer: get('ans'), why: get('why'), seconds: get('sec'), scene: get('scene') });
  });
  return { title, rounds: [...rounds].map(([t, questions]) => ({ title: t, questions })) };
}

// Text from a file or the paste box -> { pack, count }. Throws a readable Error.
export function parseQuizText(text, filename = '') {
  const title = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'My quiz';
  const t = String(text || '').replace(/^﻿/, '').trim();
  if (!t) throw new Error('That file is empty');
  if (t[0] === '{' || t[0] === '[') {
    let raw; try { raw = JSON.parse(t); } catch (e) { throw new Error('That JSON has a typo: ' + e.message); }
    return normalizePack(raw, title);
  }
  return normalizePack(fromCsv(t, title), title);
}

// ---------- the party ----------
// A quiz round as a step in the run of show. The questions travel inside the step,
// so uploaded quizzes work on every phone and the projector without anything to fetch.
export function roundStep(pack, round) {
  return {
    station: 'quiz', quiz: pack.id, round: round.id,
    title: round.title.startsWith(pack.title) ? round.title : `${pack.title}: ${round.title}`,
    intro: round.intro, questions: round.questions,
    stamp: { id: `q-${pack.id}-${round.id}`.slice(0, 40), name: round.title.slice(0, 30), line: 'Round done.' },
  };
}

// Fill in questions for steps that only name a quiz ("quiz": "ap-bio-fun-day", "round": "round1").
export async function resolveShow(show) {
  return Promise.all(show.map(async (s) => {
    if (s.station !== 'quiz' || s.questions || !s.quiz) return s;
    try {
      const p = await loadQuizPack(s.quiz);
      const r = p.rounds.find(x => x.id === s.round) || p.rounds[0];
      return { ...roundStep(p, r), ...s, questions: r.questions };
    } catch { return s; }
  }));
}

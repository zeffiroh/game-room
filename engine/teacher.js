// Teacher access. A teacher types their code once; this browser remembers it.
// The code is turned into a SHA-256 fingerprint ("gameroom:" + code with only letters/digits, upper case)
// and compared to config.js (TEACHER_LOCK = 'config') or checked by Neon (TEACHER_LOCK = 'neon').
import { TEACHER_LOCK, TEACHER_CODES, OWNER_CODE } from '../config.js';
import { db, MODE } from './db.js';
import { prefs } from './store.js';

export const normalize = (code) => String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function fingerprint(code) {
  const bytes = new TextEncoder().encode('gameroom:' + normalize(code));
  const buf = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Which lock is actually in force. 'neon' only applies when there is a database to ask.
export const lockMode = () => (TEACHER_LOCK === 'neon' && MODE !== 'neon') ? 'config' : (TEACHER_LOCK || 'config');

export async function isOwner(code) {
  const n = normalize(code);
  return n.length >= 8 && !!OWNER_CODE && (await fingerprint(n)) === OWNER_CODE.trim().toLowerCase();
}

export async function checkCode(code) {
  const n = normalize(code);
  if (n.length < 8) return false;
  const mode = lockMode();
  if (mode === 'off') return true;
  if (mode === 'config' && await isOwner(n)) return true;
  if (mode === 'neon') { try { return !!(await db.checkTeacher(n)); } catch { return false; } }
  const fp = await fingerprint(n);
  return TEACHER_CODES.map(s => String(s).trim().toLowerCase()).includes(fp);
}

export const teacher = {
  code: () => prefs.get('teacherCode', ''),
  async unlock(code) { const ok = await checkCode(code); if (ok) prefs.set('teacherCode', normalize(code)); return ok; },
  forget: () => prefs.set('teacherCode', ''),
  // Re-check the remembered code (a revoked code stops working next visit).
  async isUnlocked() {
    if (lockMode() === 'off') return true;
    const c = teacher.code(); if (!c) return false;
    const ok = await checkCode(c); if (!ok) teacher.forget();
    return ok;
  },
};

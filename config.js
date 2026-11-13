// Game Room settings.

// Neon connection for the public party_client role (empty = everything stays in one browser).
export const NEON_URL = 'postgresql://party_client:Mukumouli-2026-Party!@ep-tiny-bread-behampue-pooler.c-9.us-east-2.aws.neon.tech/neondb?sslmode=require';

// How often each device checks for updates (milliseconds).
export const POLL_MS = 1500;

// Who may host a room: 'config' (codes below), 'neon' (codes in the database), or 'off'.
export const TEACHER_LOCK = 'config';

// Owner code fingerprint. Unlocks hosting and the hidden #/admin page.
export const OWNER_CODE = 'dca54d4110e2fe07025800469999f51afd1989a0eacabf617a40507781d9f34a';

// Teacher code fingerprints (SHA-256). These are not the codes themselves.
export const TEACHER_CODES = [
];

// Footer donate button. '' = button shows but goes nowhere.
export const DONATE_URL = '';

// Footer credits.
export const CREDITS = {
  name: 'Mitali Aayat Mahnoor',
  site: 'https://zeffiroh.github.io',
  siteLabel: 'zeffiroh.github.io',
};

// "Get lifetime teacher access" link on the locked Host screen (Razorpay payment page). '' = hidden.
export const BUY_URL = '';

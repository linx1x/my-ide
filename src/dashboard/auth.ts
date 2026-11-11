/**
 * Dashboard auth: OTP via WhatsApp, JWT sessions.
 * Only numbers in ALLOWED_NUMBERS can verify.
 */
import { randomInt, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import config from '../config.js';
import { getAuthDb } from './auth-db.js';

type OtpEntry = { code: string; expiresAt: number; attempts: number };
type RevokedRow = { jti: string; expires_at: number };
type SocketLike = {
  authState?: { creds?: { me?: { id?: string } } };
  sendMessage: (jid: string, content: { text: string }) => Promise<unknown>;
};

const otpStore = new Map<string, OtpEntry>(); // phone -> { code, expiresAt, attempts }
const OTP_TTL_MS = 5 * 60 * 1000; // 5 min
const OTP_LENGTH = 6;
const MAX_VERIFY_ATTEMPTS = 5;
const JWT_EXPIRY = '12h';
const JWT_EXPIRY_MS = 12 * 60 * 60 * 1000;
const RATE_LIMIT_MS = 60 * 1000; // 1 min between OTP requests per phone
const lastOtpRequest = new Map<string, number>();
// Global OTP rate limit: prevent enumeration of ALLOWED_NUMBERS across many phones
const GLOBAL_OTP_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const GLOBAL_OTP_MAX = 100;
const globalOtpLog: number[] = []; // timestamps of recent OTP requests

// In-memory cache of revoked JTIs (backed by SQLite so it survives restarts)
const revokedJtis = new Map<string, number>(); // jti -> expiresAt
let revokedJtisLoaded = false;

function loadRevokedJtis(): void {
  if (revokedJtisLoaded) {return;}
  try {
    const db = getAuthDb();
    const rows = db.prepare('SELECT jti, expires_at FROM revoked_tokens WHERE expires_at > ?').all(Date.now()) as RevokedRow[];
    for (const row of rows) {revokedJtis.set(row.jti, row.expires_at);}
  } catch { /* db not ready yet */ }
  revokedJtisLoaded = true;
}

function cleanupRevokedJtis(): void {
  const now = Date.now();
  for (const [jti, expiresAt] of revokedJtis) {
    if (expiresAt <= now) {revokedJtis.delete(jti);}
  }
  // Periodic SQLite cleanup (best-effort)
  try {
    getAuthDb().prepare('DELETE FROM revoked_tokens WHERE expires_at <= ?').run(now);
  } catch { /* ignore */ }
}

function normalizePhone(phone: string): string {
  return String(phone).replace(/[\s+]/g, '').trim();
}

function isAllowedNumber(phone: string): boolean {
  const norm = normalizePhone(phone);
  const list = config?.allowedNumbers;
  if (!Array.isArray(list)) {return false;}
  return list.some((n) => n === norm);
}

function generateOTP(): string {
  return String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, '0');
}

/**
 * Request OTP — sends code via WhatsApp if number is allowed.
 * @param {string} phone - User phone (e.g. 33612345678)
 * @param {object} sock - Baileys socket to send via WhatsApp
 * @returns {{ ok: boolean, error?: string }}
 */
// Generic message used regardless of whether number is allowed (prevents enumeration)
const OTP_GENERIC_RESPONSE = { ok: true, message: 'If that number is authorized, a code has been sent via WhatsApp.' };

export async function requestOTP(phone: string, sock: SocketLike | null | undefined | unknown): Promise<{ ok: boolean; error?: string; message?: string }> {
  try {
    const norm = normalizePhone(phone);
    if (!norm) {return { ok: false, error: 'Invalid phone number' };}

    // Global rate limit: prevents enumeration across many phone numbers
    const now = Date.now();
    const windowStart = now - GLOBAL_OTP_WINDOW_MS;
    while (globalOtpLog.length > 0 && (globalOtpLog[0] ?? Number.POSITIVE_INFINITY) < windowStart) {globalOtpLog.shift();}
    if (globalOtpLog.length >= GLOBAL_OTP_MAX) {
      return { ok: false, error: 'Too many code requests. Try again later.' };
    }
    globalOtpLog.push(now);

    // Per-phone rate limit (same generic response to avoid timing oracle)
    const lastReq = lastOtpRequest.get(norm);
    if (lastReq && now - lastReq < RATE_LIMIT_MS) {
      return OTP_GENERIC_RESPONSE;
    }

    // Return generic response immediately if number not allowed (no timing difference)
    if (!isAllowedNumber(norm)) {return OTP_GENERIC_RESPONSE;}

    if (!sock) {return { ok: false, error: 'WhatsApp not connected. Start My IDE with WhatsApp enabled.' };}
    // Baileys sendMessage uses authState.creds.me.id; avoid "Cannot read properties of undefined (reading 'id')" when not ready
    const meId = (sock as SocketLike).authState?.creds?.me?.id;
    if (!meId) {
      return { ok: false, error: 'WhatsApp session not ready yet. Wait a few seconds after “WhatsApp connected” (or scan the QR if you just linked), then try again.' };
    }

    lastOtpRequest.set(norm, now);

    const code = generateOTP();
    otpStore.set(norm, { code, expiresAt: now + OTP_TTL_MS, attempts: 0 });

    const jid = `${norm}@s.whatsapp.net`;
    const msg = `Your My IDE dashboard code: ${code}\n\nValid for 5 minutes. Do not share this code.`;

    await (sock as SocketLike).sendMessage(jid, { text: msg });
    return OTP_GENERIC_RESPONSE;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[Dashboard] requestOTP error:', message);
    const norm = normalizePhone(phone);
    if (norm) {
      otpStore.delete(norm);
      lastOtpRequest.delete(norm);
    }
    const msg = message ?? '';
    // Modern: "Cannot read properties of undefined (reading 'id')"; legacy: "Cannot read property 'id' of undefined"
    const isSessionNotReady =
      /reading 'id'/.test(msg) || /property 'id' of undefined/.test(msg) || (/'id'/.test(msg) && /undefined/.test(msg));
    const friendly = isSessionNotReady
      ? 'WhatsApp session not ready. Wait a few seconds after “WhatsApp connected” and try again.'
      : msg || 'Failed to send code. Check server logs.';
    return { ok: false, error: friendly };
  }
}

/**
 * Verify OTP and return JWT token.
 * @param {string} phone
 * @param {string} code
 * @returns {{ ok: boolean, token?: string, error?: string }}
 */
export function verifyOTP(phone: string, code: string): { ok: boolean; token?: string; error?: string } {
  const norm = normalizePhone(phone);
  const entry = otpStore.get(norm);
  if (!entry) {return { ok: false, error: 'Code expired or invalid. Request a new one.' };}
  if (entry.expiresAt < Date.now()) {
    otpStore.delete(norm);
    return { ok: false, error: 'Code expired. Request a new one.' };
  }
  entry.attempts++;
  if (entry.attempts > MAX_VERIFY_ATTEMPTS) {
    otpStore.delete(norm);
    return { ok: false, error: 'Too many attempts. Request a new code.' };
  }
  if (entry.code !== String(code).trim()) {
    const remaining = MAX_VERIFY_ATTEMPTS - entry.attempts;
    return { ok: false, error: `Invalid code. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.` };
  }
  otpStore.delete(norm);

  const token = jwt.sign({ sub: norm, type: 'dashboard', jti: randomUUID() }, config.dashboardSecret, {
    expiresIn: JWT_EXPIRY,
  });
  return { ok: true, token };
}

/**
 * Revoke an issued JWT by blacklisting its jti until natural expiry.
 * @param {string} token
 * @returns {{ ok: boolean }}
 */
export function revokeToken(token: string | undefined): { ok: boolean } {
  if (!token) {return { ok: false };}
  try {
    const decoded = jwt.decode(token);
    if (!decoded || typeof decoded !== 'object' || !decoded.jti) {return { ok: false };}
    const expiresAt = typeof decoded.exp === 'number' ? decoded.exp * 1000 : Date.now() + JWT_EXPIRY_MS;
    revokedJtis.set(decoded.jti, expiresAt);
    // Persist to SQLite so revocation survives restarts
    try {
      getAuthDb().prepare(
        'INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)'
      ).run(decoded.jti, expiresAt);
    } catch { /* best-effort */ }
    cleanupRevokedJtis();
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

/**
 * Verify JWT from cookie or Authorization header.
 * @param {string} token
 * @returns {{ ok: boolean, phone?: string, error?: string }}
 */
export function verifyToken(token: string | undefined): { ok: boolean; phone?: string; error?: string } {
  if (!token) {return { ok: false, error: 'No token' };}
  try {
    loadRevokedJtis();
    cleanupRevokedJtis();
    const decoded = jwt.verify(token, config.dashboardSecret);
    if (typeof decoded === 'string') {return { ok: false, error: 'Invalid token' };}
    const payload = decoded as JwtPayload & { type?: string; sub?: string; jti?: string };
    if (payload.type !== 'dashboard' || !payload.sub || !payload.jti) {return { ok: false, error: 'Invalid token' };}
    if (revokedJtis.has(payload.jti)) {return { ok: false, error: 'Token revoked' };}
    return { ok: true, phone: payload.sub };
  } catch {
    return { ok: false, error: 'Token expired or invalid' };
  }
}

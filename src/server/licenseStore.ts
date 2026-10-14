import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ActivationCode, UserPlan } from '../types';
import {
  getAllLicensesDb,
  insertLicenseDb,
  deleteLicenseDb,
  redeemLicenseDb,
  getAuthoritativeQuotaDb,
  consumeAuthoritativeQuotaDb,
} from '../db/licenses.ts';

export const FREE_SEARCH_LIMIT = 10;
const TOKEN_SECRET = process.env.TOKEN_SECRET || crypto.randomBytes(32).toString('hex');
const ADMIN_PIN = process.env.ADMIN_PIN || 'chahin36';

function isSqlConfigured(): boolean {
  return Boolean(
    process.env.SQL_HOST &&
      process.env.SQL_USER &&
      process.env.SQL_PASSWORD &&
      process.env.SQL_DB_NAME
  );
}

// Persistent storage path for local node runtime
const DATA_DIR = path.join(process.cwd(), '.data');
const LICENSES_FILE = path.join(DATA_DIR, 'licenses.json');
const QUOTAS_FILE = path.join(DATA_DIR, 'quotas.json');

// Memory caches
let activationCodes: ActivationCode[] = [];
let emailQuotas: Record<string, number> = {};
let ipQuotas: Record<string, number> = {};
const adminSessions = new Map<string, number>(); // token -> expiresAtMs

// Ensure data directory exists
function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[LicenseStore] Could not create data directory:', err);
  }
}

// Load persisted licenses
export function loadPersistedState() {
  ensureDataDir();
  try {
    if (fs.existsSync(LICENSES_FILE)) {
      const raw = fs.readFileSync(LICENSES_FILE, 'utf-8');
      activationCodes = JSON.parse(raw);
    } else {
      activationCodes = [
        {
          code: 'OMNI-PRO-2026-VIP1',
          tier: 'pro',
          duration: '1_month',
          createdAt: Date.now() - 3600000,
          isUsed: false,
          note: 'Seed Pro 1-Month Code',
        },
        {
          code: 'OMNI-ENT-7104-VIP2',
          tier: 'enterprise',
          duration: '1_year',
          createdAt: Date.now() - 1800000,
          isUsed: false,
          note: 'Seed Enterprise 1-Year Code',
        },
      ];
      savePersistedLicenses();
    }
  } catch (err) {
    console.warn('[LicenseStore] Error loading licenses:', err);
  }

  try {
    if (fs.existsSync(QUOTAS_FILE)) {
      const raw = fs.readFileSync(QUOTAS_FILE, 'utf-8');
      emailQuotas = JSON.parse(raw);
    }
  } catch (err) {
    console.warn('[LicenseStore] Error loading quotas:', err);
  }
}

function savePersistedLicenses() {
  try {
    ensureDataDir();
    fs.writeFileSync(LICENSES_FILE, JSON.stringify(activationCodes, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[LicenseStore] Could not persist licenses:', err);
  }
}

function savePersistedQuotas() {
  try {
    ensureDataDir();
    fs.writeFileSync(QUOTAS_FILE, JSON.stringify(emailQuotas, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[LicenseStore] Could not persist quotas:', err);
  }
}

// Initial load
loadPersistedState();

// HMAC Token generation & verification
export function createSignedUserToken(
  dataOrEmail:
    | {
        email: string;
        tier: 'free' | 'pro' | 'enterprise';
        expiresAt?: number;
        licenseCode?: string;
      }
    | string,
  tier?: 'free' | 'pro' | 'enterprise',
  durationDays?: number
): string {
  let data: {
    email: string;
    tier: 'free' | 'pro' | 'enterprise';
    expiresAt?: number;
    licenseCode?: string;
  };

  if (typeof dataOrEmail === 'string') {
    const t = tier || 'pro';
    const expiresAt = durationDays ? Date.now() + durationDays * 24 * 60 * 60 * 1000 : undefined;
    data = { email: dataOrEmail, tier: t, expiresAt };
  } else {
    data = dataOrEmail;
  }

  const payload = JSON.stringify({ ...data, issuedAt: Date.now() });
  const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
  return Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url');
}

export function verifySignedUserToken(token: string): {
  valid: boolean;
  user?: { email: string; tier: 'free' | 'pro' | 'enterprise'; expiresAt?: number; licenseCode?: string };
} {
  if (!token || typeof token !== 'string') return { valid: false };

  try {
    const raw = Buffer.from(token, 'base64url').toString('utf-8');
    const { payload, hmac } = JSON.parse(raw);
    const expected = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');

    if (crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) {
      const parsed = JSON.parse(payload);
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        return { valid: false };
      }
      return { valid: true, user: parsed };
    }
  } catch {
    // Malformed token
  }
  return { valid: false };
}

// Admin PIN Verification & Session Management
const pinAttempts = new Map<string, { count: number; firstAttempt: number }>();

export function verifyAdminPin(pin: string, clientIp: string): { success: boolean; token?: string; error?: string } {
  // Rate limiting against brute-forcing
  const now = Date.now();
  const attempt = pinAttempts.get(clientIp) || { count: 0, firstAttempt: now };

  if (now - attempt.firstAttempt < 60000 && attempt.count >= 5) {
    return { success: false, error: 'Too many attempts. Please try again after 1 minute.' };
  }

  if (now - attempt.firstAttempt >= 60000) {
    attempt.count = 0;
    attempt.firstAttempt = now;
  }

  attempt.count += 1;
  pinAttempts.set(clientIp, attempt);

  const cleanInput = (pin || '').trim();
  const cleanAdmin = ADMIN_PIN.trim();

  // Strict comparison against configured server secret ADMIN_PIN
  if (cleanInput && cleanInput === cleanAdmin) {
    // Successful login - reset attempts
    pinAttempts.delete(clientIp);
    const adminToken = crypto.randomBytes(32).toString('hex');
    adminSessions.set(adminToken, now + 2 * 60 * 60 * 1000); // 2 hours
    return { success: true, token: adminToken };
  }

  return { success: false, error: 'Invalid administrator PIN' };
}

export function verifyAdminSession(token?: string): boolean {
  if (!token) return false;
  const clean = token.replace(/^Bearer\s+/i, '').trim();
  const expires = adminSessions.get(clean);
  if (expires && Date.now() < expires) {
    return true;
  }
  if (expires) adminSessions.delete(clean);
  return false;
}

// License Management Operations
export function getAllLicenses(): ActivationCode[] {
  return [...activationCodes];
}

export function generateServerLicenseCode(
  tier: 'pro' | 'enterprise',
  duration: '1_month' | '3_months' | '1_year' | 'lifetime',
  note?: string
): ActivationCode {
  const prefix = tier === 'pro' ? 'OMNI-PRO' : 'OMNI-ENT';
  const seg1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const seg2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const codeString = `${prefix}-${seg1}-${seg2}`;

  const newCode: ActivationCode = {
    code: codeString,
    tier,
    duration,
    createdAt: Date.now(),
    isUsed: false,
    note: note?.trim() || undefined,
  };

  activationCodes.unshift(newCode);
  savePersistedLicenses();
  return newCode;
}

export function deleteServerLicenseCode(codeStr: string): boolean {
  const prevLen = activationCodes.length;
  activationCodes = activationCodes.filter((c) => c.code.toUpperCase() !== codeStr.toUpperCase());
  if (activationCodes.length !== prevLen) {
    savePersistedLicenses();
    return true;
  }
  return false;
}

export function redeemServerLicense(
  codeStr: string,
  userEmail: string
): { success: boolean; message: string; userPlan?: UserPlan; token?: string; tier?: 'pro' | 'enterprise' } {
  const normalized = (codeStr || '').trim().toUpperCase();
  const normalizedEmail = (userEmail || '').trim().toLowerCase();

  if (!normalized) {
    return { success: false, message: 'License code is required' };
  }
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return { success: false, message: 'Valid user email is required' };
  }

  const target = activationCodes.find((c) => c.code.toUpperCase() === normalized);
  if (!target) {
    return { success: false, message: 'License code not found or invalid' };
  }

  if (target.isUsed) {
    return {
      success: false,
      message: `This license code was already redeemed and cannot be reused or renewed.`,
    };
  }

  const now = Date.now();
  let durationMs = 30 * 24 * 60 * 60 * 1000;
  if (target.duration === '3_months') durationMs = 90 * 24 * 60 * 60 * 1000;
  if (target.duration === '1_year') durationMs = 365 * 24 * 60 * 60 * 1000;
  if (target.duration === 'lifetime') durationMs = 100 * 365 * 24 * 60 * 60 * 1000;

  const expiresAt = now + durationMs;

  target.isUsed = true;
  target.usedByEmail = normalizedEmail;
  target.usedAt = now;
  target.expiresAt = expiresAt;
  savePersistedLicenses();

  const token = createSignedUserToken({
    email: normalizedEmail,
    tier: target.tier,
    expiresAt,
    licenseCode: target.code,
  });

  const userPlan: UserPlan = {
    tier: target.tier,
    name: target.tier === 'enterprise' ? 'Enterprise VIP Plan' : 'Pro Research Plan',
    email: normalizedEmail,
    totalFreeLimit: FREE_SEARCH_LIMIT,
    usedSearches: 0,
    licenseKey: target.code,
    activatedAt: now,
    expiresAt,
    duration: target.duration,
  };

  return {
    success: true,
    message: 'License code activated successfully!',
    tier: target.tier,
    userPlan,
    token,
  };
}

// Server Quota Verification & Consumption
export function getAuthoritativeQuota(
  email?: string,
  ip?: string
): { used: number; total: number; isExhausted: boolean } {
  let used = 0;
  if (email && email.trim()) {
    const norm = email.trim().toLowerCase();
    used = emailQuotas[norm] || 0;
  } else if (ip) {
    used = ipQuotas[ip] || 0;
  }

  return {
    used,
    total: FREE_SEARCH_LIMIT,
    isExhausted: used >= FREE_SEARCH_LIMIT,
  };
}

export function consumeAuthoritativeQuota(
  email?: string,
  ip?: string
): { success: boolean; used: number; remaining: number } {
  let used = 0;
  if (email && email.trim()) {
    const norm = email.trim().toLowerCase();
    used = (emailQuotas[norm] || 0) + 1;
    emailQuotas[norm] = used;
    savePersistedQuotas();
  } else if (ip) {
    used = (ipQuotas[ip] || 0) + 1;
    ipQuotas[ip] = used;
  }

  const remaining = Math.max(0, FREE_SEARCH_LIMIT - used);
  return {
    success: used <= FREE_SEARCH_LIMIT,
    used,
    remaining,
  };
}

// ----------------------------------------------------
// Cloud SQL Persistent Database Operations (Durable across multi-instance restarts)
// ----------------------------------------------------

export async function getAllLicensesAsync(): Promise<ActivationCode[]> {
  if (isSqlConfigured()) {
    try {
      const rows = await getAllLicensesDb();
      return rows.map((r) => ({
        code: r.code,
        tier: r.tier as 'pro' | 'enterprise',
        duration: r.duration as '1_month' | '3_months' | '1_year' | 'lifetime',
        createdAt: r.createdAt ? r.createdAt.getTime() : Date.now(),
        isUsed: r.isUsed,
        usedByEmail: r.usedByEmail || undefined,
        usedAt: r.usedAt ? r.usedAt.getTime() : undefined,
        expiresAt: r.expiresAt ? r.expiresAt.getTime() : undefined,
        note: r.note || undefined,
      }));
    } catch (err) {
      console.warn('[LicenseStore] Falling back to memory licenses:', err);
    }
  }
  return getAllLicenses();
}

export async function generateServerLicenseCodeAsync(
  tier: 'pro' | 'enterprise',
  duration: '1_month' | '3_months' | '1_year' | 'lifetime',
  note?: string
): Promise<ActivationCode> {
  const local = generateServerLicenseCode(tier, duration, note);
  if (isSqlConfigured()) {
    try {
      await insertLicenseDb(local.code, tier, duration, note);
    } catch (err) {
      console.warn('[LicenseStore] Could not insert license in DB:', err);
    }
  }
  return local;
}

export async function deleteServerLicenseCodeAsync(codeStr: string): Promise<boolean> {
  const localDeleted = deleteServerLicenseCode(codeStr);
  if (isSqlConfigured()) {
    try {
      const dbDeleted = await deleteLicenseDb(codeStr);
      return dbDeleted || localDeleted;
    } catch (err) {
      console.warn('[LicenseStore] Could not delete license in DB:', err);
    }
  }
  return localDeleted;
}

export async function redeemServerLicenseAsync(
  codeStr: string,
  userEmail: string,
  userUid?: string
): Promise<{ success: boolean; message: string; userPlan?: UserPlan; token?: string; tier?: 'pro' | 'enterprise' }> {
  if (isSqlConfigured()) {
    try {
      const dbRes = await redeemLicenseDb(codeStr, userEmail, userUid);
      if (!dbRes.success) {
        return { success: false, message: dbRes.message || 'License code not found or invalid' };
      }

      const lic = dbRes.license!;
      const token = createSignedUserToken({
        email: userEmail.toLowerCase().trim(),
        tier: lic.tier as 'pro' | 'enterprise',
        expiresAt: dbRes.expiresAtMs,
        licenseCode: lic.code,
      });

      const userPlan: UserPlan = {
        tier: lic.tier as 'pro' | 'enterprise',
        name: lic.tier === 'enterprise' ? 'Enterprise VIP Plan' : 'Pro Research Plan',
        email: userEmail.toLowerCase().trim(),
        totalFreeLimit: FREE_SEARCH_LIMIT,
        usedSearches: 0,
        licenseKey: lic.code,
        activatedAt: Date.now(),
        expiresAt: dbRes.expiresAtMs,
        duration: lic.duration as any,
      };

      // Also mark local cache
      const cached = activationCodes.find((c) => c.code.toUpperCase() === codeStr.toUpperCase().trim());
      if (cached) {
        cached.isUsed = true;
        cached.usedByEmail = userEmail.toLowerCase().trim();
        cached.usedAt = Date.now();
        cached.expiresAt = dbRes.expiresAtMs;
        savePersistedLicenses();
      }

      return {
        success: true,
        message: 'License code activated successfully!',
        tier: lic.tier as 'pro' | 'enterprise',
        userPlan,
        token,
      };
    } catch (err) {
      console.warn('[LicenseStore] DB redeem failed, trying memory store:', err);
    }
  }

  return redeemServerLicense(codeStr, userEmail);
}

export async function getAuthoritativeQuotaAsync(
  email?: string,
  ip?: string
): Promise<{ used: number; total: number; isExhausted: boolean }> {
  if (isSqlConfigured()) {
    try {
      const identifier = email && email.trim() ? email.trim().toLowerCase() : ip || 'client';
      const identifierType = email && email.trim() ? 'email' : 'ip';
      return await getAuthoritativeQuotaDb(identifier, identifierType, FREE_SEARCH_LIMIT);
    } catch (err) {
      console.warn('[LicenseStore] DB quota check fallback to memory:', err);
    }
  }
  return getAuthoritativeQuota(email, ip);
}

export async function consumeAuthoritativeQuotaAsync(
  email?: string,
  ip?: string
): Promise<{ success: boolean; used: number; remaining: number }> {
  if (isSqlConfigured()) {
    try {
      const identifier = email && email.trim() ? email.trim().toLowerCase() : ip || 'client';
      const identifierType = email && email.trim() ? 'email' : 'ip';
      const res = await consumeAuthoritativeQuotaDb(identifier, identifierType, FREE_SEARCH_LIMIT);
      // Mirror to local memory as well
      consumeAuthoritativeQuota(email, ip);
      return res;
    } catch (err) {
      console.warn('[LicenseStore] DB quota consume fallback to memory:', err);
    }
  }
  return consumeAuthoritativeQuota(email, ip);
}


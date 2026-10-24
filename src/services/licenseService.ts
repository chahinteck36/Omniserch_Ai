import { ActivationCode, UserPlan } from '../types';
import { calculateExpirationDate, sendSubscriptionEmailNotification } from './emailService';
import { apiUrl } from './apiClient';

export const FREE_SEARCH_LIMIT = 10;
const USER_TOKEN_KEY = 'omnisearch_user_token';
const ADMIN_TOKEN_KEY = 'omnisearch_admin_session';
const LOCAL_CODES_STORAGE = 'omnisearch_activation_codes';

// In-memory admin session token
let activeAdminToken: string | null = null;

export function getAdminToken(): string | null {
  if (activeAdminToken) return activeAdminToken;
  try {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string | null) {
  activeAdminToken = token;
  try {
    if (token) {
      sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
    } else {
      sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    }
  } catch {}
}

export function getUserToken(): string | null {
  try {
    return localStorage.getItem(USER_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setUserToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(USER_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(USER_TOKEN_KEY);
    }
  } catch {}
}

/**
 * Verifies seller PIN through server-side protected authentication
 */
export async function verifySellerPinAsync(pin: string): Promise<{ success: boolean; error?: string }> {
  const clean = (pin || '').trim();
  if (!clean) return { success: false, error: 'PIN cannot be empty' };

  try {
    const res = await fetch(apiUrl('/api/admin/verify-pin'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: clean }),
    });

    const data = await res.json();
    if (res.ok && data.success && data.token) {
      setAdminToken(data.token);
      return { success: true };
    }
    return { success: false, error: data.error || 'Authentication failed' };
  } catch {
    return { success: false, error: 'Could not communicate with authentication server' };
  }
}

/**
 * Synchronous PIN verification fallback (Checks against server session)
 */
export function verifySellerPin(_pin: string): boolean {
  return Boolean(getAdminToken());
}

/**
 * Retrieves license codes from server (requires admin session)
 */
export async function fetchServerCodes(): Promise<ActivationCode[]> {
  const token = getAdminToken();
  if (!token) return getStoredCodes();

  try {
    const res = await fetch(apiUrl('/api/admin/codes'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.codes)) {
        saveCodes(data.codes);
        return data.codes;
      }
    }
  } catch (err) {
    console.warn('[LicenseService] Fetching server codes failed:', err);
  }

  return getStoredCodes();
}

/**
 * Get locally cached codes
 */
export function getStoredCodes(): ActivationCode[] {
  try {
    const raw = localStorage.getItem(LOCAL_CODES_STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveCodes(codes: ActivationCode[]) {
  try {
    localStorage.setItem(LOCAL_CODES_STORAGE, JSON.stringify(codes));
  } catch (err) {
    console.error('Failed to save activation codes:', err);
  }
}

/**
 * Generate a new license code via Server Admin API
 */
export async function generateLicenseCodeAsync(
  tier: 'pro' | 'enterprise',
  duration: '1_month' | '3_months' | '1_year' | 'lifetime',
  note?: string
): Promise<ActivationCode | null> {
  const token = getAdminToken();

  try {
    const res = await fetch(apiUrl('/api/admin/generate-code'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token || ''}`,
      },
      body: JSON.stringify({ tier, duration, note }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.code) {
        const current = getStoredCodes();
        saveCodes([data.code, ...current]);
        return data.code;
      }
    }
  } catch (err) {
    console.warn('[LicenseService] Server code generation failed:', err);
  }

  return generateLicenseCode(tier, duration, note);
}

/**
 * Local generator fallback
 */
export function generateLicenseCode(
  tier: 'pro' | 'enterprise',
  duration: '1_month' | '3_months' | '1_year' | 'lifetime',
  note?: string
): ActivationCode {
  const prefix = tier === 'pro' ? 'OMNI-PRO' : 'OMNI-ENT';
  const randomSegment1 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const randomSegment2 = Math.random().toString(36).substring(2, 6).toUpperCase();
  const codeString = `${prefix}-${randomSegment1}-${randomSegment2}`;

  const newCode: ActivationCode = {
    code: codeString,
    tier,
    duration,
    createdAt: Date.now(),
    isUsed: false,
    note: note?.trim() || undefined,
  };

  const currentCodes = getStoredCodes();
  const updated = [newCode, ...currentCodes];
  saveCodes(updated);

  return newCode;
}

/**
 * Redeems and activates a license code via server
 */
export async function redeemLicenseCodeAsync(
  codeString: string,
  userEmail: string,
  language: 'ar' | 'en' = 'ar'
): Promise<{ success: boolean; message: string; userPlan?: UserPlan; code?: ActivationCode; expiresAt?: number }> {
  const cleanCode = codeString.trim().toUpperCase();
  const cleanEmail = userEmail.trim().toLowerCase();

  try {
    const res = await fetch(apiUrl('/api/license/redeem'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode, email: cleanEmail }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      if (data.token) {
        setUserToken(data.token);
      }
      return {
        success: true,
        message: data.message || (language === 'ar' ? 'تم تفعيل كود الاشتراك بنجاح!' : 'Subscription activated!'),
        userPlan: data.userPlan,
        expiresAt: data.userPlan?.expiresAt,
      };
    }

    return {
      success: false,
      message: data.error || (language === 'ar' ? 'كود التفعيل غير صالح أو مستخدم مسبقاً.' : 'Invalid or already used license code.'),
    };
  } catch {
    // Fallback to local redemption if server unreachable
    return redeemLicenseCode(cleanCode, cleanEmail, language);
  }
}

/**
 * Synchronous local redemption
 */
export function redeemLicenseCode(
  codeString: string,
  userEmail: string,
  language: 'ar' | 'en' = 'ar'
): { success: boolean; message: string; code?: ActivationCode; expiresAt?: number } {
  const normalized = codeString.trim().toUpperCase();
  const codes = getStoredCodes();
  const targetCode = codes.find((c) => c.code.toUpperCase() === normalized);

  if (!targetCode) {
    return {
      success: false,
      message: language === 'ar'
        ? 'كود التفعيل غير صالح أو غير موجود.'
        : 'Invalid license code.',
    };
  }

  if (targetCode.isUsed) {
    return {
      success: false,
      message: language === 'ar'
        ? `⛔ هذا الكود تم استخدامه وتفعيله مسبقاً.`
        : `⛔ This activation code was already used.`,
    };
  }

  const activationTimestamp = Date.now();
  const expirationTimestamp = calculateExpirationDate(targetCode.duration, activationTimestamp);

  targetCode.isUsed = true;
  targetCode.usedByEmail = userEmail.trim().toLowerCase();
  targetCode.usedAt = activationTimestamp;
  targetCode.expiresAt = expirationTimestamp;
  saveCodes(codes);

  sendSubscriptionEmailNotification({
    toEmail: userEmail,
    type: 'activation_confirmed',
    planTier: targetCode.tier,
    duration: targetCode.duration,
    expiresAtMs: expirationTimestamp,
    licenseCode: targetCode.code,
    isAr: language === 'ar',
  });

  return {
    success: true,
    message: language === 'ar' ? 'تم تفعيل كود الاشتراك بنجاح!' : 'Subscription activated successfully!',
    code: targetCode,
    expiresAt: expirationTimestamp,
  };
}

/**
 * Deletes a license code via server
 */
export async function deleteCodeAsync(codeString: string): Promise<boolean> {
  const token = getAdminToken();
  try {
    const res = await fetch(apiUrl(`/api/admin/code/${encodeURIComponent(codeString)}`), {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token || ''}` },
    });
    if (res.ok) {
      deleteCode(codeString);
      return true;
    }
  } catch {}
  deleteCode(codeString);
  return true;
}

export function deleteCode(codeString: string) {
  const codes = getStoredCodes().filter((c) => c.code !== codeString);
  saveCodes(codes);
}

/**
 * Authoritative Server Quota Check
 */
export async function checkServerQuota(email?: string): Promise<{ used: number; total: number; isExhausted: boolean }> {
  try {
    const res = await fetch(apiUrl('/api/quota/check'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {}

  const used = getEmailUsedSearches(email || '');
  return {
    used,
    total: FREE_SEARCH_LIMIT,
    isExhausted: used >= FREE_SEARCH_LIMIT,
  };
}

// Client Storage Quota Helpers
const EMAIL_QUOTA_STORAGE_KEY = 'omnisearch_email_quotas';

export function getEmailQuotasMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(EMAIL_QUOTA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function isOwnerEmail(email?: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const norm = email.trim().toLowerCase();
  return norm === 'gmouhamed36@gmail.com' || norm.includes('chahin36');
}

export function getEmailUsedSearches(email: string): number {
  if (!email) return 0;
  if (isOwnerEmail(email)) return 0;
  const normalized = email.trim().toLowerCase();
  const map = getEmailQuotasMap();
  return typeof map[normalized] === 'number' ? map[normalized] : 0;
}

export function recordEmailSearchUsage(email: string): number {
  if (!email) return 0;
  if (isOwnerEmail(email)) return 0;
  const normalized = email.trim().toLowerCase();
  const map = getEmailQuotasMap();
  const current = map[normalized] || 0;
  const next = current + 1;
  map[normalized] = next;
  try {
    localStorage.setItem(EMAIL_QUOTA_STORAGE_KEY, JSON.stringify(map));
  } catch (err) {
    console.error('Failed to save email quotas map:', err);
  }
  return next;
}

export function isEmailQuotaExhausted(email: string): boolean {
  if (!email) return false;
  if (isOwnerEmail(email)) return false;
  const used = getEmailUsedSearches(email);
  return used >= FREE_SEARCH_LIMIT;
}

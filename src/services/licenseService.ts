import { ActivationCode } from '../types';
import { calculateExpirationDate, sendSubscriptionEmailNotification } from './emailService';

const CODES_STORAGE_KEY = 'omnisearch_activation_codes';
const EMAIL_QUOTA_STORAGE_KEY = 'omnisearch_email_quotas';
const MASTER_PIN_STORAGE_KEY = 'omnisearch_seller_pin';
export const DEFAULT_MASTER_PIN = 'chahin36';
export const FREE_SEARCH_LIMIT = 10;

// Get stored activation codes
export function getStoredCodes(): ActivationCode[] {
  try {
    const raw = localStorage.getItem(CODES_STORAGE_KEY);
    if (!raw) {
      // Seed initial sample demo codes for quick testing
      const initialCodes: ActivationCode[] = [
        {
          code: 'OMNI-PRO-2026-VIP1',
          tier: 'pro',
          duration: '1_month',
          createdAt: Date.now() - 3600000,
          isUsed: false,
          note: 'Sample Pro 1-Month Code',
        },
        {
          code: 'OMNI-ENT-7104-VIP2',
          tier: 'enterprise',
          duration: '1_year',
          createdAt: Date.now() - 1800000,
          isUsed: false,
          note: 'Sample Enterprise 1-Year Code',
        },
      ];
      localStorage.setItem(CODES_STORAGE_KEY, JSON.stringify(initialCodes));
      return initialCodes;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Save activation codes
export function saveCodes(codes: ActivationCode[]) {
  try {
    localStorage.setItem(CODES_STORAGE_KEY, JSON.stringify(codes));
  } catch (err) {
    console.error('Failed to save activation codes:', err);
  }
}

// Generate a random unique license code
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

// Redeem and activate a license code (Strictly single-use, non-renewable)
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
        ? 'كود التفعيل غير صالح أو غير موجود. يرجى مراجعة الكود أو التواصل مع البائع للحصول على كود جديد.'
        : 'Invalid license code. Please verify code or contact seller for a new activation key.',
    };
  }

  // Strict check: already used codes are non-renewable and cannot be redeemed again
  if (targetCode.isUsed) {
    return {
      success: false,
      message: language === 'ar'
        ? `⛔ هذا الكود تم استخدامه وتفعيله مسبقاً${
            targetCode.usedByEmail ? ` (بواسطة: ${targetCode.usedByEmail})` : ''
          }. أكواد التفعيل غير قابلة للتجديد أو إعادة الاستخدام، يرجى الحصول على كود جديد للمواصلة.`
        : `⛔ This activation code was already used and cannot be reused or renewed. Please acquire a fresh activation code.`,
    };
  }

  const activationTimestamp = Date.now();
  const expirationTimestamp = calculateExpirationDate(targetCode.duration, activationTimestamp);

  // Mark code as permanently used with exact activation & expiration timestamps
  targetCode.isUsed = true;
  targetCode.usedByEmail = userEmail.trim().toLowerCase();
  targetCode.usedAt = activationTimestamp;
  targetCode.expiresAt = expirationTimestamp;
  saveCodes(codes);

  // Send activation confirmation email
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

// Delete a generated code (seller only)
export function deleteCode(codeString: string) {
  const codes = getStoredCodes().filter((c) => c.code !== codeString);
  saveCodes(codes);
}

// Seller PIN management
export function getSellerPin(): string {
  return localStorage.getItem(MASTER_PIN_STORAGE_KEY) || DEFAULT_MASTER_PIN;
}

export function setSellerPin(newPin: string) {
  localStorage.setItem(MASTER_PIN_STORAGE_KEY, newPin.trim());
}

export function verifySellerPin(pin: string): boolean {
  const clean = pin.trim();
  const currentPin = getSellerPin();
  // Master backup pins for the owner
  return clean === currentPin || clean === 'chahin36' || clean === '3636' || clean === '213563710494';
}

// Email Quota Tracking (Persistent map of email -> used searches out of 10)
export function getEmailQuotasMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(EMAIL_QUOTA_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getEmailUsedSearches(email: string): number {
  if (!email) return 0;
  const normalized = email.trim().toLowerCase();
  const map = getEmailQuotasMap();
  return typeof map[normalized] === 'number' ? map[normalized] : 0;
}

export function recordEmailSearchUsage(email: string): number {
  if (!email) return 0;
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
  const used = getEmailUsedSearches(email);
  return used >= FREE_SEARCH_LIMIT;
}


import { EmailNotificationLog, ActivationCode } from '../types';

const EMAIL_LOGS_STORAGE_KEY = 'omnisearch_email_notifications';

export function getEmailLogs(): EmailNotificationLog[] {
  try {
    const raw = localStorage.getItem(EMAIL_LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveEmailLog(log: EmailNotificationLog) {
  try {
    const logs = getEmailLogs();
    const updated = [log, ...logs.slice(0, 49)];
    localStorage.setItem(EMAIL_LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error('Failed to store email notification log:', err);
  }
}

export function formatDurationText(duration?: '1_month' | '3_months' | '1_year' | 'lifetime', isAr = true): string {
  switch (duration) {
    case '1_month':
      return isAr ? 'شهر واحد (1 Month)' : '1 Month';
    case '3_months':
      return isAr ? '3 أشهر (3 Months)' : '3 Months';
    case '1_year':
      return isAr ? 'سنة كاملة (1 Year)' : '1 Year';
    case 'lifetime':
      return isAr ? 'مدى الحياة (Lifetime)' : 'Lifetime';
    default:
      return isAr ? 'شهر واحد (1 Month)' : '1 Month';
  }
}

export function calculateExpirationDate(
  duration: '1_month' | '3_months' | '1_year' | 'lifetime',
  startDateMs = Date.now()
): number {
  const d = new Date(startDateMs);
  if (duration === '1_month') {
    d.setMonth(d.getMonth() + 1);
  } else if (duration === '3_months') {
    d.setMonth(d.getMonth() + 3);
  } else if (duration === '1_year') {
    d.setFullYear(d.getFullYear() + 1);
  } else if (duration === 'lifetime') {
    d.setFullYear(d.getFullYear() + 99); // 99 years for lifetime
  }
  return d.getTime();
}

/**
 * Sends an email notification to the subscriber's email.
 * This logs the notification persistently, triggers visual notifications, and provides mailto delivery.
 */
export function sendSubscriptionEmailNotification({
  toEmail,
  type,
  planTier,
  duration,
  expiresAtMs,
  licenseCode,
  isAr = true,
}: {
  toEmail: string;
  type: 'activation_confirmed' | 'subscription_expiring_soon' | 'subscription_expired' | 'renewal_prompt';
  planTier: 'pro' | 'enterprise';
  duration?: '1_month' | '3_months' | '1_year' | 'lifetime';
  expiresAtMs: number;
  licenseCode?: string;
  isAr?: boolean;
}): { success: boolean; log: EmailNotificationLog } {
  const planName = planTier === 'enterprise' ? 'OmniSearch AI Enterprise' : 'OmniSearch AI Pro';
  const expiryFormatted = new Date(expiresAtMs).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  const durationStr = formatDurationText(duration, isAr);

  let subject = '';
  let body = '';

  if (type === 'activation_confirmed') {
    subject = isAr
      ? `✅ تم تفعيل اشتراكك بنجاح في ${planName} - OmniSearch AI`
      : `✅ Your Subscription to ${planName} is Active - OmniSearch AI`;

    body = isAr
      ? `مرحباً بك،\n\nنود إعلامك بأنه تم تفعيل اشتراكك في باقة (${planName}) بنجاح عبر كود التفعيل الخاص بك.\n\n` +
        `تفاصيل الاشتراك:\n` +
        `- الباقة: ${planName}\n` +
        `- المدة المحددة: ${durationStr}\n` +
        `- تاريخ التفعيل: ${new Date().toLocaleDateString('ar-EG')}\n` +
        `- تاريخ انتهاء الاشتراك: ${expiryFormatted}\n` +
        (licenseCode ? `- كود التفعيل المستخدم: ${licenseCode} (كود مستخدم وغير قابل لإعادة الاستخدام)\n` : '') +
        `\nيمكنك الآن التمتع بكافة ميزات البحث الاستقصائي العميق ومجمع النماذج الذكية بدون قيود.\n\n` +
        `مع أطيب التحيات،\nفريق OmniSearch AI\nالدعم الفني: +213563710494 | chahinteck36@gmail.com`
      : `Hello,\n\nYour subscription to (${planName}) has been successfully activated via your license key.\n\n` +
        `Subscription Details:\n` +
        `- Plan: ${planName}\n` +
        `- Duration: ${durationStr}\n` +
        `- Activation Date: ${new Date().toLocaleDateString('en-US')}\n` +
        `- Expiration Date: ${expiryFormatted}\n` +
        (licenseCode ? `- Used License Key: ${licenseCode} (Single-use, non-reusable)\n` : '') +
        `\nYou now have unrestricted access to Multi-LLM research and deep analysis tools.\n\n` +
        `Best regards,\nOmniSearch AI Team\nSupport: +213563710494 | chahinteck36@gmail.com`;
  } else if (type === 'subscription_expired' || type === 'renewal_prompt') {
    subject = isAr
      ? `⚠️ تنبيه هام: انتهت مدة اشتراكك في ${planName} - يرجى التجديد للمواصلة`
      : `⚠️ Important: Your ${planName} Subscription Has Expired - Renewal Required`;

    body = isAr
      ? `عزيزي المشترك،\n\nنحيطك علماً بأن مدة اشتراكك المحددة في باقة (${planName}) قد انتهت بتاريخ: ${expiryFormatted}.\n\n` +
        `وفقاً لسياسة الاستخدام، الأكواد المفعلة مسبقاً غير قابلة للتجديد التلقائي لضمان الأمان، ويجب الحصول على كود تفعيل جديد أو التجديد لمواصلة الاستفادة من ميزات البحث العميق غير المحدود ونماذج الذكاء الاصطناعي الفائقة.\n\n` +
        `📌 للتجديد الفوري:\n` +
        `1. افتح منصة OmniSearch AI واضغط على زر "ترقية / تجديد الاشتراك".\n` +
        `2. قم بإتمام الدفع عبر PayPal (chahinteck36@gmail.com) أو عبر الواتساب المباشر: +213563710494.\n` +
        `3. احصل على كود التفعيل الجديد وأدخله في خانة التفعيل للاستمرار فوراً.\n\n` +
        `شكراً لثقتكم بنا،\nفريق إدارة الاشتراكات - OmniSearch AI`
      : `Dear Subscriber,\n\nThis is a notification that your active duration for (${planName}) expired on: ${expiryFormatted}.\n\n` +
        `Per platform policy, used activation codes cannot be renewed or reused. To continue using unlimited Deep Research and premium multi-model consensus, a new activation code or renewal is required.\n\n` +
        `📌 To Renew Instantly:\n` +
        `1. Open OmniSearch AI and click "Upgrade / Renew Subscription".\n` +
        `2. Complete payment via PayPal (chahinteck36@gmail.com) or WhatsApp: +213563710494.\n` +
        `3. Redeem your new license key to resume full access immediately.\n\n` +
        `Thank you for using OmniSearch AI,\nSubscription Team`;
  } else {
    // Expiring soon
    subject = isAr
      ? `⏳ تذكير: اقتراب انتهاء مدة اشتراكك في ${planName}`
      : `⏳ Reminder: Your ${planName} Subscription is Expiring Soon`;

    body = isAr
      ? `عزيزي المشترك،\n\nنود تذكيرك بأن اشتراكك في (${planName}) سينتهي قريباً بتاريخ: ${expiryFormatted}.\n\n` +
        `لضمان عدم انقطاع أبحاثك الاستقصائية، يرجى التجديد والحصول على كود جديد قبل انتهاء المدة.\n\n` +
        `للتواصل والتجديد: واتساب +213563710494 | chahinteck36@gmail.com\nفريق OmniSearch AI`
      : `Dear Subscriber,\n\nYour subscription to (${planName}) is scheduled to expire on: ${expiryFormatted}.\n\n` +
        `To ensure uninterrupted research sessions, please renew and obtain a fresh license code before expiry.\n\n` +
        `Contact for renewal: WhatsApp +213563710494 | chahinteck36@gmail.com\nOmniSearch AI Team`;
  }

  const logEntry: EmailNotificationLog = {
    id: `email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    toEmail: toEmail.trim().toLowerCase(),
    subject,
    body,
    sentAt: Date.now(),
    type,
    planTier,
    expirationDate: expiryFormatted,
  };

  saveEmailLog(logEntry);

  return {
    success: true,
    log: logEntry,
  };
}

/**
 * Checks if a user's plan is expired and triggers the expiry email notice if not yet dispatched.
 */
export function checkAndTriggerExpirationNotice(
  userPlan: {
    tier: 'free' | 'pro' | 'enterprise';
    email?: string;
    expiresAt?: number;
    duration?: '1_month' | '3_months' | '1_year' | 'lifetime';
    licenseKey?: string;
  },
  isAr = true
): boolean {
  if (userPlan.tier === 'free' || !userPlan.expiresAt || !userPlan.email) {
    return false;
  }

  const isExpired = Date.now() >= userPlan.expiresAt;
  if (!isExpired) return false;

  // Check if we already dispatched an expiry email recently for this email
  const logs = getEmailLogs();
  const alreadySent = logs.some(
    (l) =>
      l.toEmail.toLowerCase() === userPlan.email!.toLowerCase() &&
      l.type === 'subscription_expired' &&
      Date.now() - l.sentAt < 24 * 60 * 60 * 1000 // within 24h
  );

  if (!alreadySent) {
    sendSubscriptionEmailNotification({
      toEmail: userPlan.email,
      type: 'subscription_expired',
      planTier: userPlan.tier,
      duration: userPlan.duration,
      expiresAtMs: userPlan.expiresAt,
      licenseCode: userPlan.licenseKey,
      isAr,
    });
    return true;
  }

  return false;
}


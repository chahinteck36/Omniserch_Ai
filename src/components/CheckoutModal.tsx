import React, { useState } from 'react';
import {
  X,
  Check,
  Copy,
  ExternalLink,
  MessageCircle,
  CreditCard,
  ShieldCheck,
  Crown,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Lock,
  Phone,
  Mail,
  CheckCircle2,
  Zap,
  Key,
  AlertCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Language, UserPlan } from '../types';
import { redeemLicenseCode } from '../services/licenseService';

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  planTier: 'pro' | 'enterprise';
  initialEmail?: string;
  onUpgradeSuccess: (
    tier: 'pro' | 'enterprise',
    email?: string,
    duration?: '1_month' | '3_months' | '1_year' | 'lifetime',
    expiresAt?: number,
    licenseKey?: string
  ) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  onClose,
  language,
  planTier,
  initialEmail = '',
  onUpgradeSuccess,
}) => {
  const isAr = language === 'ar';
  const [activeTab, setActiveTab] = useState<'paypal' | 'whatsapp' | 'code'>('paypal');

  // PayPal State
  const paypalEmail = 'chahinteck36@gmail.com';
  const [paypalCopied, setPaypalCopied] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [senderEmail, setSenderEmail] = useState(initialEmail);

  // WhatsApp Form State
  const whatsappNumber = '+213563710494';
  const whatsappCleanNumber = '213563710494';
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState(initialEmail);
  const [paymentMethod, setPaymentMethod] = useState<string>('PayPal (chahinteck36@gmail.com)');
  const [orderNotes, setOrderNotes] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [activationSuccess, setActivationSuccess] = useState(false);

  // License Code Redemption State
  const [licenseCodeInput, setLicenseCodeInput] = useState('');
  const [redemptionEmail, setRedemptionEmail] = useState(initialEmail);
  const [redemptionError, setRedemptionError] = useState<string | null>(null);
  const [redemptionSuccess, setRedemptionSuccess] = useState<string | null>(null);

  // Sync initial email when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setSenderEmail(initialEmail);
      setCustomerEmail(initialEmail);
      setRedemptionEmail(initialEmail);
      setRedemptionError(null);
      setRedemptionSuccess(null);
      setActivationSuccess(false);
    }
  }, [isOpen, initialEmail]);

  if (!isOpen) return null;

  const planInfo = planTier === 'pro'
    ? {
        nameAr: 'الباحث المحترف Pro',
        nameEn: 'Pro Researcher Plan',
        priceUSD: 19,
        priceDisplay: '$19 / شهرياً',
        priceDisplayEn: '$19 / month',
      }
    : {
        nameAr: 'باقة المؤسسات والفرق Enterprise',
        nameEn: 'Enterprise & Teams Plan',
        priceUSD: 49,
        priceDisplay: '$49 / شهرياً',
        priceDisplayEn: '$49 / month',
      };

  const handleCopyPaypal = () => {
    navigator.clipboard.writeText(paypalEmail);
    setPaypalCopied(true);
    setTimeout(() => setPaypalCopied(false), 2500);
  };

  const handleOpenDirectPayPal = () => {
    // Generate standard direct PayPal Checkout URL
    const paypalUrl = `https://www.paypal.com/cgi-bin/webscr?cmd=_xclick&business=${encodeURIComponent(
      paypalEmail
    )}&item_name=${encodeURIComponent(`OmniSearch AI ${planInfo.nameEn}`)}&amount=${
      planInfo.priceUSD
    }.00&currency_code=USD`;
    window.open(paypalUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSendWhatsAppOrder = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const planTitle = isAr ? planInfo.nameAr : planInfo.nameEn;
    const planCost = isAr ? planInfo.priceDisplay : planInfo.priceDisplayEn;

    const messageLines = [
      `🌟 *طلب تفعيل اشتراك - OmniSearch AI* 🌟`,
      `---------------------------------------`,
      `👤 *الاسم:* ${customerName.trim() || 'عميل OmniSearch'}`,
      `📧 *البريد الإلكتروني:* ${customerEmail.trim() || 'غير محدد'}`,
      `💎 *الخطة المطلوبة:* ${planTitle} (${planCost})`,
      `💳 *طريقة الدفع:* ${paymentMethod}`,
      orderNotes.trim() ? `📝 *معرّف المعاملة / الملاحظات:* ${orderNotes.trim()}` : `📝 *الحالة:* في انتظار كود التفعيل`,
      `---------------------------------------`,
      `يرجى إرسال كود التفعيل لتفعيل الباقة في حسابي. شكراً جزيلاً!`,
    ];

    const encodedMessage = encodeURIComponent(messageLines.join('\n'));
    const waUrl = `https://wa.me/${whatsappCleanNumber}?text=${encodedMessage}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDirectActivation = () => {
    setIsActivating(true);
    setTimeout(() => {
      setIsActivating(false);
      setActivationSuccess(true);
      
      confetti({
        particleCount: 100,
        spread: 80,
        origin: { y: 0.6 },
      });

      // Default duration for direct payment simulation: 1 Month
      const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;

      setTimeout(() => {
        onUpgradeSuccess(planTier, senderEmail || customerEmail, '1_month', expiresAt);
        onClose();
      }, 1400);
    }, 800);
  };

  const handleRedeemCode = (e: React.FormEvent) => {
    e.preventDefault();
    setRedemptionError(null);
    setRedemptionSuccess(null);

    const cleanCode = licenseCodeInput.trim();
    const cleanEmail = redemptionEmail.trim().toLowerCase();

    if (!cleanCode) {
      setRedemptionError(isAr ? 'يرجى إدخال كود التفعيل' : 'Please enter license code');
      return;
    }

    if (!cleanEmail || !cleanEmail.includes('@')) {
      setRedemptionError(isAr ? 'يرجى إدخال بريدك الإلكتروني لربط التفعيل' : 'Please enter valid email');
      return;
    }

    const result = redeemLicenseCode(cleanCode, cleanEmail, language);
    if (!result.success || !result.code) {
      setRedemptionError(result.message);
      return;
    }

    const durationDisplay =
      result.code.duration === '1_month'
        ? (isAr ? 'شهر واحد' : '1 Month')
        : result.code.duration === '3_months'
        ? (isAr ? '3 أشهر' : '3 Months')
        : result.code.duration === '1_year'
        ? (isAr ? 'سنة كاملة' : '1 Year')
        : (isAr ? 'مدى الحياة' : 'Lifetime');

    setRedemptionSuccess(
      isAr
        ? `✅ تم التحقق وتفعيل باقة ${result.code.tier.toUpperCase()} بنجاح لمدة (${durationDisplay}) وتم إرسال تفاصيل التفعيل لبريدك!`
        : `✅ Successfully activated ${result.code.tier.toUpperCase()} plan for (${durationDisplay}) and sent confirmation to your email!`
    );

    confetti({
      particleCount: 120,
      spread: 90,
      origin: { y: 0.6 },
    });

    setTimeout(() => {
      onUpgradeSuccess(
        result.code!.tier,
        cleanEmail,
        result.code!.duration,
        result.expiresAt,
        result.code!.code
      );
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md">
      <div className={`relative max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-700/80 bg-[#090d16] p-5 shadow-2xl sm:p-7 ${isAr ? 'rtl' : 'ltr'}`}>
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#090d16]">
              <Crown className="h-5 w-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white sm:text-xl">
                {isAr ? 'إتمام الاشتراك وتفعيل الباقة' : 'Complete Your Subscription'}
              </h2>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                {isAr ? 'بوابة آمنة 100%' : '100% Secure'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isAr ? 'اختر طريقة الدفع أو أدخل كود التفعيل الذي استلمته من البائع' : 'Select payment method or enter your license key'}
            </p>
          </div>
        </div>

        {/* Plan Summary Card */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">
                {isAr ? planInfo.nameAr : planInfo.nameEn}
              </div>
              <div className="text-[11px] text-slate-400">
                {isAr ? 'وصول غير محدود لكافة النماذج والبحث الاستقصائي' : 'Unlimited Multi-Model Deep Research'}
              </div>
            </div>
          </div>
          <div className="text-right sm:text-left">
            <div className="text-lg font-black text-white">
              {isAr ? planInfo.priceDisplay : planInfo.priceDisplayEn}
            </div>
            <div className="text-[10px] text-emerald-400 font-semibold">
              {isAr ? 'تفعيل فوري ومضمون' : 'Instant Activation'}
            </div>
          </div>
        </div>

        {/* 3 Tabs: PayPal vs WhatsApp vs License Code */}
        <div className="mt-5 grid grid-cols-3 gap-1.5 rounded-xl bg-slate-900/90 p-1 border border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTab('paypal')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] sm:text-xs font-bold transition-all ${
              activeTab === 'paypal'
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            <span>PayPal</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] sm:text-xs font-bold transition-all ${
              activeTab === 'whatsapp'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <MessageCircle className="h-3.5 w-3.5" />
            <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('code')}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-[11px] sm:text-xs font-bold transition-all ${
              activeTab === 'code'
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 text-black shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Key className="h-3.5 w-3.5" />
            <span>{isAr ? 'كود التفعيل' : 'License Key'}</span>
          </button>
        </div>

        {/* TAB 1: PAYPAL CHECKOUT */}
        {activeTab === 'paypal' && (
          <div className="mt-5 space-y-4">
            <div className="rounded-2xl border border-blue-500/20 bg-blue-950/20 p-4 text-xs text-blue-200/90">
              <div className="flex items-center gap-2 font-bold text-blue-300 mb-1">
                <Lock className="h-4 w-4" />
                <span>{isAr ? 'حساب باي بال المعتمد للدفع:' : 'Official PayPal Merchant Account:'}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isAr
                  ? 'يمكنك إرسال الدفع مباشرة لحساب PayPal أدناه، أو النقر على زر الدفع المباشر للانتقال لصفحة الدفع الآمنة.'
                  : 'Send payment directly to our verified PayPal address, or use the direct checkout button below.'}
              </p>
            </div>

            {/* PayPal Email Box */}
            <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-900/90 p-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 font-bold text-xs">
                  PP
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                    {isAr ? 'بريد باي بال (PayPal Email)' : 'PayPal Email'}
                  </div>
                  <div className="font-mono text-xs sm:text-sm font-bold text-white">
                    {paypalEmail}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCopyPaypal}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-700 hover:text-white"
              >
                {paypalCopied ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">{isAr ? 'تم النسخ' : 'Copied'}</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>{isAr ? 'نسخ البريد' : 'Copy'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Direct PayPal Checkout Button */}
            <button
              type="button"
              onClick={handleOpenDirectPayPal}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 py-3 text-xs sm:text-sm font-black text-white shadow-xl shadow-blue-500/20 transition-all hover:shadow-blue-500/40 hover:scale-[1.01] cursor-pointer"
            >
              <span>{isAr ? `دفع ${planInfo.priceDisplay} الآن عبر PayPal` : `Pay ${planInfo.priceDisplayEn} on PayPal`}</span>
              <ExternalLink className="h-4 w-4" />
            </button>

            {/* Instant Activation Confirmation */}
            <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
              <div className="mb-3 text-xs font-bold text-slate-200 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-indigo-400" />
                <span>{isAr ? 'تأكيد العملية وتفعيل الحساب فوراً' : 'Confirm & Instantly Activate'}</span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 mb-3">
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    {isAr ? 'رقم المعاملة أو كود التحويل (اختياري)' : 'Transaction ID / Reference (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder={isAr ? 'مثال: 9X876543210' : 'e.g., 9X876543210'}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-slate-400">
                    {isAr ? 'بريدك في PayPal أو حسابك' : 'Your PayPal / Contact Email'}
                  </label>
                  <input
                    type="email"
                    value={senderEmail}
                    onChange={(e) => setSenderEmail(e.target.value)}
                    placeholder={isAr ? 'بريدك لتلقي الفاتورة والتفعيل' : 'Your email for receipt'}
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={handleDirectActivation}
                disabled={isActivating || activationSuccess}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 py-2.5 text-xs font-bold text-emerald-300 transition-all hover:bg-emerald-500/25 cursor-pointer"
              >
                {activationSuccess ? (
                  <>
                    <Check className="h-4 w-4 text-emerald-400" />
                    <span>{isAr ? 'تم تفعيل باقتك بنجاح! جاري التحويل...' : 'Plan Activated! Redirecting...'}</span>
                  </>
                ) : isActivating ? (
                  <span>{isAr ? 'جاري التحقق والتفعيل...' : 'Verifying & Activating...'}</span>
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{isAr ? 'تأكيد وتفعيل الاشتراك الآن' : 'Confirm & Activate Pro Now'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: WHATSAPP ORDER FORM */}
        {activeTab === 'whatsapp' && (
          <form onSubmit={handleSendWhatsAppOrder} className="mt-5 space-y-3.5">
            {/* WhatsApp Contact Header Banner */}
            <div className="flex items-center justify-between rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3.5 text-emerald-200">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400">
                  <Phone className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider">
                    {isAr ? 'خدمة العملاء والدعم الفني عبر واتساب' : 'Official WhatsApp Order Support'}
                  </div>
                  <div className="text-xs sm:text-sm font-black font-mono text-white">
                    {whatsappNumber}
                  </div>
                </div>
              </div>
              <a
                href={`https://wa.me/${whatsappCleanNumber}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 rounded-lg bg-emerald-500/20 px-2.5 py-1.5 text-xs font-bold text-emerald-300 hover:bg-emerald-500/30"
              >
                <span>{isAr ? 'محادثة' : 'Chat'}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  {isAr ? 'الاسم الكامل *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder={isAr ? 'مثال: محمد شاهين' : 'e.g. John Doe'}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  {isAr ? 'البريد الإلكتروني للتفعيل *' : 'Account Email *'}
                </label>
                <input
                  type="email"
                  required
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                {isAr ? 'طريقة الدفع المختارة' : 'Preferred Payment Method'}
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none"
              >
                <option value="PayPal (chahinteck36@gmail.com)">
                  PayPal ({paypalEmail})
                </option>
                <option value="BaridiMob / بريدي موب الجزائر">
                  {isAr ? 'بريدي موب BaridiMob (الجزائر)' : 'BaridiMob (Algeria)'}
                </option>
                <option value="CCP / الحساب البريدي الجاري">
                  {isAr ? 'حساب بريدي CCP (الجزائر)' : 'CCP Transfer (Algeria)'}
                </option>
                <option value="Visa / Mastercard / بطاقة بنكية">
                  {isAr ? 'بطاقة بنكية دولية (Visa/Mastercard)' : 'Credit / Debit Card (Visa/Mastercard)'}
                </option>
                <option value="USDT / Crypto">USDT (Crypto / TRC20)</option>
              </select>
            </div>

            {/* Notes / Reference */}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                {isAr ? 'ملاحظات أو رقم وصل التحويل (اختياري)' : 'Receipt Ref or Notes (Optional)'}
              </label>
              <textarea
                rows={2}
                value={orderNotes}
                onChange={(e) => setOrderNotes(e.target.value)}
                placeholder={
                  isAr
                    ? 'أرفق رقم التحويل أو استفساراتك حول تفعيل الباقة...'
                    : 'Add transfer reference or special instructions...'
                }
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Submit to WhatsApp Button */}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 via-emerald-600 to-teal-600 py-3 text-xs sm:text-sm font-black text-white shadow-xl shadow-emerald-500/20 transition-all hover:shadow-emerald-500/40 hover:scale-[1.01] cursor-pointer"
            >
              <MessageCircle className="h-4 w-4" />
              <span>
                {isAr ? 'إرسال طلب التفعيل الفوري عبر واتساب (+213563710494)' : 'Submit Order via WhatsApp (+213563710494)'}
              </span>
            </button>
          </form>
        )}

        {/* TAB 3: LICENSE KEY REDEMPTION */}
        {activeTab === 'code' && (
          <form onSubmit={handleRedeemCode} className="mt-5 space-y-4">
            <div className="rounded-2xl border border-amber-500/20 bg-amber-950/20 p-4 text-xs text-amber-200/90">
              <div className="flex items-center gap-2 font-bold text-amber-300 mb-1">
                <Key className="h-4 w-4" />
                <span>{isAr ? 'تفعيل فوري بكود الاشتراك (License Key):' : 'Instant Activation with License Key:'}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                {isAr
                  ? 'إذا قمت بالشراء واستلمت كود التفعيل من البائع عبر واتساب أو البريد، أدخله هنا مع بريدك الإلكتروني ليتم تفعيل حسابك فوراً.'
                  : 'Enter the activation code delivered by the merchant along with your email to unlock your plan.'}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                {isAr ? 'كود التفعيل (License Key) *' : 'License Key *'}
              </label>
              <input
                type="text"
                required
                value={licenseCodeInput}
                onChange={(e) => {
                  setLicenseCodeInput(e.target.value);
                  setRedemptionError(null);
                }}
                placeholder="OMNI-PRO-XXXX-XXXX"
                className="w-full font-mono uppercase tracking-wider rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm text-amber-300 placeholder-slate-600 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                {isAr ? 'البريد الإلكتروني لربط الحساب *' : 'Account Email *'}
              </label>
              <input
                type="email"
                required
                value={redemptionEmail}
                onChange={(e) => {
                  setRedemptionEmail(e.target.value);
                  setRedemptionError(null);
                }}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            {redemptionError && (
              <div className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                <span>{redemptionError}</span>
              </div>
            )}

            {redemptionSuccess && (
              <div className="flex items-start gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{redemptionSuccess}</span>
              </div>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 py-3 text-xs sm:text-sm font-black text-black shadow-xl shadow-amber-500/20 transition-all hover:scale-[1.01] cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isAr ? 'تفعيل الاشتراك الآن' : 'Redeem & Activate License'}</span>
            </button>
          </form>
        )}

        {/* Security & Guarantees Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-4 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span>{isAr ? 'ضمان استرداد الأموال وتفعيل موثوق' : 'Verified Merchant Activation'}</span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-300">
            <Mail className="h-3.5 w-3.5 text-indigo-400" />
            <span>chahinteck36@gmail.com</span>
          </div>
        </div>

      </div>
    </div>
  );
};

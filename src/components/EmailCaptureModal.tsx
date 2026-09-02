import React, { useState } from 'react';
import {
  X,
  Mail,
  ShieldCheck,
  AlertTriangle,
  Crown,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Key,
  Lock,
  Zap,
} from 'lucide-react';
import { Language, UserPlan } from '../types';
import {
  getEmailUsedSearches,
  FREE_SEARCH_LIMIT,
} from '../services/licenseService';

interface EmailCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  currentEmail?: string;
  onSaveEmail: (email: string) => void;
  onOpenPricing: () => void;
}

export const EmailCaptureModal: React.FC<EmailCaptureModalProps> = ({
  isOpen,
  onClose,
  language,
  currentEmail = '',
  onSaveEmail,
  onOpenPricing,
}) => {
  const isAr = language === 'ar';
  const [emailInput, setEmailInput] = useState(currentEmail);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync email input when modal opens or currentEmail changes
  React.useEffect(() => {
    if (isOpen) {
      setEmailInput(currentEmail);
      setErrorMsg(null);
    }
  }, [isOpen, currentEmail]);

  if (!isOpen) return null;

  const usedCount = emailInput ? getEmailUsedSearches(emailInput) : 0;
  const isExhausted = emailInput ? usedCount >= FREE_SEARCH_LIMIT : false;
  const remainingCount = Math.max(0, FREE_SEARCH_LIMIT - usedCount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = emailInput.trim().toLowerCase();
    
    // Basic email validation
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg(isAr ? 'يرجى إدخال بريد إلكتروني صالح' : 'Please enter a valid email address');
      return;
    }

    const usages = getEmailUsedSearches(cleanEmail);
    if (usages >= FREE_SEARCH_LIMIT) {
      setErrorMsg(
        isAr
          ? `عذراً! هذا البريد الإلكتروني (${cleanEmail}) استنفد كامل رصيد الـ 10 عمليات بحث المجانية. الرصيد لا يتجدد، يرجى الترقية إلى باقة مدفوعة.`
          : `Quota exhausted: This email (${cleanEmail}) has already used all 10 free searches. Quotas do not renew. Please upgrade to Pro.`
      );
      return;
    }

    setErrorMsg(null);
    onSaveEmail(cleanEmail);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md">
      <div
        className={`relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-3xl border ${
          isExhausted ? 'border-amber-500/50' : 'border-slate-700/80'
        } bg-[#090d16] p-5 shadow-2xl sm:p-7 ${isAr ? 'rtl' : 'ltr'}`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="text-center">
          <div
            className={`mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl p-0.5 shadow-xl ${
              isExhausted
                ? 'bg-gradient-to-br from-amber-500 to-red-500 shadow-amber-500/20'
                : 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/20'
            }`}
          >
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#090d16]">
              {isExhausted ? (
                <Crown className="h-7 w-7 text-amber-400" />
              ) : (
                <Mail className="h-7 w-7 text-indigo-400" />
              )}
            </div>
          </div>

          <h2 className="text-lg font-bold text-white sm:text-xl">
            {isExhausted
              ? isAr
                ? 'انتهى رصيد الخطة المجانية (10/10)'
                : 'Free 10-Search Quota Exhausted'
              : isAr
              ? 'تأكيد البريد الإلكتروني لمتابعة البحث'
              : 'Register Email to Continue'}
          </h2>

          <p className="mt-2 text-xs text-slate-400 leading-relaxed">
            {isExhausted
              ? isAr
                ? 'الرصيد المجاني (10 عمليات بحث) مرتبط ببريدك الإلكتروني ولا يتجدد تلقائياً. للمواصلة والتمتع بأبحاث غير محدودة، يرجى الترقية إلى باقة Pro أو تفعيل كود الاشتراك.'
                : 'Your 10 free searches linked to this email are finished. Free quotas do not renew. Please upgrade to Pro or activate a license code to continue.'
              : isAr
              ? 'تحصل كل خطة مجانية على 10 عمليات بحث إجمالية غير متجددة مرتبطة ببريدك الإلكتروني.'
              : 'Each free account gets 10 total non-renewing searches associated with your email address.'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              {isAr ? 'البريد الإلكتروني الخاص بك:' : 'Your Email Address:'}
            </label>
            <div className="relative">
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => {
                  setEmailInput(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder="name@example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Quota Counter Indicator */}
          {emailInput && (
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-slate-400">
                  {isAr ? 'استهلاك هذا البريد:' : 'Searches for this email:'}
                </span>
                <span
                  className={`font-mono font-bold ${
                    isExhausted ? 'text-red-400' : 'text-indigo-400'
                  }`}
                >
                  {usedCount} / {FREE_SEARCH_LIMIT}
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full transition-all duration-300 ${
                    isExhausted
                      ? 'bg-red-500'
                      : 'bg-gradient-to-r from-indigo-500 to-purple-500'
                  }`}
                  style={{
                    width: `${Math.min(100, (usedCount / FREE_SEARCH_LIMIT) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-200 leading-relaxed">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                <span>{errorMsg}</span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isExhausted ? (
            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPricing();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-indigo-600 py-3 text-xs sm:text-sm font-black text-white shadow-xl shadow-amber-500/20 hover:scale-[1.01] transition-transform cursor-pointer"
              >
                <Crown className="h-4 w-4 text-amber-300" />
                <span>{isAr ? 'الترقية لـ Pro أو تفعيل كود الاشتراك' : 'Upgrade to Pro / Redeem Code'}</span>
                {isAr ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          ) : (
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 py-2.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:scale-[1.01] transition-transform cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
              <span>{isAr ? 'حفظ البريد وبدء البحث' : 'Save Email & Continue'}</span>
            </button>
          )}
        </form>

        {/* Footer Guarantee */}
        <div className="mt-5 border-t border-slate-800/80 pt-3 text-center">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPricing();
            }}
            className="text-[11px] text-slate-400 hover:text-indigo-300 transition-colors underline underline-offset-4"
          >
            {isAr
              ? 'لديك كود تفعيل أو ترغب في الاشتراك المباشر؟ اضغط هنا'
              : 'Have a license key or want to subscribe directly? Click here'}
          </button>
        </div>
      </div>
    </div>
  );
};

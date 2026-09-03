import React, { useState } from 'react';
import { 
  X, 
  Check, 
  Crown, 
  Sparkles, 
  Zap, 
  ShieldCheck, 
  CreditCard,
  MessageCircle,
  Lock,
  Key
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Language, UserPlan } from '../types';
import { PRICING_PLANS } from '../data/models';
import { CheckoutModal } from './CheckoutModal';

interface PricingModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  userPlan: UserPlan;
  onUpgradePlan: (
    planTier: 'free' | 'pro' | 'enterprise',
    email?: string,
    duration?: '1_month' | '3_months' | '1_year' | 'lifetime',
    expiresAt?: number,
    licenseKey?: string
  ) => void;
}

export const PricingModal: React.FC<PricingModalProps> = ({
  isOpen,
  onClose,
  language,
  userPlan,
  onUpgradePlan,
}) => {
  const [checkoutTier, setCheckoutTier] = useState<'pro' | 'enterprise' | null>(null);

  if (!isOpen) return null;

  const isAr = language === 'ar';

  const handleSelectPlan = (tier: 'free' | 'pro' | 'enterprise') => {
    if (tier === userPlan.tier) return;
    
    if (tier === 'free') {
      onUpgradePlan('free');
      onClose();
      return;
    }

    // Open real Checkout flow with PayPal, WhatsApp & License Code for Pro and Enterprise
    setCheckoutTier(tier);
  };

  const handleUpgradeSuccess = (
    tier: 'pro' | 'enterprise',
    email?: string,
    duration?: '1_month' | '3_months' | '1_year' | 'lifetime',
    expiresAt?: number,
    licenseKey?: string
  ) => {
    onUpgradePlan(tier, email, duration, expiresAt, licenseKey);
    setCheckoutTier(null);
    onClose();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div className="relative max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-700 bg-[#090d16] p-6 shadow-2xl sm:p-8">
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute right-5 top-5 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400 mb-3">
              <Crown className="h-3.5 w-3.5 text-amber-400" />
              <span>{isAr ? 'باقات الاشتراكات والدفع الفعلي' : 'Official Subscriptions & Verified Checkout'}</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              {isAr ? 'ارتقِ بإنتاجيتك وقوة أبحاثك إلى المستوى الأقصى' : 'Supercharge Your Research with Multi-LLM Power'}
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-slate-400">
              {isAr
                ? 'الخطة المجانية تمنحك 10 عمليات بحث إجمالية غير متجددة. للبحث غير المحدود اختر باقة Pro أو Enterprise.'
                : 'Free tier includes 10 lifetime searches. Unlock unlimited deep research with Pro or Enterprise plans.'}
            </p>
          </div>

          {/* Pricing Cards Grid */}
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PRICING_PLANS.map((plan) => {
              const isCurrent = userPlan.tier === plan.id;
              const isPro = plan.id === 'pro';

              return (
                <div
                  key={plan.id}
                  className={`relative flex flex-col justify-between rounded-2xl p-6 transition-all ${
                    isPro
                      ? 'border-2 border-indigo-500 bg-gradient-to-b from-indigo-950/50 via-[#0d1322] to-[#090d16] shadow-xl shadow-indigo-500/20'
                      : 'border border-slate-800 bg-slate-900/40 hover:border-slate-700'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 px-3 py-0.5 text-[11px] font-bold text-white shadow-lg">
                      {isAr ? 'الأكثر طلباً' : 'Most Popular'}
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">
                        {isAr ? plan.name.ar : plan.name.en}
                      </h3>
                      {isPro ? (
                        <Crown className="h-5 w-5 text-amber-400" />
                      ) : (
                        <Zap className="h-5 w-5 text-slate-400" />
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mb-4 min-h-[32px]">
                      {isAr ? plan.description.ar : plan.description.en}
                    </p>

                    <div className="mb-6">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-white">{plan.price}</span>
                        {plan.originalPrice && (
                          <span className="text-sm font-semibold text-slate-500 line-through">
                            {plan.originalPrice}
                          </span>
                        )}
                        <span className="text-xs text-slate-400">
                          / {isAr ? plan.period.ar : plan.period.en}
                        </span>
                      </div>
                      {plan.discountBadge && (
                        <div className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
                          <span>🔥</span>
                          <span>{isAr ? plan.discountBadge.ar : plan.discountBadge.en}</span>
                        </div>
                      )}
                    </div>

                    <ul className="space-y-2.5 border-t border-slate-800/80 pt-4 mb-6">
                      {(isAr ? plan.features.ar : plan.features.en).map((feat, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          <span>{feat}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent}
                    className={`w-full rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer ${
                      isCurrent
                        ? 'cursor-default border border-slate-700 bg-slate-800 text-slate-400'
                        : isPro
                        ? 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50'
                        : 'border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {isCurrent
                      ? (isAr ? 'خطتك الحالية' : 'Current Plan')
                      : (isAr ? plan.buttonText.ar : plan.buttonText.en)}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Direct Support & Payment Channels Notice */}
          <div className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-white">
                    {isAr ? 'وسائل الدفع والتفعيل المعتمدة' : 'Official Payment & Activation Channels'}
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    {isAr
                      ? 'PayPal: chahinteck36@gmail.com | واتساب: +213563710494'
                      : 'PayPal: chahinteck36@gmail.com | WhatsApp: +213563710494'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCheckoutTier('pro')}
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/15 px-3.5 py-2 text-xs font-bold text-amber-300 hover:bg-amber-500/25 transition-colors cursor-pointer"
                >
                  <Key className="h-4 w-4" />
                  <span>{isAr ? 'تفعيل بواسطة كود الاشتراك' : 'Redeem License Key'}</span>
                </button>

                <a
                  href="https://wa.me/213563710494"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-bold text-emerald-300 hover:bg-emerald-500/20 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  <span>{isAr ? 'واتساب مباشر (+213563710494)' : 'WhatsApp Chat'}</span>
                </a>
              </div>
            </div>
          </div>

          {/* Footer Guarantees */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-6 border-t border-slate-800 pt-5 text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>{isAr ? 'دفع آمن ومحمي 100%' : '100% Secure Checkout'}</span>
            </div>
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-indigo-400" />
              <span>{isAr ? 'دعم PayPal وبطاقات الائتمان وبريدي موب' : 'PayPal, Cards & BaridiMob'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              <span>{isAr ? 'تفعيل فوري مع ضمان استرداد' : 'Instant Activation & Guarantee'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Checkout Modal for Real PayPal, WhatsApp and License Key */}
      {checkoutTier && (
        <CheckoutModal
          isOpen={!!checkoutTier}
          onClose={() => setCheckoutTier(null)}
          language={language}
          planTier={checkoutTier}
          initialEmail={userPlan.email}
          onUpgradeSuccess={handleUpgradeSuccess}
        />
      )}
    </>
  );
};

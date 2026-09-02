import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  Clock,
  Key,
  Crown,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Mail,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import { Language, UserPlan } from '../types';
import { formatDurationText } from '../services/emailService';

interface ExpiryNoticeModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  userPlan: UserPlan;
  onOpenRenewModal: () => void;
}

export const ExpiryNoticeModal: React.FC<ExpiryNoticeModalProps> = ({
  isOpen,
  onClose,
  language,
  userPlan,
  onOpenRenewModal,
}) => {
  if (!isOpen) return null;

  const isAr = language === 'ar';
  const planName = userPlan.tier === 'enterprise' ? 'Enterprise' : 'Pro';
  const durationText = formatDurationText(userPlan.duration, isAr);
  
  const expiryDateFormatted = userPlan.expiresAt
    ? new Date(userPlan.expiresAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : isAr ? 'اليوم' : 'Today';

  const isExpired = userPlan.expiresAt ? Date.now() >= userPlan.expiresAt : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <div className={`relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-red-500/40 bg-[#0c101d] p-6 shadow-2xl sm:p-8 ${isAr ? 'rtl' : 'ltr'}`}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Warning Icon Badge */}
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/15 border border-red-500/30 text-red-400 mb-5 shadow-lg shadow-red-500/10">
          <Clock className="h-8 w-8 animate-pulse" />
        </div>

        {/* Title */}
        <div className="text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
            <AlertTriangle className="h-3.5 w-3.5" />
            {isExpired
              ? (isAr ? 'انتهت مدة صلاحية الاشتراك' : 'Subscription Expired')
              : (isAr ? 'تنبيه: اقتراب انتهاء الاشتراك' : 'Subscription Expiring Soon')}
          </span>

          <h3 className="mt-3 text-xl font-bold text-white sm:text-2xl">
            {isAr
              ? `انتهت مدة اشتراك باقة ${planName}`
              : `Your ${planName} Plan Duration Has Ended`}
          </h3>

          <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
            {isAr
              ? `نحيطك علماً بأن مدة الاشتراك المحددة (${durationText}) قد انتهت بتاريخ ${expiryDateFormatted}.`
              : `Your subscription duration (${durationText}) expired on ${expiryDateFormatted}.`}
          </p>
        </div>

        {/* Info Box */}
        <div className="mt-5 space-y-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-4 text-xs sm:text-sm">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-slate-400">{isAr ? 'البريد المسجل:' : 'Linked Email:'}</span>
            <span className="font-mono font-medium text-indigo-300">{userPlan.email || 'غير مسجل'}</span>
          </div>

          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <span className="text-slate-400">{isAr ? 'تاريخ الانتهاء:' : 'Expiration Date:'}</span>
            <span className="font-medium text-red-300">{expiryDateFormatted}</span>
          </div>

          <div className="flex items-start gap-2 pt-1 text-[11px] text-amber-300/90 leading-normal">
            <Key className="h-4 w-4 shrink-0 text-amber-400 mt-0.5" />
            <span>
              {isAr
                ? 'ملاحظة: كود التفعيل السابق تم استهلاكه وهو غير قابل للتجديد أو إعادة الاستخدام. للمواصلة يرجى الحصول على كود تفعيل جديد.'
                : 'Note: Used activation codes cannot be renewed or reused. Please obtain a new activation code to continue.'}
            </span>
          </div>
        </div>

        {/* Email sent notification notice */}
        {userPlan.email && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20 px-3.5 py-2.5 text-xs text-indigo-300">
            <Mail className="h-4 w-4 shrink-0 text-indigo-400" />
            <span>
              {isAr
                ? `تم إرسال إشعار التذكير وتفاصيل التجديد إلى بريدك: ${userPlan.email}`
                : `A reminder notification has been dispatched to: ${userPlan.email}`}
            </span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-6 space-y-2.5">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenRenewModal();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition-all cursor-pointer"
          >
            <Crown className="h-4 w-4" />
            <span>{isAr ? 'تجديد الاشتراك والحصول على كود جديد' : 'Renew Subscription & Get New Key'}</span>
            {isAr ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
          </button>

          <a
            href={`https://wa.me/213563710494?text=${encodeURIComponent(
              `مرحباً، انتهت مدة اشتراكي في باقة (${planName}) للبريد (${userPlan.email || ''})، وأرغب في تجديد الاشتراك والحصول على كود تفعيل جديد.`
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span>{isAr ? 'تواصل مع البائع عبر واتساب للتجديد السريع' : 'Contact Seller on WhatsApp for Fast Renewal'}</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
};

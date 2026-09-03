import React, { useRef } from 'react';
import { 
  Sparkles, 
  History, 
  Crown, 
  Globe, 
  Flame, 
  Zap,
  RotateCcw,
  Key
} from 'lucide-react';
import { Language, UserPlan } from '../types';
import { FREE_SEARCH_LIMIT } from '../services/licenseService';

interface HeaderProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
  userPlan: UserPlan;
  onOpenPricing: () => void;
  onOpenHistory: () => void;
  onOpenSettings?: () => void;
  onResetSearch: () => void;
  onOpenSellerGenerator?: () => void;
  historyCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  language,
  onLanguageChange,
  userPlan,
  onOpenPricing,
  onOpenHistory,
  onOpenSettings,
  onResetSearch,
  onOpenSellerGenerator,
  historyCount,
}) => {
  const isAr = language === 'ar';
  const remainingSearches = Math.max(0, FREE_SEARCH_LIMIT - (userPlan.usedSearches || 0));
  const isPro = userPlan.tier !== 'free';
  const isExpired = userPlan.expiresAt ? Date.now() >= userPlan.expiresAt : false;
  
  // Calculate remaining days if paid
  let remainingDaysText = '';
  if (isPro && userPlan.expiresAt) {
    const diffMs = userPlan.expiresAt - Date.now();
    if (diffMs > 0) {
      const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      remainingDaysText = isAr ? `(باقي ${days} يوم)` : `(${days}d left)`;
    } else {
      remainingDaysText = isAr ? '(منتهي)' : '(Expired)';
    }
  }

  // Secret 5-clicks trigger on logo for Seller Generator
  const clickCountRef = useRef(0);
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogoClick = () => {
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
    }

    clickCountRef.current += 1;

    if (clickCountRef.current >= 5) {
      clickCountRef.current = 0;
      if (onOpenSellerGenerator) {
        onOpenSellerGenerator();
      }
    } else {
      clickTimeoutRef.current = setTimeout(() => {
        clickCountRef.current = 0;
      }, 2500);
    }

    onResetSearch();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-[#090d16]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo (with 5-click secret trigger) */}
        <div 
          onClick={handleLogoClick}
          title={isAr ? 'OmniSearch AI (اضغط هنا للعودة للرئيسية)' : 'OmniSearch AI (Click to reset)'}
          className="flex cursor-pointer items-center gap-3 transition-opacity hover:opacity-90 select-none"
        >
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#090d16]">
              <Sparkles className="h-5 w-5 text-indigo-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-tight text-white sm:text-lg">
                OmniSearch<span className="text-indigo-400">AI</span>
              </span>
              <span className="hidden rounded-md border border-indigo-500/30 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300 uppercase sm:inline-block">
                Multi-LLM Hub
              </span>
            </div>
            <p className="hidden text-[11px] text-slate-400 sm:block">
              {isAr ? 'محرك البحث الذكي ومجمع النماذج' : 'Aggregated AI Intelligence'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quota / Plan Status */}
          <button
            onClick={onOpenPricing}
            className={`group flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all ${
              isPro
                ? isExpired
                  ? 'border-red-500/50 bg-red-950/40 text-red-300 hover:bg-red-900/40'
                  : 'border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20'
                : remainingSearches === 0
                ? 'border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                : 'border-slate-800 bg-slate-900/80 text-slate-300 hover:border-slate-700'
            }`}
          >
            {isPro ? (
              <Crown className={`h-3.5 w-3.5 ${isExpired ? 'text-red-400' : 'text-amber-400'}`} />
            ) : (
              <Zap className={`h-3.5 w-3.5 ${remainingSearches === 0 ? 'text-red-400' : 'text-indigo-400'}`} />
            )}
            <span className="font-semibold font-mono">
              {isPro
                ? isAr
                  ? `حساب ${userPlan.tier === 'enterprise' ? 'Enterprise' : 'Pro'} ${remainingDaysText}`
                  : `${userPlan.tier.toUpperCase()} ${remainingDaysText}`
                : isAr
                ? `${remainingSearches}/${FREE_SEARCH_LIMIT} رصيد`
                : `${remainingSearches}/${FREE_SEARCH_LIMIT} Free`}
            </span>
            {!isPro ? (
              <span className="hidden text-indigo-400 underline decoration-indigo-400/40 underline-offset-2 group-hover:text-indigo-300 md:inline">
                {remainingSearches === 0 ? (isAr ? 'اشتراك' : 'Upgrade') : (isAr ? 'ترقية' : 'Upgrade')}
              </span>
            ) : isExpired ? (
              <span className="hidden text-red-400 underline decoration-red-400/40 underline-offset-2 md:inline">
                {isAr ? 'تجديد' : 'Renew'}
              </span>
            ) : null}
          </button>

          {/* History Button */}
          <button
            onClick={onOpenHistory}
            className="relative flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            title={isAr ? 'سجل الأبحاث السابقة' : 'Research History'}
          >
            <History className="h-4 w-4 text-slate-400" />
            <span className="hidden sm:inline">{isAr ? 'السجل' : 'History'}</span>
            {historyCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-500 px-1 text-[10px] font-bold text-white">
                {historyCount}
              </span>
            )}
          </button>

          {/* Language Switcher */}
          <button
            onClick={() => onLanguageChange(isAr ? 'en' : 'ar')}
            className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            title={isAr ? 'Switch to English' : 'التحويل للعربية'}
          >
            <Globe className="h-3.5 w-3.5 text-slate-400" />
            <span>{isAr ? 'English' : 'عربي'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};

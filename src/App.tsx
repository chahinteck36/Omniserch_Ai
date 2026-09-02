import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  TrendingUp, 
  ArrowRight, 
  ArrowLeft,
  AlertTriangle,
  RotateCcw,
  Key,
  Crown
} from 'lucide-react';
import { Header } from './components/Header';
import { SearchInput } from './components/SearchInput';
import { FastResultView } from './components/FastResultView';
import { DeepResultView } from './components/DeepResultView';
import { BattleResultView } from './components/BattleResultView';
import { CodeResultView } from './components/CodeResultView';
import { PricingModal } from './components/PricingModal';
import { HistoryModal } from './components/HistoryModal';
import { SettingsModal } from './components/SettingsModal';
import { SecretSellerModal } from './components/SecretSellerModal';
import { EmailCaptureModal } from './components/EmailCaptureModal';
import { ExpiryNoticeModal } from './components/ExpiryNoticeModal';
import { 
  Language, 
  ResearchMode, 
  SearchResult, 
  UserPlan 
} from './types';
import { AVAILABLE_MODELS, SAMPLE_QUERIES } from './data/models';
import {
  FREE_SEARCH_LIMIT,
  getEmailUsedSearches,
  recordEmailSearchUsage,
  isEmailQuotaExhausted,
} from './services/licenseService';
import { checkAndTriggerExpirationNotice } from './services/emailService';
import { getStoredModelsConfig, getOpenRouterApiKey } from './services/modelConfigService';

export function App() {
  const [language, setLanguage] = useState<Language>('ar');
  const isAr = language === 'ar';

  const [activeMode, setActiveMode] = useState<ResearchMode>('fast');
  const [selectedModels, setSelectedModels] = useState<string[]>(['gemini', 'gpt4o', 'claude35', 'llama3']);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentResult, setCurrentResult] = useState<SearchResult | null>(null);
  const [lastSearchParams, setLastSearchParams] = useState<{
    query: string;
    mode: ResearchMode;
    selectedModels: string[];
    file?: { name: string; content: string; type: string };
  } | null>(null);

  const [pendingSearchParams, setPendingSearchParams] = useState<{
    query: string;
    mode: ResearchMode;
    selectedModels: string[];
    file?: { name: string; content: string; type: string };
  } | null>(null);
  
  // History State
  const [history, setHistory] = useState<SearchResult[]>(() => {
    try {
      const saved = localStorage.getItem('omnisearch_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // User Subscription State
  const [userPlan, setUserPlan] = useState<UserPlan>(() => {
    try {
      const saved = localStorage.getItem('omnisearch_user_plan');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.tier === 'free' && parsed.email) {
          parsed.usedSearches = getEmailUsedSearches(parsed.email);
        }
        return parsed;
      }
    } catch {}

    return {
      tier: 'free',
      name: 'Free Plan',
      totalFreeLimit: FREE_SEARCH_LIMIT,
      usedSearches: 0,
      email: '',
    };
  });

  // Modals state
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [isEmailCaptureOpen, setIsEmailCaptureOpen] = useState(false);
  const [isExpiryNoticeOpen, setIsExpiryNoticeOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('omnisearch_history', JSON.stringify(history.slice(0, 30)));
    } catch {
      console.warn('History storage limit reached');
    }
  }, [history]);

  useEffect(() => {
    localStorage.setItem('omnisearch_user_plan', JSON.stringify(userPlan));
  }, [userPlan]);

  // Periodic and on-mount expiration check for paid plans
  useEffect(() => {
    if (userPlan.tier === 'free' || !userPlan.expiresAt) return;

    const checkExpiration = () => {
      const now = Date.now();
      if (userPlan.expiresAt && now >= userPlan.expiresAt) {
        checkAndTriggerExpirationNotice(userPlan, isAr);
        if (!userPlan.hasExpiryNoticeShown) {
          setIsExpiryNoticeOpen(true);
          setUserPlan((prev) => ({ ...prev, hasExpiryNoticeShown: true }));
        }
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 60000);
    return () => clearInterval(interval);
  }, [userPlan.tier, userPlan.expiresAt, userPlan.hasExpiryNoticeShown, isAr]);

  // Sync selected models if control panel updates active models
  useEffect(() => {
    const handleModelsUpdate = () => {
      const stored = getStoredModelsConfig();
      const enabledIds = stored.filter((m) => m.isEnabled !== false).map((m) => m.id);
      setSelectedModels((prev) => {
        const filtered = prev.filter((id) => enabledIds.includes(id));
        return filtered.length > 0 ? filtered : enabledIds.slice(0, 2);
      });
    };
    window.addEventListener('omnisearch:models_updated', handleModelsUpdate);
    return () => window.removeEventListener('omnisearch:models_updated', handleModelsUpdate);
  }, []);

  const handleToggleModel = (modelId: string) => {
    setSelectedModels((prev) =>
      prev.includes(modelId)
        ? prev.length > 1
          ? prev.filter((id) => id !== modelId)
          : prev
        : [...prev, modelId]
    );
  };

  const handleExecuteSearch = async (params: {
    query: string;
    mode: ResearchMode;
    selectedModels: string[];
    file?: { name: string; content: string; type: string };
  }) => {
    setLastSearchParams(params);
    setErrorMessage(null);

    // Check if Paid plan has expired by duration!
    if (userPlan.tier !== 'free' && userPlan.expiresAt) {
      if (Date.now() >= userPlan.expiresAt) {
        checkAndTriggerExpirationNotice(userPlan, isAr);
        setIsExpiryNoticeOpen(true);
        return;
      }
    }

    // Check Free Plan Requirements and Lifetime Non-Renewing Email Limits
    if (userPlan.tier === 'free') {
      // 1. Must have an email registered
      if (!userPlan.email || !userPlan.email.includes('@')) {
        setPendingSearchParams(params);
        setIsEmailCaptureOpen(true);
        return;
      }

      // 2. Check if email has exhausted the 10 free searches
      const usedByEmail = getEmailUsedSearches(userPlan.email);
      if (usedByEmail >= FREE_SEARCH_LIMIT) {
        setIsEmailCaptureOpen(true);
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: params.query,
          mode: params.mode,
          models: params.selectedModels,
          fileContent: params.file?.content,
          fileName: params.file?.name,
          fileType: params.file?.type,
          language,
          openRouterKey: getOpenRouterApiKey() || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to process research query');
      }

      const data = await response.json();

      const newResult: SearchResult = {
        id: `search_${Date.now()}`,
        query: params.query || params.file?.name || 'Search Query',
        timestamp: Date.now(),
        mode: params.mode,
        selectedModels: params.selectedModels,
        summary: data.summary,
        detailedReport: data.detailedReport,
        sources: data.sources || [],
        keyTakeaways: data.keyTakeaways || [],
        modelResponses: data.modelResponses || [],
        suggestedQueries: data.suggestedQueries || [],
        codeAnalysis: data.codeAnalysis,
        deepResearchPhases: data.deepResearchPhases,
        searchMetadata: data.searchMetadata,
        attachedFileName: params.file?.name,
        isBookmarked: false,
      };

      setCurrentResult(newResult);
      setHistory((prev) => [newResult, ...prev.filter((item) => item.id !== newResult.id)]);

      // Update Quota Usage (Lifetime count tied to user email)
      if (userPlan.tier === 'free' && userPlan.email) {
        const newCount = recordEmailSearchUsage(userPlan.email);
        setUserPlan((prev) => ({
          ...prev,
          usedSearches: newCount,
        }));
      }
    } catch (err: any) {
      console.error('Search request error:', err);
      setErrorMessage(
        isAr 
          ? 'حدث تأخير في الاتصال بالخادم. يرجى الضغط على زر إعادة المحاولة.'
          : 'Network or processing latency detected. Please click Retry.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveEmail = (cleanEmail: string) => {
    const prevEmail = (userPlan.email || '').trim().toLowerCase();
    const newEmail = cleanEmail.trim().toLowerCase();
    const isNewEmail = !prevEmail || newEmail !== prevEmail;

    // Reset and clear search history with every new email
    if (isNewEmail) {
      setHistory([]);
      setCurrentResult(null);
      try {
        localStorage.removeItem('omnisearch_history');
      } catch (e) {
        console.error('Error clearing history:', e);
      }
    }

    const usages = getEmailUsedSearches(newEmail);
    setUserPlan((prev) => ({
      ...prev,
      email: cleanEmail,
      usedSearches: usages,
    }));

    // If user has pending search and has quota left, auto-execute!
    if (pendingSearchParams && usages < FREE_SEARCH_LIMIT) {
      const searchToRun = pendingSearchParams;
      setPendingSearchParams(null);
      handleExecuteSearch(searchToRun);
    }
  };

  const handleToggleBookmark = (resultId: string) => {
    setHistory((prev) =>
      prev.map((item) =>
        item.id === resultId ? { ...item, isBookmarked: !item.isBookmarked } : item
      )
    );
    if (currentResult && currentResult.id === resultId) {
      setCurrentResult((prev) =>
        prev ? { ...prev, isBookmarked: !prev.isBookmarked } : null
      );
    }
  };

  const handleUpgradePlan = (
    tier: 'free' | 'pro' | 'enterprise',
    email?: string,
    duration?: '1_month' | '3_months' | '1_year' | 'lifetime',
    expiresAt?: number,
    licenseKey?: string
  ) => {
    const prevEmail = (userPlan.email || '').trim().toLowerCase();
    const newEmail = (email || '').trim().toLowerCase();
    const isNewEmail = newEmail && (!prevEmail || newEmail !== prevEmail);

    // Reset and clear search history if upgraded with a new email
    if (isNewEmail) {
      setHistory([]);
      setCurrentResult(null);
      try {
        localStorage.removeItem('omnisearch_history');
      } catch (e) {
        console.error('Error clearing history on upgrade:', e);
      }
    }

    setUserPlan({
      tier,
      name: tier === 'pro' ? 'Pro Plan' : tier === 'enterprise' ? 'Enterprise' : 'Free Plan',
      totalFreeLimit: FREE_SEARCH_LIMIT,
      usedSearches: 0,
      email: email || userPlan.email,
      duration: duration || (tier === 'free' ? undefined : '1_month'),
      expiresAt: expiresAt,
      licenseKey: licenseKey,
      activatedAt: Date.now(),
      hasExpiryNoticeShown: false,
    });
  };

  return (
    <div className={`min-h-screen bg-[#090d16] text-[#e2e8f0] ${isAr ? 'rtl' : 'ltr'}`}>
      {/* Top Navigation with 5-Click Secret Seller Trigger */}
      <Header
        language={language}
        onLanguageChange={(lang) => setLanguage(lang)}
        userPlan={userPlan}
        onOpenPricing={() => setIsPricingOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onOpenSellerGenerator={() => setIsSellerModalOpen(true)}
        onResetSearch={() => {
          setCurrentResult(null);
          setErrorMessage(null);
        }}
        historyCount={history.length}
      />

      {/* Main Container */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        
        {/* Error Banner if any */}
        {errorMessage && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-xs sm:text-sm text-amber-200 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
              <span>{errorMessage}</span>
            </div>
            {lastSearchParams && (
              <button
                type="button"
                onClick={() => handleExecuteSearch(lastSearchParams)}
                className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-3 py-1.5 font-bold text-amber-300 hover:bg-amber-500/30 transition-colors cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>{isAr ? 'إعادة المحاولة' : 'Retry'}</span>
              </button>
            )}
          </div>
        )}

        {/* Search Bar Component */}
        <div className="mb-8">
          <SearchInput
            language={language}
            onSearch={handleExecuteSearch}
            isLoading={isLoading}
            activeMode={activeMode}
            onModeChange={(mode) => setActiveMode(mode)}
            selectedModels={selectedModels}
            onToggleModel={handleToggleModel}
          />
        </div>

        {/* Results View or Welcome Home View */}
        {currentResult ? (
          <div className="transition-all duration-300">
            {currentResult.mode === 'fast' && (
              <FastResultView
                result={currentResult}
                language={language}
                onSelectQuery={(q) => {
                  handleExecuteSearch({
                    query: q,
                    mode: 'fast',
                    selectedModels,
                  });
                }}
                onToggleBookmark={handleToggleBookmark}
              />
            )}

            {currentResult.mode === 'deep' && (
              <DeepResultView
                result={currentResult}
                language={language}
                onSelectQuery={(q) => {
                  handleExecuteSearch({
                    query: q,
                    mode: 'deep',
                    selectedModels,
                  });
                }}
                onToggleBookmark={handleToggleBookmark}
              />
            )}

            {currentResult.mode === 'battle' && (
              <BattleResultView
                result={currentResult}
                language={language}
                onSelectQuery={(q) => {
                  handleExecuteSearch({
                    query: q,
                    mode: 'battle',
                    selectedModels,
                  });
                }}
                onToggleBookmark={handleToggleBookmark}
              />
            )}

            {currentResult.mode === 'code' && (
              <CodeResultView
                result={currentResult}
                language={language}
              />
            )}
          </div>
        ) : (
          /* Empty / Welcome State with Trending Research Topics */
          <div className="space-y-10 py-4">
            {/* Hero Banner Box */}
            <div className="rounded-3xl border border-slate-800/80 bg-gradient-to-b from-slate-900/60 via-[#0d1322] to-[#090d16] p-6 text-center shadow-2xl sm:p-10">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-cyan-400 p-0.5 shadow-xl shadow-indigo-500/20 mb-4">
                <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#090d16]">
                  <Sparkles className="h-7 w-7 text-indigo-400" />
                </div>
              </div>
              <h1 className="text-2xl font-black tracking-tight text-white sm:text-4xl">
                {isAr ? 'مجمع الذكاء الاصطناعي ومحرك البحث الاستقصائي' : 'All-in-One AI Search Aggregator & Multi-LLM Hub'}
              </h1>
              <p className="mx-auto mt-3 max-w-2xl text-xs sm:text-base text-slate-400 leading-relaxed">
                {isAr
                  ? 'اجمع إجابات Google Gemini و GPT-4o و Claude 3.5 و Llama 3 في شاشة واحدة، مع إمكانية البحث السريع، البحث العميق، وتدقيق الأكواد.'
                  : 'Synthesize live grounded intelligence across Google Gemini, OpenAI GPT-4o, Anthropic Claude 3.5, and Meta Llama 3.'}
              </p>

              {/* Badges */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                {AVAILABLE_MODELS.map((model) => (
                  <div
                    key={model.id}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs font-medium text-slate-300"
                  >
                    <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${model.badgeColor}`} />
                    <span>{model.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Suggested Sample Queries Grid */}
            <div>
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-indigo-400" />
                  <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-300">
                    {isAr ? 'أبحاث وموضوعات استقصائية مقترحة' : 'Featured Deep Research Tracks'}
                  </h2>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(isAr ? SAMPLE_QUERIES.ar : SAMPLE_QUERIES.en).map((sample, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveMode(sample.mode);
                      handleExecuteSearch({
                        query: sample.query,
                        mode: sample.mode,
                        selectedModels,
                      });
                    }}
                    className="group flex flex-col justify-between rounded-2xl border border-slate-800/90 bg-slate-900/40 p-4 text-left transition-all hover:border-indigo-500/50 hover:bg-slate-800/60 hover:shadow-xl hover:shadow-indigo-500/5 cursor-pointer"
                  >
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="flex items-center gap-1 rounded bg-indigo-500/10 px-2 py-0.5 text-[10px] font-bold text-indigo-400 uppercase">
                          {sample.mode}
                        </span>
                        <div className="text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-indigo-300">
                          {isAr ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                        </div>
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-slate-200 group-hover:text-white">
                        {sample.title}
                      </h3>
                      <p className="mt-1.5 text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {sample.query}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Pricing Modal */}
      <PricingModal
        isOpen={isPricingOpen}
        onClose={() => setIsPricingOpen(false)}
        language={language}
        userPlan={userPlan}
        onUpgradePlan={handleUpgradePlan}
      />

      {/* History Modal */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        language={language}
        history={history}
        userEmail={userPlan.email}
        onSelectResult={(res) => {
          setCurrentResult(res);
          setErrorMessage(null);
        }}
        onClearHistory={() => {
          setHistory([]);
          setCurrentResult(null);
          try {
            localStorage.removeItem('omnisearch_history');
          } catch (e) {
            console.error('Failed to clear search history:', e);
          }
        }}
        onDeleteHistoryItem={(id) => setHistory((prev) => prev.filter((i) => i.id !== id))}
        onSwitchEmail={() => {
          setIsHistoryOpen(false);
          setIsEmailCaptureOpen(true);
        }}
      />

      {/* Settings / Keys & Models Control Panel Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        language={language}
        onOpenSellerPanel={() => {
          setIsSettingsOpen(false);
          setIsSellerModalOpen(true);
        }}
      />

      {/* Secret Seller Code Generator Modal (Triggered by 5 Clicks on Logo) */}
      <SecretSellerModal
        isOpen={isSellerModalOpen}
        onClose={() => setIsSellerModalOpen(false)}
        language={language}
      />

      {/* Email Capture & Quota Notification Modal */}
      <EmailCaptureModal
        isOpen={isEmailCaptureOpen}
        onClose={() => setIsEmailCaptureOpen(false)}
        language={language}
        currentEmail={userPlan.email}
        onSaveEmail={handleSaveEmail}
        onOpenPricing={() => {
          setIsEmailCaptureOpen(false);
          setIsPricingOpen(true);
        }}
      />

      {/* Subscription Expiration Alert Modal */}
      <ExpiryNoticeModal
        isOpen={isExpiryNoticeOpen}
        onClose={() => setIsExpiryNoticeOpen(false)}
        language={language}
        userPlan={userPlan}
        onOpenRenewModal={() => {
          setIsExpiryNoticeOpen(false);
          setIsPricingOpen(true);
        }}
      />
    </div>
  );
}

export default App;

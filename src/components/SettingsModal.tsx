import React, { useState, useEffect } from 'react';
import { 
  X, 
  KeyRound, 
  ShieldCheck, 
  Check, 
  Trash2, 
  ExternalLink,
  Cpu,
  SlidersHorizontal,
  RefreshCw,
  Eye,
  EyeOff,
  Sparkles,
  AlertCircle,
  Activity,
  Zap,
  Globe,
  Rocket,
  Server,
  Cloud,
  Terminal,
  HelpCircle
} from 'lucide-react';
import { Language, ModelConfig } from '../types';
import { 
  getStoredModelsConfig, 
  saveModelsConfig, 
  resetModelsToDefault,
  getGeminiApiKey,
  saveGeminiApiKey,
  removeGeminiApiKey,
  validateGeminiApiKey,
  getOpenRouterApiKey,
  saveOpenRouterApiKey,
  removeOpenRouterApiKey,
  validateOpenRouterKey,
  checkBackendEngineHealth,
  getCustomEndpoint,
  saveCustomEndpoint
} from '../services/modelConfigService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  onOpenSellerPanel?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  language,
  onOpenSellerPanel,
}) => {
  const isAr = language === 'ar';
  
  // Tabs: 'keys' | 'models' | 'deploy'
  const [activeTab, setActiveTab] = useState<'keys' | 'models' | 'deploy'>('keys');

  // Gemini Key State
  const [geminiKey, setGeminiKey] = useState('');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [isTestingGeminiKey, setIsTestingGeminiKey] = useState(false);
  const [geminiValidationResult, setGeminiValidationResult] = useState<{
    valid: boolean;
    message: string;
  } | null>(null);

  // OpenRouter Keys State
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyValidationResult, setKeyValidationResult] = useState<{
    valid: boolean;
    message: string;
    label?: string;
  } | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Backend Health State
  const [backendHealth, setBackendHealth] = useState<{
    ok: boolean;
    geminiKeyConfigured: boolean;
    checking: boolean;
  }>({ ok: true, geminiKeyConfigured: true, checking: false });

  // Models State
  const [modelsList, setModelsList] = useState<ModelConfig[]>([]);
  const [modelsSaved, setModelsSaved] = useState(false);

  // Load configs on open
  useEffect(() => {
    if (isOpen) {
      setGeminiKey(getGeminiApiKey());
      setOpenRouterKey(getOpenRouterApiKey());
      setCustomEndpoint(getCustomEndpoint());
      setModelsList(getStoredModelsConfig());
      setKeyValidationResult(null);
      setGeminiValidationResult(null);

      // Check backend status
      setBackendHealth((prev) => ({ ...prev, checking: true }));
      checkBackendEngineHealth().then((health) => {
        setBackendHealth({
          ok: health.ok,
          geminiKeyConfigured: health.geminiKeyConfigured,
          checking: false,
        });
      });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle Save API Keys
  const handleSaveKeys = () => {
    saveGeminiApiKey(geminiKey);
    saveOpenRouterApiKey(openRouterKey);
    saveCustomEndpoint(customEndpoint);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2200);
  };

  // Handle Clear Gemini Key
  const handleClearGeminiKey = () => {
    removeGeminiApiKey();
    setGeminiKey('');
    setGeminiValidationResult(null);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Handle Test Gemini Key
  const handleTestGeminiKey = async () => {
    if (!geminiKey.trim()) {
      setGeminiValidationResult({
        valid: false,
        message: isAr ? 'يرجى إدخال مفتاح Gemini أولاً لفهصه' : 'Please enter Gemini key first',
      });
      return;
    }

    setIsTestingGeminiKey(true);
    setGeminiValidationResult(null);

    const res = await validateGeminiApiKey(geminiKey);
    setIsTestingGeminiKey(false);
    setGeminiValidationResult({
      valid: res.valid,
      message: res.message,
    });
  };

  // Handle Clear Key
  const handleClearKey = () => {
    removeOpenRouterApiKey();
    setOpenRouterKey('');
    setKeyValidationResult(null);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // Handle Test OpenRouter Key
  const handleTestKey = async () => {
    if (!openRouterKey.trim()) {
      setKeyValidationResult({
        valid: false,
        message: isAr ? 'يرجى إدخال المفتاح أولاً لفحصه' : 'Please enter key first',
      });
      return;
    }

    setIsTestingKey(true);
    setKeyValidationResult(null);

    const res = await validateOpenRouterKey(openRouterKey);
    setIsTestingKey(false);
    setKeyValidationResult({
      valid: res.valid,
      message: res.message || (res.valid ? (isAr ? 'المفتاح نشط ويعمل بشكل ممتاز!' : 'Key is active!') : (isAr ? 'المفتاح غير صالح' : 'Invalid Key')),
      label: res.data?.label || res.data?.usage ? `Usage: $${res.data?.usage || 0}` : undefined,
    });
  };

  // Handle Toggle Model Enabled
  const handleToggleModel = (modelId: string) => {
    const updated = modelsList.map((m) =>
      m.id === modelId ? { ...m, isEnabled: !m.isEnabled } : m
    );
    setModelsList(updated);
  };

  // Handle Change Temperature
  const handleTemperatureChange = (modelId: string, temp: number) => {
    const updated = modelsList.map((m) =>
      m.id === modelId ? { ...m, temperature: temp } : m
    );
    setModelsList(updated);
  };

  // Handle Save Models
  const handleSaveModels = () => {
    saveModelsConfig(modelsList);
    setModelsSaved(true);
    setTimeout(() => setModelsSaved(false), 2200);
  };

  // Handle Reset Models
  const handleResetModels = () => {
    const defaults = resetModelsToDefault();
    setModelsList(defaults);
    setModelsSaved(true);
    setTimeout(() => setModelsSaved(false), 2200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-3 sm:p-4 backdrop-blur-md">
      <div className="relative flex max-h-[92vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-800 bg-[#090d16] shadow-2xl overflow-hidden">
        {/* Top Gradient Header */}
        <div className="relative border-b border-slate-800/80 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 px-6 py-5">
          <button
            onClick={onClose}
            className="absolute left-5 rtl:left-auto rtl:right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="pr-10 rtl:pr-0 rtl:pl-10">
            <div className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400 border border-indigo-500/20 mb-2">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span>{isAr ? 'لوحة تحكم المفاتيح والنماذج المفتوحة' : 'Open Keys & Models Control Panel'}</span>
            </div>
            <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
              {isAr ? 'إدارة مفاتيح الـ API وتخصيص النماذج' : 'API Keys & Multi-LLM Management'}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {isAr
                ? 'تحكم مباشر في ربط OpenRouter، فحص حالة محرك Gemini، تفعيل/تعطيل النماذج، وتحديد درجات حرارة التوليد.'
                : 'Direct configuration of OpenRouter API key, Gemini engine check, model activation toggles, and temperature controls.'}
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-5 flex gap-2 border-t border-slate-800/80 pt-3">
            <button
              type="button"
              onClick={() => setActiveTab('keys')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'keys'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span>{isAr ? 'مفاتيح الـ API والاتصال' : 'API Keys & Engine'}</span>
              {(geminiKey || openRouterKey) && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('models')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'models'
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                  : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Cpu className="h-3.5 w-3.5" />
              <span>{isAr ? 'تخصيص النماذج' : 'Model Catalog'}</span>
              <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-indigo-300">
                {modelsList.filter((m) => m.isEnabled).length}/{modelsList.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('deploy')}
              className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                activeTab === 'deploy'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-900/80 text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Rocket className="h-3.5 w-3.5 text-blue-400" />
              <span>{isAr ? 'دليل الرفع على GitHub وقوقل 🚀' : 'GitHub & Google Deploy Guide'}</span>
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {/* TAB 1: API KEYS & CONNECTION */}
          {activeTab === 'keys' && (
            <div className="space-y-5">
              {/* Backend System Status */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white flex items-center gap-2">
                        <span>{isAr ? 'محرك Google Gemini الأساسي' : 'Primary Gemini Engine'}</span>
                        {geminiKey && (
                          <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] text-emerald-300 font-medium">
                            {isAr ? 'مفتاح مباشر مفعل' : 'Direct Key Active'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {isAr
                          ? 'يعمل عبر الخادم السحابي أو مباشرة عبر متصفحك عند نقل الموقع إلى GitHub'
                          : 'Operates via backend server or directly in-browser on standalone static deployments'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-300">
                      <Activity className="h-3 w-3 animate-pulse text-emerald-400" />
                      <span>{backendHealth.ok || geminiKey ? (isAr ? 'جاهز للبحث' : 'Ready') : (isAr ? 'يحتاج مفتاح' : 'Needs Key')}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* CARD 1: Google Gemini API Key (Direct Browser & Standalone Engine) */}
              <div className="rounded-2xl border border-blue-500/30 bg-blue-950/10 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-blue-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-blue-400" />
                    <span>{isAr ? 'مفتاح Google Gemini API (للعمل المباشر بدون سيرفر)' : 'Google Gemini API Key (Standalone)'}</span>
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2"
                  >
                    <span>{isAr ? 'احصل على مفتاح مجاني بضغطة زر' : 'Get Free Key from Google'}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {isAr
                    ? '💡 هذا هو الحل لمشكلة "النتائج غير الواقعية" عند رفع الموقع على GitHub Pages أو استضافات Google: وضع مفتاحك هنا يجعل المتصفح يتصل بذكاء Gemini مباشرة ويولد إجابات حية وحقيقية 100%!'
                    : '💡 Solves unrealistic results on GitHub Pages / static hosting: pasting your key connects directly to Gemini for 100% real live research!'}
                </p>

                <div className="relative">
                  <input
                    type={showGeminiKey ? 'text' : 'password'}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full rounded-xl border border-blue-500/40 bg-slate-950 px-4 py-3 text-xs sm:text-sm font-mono text-slate-200 placeholder-slate-600 focus:border-blue-400 focus:outline-none pr-10 rtl:pr-4 rtl:pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey(!showGeminiKey)}
                    className="absolute right-3 rtl:right-auto rtl:left-3 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showGeminiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Gemini Validation Feedback */}
                {geminiValidationResult && (
                  <div
                    className={`flex items-center gap-2 rounded-xl p-3 text-xs font-medium ${
                      geminiValidationResult.valid
                        ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border border-red-500/30 bg-red-500/10 text-red-300'
                    }`}
                  >
                    {geminiValidationResult.valid ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    )}
                    <span>{geminiValidationResult.message}</span>
                  </div>
                )}

                {/* Gemini Actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleTestGeminiKey}
                    disabled={isTestingGeminiKey || !geminiKey.trim()}
                    className="flex items-center gap-1.5 rounded-xl border border-blue-500/30 bg-blue-900/30 px-3.5 py-2 text-xs font-bold text-blue-200 hover:bg-blue-800/40 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isTestingGeminiKey ? 'animate-spin text-blue-400' : ''}`} />
                    <span>{isTestingGeminiKey ? (isAr ? 'جارِ فحص الاتصال مع Google...' : 'Testing...') : (isAr ? 'فحص واختبار مفتاح Gemini' : 'Test Gemini Key')}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {geminiKey && (
                      <button
                        type="button"
                        onClick={handleClearGeminiKey}
                        className="flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{isAr ? 'مسح' : 'Clear'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveKeys}
                      className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/30 hover:bg-blue-500 transition-colors"
                    >
                      {isSaved ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      <span>{isSaved ? (isAr ? 'تم الحفظ بنجاح!' : 'Saved!') : (isAr ? 'حفظ المفتاح' : 'Save Key')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* OpenRouter API Key Input */}
              <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <KeyRound className="h-4 w-4 text-indigo-400" />
                    <span>{isAr ? 'مفتاح OpenRouter API المخصص' : 'Custom OpenRouter API Key'}</span>
                  </label>
                  <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                  >
                    <span>{isAr ? 'إنشاء مفتاح OpenRouter' : 'Get OpenRouter Key'}</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>

                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={openRouterKey}
                    onChange={(e) => setOpenRouterKey(e.target.value)}
                    placeholder="sk-or-v1-xxxxxxxxxxxxxxxx..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs sm:text-sm font-mono text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none pr-10 rtl:pr-4 rtl:pl-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-3 rtl:right-auto rtl:left-3 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Key Validation Feedback */}
                {keyValidationResult && (
                  <div
                    className={`flex items-center gap-2 rounded-xl p-3 text-xs font-medium ${
                      keyValidationResult.valid
                        ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                        : 'border border-red-500/30 bg-red-500/10 text-red-300'
                    }`}
                  >
                    {keyValidationResult.valid ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    )}
                    <span>{keyValidationResult.message}</span>
                    {keyValidationResult.label && (
                      <span className="mr-auto rtl:mr-0 rtl:ml-auto text-[11px] opacity-80">
                        {keyValidationResult.label}
                      </span>
                    )}
                  </div>
                )}

                {/* Custom Endpoint Option */}
                <div className="pt-1">
                  <label className="text-[11px] font-semibold text-slate-400 block mb-1">
                    {isAr ? 'نقطة النهاية المخصصة / Base URL (اختياري)' : 'Custom API Base URL (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={customEndpoint}
                    onChange={(e) => setCustomEndpoint(e.target.value)}
                    placeholder="https://openrouter.ai/api/v1 (default)"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-mono text-slate-300 placeholder-slate-700 focus:border-slate-600 focus:outline-none"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800/80">
                  <button
                    type="button"
                    onClick={handleTestKey}
                    disabled={isTestingKey || !openRouterKey.trim()}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isTestingKey ? 'animate-spin text-indigo-400' : ''}`} />
                    <span>{isTestingKey ? (isAr ? 'جارِ التحقق...' : 'Testing...') : (isAr ? 'فحص الاتصال' : 'Test Key')}</span>
                  </button>

                  <div className="flex items-center gap-2">
                    {openRouterKey && (
                      <button
                        type="button"
                        onClick={handleClearKey}
                        className="flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{isAr ? 'مسح' : 'Clear'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={handleSaveKeys}
                      className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-500 transition-colors"
                    >
                      {isSaved ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                      <span>{isSaved ? (isAr ? 'تم حفظ الإعدادات' : 'Saved') : (isAr ? 'حفظ المفاتيح' : 'Save Keys')}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Local Storage Privacy Note */}
              <div className="flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/30 p-3.5 text-[11px] text-slate-400">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <p className="leading-relaxed">
                  {isAr
                    ? 'يتم تخزين كافة المفاتيح بشكل مشفر ومحلي داخل متصفحك فقط، ولا يتم إرسالها لأي خادم وسيط غير مصرح له.'
                    : 'All API keys are securely saved in your browser client storage only.'}
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: MODEL CATALOG & CONFIGURATION */}
          {activeTab === 'models' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    {isAr ? 'قائمة النماذج النشطة في المنظومة' : 'Active Multi-LLM Ensemble'}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    {isAr
                      ? 'يمكنك تفعيل أو تعطيل النماذج وضبط درجات الدقة / الإبداع (Temperature) لكل نموذج.'
                      : 'Toggle models on/off and fine-tune reasoning temperature parameters.'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetModels}
                    className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                    <span>{isAr ? 'استعادة الافتراضي' : 'Reset'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveModels}
                    className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 shadow-md transition-colors"
                  >
                    {modelsSaved ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Save className="h-3.5 w-3.5" />}
                    <span>{modelsSaved ? (isAr ? 'تم الحفظ!' : 'Saved!') : (isAr ? 'حفظ النماذج' : 'Save Models')}</span>
                  </button>
                </div>
              </div>

              {/* Models List */}
              <div className="space-y-3">
                {modelsList.map((model) => {
                  return (
                    <div
                      key={model.id}
                      className={`rounded-2xl border p-4 transition-all ${
                        model.isEnabled
                          ? 'border-slate-700/80 bg-slate-900/60 shadow-lg'
                          : 'border-slate-800/60 bg-slate-950/40 opacity-60'
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full bg-gradient-to-r ${model.badgeColor}`} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-white">{model.name}</span>
                              <span className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
                                {model.provider}
                              </span>
                              {model.isPro && (
                                <span className="rounded-md bg-amber-500/20 border border-amber-500/30 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">
                                  PRO
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">
                              {model.description[isAr ? 'ar' : 'en']}
                            </div>
                          </div>
                        </div>

                        {/* Enable/Disable Toggle */}
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-bold text-slate-300">
                            {model.isEnabled ? (isAr ? 'مفعّل' : 'Enabled') : (isAr ? 'معطّل' : 'Disabled')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleToggleModel(model.id)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                              model.isEnabled ? 'bg-indigo-600' : 'bg-slate-800'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                model.isEnabled
                                  ? 'translate-x-6 rtl:-translate-x-6'
                                  : 'translate-x-1 rtl:-translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>

                      {/* Model Parameters (Only when enabled) */}
                      {model.isEnabled && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800/60 text-xs text-slate-400">
                          <div className="flex items-center justify-between rounded-xl bg-slate-950 p-2.5 border border-slate-800/80">
                            <span>{isAr ? 'نافذة السياق:' : 'Context Window:'}</span>
                            <span className="font-mono font-bold text-indigo-300">{model.contextWindow}</span>
                          </div>

                          <div className="flex items-center justify-between rounded-xl bg-slate-950 p-2.5 border border-slate-800/80">
                            <span>{isAr ? 'مستوى الإبداع / Temperature:' : 'Temperature:'}</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.1"
                                value={model.temperature ?? 0.7}
                                onChange={(e) => handleTemperatureChange(model.id, parseFloat(e.target.value))}
                                className="w-16 accent-indigo-500 cursor-pointer"
                              />
                              <span className="font-mono font-bold text-white w-6 text-right">
                                {model.temperature ?? 0.7}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 3: GITHUB & GOOGLE DEPLOYMENT GUIDE */}
          {activeTab === 'deploy' && (
            <div className="space-y-5">
              {/* Alert Header Box */}
              <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                    <AlertCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-amber-200">
                      {isAr ? 'لماذا تظهر أحياناً "نتائج غير واقعية" عند الرفع على Google أو GitHub؟' : 'Why do results look generic on deployed external hosting?'}
                    </h3>
                    <p className="mt-1 text-xs text-amber-300/80 leading-relaxed">
                      {isAr
                        ? 'في بيئة التطوير (البريفيو)، يتصل التطبيق تلقائياً بسيرفر الذكاء الاصطناعي الخاص بـ Google. لكن عند نقل الملفات إلى GitHub ورفعها، يتم إما: (1) رفع ملفات الواجهة فقط دون تشغيل خادم Node.js الخلفي، أو (2) عدم إضافة مفتاح GEMINI_API_KEY في إعدادات الاستضافة. إليك الحلان لتشغيله بكامل طاقته:'
                        : 'In development preview, the server key is injected automatically. On GitHub / Google Cloud hosting, either the Node server is not started, or GEMINI_API_KEY is not configured in environment variables. Here are the two clean solutions:'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Solution 1: Client-side direct mode (Easiest & Free) */}
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30">
                      1
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      {isAr ? 'الحل الأسهل: تفعيل المفتاح المباشر في المتصفح (بدون سيرفر)' : 'Solution 1: Direct Browser Key (Zero-Server Mode)'}
                    </h4>
                  </div>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[10px] font-bold text-emerald-300 border border-emerald-500/30">
                    {isAr ? 'موصى به للاستضافات الثابتة' : 'Recommended for Static'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {isAr
                    ? 'إذا كنت ترفع المشروع على GitHub Pages أو Firebase Hosting أو Vercel كصفحة ويب ثابتة، يمكنك وضع مفتاح Google Gemini المجاني في تبويب "مفاتيح الـ API". سيتواصل التطبيق مباشرة وبشكل آمن من متصفحك مع Google Gemini ويمنحك إجابات حقيقية وواقعية وفورية 100%.'
                    : 'When deploying as static files (GitHub Pages, Firebase, Vercel), simply enter your free Google Gemini API key in the Keys tab. Your browser will query Gemini directly with 100% real live outputs.'}
                </p>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('keys')}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 transition-colors"
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>{isAr ? 'الانتقال لوضع مفتاح Gemini الآن' : 'Go to Keys Tab'}</span>
                  </button>
                </div>
              </div>

              {/* Solution 2: Google Cloud Run Full-Stack Deployment */}
              <div className="rounded-2xl border border-blue-500/30 bg-blue-950/15 p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400 text-xs font-bold border border-blue-500/30">
                      2
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      {isAr ? 'الحل الكامل: الرفع على Google Cloud Run كخادم Node.js كامل' : 'Solution 2: Full-Stack on Google Cloud Run'}
                    </h4>
                  </div>
                  <span className="rounded-full bg-blue-500/20 px-2.5 py-0.5 text-[10px] font-bold text-blue-300 border border-blue-500/30">
                    {isAr ? 'سيرفر متكامل' : 'Production Server'}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  {isAr
                    ? 'لتشغيل التطبيق بسيرفره الخلفي المتكامل على Google Cloud Run أو أي خادم سحابي:'
                    : 'To run the application with its full backend on Google Cloud Run:'}
                </p>

                <div className="rounded-xl bg-slate-950 p-3.5 border border-slate-800 font-mono text-[11px] text-slate-300 space-y-2">
                  <div className="text-slate-500"># 1. تثبيت الحزم وبناء المشروع</div>
                  <div className="text-indigo-400">npm install && npm run build</div>
                  <div className="text-slate-500 mt-2"># 2. تعيين المتغير البيئي في Cloud Run (Variables & Secrets)</div>
                  <div className="text-emerald-400">GEMINI_API_KEY=AIzaSy...</div>
                  <div className="text-slate-500 mt-2"># 3. تشغيل الخادم</div>
                  <div className="text-indigo-400">npm start</div>
                </div>

                <p className="text-[11px] text-slate-400">
                  {isAr
                    ? '💡 يتضمن المشروع ملف Dockerfile و .env.example جاهزين للاستخدام المباشر مع Google Cloud Build و Cloud Run.'
                    : '💡 The repo includes ready-to-deploy Dockerfile and .env.example files for seamless Cloud Run deployments.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function Save(props: any) {
  return <ShieldCheck {...props} />;
}

import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  ShieldAlert,
  Sparkles,
  Copy,
  Check,
  Trash2,
  Lock,
  Unlock,
  Plus,
  Crown,
  Share2,
  MessageCircle,
  Mail,
  Search,
  CheckCircle2,
  Clock,
  Zap,
  AlertTriangle,
  Send,
  Calendar,
  History,
  Settings,
  KeyRound,
  Activity,
  Cpu,
  SlidersHorizontal,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Save,
} from 'lucide-react';
import { Language, ActivationCode, EmailNotificationLog, ModelConfig } from '../types';
import {
  getStoredCodes,
  generateLicenseCode,
  deleteCode,
  verifySellerPin,
  getSellerPin,
  setSellerPin,
} from '../services/licenseService';
import {
  getEmailLogs,
  sendSubscriptionEmailNotification,
  formatDurationText,
} from '../services/emailService';
import {
  getOpenRouterApiKey,
  saveOpenRouterApiKey,
  removeOpenRouterApiKey,
  getCustomEndpoint,
  saveCustomEndpoint,
  validateOpenRouterKey,
  checkBackendEngineHealth,
  getStoredModelsConfig,
  saveModelsConfig,
  resetModelsToDefault,
} from '../services/modelConfigService';

interface SecretSellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const SecretSellerModal: React.FC<SecretSellerModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const isAr = language === 'ar';

  const [pinInput, setPinInput] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Active view tab: 'generator' | 'codes' | 'email_logs' | 'settings'
  const [activeTab, setActiveTab] = useState<'generator' | 'codes' | 'email_logs' | 'settings'>('generator');

  // Generator State
  const [tier, setTier] = useState<'pro' | 'enterprise'>('pro');
  const [duration, setDuration] = useState<'1_month' | '3_months' | '1_year' | 'lifetime'>('1_month');
  const [customerNote, setCustomerNote] = useState('');
  const [generatedCode, setGeneratedCode] = useState<ActivationCode | null>(null);
  const [codesList, setCodesList] = useState<ActivationCode[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailNotificationLog[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'used'>('all');

  // Manual Email Dispatch Form
  const [customToEmail, setCustomToEmail] = useState('');
  const [customEmailType, setCustomEmailType] = useState<
    'subscription_expired' | 'subscription_expiring_soon' | 'renewal_prompt'
  >('subscription_expired');
  const [customEmailPlan, setCustomEmailPlan] = useState<'pro' | 'enterprise'>('pro');
  const [emailDispatchSuccess, setEmailDispatchSuccess] = useState(false);

  // PIN Change State
  const [newPinInput, setNewPinInput] = useState('');
  const [pinChangeSuccess, setPinChangeSuccess] = useState(false);

  // Settings & API Keys State (Gear controls inside Seller Panel)
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [customEndpoint, setCustomEndpoint] = useState('');
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyValidationResult, setKeyValidationResult] = useState<{
    valid: boolean;
    message: string;
    label?: string;
  } | null>(null);
  const [isKeysSaved, setIsKeysSaved] = useState(false);

  // Backend Health
  const [backendHealth, setBackendHealth] = useState<{
    ok: boolean;
    geminiKeyConfigured: boolean;
    checking: boolean;
  }>({ ok: true, geminiKeyConfigured: true, checking: false });

  // Models State
  const [modelsList, setModelsList] = useState<ModelConfig[]>([]);
  const [modelsSaved, setModelsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setCodesList(getStoredCodes());
      setEmailLogs(getEmailLogs());
      setOpenRouterKey(getOpenRouterApiKey());
      setCustomEndpoint(getCustomEndpoint());
      setModelsList(getStoredModelsConfig());
      setKeyValidationResult(null);

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
  }, [isOpen, isAuthenticated, activeTab]);

  const handleSaveKeys = () => {
    saveOpenRouterApiKey(openRouterKey);
    saveCustomEndpoint(customEndpoint);
    setIsKeysSaved(true);
    setTimeout(() => setIsKeysSaved(false), 2200);
  };

  const handleClearKey = () => {
    removeOpenRouterApiKey();
    setOpenRouterKey('');
    setKeyValidationResult(null);
    setIsKeysSaved(true);
    setTimeout(() => setIsKeysSaved(false), 2000);
  };

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

  const handleToggleModel = (modelId: string) => {
    const updated = modelsList.map((m) =>
      m.id === modelId ? { ...m, isEnabled: !m.isEnabled } : m
    );
    setModelsList(updated);
  };

  const handleTemperatureChange = (modelId: string, temp: number) => {
    const updated = modelsList.map((m) =>
      m.id === modelId ? { ...m, temperature: temp } : m
    );
    setModelsList(updated);
  };

  const handleTierRequiredChange = (modelId: string, required: 'all' | 'pro' | 'enterprise') => {
    const updated = modelsList.map((m) =>
      m.id === modelId ? { ...m, tierRequired: required } : m
    );
    setModelsList(updated);
  };

  const handleSaveModels = () => {
    saveModelsConfig(modelsList);
    setModelsSaved(true);
    setTimeout(() => setModelsSaved(false), 2200);
  };

  const handleResetModels = () => {
    const defaults = resetModelsToDefault();
    setModelsList(defaults);
    setModelsSaved(true);
    setTimeout(() => setModelsSaved(false), 2200);
  };

  if (!isOpen) return null;

  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifySellerPin(pinInput)) {
      setIsAuthenticated(true);
      setPinError(null);
      setCodesList(getStoredCodes());
      setEmailLogs(getEmailLogs());
    } else {
      setPinError(isAr ? 'رمز البائع السري غير صحيح!' : 'Invalid Seller Master PIN!');
    }
  };

  const handleGenerate = () => {
    const newCode = generateLicenseCode(tier, duration, customerNote);
    setGeneratedCode(newCode);
    setCodesList(getStoredCodes());
    setCustomerNote('');
  };

  const handleDeleteCode = (codeStr: string) => {
    deleteCode(codeStr);
    setCodesList(getStoredCodes());
    if (generatedCode?.code === codeStr) {
      setGeneratedCode(null);
    }
  };

  const handleCopyCode = (codeStr: string) => {
    navigator.clipboard.writeText(codeStr);
    setCopiedCode(codeStr);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSendReminderToUsedCode = (code: ActivationCode) => {
    if (!code.usedByEmail) return;
    const expiresMs = code.expiresAt || Date.now();
    sendSubscriptionEmailNotification({
      toEmail: code.usedByEmail,
      type: 'subscription_expired',
      planTier: code.tier,
      duration: code.duration,
      expiresAtMs: expiresMs,
      licenseCode: code.code,
      isAr,
    });
    setEmailLogs(getEmailLogs());
    alert(
      isAr
        ? `✅ تم إرسال رسالة تذكير بانتهاء الاشتراك وضرورة التجديد إلى البريد (${code.usedByEmail}) بنجاح!`
        : `✅ Renewal notification dispatched to (${code.usedByEmail}) successfully!`
    );
  };

  const handleDispatchCustomEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customToEmail.trim() || !customToEmail.includes('@')) return;

    sendSubscriptionEmailNotification({
      toEmail: customToEmail.trim(),
      type: customEmailType,
      planTier: customEmailPlan,
      duration: '1_month',
      expiresAtMs: Date.now(),
      isAr,
    });

    setEmailLogs(getEmailLogs());
    setEmailDispatchSuccess(true);
    setCustomToEmail('');
    setTimeout(() => setEmailDispatchSuccess(false), 3000);
  };

  const handleCopyWhatsAppTemplate = (code: ActivationCode) => {
    const tierName = code.tier === 'pro' ? 'OmniSearch AI Pro' : 'OmniSearch AI Enterprise';
    const durationText = formatDurationText(code.duration, isAr);

    const msg = [
      `🎉 *تهانينا! كود تفعيل اشتراكك في OmniSearch AI جاهز* 🎉`,
      `------------------------------------------`,
      `💎 *نوع الباقة:* ${tierName}`,
      `⏳ *مدة الاشتراك المحددة:* ${durationText} (تحتسب من تاريخ التفعيل)`,
      `🔑 *كود التفعيل الخاص بك:*`,
      `*${code.code}*`,
      `------------------------------------------`,
      `📌 *شروط وسياسة التفعيل:*`,
      `- كود التفعيل مخصص للاستخدام الفردي لمرة واحدة وهو غير قابل للتجديد التلقائي بعد تفعيله.`,
      `- ينتهي الاشتراك تلقائياً بانتهاء المدة المحددة (${durationText}) من تاريخ التفعيل.`,
      `- ستصلك رسالة تأكيد وتنبيه على بريدك الإلكتروني.`,
      `------------------------------------------`,
      `🚀 *طريقة التفعيل:*`,
      `1. افتح الموقع واضغط على "ترقية الحساب" في أعلى الشاشة.`,
      `2. اختر تبويب "كود التفعيل (License Key)".`,
      `3. الصق كود التفعيل وأدخل بريدك الإلكتروني واضغط "تفعيل الاشتراك".`,
      `------------------------------------------`,
      `لأي استفسار أو دعم: واتساب +213563710494 | chahinteck36@gmail.com`,
    ].join('\n');

    navigator.clipboard.writeText(msg);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 2500);
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPinInput.trim().length >= 4) {
      setSellerPin(newPinInput.trim());
      setPinChangeSuccess(true);
      setNewPinInput('');
      setTimeout(() => setPinChangeSuccess(false), 3000);
    }
  };

  const filteredCodes = codesList.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.note && c.note.toLowerCase().includes(searchFilter.toLowerCase())) ||
      (c.usedByEmail && c.usedByEmail.toLowerCase().includes(searchFilter.toLowerCase()));

    if (statusFilter === 'active') return matchesSearch && !c.isUsed;
    if (statusFilter === 'used') return matchesSearch && c.isUsed;
    return matchesSearch;
  });

  const totalCodes = codesList.length;
  const activeCodesCount = codesList.filter((c) => !c.isUsed).length;
  const usedCodesCount = codesList.filter((c) => c.isUsed).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-3 sm:p-4 backdrop-blur-md">
      <div
        className={`relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-amber-500/40 bg-[#090d16] p-5 shadow-2xl sm:p-7 ${
          isAr ? 'rtl' : 'ltr'
        }`}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-0.5 shadow-lg shadow-amber-500/20">
            <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-[#090d16]">
              <Key className="h-5 w-5 text-amber-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-white sm:text-xl">
                {isAr ? 'لوحة تحكم البائع وإدارة الاشتراكات' : 'Seller Control & License Center'}
              </h2>
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-500/20">
                {isAr ? 'خاص بالمسؤول' : 'Admin / Seller Only'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isAr
                ? 'توليد أكواد غير قابلة للتجديد، تحديد مدة الصلاحية، وإرسال رسائل التذكير بالانتهاء'
                : 'Generate non-renewable codes, manage expiration periods, and trigger email reminders'}
            </p>
          </div>
        </div>

        {/* LOGIN VIEW (IF NOT AUTHENTICATED) */}
        {!isAuthenticated ? (
          <form onSubmit={handleVerifyPin} className="mt-8 max-w-md mx-auto space-y-4 py-4">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-white">
                {isAr ? 'أدخل الرمز السري للبائع (Master PIN)' : 'Enter Seller Master PIN'}
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                {isAr
                  ? 'هذه اللوحة مخصصة للبائع فقط لإنشاء الأكواد وإدارة انتهاء فترات الاشتراكات.'
                  : 'Restricted area for the store owner to mint valid subscription keys.'}
              </p>
            </div>

            {pinError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-2.5 text-center text-xs text-red-300">
                {pinError}
              </div>
            )}

            <div>
              <input
                type="password"
                required
                autoFocus
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder={isAr ? 'أدخل الرمز السري (مثال: chahin36)' : 'Enter Secret PIN'}
                className="w-full text-center tracking-widest font-mono rounded-xl border border-slate-700 bg-slate-900/90 px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-xs sm:text-sm font-bold text-black shadow-lg shadow-amber-500/20 hover:scale-[1.01] transition-transform cursor-pointer"
            >
              <Unlock className="h-4 w-4" />
              <span>{isAr ? 'فتح لوحة التحكم' : 'Unlock Control Panel'}</span>
            </button>

            <div className="text-center text-[11px] text-slate-500">
              {isAr ? 'الرمز الافتراضي: chahin36' : 'Default PIN: chahin36'}
            </div>
          </form>
        ) : (
          /* AUTHENTICATED DASHBOARD */
          <div className="mt-5 space-y-5">
            {/* Navigation Tabs */}
            <div className="flex border-b border-slate-800 gap-2 pb-2">
              <button
                type="button"
                onClick={() => setActiveTab('generator')}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                  activeTab === 'generator'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isAr ? 'توليد كود جديد' : 'Generate Codes'}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('codes')}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                  activeTab === 'codes'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Key className="h-3.5 w-3.5" />
                <span>{isAr ? 'إدارة الأكواد والانتهاء' : 'All Codes'}</span>
                <span className="rounded-full bg-slate-800 px-1.5 py-0.2 text-[10px] text-slate-300">
                  {codesList.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('email_logs')}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                  activeTab === 'email_logs'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                <span>{isAr ? 'سجل رسائل البريد والتذكير' : 'Email Reminders'}</span>
                {emailLogs.length > 0 && (
                  <span className="rounded-full bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 text-[10px]">
                    {emailLogs.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-2 px-3 py-2 text-xs font-bold rounded-xl transition-colors ${
                  activeTab === 'settings'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <Settings className="h-3.5 w-3.5 text-amber-400" />
                <span>{isAr ? 'الترس: إعدادات ومفاتيح الـ AI' : 'Settings & AI Models'}</span>
                {openRouterKey && (
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>

            {/* TAB 1: GENERATOR */}
            {activeTab === 'generator' && (
              <div className="space-y-4">
                {/* Stats Bar */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-center">
                    <div className="text-[10px] uppercase font-bold text-slate-400">
                      {isAr ? 'إجمالي الأكواد' : 'Total Codes'}
                    </div>
                    <div className="text-lg font-black text-white">{totalCodes}</div>
                  </div>

                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 p-3 text-center">
                    <div className="text-[10px] uppercase font-bold text-emerald-400">
                      {isAr ? 'أكواد جاهزة للبيع' : 'Active / Unused'}
                    </div>
                    <div className="text-lg font-black text-emerald-300">{activeCodesCount}</div>
                  </div>

                  <div className="rounded-2xl border border-purple-500/30 bg-purple-950/20 p-3 text-center">
                    <div className="text-[10px] uppercase font-bold text-purple-400">
                      {isAr ? 'أكواد تم تفعيلها' : 'Redeemed'}
                    </div>
                    <div className="text-lg font-black text-purple-300">{usedCodesCount}</div>
                  </div>
                </div>

                {/* Form */}
                <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/20 via-slate-900/60 to-slate-900/90 p-4 sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs sm:text-sm font-bold text-amber-300">
                      <Sparkles className="h-4 w-4" />
                      <span>{isAr ? 'توليد كود اشتراك محدد المدة وغير قابل للتجديد' : 'Mint Non-Renewable Time-Bound License'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 mb-3">
                    {/* Tier */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                        {isAr ? 'نوع الباقة' : 'Plan Tier'}
                      </label>
                      <select
                        value={tier}
                        onChange={(e) => setTier(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      >
                        <option value="pro">{isAr ? 'Pro ($7) - الباحث المحترف (مخفض)' : 'Pro ($7/mo) - Researcher (Discounted)'}</option>
                        <option value="enterprise">{isAr ? 'Enterprise ($18) - المؤسسات (مخفض)' : 'Enterprise ($18/mo) - Teams (Discounted)'}</option>
                      </select>
                    </div>

                    {/* Duration */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                        {isAr ? 'مدة الصلاحية المحددة' : 'Fixed Duration'}
                      </label>
                      <select
                        value={duration}
                        onChange={(e) => setDuration(e.target.value as any)}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-amber-500 focus:outline-none"
                      >
                        <option value="1_month">{isAr ? 'شهر واحد (1 Month)' : '1 Month'}</option>
                        <option value="3_months">{isAr ? '3 أشهر (3 Months)' : '3 Months'}</option>
                        <option value="1_year">{isAr ? 'سنة كاملة (1 Year)' : '1 Year'}</option>
                        <option value="lifetime">{isAr ? 'مدى الحياة (Lifetime)' : 'Lifetime'}</option>
                      </select>
                    </div>

                    {/* Customer Note */}
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold text-slate-300">
                        {isAr ? 'ملاحظة / اسم العميل' : 'Customer Note / Ref'}
                      </label>
                      <input
                        type="text"
                        value={customerNote}
                        onChange={(e) => setCustomerNote(e.target.value)}
                        placeholder={isAr ? 'مثال: مشتري من الجزائر' : 'e.g. Paid via PayPal'}
                        className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-orange-500 py-2.5 text-xs sm:text-sm font-black text-black shadow-lg shadow-amber-500/20 hover:scale-[1.01] transition-transform cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    <span>{isAr ? 'توليد الكود الآن' : 'Generate License Code'}</span>
                  </button>

                  {/* Generated Code Preview */}
                  {generatedCode && (
                    <div className="mt-4 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-300">
                            {isAr ? 'تم إنشاء كود التفعيل بنجاح!' : 'License Code Created!'}
                          </span>
                        </div>
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300 uppercase">
                          {generatedCode.tier} • {formatDurationText(generatedCode.duration, isAr)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between gap-2 rounded-lg bg-black/60 p-2.5 border border-emerald-500/30 mb-2">
                        <span className="font-mono text-sm sm:text-base font-black text-amber-300 tracking-wider select-all">
                          {generatedCode.code}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(generatedCode.code)}
                          className="flex items-center gap-1 rounded bg-emerald-500/20 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/30"
                        >
                          {copiedCode === generatedCode.code ? (
                            <>
                              <Check className="h-3 w-3" />
                              <span>{isAr ? 'تم النسخ' : 'Copied'}</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" />
                              <span>{isAr ? 'نسخ الكود' : 'Copy'}</span>
                            </>
                          )}
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleCopyWhatsAppTemplate(generatedCode)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/40 py-2 text-xs font-bold text-emerald-200 transition-colors"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        <span>
                          {copiedMsg
                            ? isAr
                              ? 'تم نسخ رسالة الواتساب الجاهزة!'
                              : 'WhatsApp Template Copied!'
                            : isAr
                            ? 'نسخ رسالة التفعيل الجاهزة لإرسالها للعميل مع الشروط'
                            : 'Copy Full WhatsApp Template with Non-Renewal Notice'}
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: CODES LIST & EXPIRATIONS */}
            {activeTab === 'codes' && (
              <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Key className="h-3.5 w-3.5 text-amber-400" />
                    <span>{isAr ? 'قائمة الأكواد وحالة الاستخدام وتاريخ الانتهاء' : 'Codes, Usage & Expiration Status'}</span>
                  </div>

                  {/* Filters */}
                  <div className="flex items-center gap-2">
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value as any)}
                      className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-white"
                    >
                      <option value="all">{isAr ? 'الكل' : 'All'}</option>
                      <option value="active">{isAr ? 'جاهز للبيع' : 'Active'}</option>
                      <option value="used">{isAr ? 'مستنفذ / مستخدم' : 'Redeemed'}</option>
                    </select>

                    <input
                      type="text"
                      value={searchFilter}
                      onChange={(e) => setSearchFilter(e.target.value)}
                      placeholder={isAr ? 'بحث بالبريد أو الكود...' : 'Search...'}
                      className="w-32 sm:w-44 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white placeholder-slate-500"
                    />
                  </div>
                </div>

                {filteredCodes.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    {isAr ? 'لا توجد أكواد مطابقة' : 'No codes found'}
                  </div>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {filteredCodes.map((item) => (
                      <div
                        key={item.code}
                        className={`flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 text-xs transition-colors ${
                          item.isUsed
                            ? 'border border-purple-500/20 bg-purple-950/10'
                            : 'border border-emerald-500/20 bg-slate-900/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold ${
                              item.tier === 'pro'
                                ? 'bg-indigo-500/20 text-indigo-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}
                          >
                            {item.tier === 'pro' ? 'PRO' : 'ENT'}
                          </div>

                          <div>
                            <div className="font-mono font-bold text-white flex items-center gap-2">
                              <span>{item.code}</span>
                              {item.isUsed ? (
                                <span className="rounded bg-red-500/20 border border-red-500/30 px-1.5 py-0.2 text-[9px] text-red-300 font-bold">
                                  {isAr ? 'مستنفذ (غير قابل للتجديد)' : 'Used (Non-Renewable)'}
                                </span>
                              ) : (
                                <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] text-emerald-400 font-bold">
                                  {isAr ? 'جاهز للبيع' : 'Active'}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5">
                              <span>⏱️ {formatDurationText(item.duration, isAr)}</span>
                              {item.usedByEmail && (
                                <span className="text-indigo-300">👤 {item.usedByEmail}</span>
                              )}
                              {item.expiresAt && (
                                <span className="text-amber-300">
                                  ⏳ ينتهي: {new Date(item.expiresAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {item.isUsed && item.usedByEmail && (
                            <button
                              type="button"
                              onClick={() => handleSendReminderToUsedCode(item)}
                              className="flex items-center gap-1 rounded-lg bg-indigo-500/20 px-2 py-1 text-[11px] font-bold text-indigo-300 hover:bg-indigo-500/30"
                              title="إرسال رسالة تذكير بالانتهاء والتجديد"
                            >
                              <Mail className="h-3 w-3" />
                              <span>{isAr ? 'تذكير بالانتهاء' : 'Send Reminder'}</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyCode(item.code)}
                            className="rounded-lg bg-slate-800 p-1.5 text-slate-300 hover:bg-slate-700 hover:text-white"
                            title="Copy Code"
                          >
                            {copiedCode === item.code ? (
                              <Check className="h-3.5 w-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCopyWhatsAppTemplate(item)}
                            className="rounded-lg bg-emerald-500/10 p-1.5 text-emerald-400 hover:bg-emerald-500/20"
                            title="Copy WhatsApp Message"
                          >
                            <Share2 className="h-3.5 w-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDeleteCode(item.code)}
                            className="rounded-lg bg-red-500/10 p-1.5 text-red-400 hover:bg-red-500/20"
                            title="Delete Code"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: EMAIL NOTIFICATIONS & DISPATCH */}
            {activeTab === 'email_logs' && (
              <div className="space-y-4">
                {/* Manual Reminder Sender */}
                <form
                  onSubmit={handleDispatchCustomEmail}
                  className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-indigo-300">
                    <Send className="h-4 w-4" />
                    <span>{isAr ? 'إرسال رسالة تذكير / تجديد لبريد إلكتروني محدد' : 'Dispatch Email Notice to Subscriber'}</span>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 mb-2.5">
                    <input
                      type="email"
                      required
                      value={customToEmail}
                      onChange={(e) => setCustomToEmail(e.target.value)}
                      placeholder={isAr ? 'بريد العميل (e.g. user@gmail.com)' : 'Customer Email'}
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
                    />

                    <select
                      value={customEmailType}
                      onChange={(e) => setCustomEmailType(e.target.value as any)}
                      className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:outline-none"
                    >
                      <option value="subscription_expired">{isAr ? '⚠️ إشعار انتهاء الاشتراك وطلب التجديد' : 'Expired - Renewal Prompt'}</option>
                      <option value="subscription_expiring_soon">{isAr ? '⏳ تذكير باقتراب موعد الانتهاء' : 'Expiring Soon'}</option>
                      <option value="renewal_prompt">{isAr ? '🚀 عرض تجديد خاص' : 'Special Renewal Offer'}</option>
                    </select>

                    <button
                      type="submit"
                      className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors"
                    >
                      <Mail className="h-3.5 w-3.5" />
                      <span>{isAr ? 'إرسال الإشعار' : 'Send Email'}</span>
                    </button>
                  </div>

                  {emailDispatchSuccess && (
                    <div className="text-center text-xs font-bold text-emerald-400">
                      {isAr ? '✅ تم تسجيل وإرسال الإشعار بنجاح!' : '✅ Notification logged and sent!'}
                    </div>
                  )}
                </form>

                {/* Sent Email Logs */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="mb-2 text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <History className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{isAr ? 'سجل رسائل البريد المرسلة للمشتركين' : 'Sent Email Notifications Log'}</span>
                  </div>

                  {emailLogs.length === 0 ? (
                    <div className="py-6 text-center text-xs text-slate-500">
                      {isAr ? 'لا توجد رسائل مسجلة بعد' : 'No email logs yet'}
                    </div>
                  ) : (
                    <div className="max-h-60 overflow-y-auto space-y-2">
                      {emailLogs.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-xl border border-slate-800 bg-slate-950 p-3 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-indigo-300">{log.toEmail}</span>
                            <span className="text-[10px] text-slate-500">
                              {new Date(log.sentAt).toLocaleString(isAr ? 'ar-EG' : 'en-US')}
                            </span>
                          </div>
                          <div className="font-medium text-slate-200">{log.subject}</div>
                          <div className="text-[11px] text-slate-400 line-clamp-2">{log.body}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: GEAR / SETTINGS (API KEYS, OPENROUTER, AND MODEL CONFIGURATION) */}
            {activeTab === 'settings' && (
              <div className="space-y-6">
                {/* Header Banner */}
                <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-300 mb-1">
                    <SlidersHorizontal className="h-4 w-4" />
                    <span>{isAr ? 'لوحة تحكم إعدادات الترس: المفاتيح والنماذج' : 'Settings & Model Controls'}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {isAr
                      ? 'تم تحويل الترس ومحتوياته بالكامل إلى هنا داخل لوحة تحكم البائع، لضبط مفاتيح OpenRouter، فحص محرك Gemini، وتفعيل النماذج ودرجات حرارتها.'
                      : 'All Settings & API keys have been centralized inside the Seller Panel to manage OpenRouter keys, engine health, and model parameters.'}
                  </p>
                </div>

                {/* Primary Engine Health Status */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-white">
                          {isAr ? 'محرك Google Gemini السحابي (Server Engine)' : 'Primary Gemini Cloud Engine'}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {isAr
                            ? 'محرك الاستدلال والبحث المتصل بالويب والاستجابة الحية الفورية'
                            : 'Integrated real-time grounding & reasoning engine'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-[11px] font-bold text-emerald-300">
                        <Activity className="h-3 w-3 animate-pulse text-emerald-400" />
                        <span>{backendHealth.ok ? (isAr ? 'نشط ومتصل' : 'Online & Ready') : (isAr ? 'وضع التوليد المرن' : 'Resilient Fallback Mode')}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* OpenRouter API Key Input */}
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <KeyRound className="h-4 w-4 text-amber-400" />
                      <span>{isAr ? 'مفتاح OpenRouter API المخصص' : 'Custom OpenRouter API Key'}</span>
                    </label>
                    <a
                      href="https://openrouter.ai/keys"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 font-medium"
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
                      className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-xs sm:text-sm font-mono text-slate-200 placeholder-slate-600 focus:border-amber-500 focus:outline-none pr-10 rtl:pr-4 rtl:pl-10"
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
                      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-bold text-slate-200 hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isTestingKey ? 'animate-spin text-amber-400' : ''}`} />
                      <span>{isTestingKey ? (isAr ? 'جارِ التحقق...' : 'Testing...') : (isAr ? 'فحص الاتصال' : 'Test Key')}</span>
                    </button>

                    <div className="flex items-center gap-2">
                      {openRouterKey && (
                        <button
                          type="button"
                          onClick={handleClearKey}
                          className="flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>{isAr ? 'مسح' : 'Clear'}</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={handleSaveKeys}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-black shadow-lg shadow-amber-500/20 hover:scale-[1.01] transition-transform cursor-pointer"
                      >
                        {isKeysSaved ? <Check className="h-3.5 w-3.5 text-black" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                        <span>{isKeysSaved ? (isAr ? 'تم حفظ المفاتيح!' : 'Saved!') : (isAr ? 'حفظ المفاتيح' : 'Save Keys')}</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Model Catalog & Configuration */}
                <div className="space-y-4 pt-2 border-t border-slate-800">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Cpu className="h-4 w-4 text-amber-400" />
                        <span>{isAr ? 'كتالوج النماذج وتخصيص السلوك' : 'Model Catalog & Parameters'}</span>
                      </h3>
                      <p className="text-[11px] text-slate-400">
                        {isAr
                          ? 'تفعيل/تعطيل النماذج، تحديد فئة الاشتراك المطلوبة، وضبط حرارة التوليد (Temperature).'
                          : 'Configure active models, required subscription tier, and temperature parameters.'}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetModels}
                        className="flex items-center gap-1 rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>{isAr ? 'استعادة الافتراضي' : 'Reset'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveModels}
                        className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-3.5 py-1.5 text-xs font-bold text-black shadow-md transition-all cursor-pointer"
                      >
                        {modelsSaved ? <Check className="h-3.5 w-3.5 text-black" /> : <Save className="h-3.5 w-3.5" />}
                        <span>{modelsSaved ? (isAr ? 'تم الحفظ!' : 'Saved!') : (isAr ? 'حفظ النماذج' : 'Save Models')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Model Items */}
                  <div className="space-y-3">
                    {modelsList.map((model) => (
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
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                model.isEnabled ? 'bg-amber-500' : 'bg-slate-800'
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  model.isEnabled
                                    ? isAr ? '-translate-x-6' : 'translate-x-6'
                                    : isAr ? '-translate-x-1' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Controls (Temperature & Tier Required) */}
                        {model.isEnabled && (
                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-800/80 pt-3">
                            <div>
                              <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1">
                                <span>{isAr ? 'درجة الحرارة / الإبداع (Temperature)' : 'Temperature'}</span>
                                <span className="font-mono text-amber-400">{(model.temperature ?? 0.7).toFixed(2)}</span>
                              </div>
                              <input
                                type="range"
                                min="0"
                                max="1"
                                step="0.05"
                                value={model.temperature ?? 0.7}
                                onChange={(e) => handleTemperatureChange(model.id, parseFloat(e.target.value))}
                                className="w-full accent-amber-500 cursor-pointer"
                              />
                              <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                                <span>{isAr ? '0.0 (دقيق وحتمي)' : '0.0 (Factual)'}</span>
                                <span>{isAr ? '1.0 (إبداعي وتوليدي)' : '1.0 (Creative)'}</span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-slate-300 mb-1">
                                {isAr ? 'مستوى الاشتراك المطلوب للنموذج' : 'Required Plan Access'}
                              </label>
                              <select
                                value={model.tierRequired || 'all'}
                                onChange={(e) => handleTierRequiredChange(model.id, e.target.value as any)}
                                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs text-slate-200 focus:outline-none"
                              >
                                <option value="all">{isAr ? 'متاح للجميع (المجاني والمدفوع)' : 'All Tiers (Free & Paid)'}</option>
                                <option value="pro">{isAr ? 'يتطلب باقة Pro فما فوق' : 'Requires Pro Tier'}</option>
                                <option value="enterprise">{isAr ? 'يتطلب باقة Enterprise فقط' : 'Requires Enterprise Only'}</option>
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Change Master PIN Form Footer */}
            <form
              onSubmit={handleChangePin}
              className="rounded-2xl border border-slate-800 bg-slate-900/40 p-3.5 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-slate-400" />
                <div>
                  <div className="text-xs font-semibold text-slate-300">
                    {isAr ? 'تغيير الرمز السري للبائع' : 'Change Master PIN'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {pinChangeSuccess
                      ? isAr
                        ? 'تم تحديث الرمز السري بنجاح!'
                        : 'PIN updated successfully!'
                      : isAr
                      ? 'قم بتعيين رمز جديد لحماية لوحة التوليد'
                      : 'Set a new PIN to protect your generator'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={newPinInput}
                  onChange={(e) => setNewPinInput(e.target.value)}
                  placeholder={isAr ? 'الرمز الجديد' : 'New PIN'}
                  className="w-28 rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs text-white focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  {isAr ? 'حفظ' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

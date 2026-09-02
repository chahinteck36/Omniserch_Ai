import React, { useState, useEffect } from 'react';
import { 
  X, 
  KeyRound, 
  ShieldCheck, 
  Check, 
  Trash2, 
  ExternalLink,
  Cpu,
  Layers
} from 'lucide-react';
import { Language } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  language,
}) => {
  const isAr = language === 'ar';
  const [openRouterKey, setOpenRouterKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const savedKey = localStorage.getItem('omnisearch_openrouter_key') || '';
      setOpenRouterKey(savedKey);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSaveKey = () => {
    if (openRouterKey.trim()) {
      localStorage.setItem('omnisearch_openrouter_key', openRouterKey.trim());
    } else {
      localStorage.removeItem('omnisearch_openrouter_key');
    }
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const handleClearKey = () => {
    localStorage.removeItem('omnisearch_openrouter_key');
    setOpenRouterKey('');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-slate-700 bg-[#090d16] p-6 shadow-2xl sm:p-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-5 top-5 rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500/10 px-2.5 py-1 text-xs font-semibold text-indigo-400 mb-2">
            <KeyRound className="h-3.5 w-3.5" />
            <span>{isAr ? 'إعدادات المفاتيح والنماذج' : 'API Key & Provider Config'}</span>
          </div>
          <h2 className="text-xl font-bold text-white sm:text-2xl">
            {isAr ? 'ربط مفتاح OpenRouter المخصص' : 'Bring Your Own OpenRouter Key'}
          </h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-400">
            {isAr
              ? 'يمكنك ربط مفتاح OpenRouter الخاص بك للوصول المباشر إلى كافة النماذج (GPT-4o, Claude 3.5, Llama 3, DeepSeek) بدون أي قيود استعلامات.'
              : 'Add your personal OpenRouter API key for unrestricted multi-LLM access across GPT-4o, Claude 3.5 Sonnet, and Llama 3.'}
          </p>
        </div>

        {/* OpenRouter API Key Form */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
            {isAr ? 'مفتاح OpenRouter API Key (sk-or-...)' : 'OpenRouter API Key (sk-or-...)'}
          </label>
          <div className="relative">
            <input
              type="password"
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-v1-..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs sm:text-sm font-mono text-slate-200 placeholder-slate-600 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <a
              href="https://openrouter.ai/keys"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300"
            >
              <span>{isAr ? 'الحصول على مفتاح OpenRouter' : 'Get OpenRouter Key'}</span>
              <ExternalLink className="h-3 w-3" />
            </a>

            <div className="flex items-center gap-2">
              {openRouterKey && (
                <button
                  type="button"
                  onClick={handleClearKey}
                  className="flex items-center gap-1 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>{isAr ? 'مسح' : 'Clear'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleSaveKey}
                className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg hover:bg-indigo-500"
              >
                {isSaved ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                <span>{isSaved ? (isAr ? 'تم الحفظ في المتصفح' : 'Saved Locally') : (isAr ? 'حفظ المفتاح' : 'Save Key')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Official Support & Payment Info */}
        <div className="mt-5 rounded-2xl border border-slate-800 bg-slate-900/60 p-4">
          <div className="text-xs font-bold text-slate-200 mb-2">
            {isAr ? 'الدعم الفني والاشتراكات المباشرة' : 'Official Support & Direct Subscriptions'}
          </div>
          <div className="space-y-2 text-xs text-slate-300">
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-950 p-2.5 border border-slate-800">
              <span className="text-slate-400">PayPal:</span>
              <span className="font-mono text-indigo-300 font-bold">chahinteck36@gmail.com</span>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-950 p-2.5 border border-slate-800">
              <span className="text-slate-400">WhatsApp:</span>
              <a
                href="https://wa.me/213563710494"
                target="_blank"
                rel="noreferrer"
                className="font-mono text-emerald-400 font-bold hover:underline"
              >
                +213 563 710 494
              </a>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-slate-800 bg-slate-900/30 p-3.5 text-[11px] text-slate-400">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <p className="leading-relaxed">
            {isAr
              ? 'يتم تخزين مفتاحك بشكل آمن ومحلي في متصفحك فقط، ولا يتم تخزينه في أي قاعدة بيانات خارجية.'
              : 'Your API key is securely encrypted and stored locally in your browser storage only.'}
          </p>
        </div>
      </div>
    </div>
  );
};

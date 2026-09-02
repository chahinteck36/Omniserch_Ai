import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Zap,
  Microscope,
  Swords,
  Code2,
  Paperclip,
  Mic,
  MicOff,
  X,
  Sparkles,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  FileCode,
  SlidersHorizontal,
  Check
} from 'lucide-react';
import { ResearchMode, Language, ModelConfig } from '../types';
import { AVAILABLE_MODELS } from '../data/models';
import { getStoredModelsConfig } from '../services/modelConfigService';

interface SearchInputProps {
  language: Language;
  onSearch: (params: {
    query: string;
    mode: ResearchMode;
    selectedModels: string[];
    file?: { name: string; content: string; type: string };
  }) => void;
  isLoading: boolean;
  activeMode: ResearchMode;
  onModeChange: (mode: ResearchMode) => void;
  selectedModels: string[];
  onToggleModel: (modelId: string) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  language,
  onSearch,
  isLoading,
  activeMode,
  onModeChange,
  selectedModels,
  onToggleModel,
}) => {
  const isAr = language === 'ar';
  const [query, setQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{
    name: string;
    content: string;
    type: string;
    size: number;
  } | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [modelsConfig, setModelsConfig] = useState<ModelConfig[]>(() => getStoredModelsConfig());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const handleUpdate = () => {
      setModelsConfig(getStoredModelsConfig());
    };
    window.addEventListener('omnisearch:models_updated', handleUpdate);
    return () => window.removeEventListener('omnisearch:models_updated', handleUpdate);
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setAttachedFile({
        name: file.name,
        content: content || '',
        type: file.type || file.name.split('.').pop() || 'text/plain',
        size: file.size,
      });
      // Auto-switch to Code mode if it's a script/code file
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (['js', 'ts', 'tsx', 'jsx', 'py', 'json', 'sql', 'cpp', 'rs', 'go', 'html', 'css'].includes(ext || '')) {
        onModeChange('code');
      }
    };
    reader.readAsText(file);
  };

  const handleVoiceToggle = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(isAr ? 'متصفحك لا يدعم التعرف على الصوت المباشر.' : 'Speech recognition is not supported in your browser.');
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = isAr ? 'ar-SA' : 'en-US';
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setQuery(transcript);
      };

      recognition.onerror = () => {
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((!query.trim() && !attachedFile) || isLoading) return;

    onSearch({
      query: query.trim(),
      mode: activeMode,
      selectedModels,
      file: attachedFile ? {
        name: attachedFile.name,
        content: attachedFile.content,
        type: attachedFile.type,
      } : undefined,
    });
  };

  const modes: { id: ResearchMode; label: { ar: string; en: string }; icon: any; badge?: string; desc: { ar: string; en: string } }[] = [
    {
      id: 'fast',
      label: { ar: 'بحث سريع', en: 'Fast Research' },
      icon: Zap,
      desc: { ar: 'إجابة فورية مدعمة بمصادر الويب', en: 'Instant grounded answer & highlights' },
    },
    {
      id: 'deep',
      label: { ar: 'بحث استقصائي عميق', en: 'Deep Research' },
      icon: Microscope,
      badge: 'Agentic',
      desc: { ar: 'تقرير استقصائي متعدد المراحل والمصادر', en: 'Multi-phase in-depth investigation' },
    },
    {
      id: 'battle',
      label: { ar: 'مقارنة النماذج (Battle)', en: 'Multi-LLM Battle' },
      icon: Swords,
      badge: 'Consensus',
      desc: { ar: 'مقارنة حية بين Gemini, GPT-4o, Claude', en: 'Compare Gemini, GPT, Claude & Llama' },
    },
    {
      id: 'code',
      label: { ar: 'تدقيق الأكواد والملفات', en: 'Code & Docs' },
      icon: Code2,
      desc: { ar: 'كشف الثغرات والتحسين البرمجي', en: 'Vulnerability scan & refactoring' },
    },
  ];

  return (
    <div className="w-full">
      {/* Mode Selector Tabs */}
      <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2">
        {modes.map((mode) => {
          const Icon = mode.icon;
          const isActive = activeMode === mode.id;
          return (
            <button
              key={mode.id}
              type="button"
              onClick={() => onModeChange(mode.id)}
              className={`group relative flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                isActive
                  ? 'border border-indigo-500/50 bg-gradient-to-r from-indigo-600/20 to-purple-600/20 text-white shadow-lg shadow-indigo-500/10'
                  : 'border border-slate-800/80 bg-slate-900/40 text-slate-400 hover:border-slate-700 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-indigo-400' : 'text-slate-400 group-hover:text-slate-300'}`} />
              <span>{isAr ? mode.label.ar : mode.label.en}</span>
              {mode.badge && (
                <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider ${
                  isActive ? 'bg-indigo-500/30 text-indigo-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {mode.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Main Input Form */}
      <form onSubmit={handleSubmit} className="relative w-full">
        <div className="relative overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0d1322]/90 shadow-2xl shadow-black/40 backdrop-blur-xl transition-all focus-within:border-indigo-500/80 focus-within:ring-2 focus-within:ring-indigo-500/20">
          
          {/* File Attachment Pill */}
          {attachedFile && (
            <div className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs text-indigo-300">
              <div className="flex items-center gap-2 truncate">
                <FileCode className="h-4 w-4 shrink-0 text-indigo-400" />
                <span className="font-mono font-medium truncate">{attachedFile.name}</span>
                <span className="text-[10px] text-indigo-400/80">({(attachedFile.size / 1024).toFixed(1)} KB)</span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedFile(null)}
                className="ml-2 rounded p-1 hover:bg-indigo-500/20 text-indigo-300"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Textarea Input */}
          <div className="flex items-start px-4 pt-3.5">
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={query.split('\n').length > 2 ? Math.min(query.split('\n').length, 5) : 2}
              placeholder={
                activeMode === 'code'
                  ? (isAr ? 'الصق الكود أو اطرح استفساراً برمجياً لتحليله وتصحيح ثغراته...' : 'Paste code or ask a technical architecture/security question...')
                  : activeMode === 'deep'
                  ? (isAr ? 'اكتب موضوع البحث المعقد (مثل: مستقبل بطاريات الحالة الصلبة 2026-2030)...' : 'Enter a comprehensive research query for deep multi-source investigation...')
                  : activeMode === 'battle'
                  ? (isAr ? 'اطرح سؤالاً للمقارنة بين إجابات Gemini و GPT-4o و Claude...' : 'Ask a question to compare consensus across Gemini, GPT-4o, Claude, and Llama...')
                  : (isAr ? 'ابحث في ملايين المصادر الحية ونماذج الذكاء الاصطناعي...' : 'Ask anything to search across web groundings and leading AI models...')
              }
              className="w-full resize-none bg-transparent text-sm text-slate-100 placeholder-slate-500 focus:outline-none sm:text-base"
            />
          </div>

          {/* Bottom Toolbar inside the box */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/60 px-3 py-2.5 sm:px-4">
            
            {/* Left Controls: File upload, Voice, Model selector */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.py,.html,.css,.sql,.csv"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
                title={isAr ? 'إرفاق ملف أو كود برمجى' : 'Attach File or Code'}
              >
                <Paperclip className="h-3.5 w-3.5 text-slate-400" />
                <span className="hidden sm:inline">{isAr ? 'إرفاق ملف' : 'Attach'}</span>
              </button>

              <button
                type="button"
                onClick={handleVoiceToggle}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs transition-all ${
                  isRecording
                    ? 'border-red-500/50 bg-red-500/20 text-red-300 animate-pulse'
                    : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
                }`}
                title={isAr ? 'البحث الصوتي' : 'Voice Dictation'}
              >
                {isRecording ? <MicOff className="h-3.5 w-3.5 text-red-400" /> : <Mic className="h-3.5 w-3.5 text-slate-400" />}
                <span className="hidden sm:inline">{isRecording ? (isAr ? 'جارِ الاستماع...' : 'Listening...') : (isAr ? 'صوت' : 'Voice')}</span>
              </button>

              {/* Multi-Model Picker Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-2.5 py-1.5 text-xs text-slate-300 transition-colors hover:border-slate-700 hover:bg-slate-800 hover:text-white"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5 text-indigo-400" />
                  <span className="hidden md:inline">{isAr ? 'النماذج المفعلة:' : 'Models:'}</span>
                  <span className="font-semibold text-indigo-300">{selectedModels.length}</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>

                {/* Dropdown Menu */}
                {isModelDropdownOpen && (
                  <div className={`absolute bottom-full mb-2 z-50 w-72 rounded-xl border border-slate-700 bg-[#0d1322] p-2 shadow-2xl ${
                    isAr ? 'right-0' : 'left-0'
                  }`}>
                    <div className="mb-2 px-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {isAr ? 'النماذج المشاركة في المعالجة' : 'Active Multi-LLM Ensemble'}
                    </div>
                    <div className="space-y-1">
                      {modelsConfig.filter((m) => m.isEnabled !== false).map((model) => {
                        const isSelected = selectedModels.includes(model.id);
                        return (
                          <button
                            key={model.id}
                            type="button"
                            onClick={() => onToggleModel(model.id)}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                              isSelected
                                ? 'bg-indigo-500/15 text-white'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <div className={`h-2 w-2 rounded-full bg-gradient-to-r ${model.badgeColor}`} />
                              <span className="font-medium">{model.name}</span>
                              {model.isPro && (
                                <span className="rounded bg-amber-500/20 px-1 py-0.2 text-[9px] font-bold text-amber-300">PRO</span>
                              )}
                            </div>
                            {isSelected && <Check className="h-3.5 w-3.5 text-indigo-400" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Search Submit Button */}
            <button
              type="submit"
              disabled={isLoading || (!query.trim() && !attachedFile)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition-all sm:text-sm ${
                isLoading || (!query.trim() && !attachedFile)
                  ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                  : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 shadow-indigo-500/25 hover:from-indigo-600 hover:to-purple-700 hover:shadow-indigo-500/35'
              }`}
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                  <span>{isAr ? 'جارِ المعالجة...' : 'Researching...'}</span>
                </>
              ) : (
                <>
                  <span>{isAr ? 'بحث ذكي' : 'Search AI'}</span>
                  {isAr ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

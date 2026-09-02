import React, { useState } from 'react';
import Markdown from 'react-markdown';
import {
  Swords,
  Sparkles,
  Zap,
  Clock,
  Coins,
  Copy,
  Check,
  Cpu,
  Layers,
  BookOpen,
  BrainCircuit,
  Columns2,
  LayoutGrid
} from 'lucide-react';
import { SearchResult, Language, ModelResponse } from '../types';
import { SourceCitations } from './SourceCitations';

interface BattleResultViewProps {
  result: SearchResult;
  language: Language;
  onSelectQuery: (query: string) => void;
  onToggleBookmark: (resultId: string) => void;
}

export const BattleResultView: React.FC<BattleResultViewProps> = ({
  result,
  language,
}) => {
  const isAr = language === 'ar';
  const models = result.modelResponses || [];
  const [selectedTab, setSelectedTab] = useState<string>(models[0]?.modelId || 'all');
  const [viewLayout, setViewLayout] = useState<'grid' | 'tabs'>('grid');
  const [copiedModel, setCopiedModel] = useState<string | null>(null);

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedModel(id);
    setTimeout(() => setCopiedModel(null), 2000);
  };

  const getModelIcon = (modelId: string) => {
    switch (modelId) {
      case 'gemini':
        return Sparkles;
      case 'gpt4o':
        return Cpu;
      case 'claude35':
        return BookOpen;
      case 'llama3':
        return Layers;
      case 'deepseek':
        return BrainCircuit;
      default:
        return Zap;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-md bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 px-2 py-0.5 text-xs font-semibold text-indigo-300">
              <Swords className="h-3 w-3" />
              {isAr ? 'مقارنة النماذج وإجماع الذكاء الاصطناعي' : 'Multi-LLM Battle & Consensus'}
            </span>
            <span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300">
              {models.length} {isAr ? 'نماذج تمت مقارنتها' : 'Models Evaluated'}
            </span>
          </div>
          <h2 className="mt-1.5 text-lg font-bold text-white sm:text-xl">
            {result.query}
          </h2>
        </div>

        {/* Layout Toggle */}
        <div className="flex items-center rounded-lg border border-slate-800 bg-slate-900/80 p-1">
          <button
            onClick={() => setViewLayout('grid')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              viewLayout === 'grid'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Columns2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isAr ? 'عرض جنباً إلى جنب' : 'Side-by-Side'}</span>
          </button>
          <button
            onClick={() => setViewLayout('tabs')}
            className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
              viewLayout === 'tabs'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{isAr ? 'تبويبات منفصلة' : 'Tabs'}</span>
          </button>
        </div>
      </div>

      {/* Multi-LLM Consensus Synthesis Box */}
      {result.summary && (
        <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-[#0c111e] p-5 shadow-xl">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              {isAr ? 'الإجماع والرؤية المشتركة بين كافة النماذج (Unified Consensus)' : 'Multi-Model Consensus Summary'}
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {result.summary}
          </p>
        </div>
      )}

      {/* Side-by-Side Grid View */}
      {viewLayout === 'grid' ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {models.map((model) => {
            const Icon = getModelIcon(model.modelId);
            return (
              <div
                key={model.modelId}
                className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-[#0d1322] p-5 shadow-xl transition-all hover:border-slate-700"
              >
                <div>
                  {/* Model Header Card */}
                  <div className="mb-3.5 flex items-center justify-between border-b border-slate-800/80 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br ${model.badgeColor} p-0.5 text-white`}>
                        <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#090d16]">
                          <Icon className="h-4 w-4 text-slate-200" />
                        </div>
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-white">{model.modelName}</h4>
                        <span className="text-[10px] text-slate-400">{model.provider}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleCopy(model.content, model.modelId)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                      title={isAr ? 'نسخ إجابة هذا النموذج' : 'Copy response'}
                    >
                      {copiedModel === model.modelId ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>

                  {/* Model Content */}
                  <div className="prose prose-invert prose-sm max-w-none text-xs sm:text-sm leading-relaxed prose-p:text-slate-300">
                    <Markdown>{model.content}</Markdown>
                  </div>
                </div>

                {/* Model Metadata Footer */}
                <div className="mt-4 flex items-center justify-between border-t border-slate-800/60 pt-3 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {model.latencyMs}ms
                  </span>
                  <span className="flex items-center gap-1">
                    <Coins className="h-3 w-3 text-indigo-400" />
                    {model.tokensUsed} tokens
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Tabbed View */
        <div className="rounded-2xl border border-slate-800 bg-[#0d1322] overflow-hidden shadow-2xl">
          {/* Tabs Bar */}
          <div className="flex flex-wrap border-b border-slate-800 bg-slate-950/70 p-2 gap-1.5">
            {models.map((model) => {
              const Icon = getModelIcon(model.modelId);
              const isActive = selectedTab === model.modelId;
              return (
                <button
                  key={model.modelId}
                  onClick={() => setSelectedTab(model.modelId)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                    isActive
                      ? 'border border-indigo-500/50 bg-indigo-600/20 text-white shadow'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{model.modelName}</span>
                </button>
              );
            })}
          </div>

          {/* Active Tab Content */}
          {(() => {
            const active = models.find((m) => m.modelId === selectedTab) || models[0];
            if (!active) return null;
            return (
              <div className="p-6 sm:p-8">
                <div className="mb-4 flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{active.modelName}</span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{active.provider}</span>
                  </div>
                  <button
                    onClick={() => handleCopy(active.content, active.modelId)}
                    className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
                  >
                    {copiedModel === active.modelId ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    <span>{copiedModel === active.modelId ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}</span>
                  </button>
                </div>
                <div className="prose prose-invert max-w-none text-sm leading-relaxed prose-p:text-slate-200">
                  <Markdown>{active.content}</Markdown>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Sources Citations */}
      <SourceCitations sources={result.sources} language={language} />
    </div>
  );
};

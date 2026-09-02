import React, { useState } from 'react';
import Markdown from 'react-markdown';
import {
  Microscope,
  CheckCircle2,
  FileDown,
  Copy,
  Check,
  Bookmark,
  BookmarkCheck,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { SearchResult, Language } from '../types';
import { SourceCitations } from './SourceCitations';

interface DeepResultViewProps {
  result: SearchResult;
  language: Language;
  onSelectQuery: (query: string) => void;
  onToggleBookmark: (resultId: string) => void;
}

export const DeepResultView: React.FC<DeepResultViewProps> = ({
  result,
  language,
  onSelectQuery,
  onToggleBookmark,
}) => {
  const isAr = language === 'ar';
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const textToCopy = `# Deep Research: ${result.query}\n\n${result.detailedReport || result.summary || ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportMarkdown = () => {
    const content = `# Deep Research Report: ${result.query}\nDate: ${new Date(result.timestamp).toLocaleDateString()}\n\n${result.detailedReport || result.summary || ''}\n\n## Sources\n${result.sources.map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join('\n')}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DeepResearch_${result.query.slice(0, 25).replace(/\s+/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-md bg-purple-500/15 px-2 py-0.5 text-xs font-semibold text-purple-300">
              <Microscope className="h-3 w-3" />
              {isAr ? 'تقرير استقصائي عميق (Deep Research)' : 'Multi-Phase Deep Investigation'}
            </span>
            <span className="rounded-md border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[11px] text-slate-300">
              {result.sources.length} {isAr ? 'مراجع تم فحصها' : 'Citations Grounded'}
            </span>
          </div>
          <h2 className="mt-1.5 text-xl font-bold text-white sm:text-2xl">
            {result.query}
          </h2>
        </div>

        {/* Action Toolbar */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleExportMarkdown}
            className="flex items-center gap-1 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-medium text-purple-300 hover:bg-purple-500/20"
            title={isAr ? 'تصدير التقرير كملف Markdown' : 'Export as Markdown'}
          >
            <FileDown className="h-3.5 w-3.5 text-purple-400" />
            <span>{isAr ? 'تصدير التقرير' : 'Export Report'}</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}</span>
          </button>

          <button
            onClick={() => onToggleBookmark(result.id)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              result.isBookmarked
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800'
            }`}
          >
            {result.isBookmarked ? <BookmarkCheck className="h-3.5 w-3.5 text-amber-400" /> : <Bookmark className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Research Phases Pipeline Tracker */}
      {result.deepResearchPhases && result.deepResearchPhases.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-400" />
              {isAr ? 'مراحل ومسار البحث الاستقصائي' : 'Autonomous Research Pipeline Steps'}
            </h3>
            <span className="text-[11px] text-emerald-400 font-medium">
              100% {isAr ? 'مكتمل' : 'Completed'}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {result.deepResearchPhases.map((phase, idx) => (
              <div
                key={phase.id}
                className="flex items-start gap-2.5 rounded-xl border border-slate-800/80 bg-slate-950/60 p-3"
              >
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div>
                  <div className="text-[11px] font-bold text-slate-200">
                    {idx + 1}. {phase.title}
                  </div>
                  {phase.details && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {phase.details}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Deep Report Document View */}
      <div className="rounded-2xl border border-slate-800/80 bg-[#0c111e] p-6 sm:p-8 shadow-2xl">
        <div className="prose prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-2xl prose-h2:text-xl prose-h2:border-b prose-h2:border-slate-800 prose-h2:pb-2 prose-h3:text-lg prose-p:leading-relaxed prose-p:text-slate-300 prose-li:text-slate-300 prose-strong:text-indigo-200 prose-code:text-amber-300">
          <Markdown>{result.detailedReport || result.summary || ''}</Markdown>
        </div>
      </div>

      {/* Sources Citations */}
      <SourceCitations sources={result.sources} language={language} />

      {/* Related Queries */}
      {result.suggestedQueries && result.suggestedQueries.length > 0 && (
        <div className="pt-2">
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            {isAr ? 'محاور بحثية إضافية مقترحة' : 'Deep Dive Exploration Tracks'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.suggestedQueries.map((suggested, idx) => (
              <button
                key={idx}
                onClick={() => onSelectQuery(suggested)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-purple-500/50 hover:bg-slate-800 hover:text-white"
              >
                <span>{suggested}</span>
                <ArrowUpRight className="h-3 w-3 text-purple-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

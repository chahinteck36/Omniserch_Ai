import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { 
  Sparkles, 
  CheckCircle2, 
  Copy, 
  Check, 
  Volume2, 
  VolumeX, 
  Bookmark, 
  BookmarkCheck,
  Clock,
  Zap,
  ArrowUpRight
} from 'lucide-react';
import { SearchResult, Language } from '../types';
import { SourceCitations } from './SourceCitations';

interface FastResultViewProps {
  result: SearchResult;
  language: Language;
  onSelectQuery: (query: string) => void;
  onToggleBookmark: (resultId: string) => void;
}

export const FastResultView: React.FC<FastResultViewProps> = ({
  result,
  language,
  onSelectQuery,
  onToggleBookmark,
}) => {
  const isAr = language === 'ar';
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const handleCopy = () => {
    const textToCopy = `${result.query}\n\n${result.summary || ''}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      alert('Text to speech is not supported in this browser.');
      return;
    }

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const text = result.summary || '';
    const cleanText = text.replace(/[#*`_]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = isAr ? 'ar-SA' : 'en-US';
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  };

  return (
    <div className="space-y-6">
      {/* Search Header Meta */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-md bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-400">
              <Zap className="h-3 w-3" />
              {isAr ? 'بحث سريع ملخص' : 'Fast Grounded Synthesis'}
            </span>
            {result.searchMetadata?.processingTimeMs && (
              <span className="flex items-center gap-1 text-xs text-slate-500">
                <Clock className="h-3 w-3" />
                {(result.searchMetadata.processingTimeMs / 1000).toFixed(2)}s
              </span>
            )}
          </div>
          <h2 className="mt-1 text-lg font-bold text-white sm:text-xl">
            {result.query}
          </h2>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/60 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white"
            title={isAr ? 'نسخ الإجابة' : 'Copy'}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copied ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}</span>
          </button>

          <button
            onClick={handleSpeak}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              isSpeaking
                ? 'border-indigo-500/50 bg-indigo-500/20 text-indigo-300'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
            title={isAr ? 'قراءة صوتية' : 'Read aloud'}
          >
            {isSpeaking ? <VolumeX className="h-3.5 w-3.5 text-indigo-400" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span>{isSpeaking ? (isAr ? 'إيقاف' : 'Stop') : (isAr ? 'استماع' : 'Listen')}</span>
          </button>

          <button
            onClick={() => onToggleBookmark(result.id)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              result.isBookmarked
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-700 hover:bg-slate-800 hover:text-white'
            }`}
            title={isAr ? 'حفظ في المفضلة' : 'Bookmark'}
          >
            {result.isBookmarked ? (
              <BookmarkCheck className="h-3.5 w-3.5 text-amber-400" />
            ) : (
              <Bookmark className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Key Takeaways Card */}
      {result.keyTakeaways && result.keyTakeaways.length > 0 && (
        <div className="rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/30 via-slate-900/50 to-[#0d1322] p-4 sm:p-5 shadow-lg">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-300">
              {isAr ? 'النقاط الجوهرية (Key Takeaways)' : 'Key Takeaways & Core Facts'}
            </h3>
          </div>
          <ul className="space-y-2">
            {result.keyTakeaways.map((takeaway, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200 leading-relaxed">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>{takeaway}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Content Render */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 sm:p-7 shadow-xl">
        <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:text-slate-100 prose-a:text-indigo-400 prose-code:text-amber-300">
          <Markdown>{result.summary || ''}</Markdown>
        </div>
      </div>

      {/* Sources Citations Section */}
      <SourceCitations sources={result.sources} language={language} />

      {/* Suggested Follow-up Queries */}
      {result.suggestedQueries && result.suggestedQueries.length > 0 && (
        <div className="pt-2">
          <h3 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-slate-400">
            {isAr ? 'استفسارات مقترحة ذات صلة' : 'Related Research Inquiries'}
          </h3>
          <div className="flex flex-wrap gap-2">
            {result.suggestedQueries.map((suggested, idx) => (
              <button
                key={idx}
                onClick={() => onSelectQuery(suggested)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs text-slate-300 transition-colors hover:border-indigo-500/50 hover:bg-slate-800 hover:text-white"
              >
                <span>{suggested}</span>
                <ArrowUpRight className="h-3 w-3 text-indigo-400" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

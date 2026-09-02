import React, { useState } from 'react';
import Markdown from 'react-markdown';
import {
  Code2,
  Bug,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  FileCode,
  Terminal,
  ShieldAlert
} from 'lucide-react';
import { SearchResult, Language } from '../types';

interface CodeResultViewProps {
  result: SearchResult;
  language: Language;
}

export const CodeResultView: React.FC<CodeResultViewProps> = ({
  result,
  language,
}) => {
  const isAr = language === 'ar';
  const analysis = result.codeAnalysis;
  const [copiedCode, setCopiedCode] = useState(false);

  const handleCopyCode = () => {
    if (!analysis?.optimizedCode) return;
    navigator.clipboard.writeText(analysis.optimizedCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-400">
              <Code2 className="h-3.5 w-3.5" />
              {isAr ? 'تدقيق الكود والتحليل المعماري' : 'Code & Architecture Audit'}
            </span>
            {result.attachedFileName && (
              <span className="flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-300 font-mono">
                <FileCode className="h-3 w-3 text-indigo-400" />
                {result.attachedFileName}
              </span>
            )}
          </div>
          <h2 className="mt-1.5 text-lg font-bold text-white sm:text-xl">
            {result.query || result.attachedFileName || 'Code Analysis'}
          </h2>
        </div>
      </div>

      {/* Architectural Overview Card */}
      {analysis?.overview && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-xl">
          <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            {isAr ? 'النظرة الهندسية العامة (Architectural Overview)' : 'Architectural Overview'}
          </h3>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {analysis.overview}
          </p>
        </div>
      )}

      {/* Bugs & Vulnerabilities Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Identified Bugs */}
        <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-red-300">
            <ShieldAlert className="h-4 w-4 text-red-400" />
            {isAr ? 'الملاحظات والثغرات المكتشفة' : 'Identified Bugs & Security Risks'}
          </h3>
          {analysis?.bugsOrIssues && analysis.bugsOrIssues.length > 0 ? (
            <ul className="space-y-2">
              {analysis.bugsOrIssues.map((bug, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-red-200/90 leading-relaxed">
                  <Bug className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-400" />
                  <span>{bug}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">{isAr ? 'لم يتم العثور على أخطاء حرجة.' : 'No critical bugs found.'}</p>
          )}
        </div>

        {/* Optimizations */}
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-950/20 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            {isAr ? 'التحسينات المقترحة وإعادة الهيكلة' : 'Refactoring & Optimizations'}
          </h3>
          {analysis?.improvements && analysis.improvements.length > 0 ? (
            <ul className="space-y-2">
              {analysis.improvements.map((imp, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <span>{imp}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-400">{isAr ? 'الكود متوافق مع المعايير.' : 'Code follows standard patterns.'}</p>
          )}
        </div>
      </div>

      {/* Optimized Code Snippet Box */}
      {analysis?.optimizedCode && (
        <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#090d16] shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-semibold text-slate-200">
                {isAr ? 'الكود المصحح والمحسن بالكامل' : 'Optimized & Fixed Implementation'}
              </span>
              {analysis.language && (
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-amber-300">
                  {analysis.language}
                </span>
              )}
            </div>

            <button
              onClick={handleCopyCode}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              {copiedCode ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedCode ? (isAr ? 'تم النسخ' : 'Copied') : (isAr ? 'نسخ الكود' : 'Copy Code')}</span>
            </button>
          </div>

          <div className="p-4 sm:p-6 overflow-x-auto text-xs sm:text-sm">
            <pre className="font-mono text-slate-200">
              <code>{analysis.optimizedCode}</code>
            </pre>
          </div>
        </div>
      )}

      {/* Additional Markdown Explanation */}
      {result.detailedReport && (
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-5 sm:p-6">
          <div className="prose prose-invert max-w-none text-xs sm:text-sm prose-p:text-slate-300">
            <Markdown>{result.detailedReport}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
};

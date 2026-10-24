import React from 'react';
import { ExternalLink, Globe, ShieldCheck, AlertCircle } from 'lucide-react';
import { SearchSource, Language } from '../types';

interface SourceCitationsProps {
  sources: SearchSource[];
  language: Language;
  showWhenEmpty?: boolean;
}

export const SourceCitations: React.FC<SourceCitationsProps> = ({
  sources,
  language,
  showWhenEmpty = false,
}) => {
  const isAr = language === 'ar';
  const count = sources?.length || 0;

  if (count === 0) {
    if (!showWhenEmpty) return null;

    return (
      <div className="w-full rounded-2xl border border-slate-800/80 bg-slate-900/30 p-4 sm:p-5">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-slate-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              {isAr ? 'المصادر والمراجع المستند إليها (0)' : 'Referenced Sources (0)'}
            </h3>
          </div>
          <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-300">
            {isAr ? '0 مصادر موثقة' : '0 Verified Sources'}
          </span>
        </div>
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 leading-relaxed">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p>
            {isAr
              ? 'لم يقم مزود البحث (Google Search Grounding) بإرجاع روابط مصادر خارجية موثقة لهذا الاستعلام. تم توليد النتائج استناداً إلى المعرفة النموذجية للذكاء الاصطناعي دون التحقق المتقاطع مع مصادر ويب مستقلة.'
              : 'No external verified sources were returned by the grounding provider for this query. Results are synthesized from model knowledge without independent external citations.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            {isAr ? `المصادر الحية المستند إليها (${count})` : `Verified Web Sources (${count})`}
          </h3>
        </div>
        <div className="flex items-center gap-1 text-[11px] text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{isAr ? `${count} روابط حية موثقة` : `${count} Grounded Citations`}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {sources.map((source, index) => {
          let domain = '';
          try {
            domain = new URL(source.url).hostname.replace(/^www\./, '');
          } catch {
            domain = 'web source';
          }

          return (
            <a
              key={index}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 transition-all hover:border-slate-700 hover:bg-slate-800/50 hover:shadow-lg hover:shadow-cyan-500/5"
            >
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-400 truncate">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-cyan-950 text-[10px] font-bold text-cyan-300">
                      {index + 1}
                    </span>
                    <span className="truncate">{domain}</span>
                  </div>
                  <ExternalLink className="h-3 w-3 text-slate-500 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                <h4 className="line-clamp-2 text-xs font-semibold text-slate-200 group-hover:text-cyan-300">
                  {source.title}
                </h4>
              </div>

              {source.snippet && (
                <p className="mt-2 line-clamp-2 text-[11px] text-slate-400 leading-relaxed">
                  {source.snippet}
                </p>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
};

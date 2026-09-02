import React, { useState } from 'react';
import { 
  X, 
  Search, 
  Trash2, 
  Clock, 
  Bookmark, 
  Zap, 
  Microscope, 
  Swords, 
  Code2,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { SearchResult, Language } from '../types';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: Language;
  history: SearchResult[];
  onSelectResult: (result: SearchResult) => void;
  onClearHistory: () => void;
  onDeleteHistoryItem: (id: string) => void;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  language,
  history,
  onSelectResult,
  onClearHistory,
  onDeleteHistoryItem,
}) => {
  const isAr = language === 'ar';
  const [filter, setFilter] = useState<'all' | 'bookmarks'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) => {
    const matchesFilter = filter === 'all' || (filter === 'bookmarks' && item.isBookmarked);
    const matchesSearch = item.query.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case 'deep':
        return <Microscope className="h-3.5 w-3.5 text-purple-400" />;
      case 'battle':
        return <Swords className="h-3.5 w-3.5 text-amber-400" />;
      case 'code':
        return <Code2 className="h-3.5 w-3.5 text-emerald-400" />;
      default:
        return <Zap className="h-3.5 w-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col rounded-3xl border border-slate-700 bg-[#090d16] p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white sm:text-xl">
              {isAr ? 'سجل الأبحاث والاستعلامات' : 'Search & Research History'}
            </h2>
            <p className="text-xs text-slate-400">
              {isAr ? `إجمالي العمليات المحفوظة: ${history.length}` : `Saved queries: ${history.length}`}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {history.length > 0 && (
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-medium text-red-300 hover:bg-red-500/20"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{isAr ? 'مسح الكل' : 'Clear All'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="my-4 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex rounded-lg border border-slate-800 bg-slate-900/60 p-1">
            <button
              onClick={() => setFilter('all')}
              className={`rounded px-3 py-1 text-xs font-medium transition-colors ${
                filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {isAr ? 'جميع الأبحاث' : 'All Queries'}
            </button>
            <button
              onClick={() => setFilter('bookmarks')}
              className={`flex items-center gap-1 rounded px-3 py-1 text-xs font-medium transition-colors ${
                filter === 'bookmarks' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Bookmark className="h-3 w-3" />
              <span>{isAr ? 'المفضلة' : 'Bookmarked'}</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={isAr ? 'ابحث في السجل...' : 'Filter history...'}
              className="w-full rounded-xl border border-slate-800 bg-slate-900/70 py-1.5 pl-9 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>
        </div>

        {/* List of items */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="h-10 w-10 text-slate-600 mb-2" />
              <p className="text-xs sm:text-sm text-slate-400">
                {isAr ? 'لا يوجد نتائج في السجل حالياً.' : 'No queries found in your history.'}
              </p>
            </div>
          ) : (
            filteredHistory.map((item) => (
              <div
                key={item.id}
                className="group flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 transition-colors hover:border-slate-700 hover:bg-slate-800/50"
              >
                <div
                  onClick={() => {
                    onSelectResult(item);
                    onClose();
                  }}
                  className="flex-1 cursor-pointer pr-3"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                      {getModeIcon(item.mode)}
                      <span className="uppercase">{item.mode}</span>
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {item.isBookmarked && (
                      <Bookmark className="h-3 w-3 text-amber-400 fill-amber-400" />
                    )}
                  </div>
                  <h4 className="text-xs sm:text-sm font-medium text-slate-200 group-hover:text-indigo-300 line-clamp-1">
                    {item.query}
                  </h4>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onDeleteHistoryItem(item.id)}
                    className="rounded p-1 text-slate-500 hover:bg-red-500/20 hover:text-red-300"
                    title={isAr ? 'حذف من السجل' : 'Delete item'}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => {
                      onSelectResult(item);
                      onClose();
                    }}
                    className="rounded p-1 text-slate-400 group-hover:text-white"
                  >
                    {isAr ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

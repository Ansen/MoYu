import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Animated banner for export progress
 */
export default function ExportProgressBanner({ exportProgress, exportType }) {
  if (!exportProgress) return null;

  const isPdf = exportType === 'pdf';

  return (
    <div className="shrink-0 px-5 py-2.5 bg-indigo-50/90 dark:bg-indigo-950/50 border-t border-indigo-200/80 dark:border-indigo-800/80 space-y-1.5 animate-in fade-in duration-150 select-none">
      <div className="flex items-center justify-between text-[13px] font-medium text-indigo-900 dark:text-indigo-200">
        <span className="flex items-center gap-2">
          <RefreshCw size={13} className="animate-spin text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className="truncate">{exportProgress.text}</span>
        </span>
        <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold shrink-0">{exportProgress.percent}%</span>
      </div>
      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all duration-150 ease-out shadow-xs ${
            isPdf 
              ? 'bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600'
              : 'bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600'
          }`}
          style={{ width: `${exportProgress.percent}%` }}
        />
      </div>
    </div>
  );
}

import React from 'react';
import { useResizable } from '../../hooks/useResizable';
import { useI18n } from '../../i18n';

export default function TocSidebar({ isOpen, toc, bookType, onTocClick, onItemClick }) {
  const { width, startResizing } = useResizable(160, 120, 400);
  const { t } = useI18n();

  if (!isOpen || !toc || toc.length === 0) return null;

  const handleClick = onTocClick || onItemClick;

  return (
    <div className="flex shrink-0 relative h-full select-none" style={{ width }}>
      <div className="w-full h-full bg-slate-50 dark:bg-[#1a1a1a] flex flex-col border-r border-slate-200 dark:border-[#2d2d2d]">
        <div className="p-2.5 text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-[#2d2d2d] flex items-center justify-between">
          <span>{bookType === 'epub' ? t('reader.toc') : t('reader.filelist')}</span>
          <span className="text-[10px] font-mono opacity-60">({toc.length})</span>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-1.5 space-y-0.5">
          {toc.map((item, idx) => (
            <button
              key={item.id !== undefined ? item.id : idx}
              onClick={() => {
                if (handleClick) handleClick(item);
              }}
              className={`w-full text-left px-2.5 py-1.5 text-[12.5px] rounded-md truncate transition-all cursor-pointer ${
                item.isActive 
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold border border-indigo-200/80 dark:border-indigo-800/60 shadow-2xs' 
                  : 'text-slate-600 dark:text-[#cccccc] hover:bg-slate-200/80 dark:hover:bg-[#262626] border border-transparent'
              }`}
              title={item.label}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {/* Resizer Handle */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-10"
        onMouseDown={(e) => startResizing(e, 'col-resize')}
      ></div>
    </div>
  );
}

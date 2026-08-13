import React from 'react';
import { useResizable } from '../../hooks/useResizable';
import { useI18n } from '../../i18n';

export default function TocSidebar({ isOpen, toc, bookType, onTocClick }) {
  const { width, startResizing } = useResizable(120, 120, 400);
  const { t } = useI18n();

  if (!isOpen || toc.length === 0) return null;

  return (
    <div className="flex shrink-0 relative h-full" style={{ width }}>
      <div className="w-full h-full bg-slate-50 dark:bg-[#1a1a1a] flex flex-col">
        <div className="p-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-[#333333]">
          {bookType === 'epub' ? t('reader.toc') : t('reader.filelist')}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {toc.map((item, idx) => (
            <button
              key={item.id || idx}
              onClick={() => onTocClick(item)}
              className={`w-full text-left px-3 py-2 text-[13px] rounded mb-1 truncate transition-colors ${
                item.isActive 
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 font-medium' 
                  : 'text-slate-600 dark:text-[#cccccc] hover:bg-slate-200 dark:hover:bg-[#333333]'
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

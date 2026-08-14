import React from 'react';
import { Folder, BookOpen, FileText } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function RecentFileItem({ item, onClick, onRemove, styleVariant = 'home' }) {
  const { t } = useI18n();
  const isFolder = item.type === 'folder';
  const isEpub = item.type === 'epub' || (item.name && item.name.toLowerCase().endsWith('.epub')) || (item.path && item.path.toLowerCase().endsWith('.epub'));

  const getIconInfo = () => {
    if (isFolder) {
      return {
        icon: <Folder size={styleVariant === 'home' ? 22 : 20} strokeWidth={1.8} />,
        bgClass: 'bg-amber-50 dark:bg-amber-500/10 text-amber-500 dark:text-amber-400'
      };
    }
    if (isEpub) {
      return {
        icon: <BookOpen size={styleVariant === 'home' ? 22 : 20} strokeWidth={1.8} />,
        bgClass: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400'
      };
    }
    return {
      icon: <FileText size={styleVariant === 'home' ? 22 : 20} strokeWidth={1.8} />,
      bgClass: 'bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400'
    };
  };

  const { icon, bgClass } = getIconInfo();
  
  if (styleVariant === 'home') {
    return (
      <div 
        onClick={onClick}
        className="group flex items-center gap-3.5 p-3.5 bg-white dark:bg-[#252526] rounded-xl border border-slate-200 dark:border-[#333333] hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] cursor-pointer transition-all shadow-xs hover:shadow"
      >
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-slate-800 dark:text-[#dddddd] truncate">{item.name}</h3>
          <p className="text-[11px] text-slate-400 dark:text-[#666666] truncate mt-0.5">{item.path}</p>
        </div>
      </div>
    );
  }

  // 'library' variant
  return (
    <div 
      onClick={onClick}
      className="group relative flex items-center gap-3.5 p-3.5 bg-white dark:bg-[#252525] rounded-xl border border-slate-200 dark:border-[#333333] hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md cursor-pointer transition-all"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${bgClass}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 pr-6">
        <h3 className="text-[13px] font-semibold text-slate-800 dark:text-[#dddddd] truncate">{item.name}</h3>
        <p className="text-[11px] text-slate-400 dark:text-[#666666] truncate mt-0.5">{item.path}</p>
      </div>
      {onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e, item.path);
          }}
          className="absolute right-3 opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
          title={t('home.recent.clear')}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>
      )}
    </div>
  );
}

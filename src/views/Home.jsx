import React, { useState, useEffect } from 'react';
import { Languages, Library, FileText, Folder, Play, ArrowRight } from 'lucide-react';
import { useI18n } from '../i18n/index';

export default function HomeView({ setView, recentFiles, openFileProgrammatically }) {
  const { t } = useI18n();
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 6) setGreeting('凌晨好');
    else if (hour < 12) setGreeting('早上好');
    else if (hour < 14) setGreeting('中午好');
    else if (hour < 18) setGreeting('下午好');
    else setGreeting('晚上好');
  }, []);

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-[#1a1a1a] p-8 md:p-12 custom-scrollbar select-none text-slate-800 dark:text-slate-200">
      <div className="max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="space-y-3">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            {greeting}，{t('home.welcome')}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            {t('home.subtitle')}
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Translator Card */}
          <div 
            onClick={() => setView('translator')}
            className="group relative bg-white dark:bg-[#252526] rounded-xl border border-slate-200 dark:border-[#333333] p-8 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Languages size={120} />
            </div>
            <div className="w-14 h-14 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <Languages size={28} />
            </div>
            <h2 className="text-xl font-bold mb-3">{t('home.translator.title')}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
              {t('home.translator.desc')}
            </p>
            <div className="flex items-center text-indigo-600 dark:text-indigo-400 font-medium text-sm gap-1 group-hover:gap-2 transition-all">
              进入工具 <ArrowRight size={16} />
            </div>
          </div>

          {/* Player Card */}
          <div 
            onClick={() => setView('library')}
            className="group relative bg-white dark:bg-[#252526] rounded-xl border border-slate-200 dark:border-[#333333] p-8 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
              <Library size={120} />
            </div>
            <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center mb-6 shadow-sm">
              <Play size={28} className="ml-1" />
            </div>
            <h2 className="text-xl font-bold mb-3">{t('home.player.title')}</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
              {t('home.player.desc')}
            </p>
            <div className="flex items-center text-emerald-600 dark:text-emerald-400 font-medium text-sm gap-1 group-hover:gap-2 transition-all">
              进入工具 <ArrowRight size={16} />
            </div>
          </div>
        </div>

        {/* Recent Files */}
        {recentFiles && recentFiles.length > 0 && (
          <div className="pt-6">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-6">{t('home.recent')}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentFiles.slice(0, 6).map((item, idx) => (
                <div 
                  key={idx}
                  onClick={() => {
                    setView('library');
                    openFileProgrammatically(item.path, item.name, item.type === 'folder');
                  }}
                  className="group flex items-center gap-3 p-4 bg-white dark:bg-[#252526] rounded-lg border border-slate-200 dark:border-[#333333] hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 cursor-pointer transition-all shadow-sm hover:shadow"
                >
                  <div className="text-indigo-500 dark:text-indigo-400 opacity-80 group-hover:opacity-100 shrink-0">
                    {item.type === 'folder' ? <Folder size={24} strokeWidth={1.5} /> : <FileText size={24} strokeWidth={1.5} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-slate-800 dark:text-[#dddddd] truncate">{item.name}</h3>
                    <p className="text-[11px] text-slate-400 dark:text-[#666666] truncate mt-1">{item.path}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

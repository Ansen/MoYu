import React, { useEffect } from 'react';
import { X, Keyboard, Settings2, PlayCircle, BookOpen } from 'lucide-react';
import { useI18n } from '../i18n';

export default function HelpModal({ isOpen, onClose }) {
  const { t } = useI18n();
  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-[#333333]">
        
        {/* Header Background */}
        <div className="h-20 shrink-0 bg-gradient-to-r from-teal-500 to-emerald-600 relative flex items-center justify-between px-6">
          <div className="absolute inset-0 bg-black/10"></div>
          <h1 className="text-xl font-bold text-white drop-shadow-md z-10 flex items-center gap-2">
            <BookOpen size={20} />
            {t('help.title')}
          </h1>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/20 text-white/80 hover:bg-black/40 hover:text-white transition-colors z-20"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 text-slate-700 dark:text-[#cccccc]">
          
          {/* 基础操作 */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400 mb-3 flex items-center gap-2">
              <PlayCircle size={16} />
              {t('help.core.title')}
            </h2>
            <div className="bg-slate-50 dark:bg-[#222222] p-4 rounded-xl border border-slate-100 dark:border-[#2a2a2a] text-[13px] leading-relaxed">
              <p className="mb-2"><strong>{t('help.core.1')}</strong> {t('help.core.1.desc')}</p>
              <p className="mb-2"><strong>{t('help.core.2')}</strong> {t('help.core.2.desc')}</p>
              <p><strong>{t('help.core.3')}</strong> {t('help.core.3.desc')}</p>
            </div>
          </section>

          {/* 发报参数 */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-3 flex items-center gap-2">
              <Settings2 size={16} />
              {t('help.settings.title')}
            </h2>
            <div className="bg-slate-50 dark:bg-[#222222] p-4 rounded-xl border border-slate-100 dark:border-[#2a2a2a] text-[13px] leading-relaxed">
              <p className="mb-2"><strong>{t('help.settings.1')}</strong> {t('help.settings.1.desc')}</p>
              <p className="mb-2"><strong>{t('help.settings.2')}</strong> {t('help.settings.2.desc')}</p>
              <p><strong>{t('help.settings.3')}</strong> {t('help.settings.3.desc')}</p>
            </div>
          </section>

          {/* 快捷键 */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
              <Keyboard size={16} />
              {t('help.shortcuts.title')}
            </h2>
            <div className="bg-slate-50 dark:bg-[#222222] p-4 rounded-xl border border-slate-100 dark:border-[#2a2a2a] text-[13px]">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-[#333333]">
                <span>{t('help.shortcuts.play')}</span>
                <kbd className="px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#444] rounded shadow-sm text-xs font-mono font-bold">{t('help.shortcuts.play.key')}</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-[#333333]">
                <span>{t('help.shortcuts.prev')}</span>
                <kbd className="px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#444] rounded shadow-sm text-xs font-mono font-bold">{t('help.shortcuts.prev.key')}</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-[#333333]">
                <span>{t('help.shortcuts.next')}</span>
                <kbd className="px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#444] rounded shadow-sm text-xs font-mono font-bold">{t('help.shortcuts.next.key')}</kbd>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

import React from 'react';
import { Layers, Play, RefreshCw } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function ModalFooter({
  isGenerating,
  onClose,
  onGenerateBatch,
  onStartPractice
}) {
  const { t } = useI18n();

  return (
    <div className="shrink-0 px-5 py-3.5 bg-slate-50 dark:bg-[#252526] border-t border-slate-200 dark:border-[#333333] flex justify-between gap-3 items-center">
      <button
        type="button"
        onClick={onClose}
        disabled={isGenerating}
        className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#555555] text-slate-600 dark:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[14px] font-medium cursor-pointer"
      >
        {t('generator.btn.cancel')}
      </button>

      <div className="flex items-center gap-2.5">
        {/* Generate Telegram Dataset (for PDF/EPUB multi-page export) */}
        <button
          type="button"
          onClick={onGenerateBatch}
          disabled={isGenerating}
          title={t('generator.btn.generateBatchTip')}
          className="px-4 py-2 rounded-xl border border-orange-300 dark:border-orange-500/50 bg-orange-50/60 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100/80 dark:hover:bg-orange-500/20 transition-all text-[14px] font-medium flex items-center gap-1.5 shadow-2xs cursor-pointer disabled:opacity-50"
        >
          {isGenerating ? (
            <RefreshCw size={14} className="animate-spin" />
          ) : (
            <Layers size={14} />
          )}
          <span>{isGenerating ? t('generator.btn.exporting') : t('generator.btn.generateBatch')}</span>
        </button>

        {/* Start Practice Directly (1-page rapid practice in software) */}
        <button
          type="button"
          onClick={onStartPractice}
          disabled={isGenerating}
          title={t('generator.btn.startPracticeTip')}
          className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-all text-[14px] font-medium flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer disabled:opacity-50"
        >
          <Play size={14} className="fill-current" />
          <span>{t('generator.btn.startPracticeDirect')}</span>
        </button>
      </div>
    </div>
  );
}

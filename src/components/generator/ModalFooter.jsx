import React from 'react';
import { Printer, Download, RefreshCw, Check, Play } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function ModalFooter({
  isExportingPdf,
  isExportingEpub,
  exportStatus,
  onExportPdf,
  onExportEpub,
  onClose,
  onStart
}) {
  const { t } = useI18n();

  return (
    <div className="shrink-0 px-5 py-3.5 bg-slate-50 dark:bg-[#252526] border-t border-slate-200 dark:border-[#333333] flex justify-between gap-3 items-center">
      <div className="flex items-center gap-2">
        {/* Export PDF Button (Print Recommended) */}
        <button
          type="button"
          onClick={onExportPdf}
          disabled={isExportingPdf || isExportingEpub}
          className={`px-3.5 py-2 rounded-xl border flex items-center gap-1.5 transition-all text-[14px] font-medium shadow-xs cursor-pointer ${
            isExportingPdf 
              ? 'border-slate-300 dark:border-[#444444] bg-slate-100 dark:bg-[#222222] text-slate-400 dark:text-slate-500' 
              : 'border-emerald-400/80 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:shadow-md'
          }`}
        >
          {isExportingPdf ? <RefreshCw size={14} className="animate-spin" /> : <Printer size={14} className="text-emerald-600 dark:text-emerald-400" />}
          <span>{isExportingPdf ? t('generator.btn.exporting') : t('generator.btn.exportPdf')}</span>
        </button>

        {/* Export EPUB Button */}
        <button
          type="button"
          onClick={onExportEpub}
          disabled={isExportingPdf || isExportingEpub}
          className={`px-3 py-2 rounded-xl border flex items-center gap-1.5 transition-all text-[14px] font-medium shadow-xs cursor-pointer ${
            isExportingEpub 
              ? 'border-slate-300 dark:border-[#444444] bg-slate-100 dark:bg-[#222222] text-slate-400 dark:text-slate-500' 
              : 'border-slate-300 dark:border-[#444444] bg-white dark:bg-[#252525] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333] hover:shadow-md'
          }`}
        >
          {isExportingEpub ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
          <span>{isExportingEpub ? t('generator.btn.exporting') : t('generator.btn.exportEpub')}</span>
        </button>

        {exportStatus === 'success' && (
          <span className="text-emerald-600 dark:text-emerald-500 text-[14px] font-medium flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-300">
            <Check size={14} className="stroke-[2.5]" />
            {t('generator.pdfExport.successToast')}
          </span>
        )}
        {exportStatus === 'error' && (
          <span className="text-red-500 text-[14px] font-medium animate-in fade-in slide-in-from-left-2 duration-300">
            {t('generator.pdfExport.errorToast')}
          </span>
        )}
      </div>
      
      <div className="flex gap-2.5 items-center">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#555555] text-slate-600 dark:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[14px] font-medium cursor-pointer"
        >
          {t('generator.btn.cancel')}
        </button>
        <button
          type="button"
          onClick={onStart}
          className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-all text-[14px] font-medium flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer"
        >
          <Play size={14} className="fill-current" />
          <span>{t('generator.btn.generate')}</span>
        </button>
      </div>
    </div>
  );
}

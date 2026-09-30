import React from 'react';
import { Printer, Download, RefreshCw, Check, ChevronLeft, FileText, BookOpen, Layers, Hash, Type } from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * Step 2 View: Telegram Dataset Ready & Multi-format Export View
 */
export default function TelegramReadyView({
  dataset,
  isExportingPdf,
  isExportingEpub,
  pdfExported,
  epubExported,
  onExportPdf,
  onExportEpub,
  onRegenerate,
  onBackToConfig,
  onClose,
  isGenerating
}) {
  const { t } = useI18n();

  if (!dataset) return null;

  const { totalPages, totalGroups, totalChars, previewRows = [], title } = dataset;

  return (
    <div className="flex-1 flex flex-col justify-between overflow-hidden animate-in fade-in zoom-in-98 duration-200">
      <div className="flex-1 p-6 space-y-4 overflow-y-auto custom-scrollbar select-none">
        
        {/* Dataset Summary Header */}
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-orange-50/70 dark:bg-orange-500/10 border border-orange-200/80 dark:border-orange-500/30">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-orange-500 ring-4 ring-orange-200 dark:ring-orange-500/20" />
            <div>
              <div className="font-bold text-[15px] text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <span>{title}</span>
              </div>
              <p className="text-[12px] text-slate-500 dark:text-slate-400 mt-0.5">
                {t('generator.ready.tip')}
              </p>
            </div>
          </div>
        </div>

        {/* 3 Metrics Pills */}
        <div className="grid grid-cols-3 gap-2.5">
          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-[#333333] flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-orange-100/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400">
              <Layers size={16} />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">{t('generator.ready.pages')}</div>
              <div className="text-[16px] font-bold font-mono text-slate-700 dark:text-slate-200 leading-tight">
                {totalPages} <span className="text-[12px] font-normal text-slate-400">{t('generator.ready.unitPages', '页')}</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-[#333333] flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-indigo-100/70 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <Hash size={16} />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">{t('generator.ready.groups')}</div>
              <div className="text-[16px] font-bold font-mono text-slate-700 dark:text-slate-200 leading-tight">
                {totalGroups} <span className="text-[12px] font-normal text-slate-400">{t('generator.ready.unitGroups', '组')}</span>
              </div>
            </div>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#252525] border border-slate-200 dark:border-[#333333] flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-100/70 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Type size={16} />
            </div>
            <div>
              <div className="text-[11px] text-slate-400 font-medium">{t('generator.ready.chars')}</div>
              <div className="text-[16px] font-bold font-mono text-slate-700 dark:text-slate-200 leading-tight">
                {totalChars} <span className="text-[12px] font-normal text-slate-400">{t('generator.ready.unitChars', '字')}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Telegram Manuscript Preview */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px] text-slate-500 dark:text-slate-400 font-medium px-0.5">
            <span className="flex items-center gap-1.5">
              <FileText size={13} className="text-orange-500" />
              <span>{t('generator.ready.preview')}</span>
            </span>
            <span className="font-mono text-[11px] text-slate-400">Page 1 / Line 01-04</span>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900 dark:bg-[#151515] text-slate-200 border border-slate-800 dark:border-[#2d2d2d] shadow-inner font-mono text-[13px] leading-relaxed select-text space-y-1">
            {previewRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <span className="text-slate-500 dark:text-slate-600 select-none text-[11px] w-5 text-right font-medium">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <div className="flex-1 flex gap-3 text-slate-200 tracking-wider">
                  {row.map((group, gIdx) => (
                    <span key={gIdx} className="font-bold hover:text-orange-400 transition-colors">
                      {group}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Multi-Format Export Cards */}
        <div className="space-y-2 pt-1">
          <div className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 px-0.5 uppercase tracking-wider">
            {t('generator.exportOptions')}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* PDF Export Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#333333] bg-white dark:bg-[#222222] hover:border-emerald-400/80 dark:hover:border-emerald-700/80 transition-all flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Printer size={18} />
                </div>
                <div>
                  <div className="font-bold text-[14px] text-slate-800 dark:text-slate-200">
                    {t('generator.ready.pdfTitle')}
                  </div>
                  <div className="text-[12px] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">
                    {t('generator.ready.pdfDesc')}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onExportPdf}
                disabled={isExportingPdf || isExportingEpub}
                className={`w-full py-2 px-3 rounded-lg border text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isExportingPdf
                    ? 'border-slate-300 dark:border-[#444444] bg-slate-100 dark:bg-[#2a2a2a] text-slate-400 dark:text-slate-500'
                    : pdfExported
                      ? 'border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                      : 'border-emerald-400/80 dark:border-emerald-700 bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs hover:shadow-md'
                }`}
              >
                {isExportingPdf ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>{t('generator.btn.exporting')}</span>
                  </>
                ) : pdfExported ? (
                  <>
                    <Check size={13} className="stroke-[2.5]" />
                    <span>{t('generator.ready.exported')} ({t('generator.ready.reExport')})</span>
                  </>
                ) : (
                  <>
                    <Printer size={13} />
                    <span>{t('generator.btn.exportPdf')}</span>
                  </>
                )}
              </button>
            </div>

            {/* EPUB Export Card */}
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-[#333333] bg-white dark:bg-[#222222] hover:border-indigo-400/80 dark:hover:border-indigo-700/80 transition-all flex flex-col justify-between gap-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 shrink-0">
                  <BookOpen size={18} />
                </div>
                <div>
                  <div className="font-bold text-[14px] text-slate-800 dark:text-slate-200">
                    {t('generator.ready.epubTitle')}
                  </div>
                  <div className="text-[12px] text-slate-400 dark:text-slate-500 leading-snug mt-0.5">
                    {t('generator.ready.epubDesc')}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onExportEpub}
                disabled={isExportingPdf || isExportingEpub}
                className={`w-full py-2 px-3 rounded-lg border text-[13px] font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  isExportingEpub
                    ? 'border-slate-300 dark:border-[#444444] bg-slate-100 dark:bg-[#2a2a2a] text-slate-400 dark:text-slate-500'
                    : epubExported
                      ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400'
                      : 'border-indigo-400/80 dark:border-indigo-700 bg-indigo-500 hover:bg-indigo-600 text-white shadow-xs hover:shadow-md'
                }`}
              >
                {isExportingEpub ? (
                  <>
                    <RefreshCw size={13} className="animate-spin" />
                    <span>{t('generator.btn.exporting')}</span>
                  </>
                ) : epubExported ? (
                  <>
                    <Check size={13} className="stroke-[2.5]" />
                    <span>{t('generator.ready.exported')} ({t('generator.ready.reExport')})</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span>{t('generator.btn.exportEpub')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Footer Actions */}
      <div className="shrink-0 px-5 py-3.5 bg-slate-50 dark:bg-[#252526] border-t border-slate-200 dark:border-[#333333] flex justify-between gap-3 items-center">
        <div className="flex items-center gap-2">
          {/* Back to Parameters Button */}
          <button
            type="button"
            onClick={onBackToConfig}
            disabled={isExportingPdf || isExportingEpub || isGenerating}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-[#444444] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[13px] font-medium flex items-center gap-1 cursor-pointer"
          >
            <ChevronLeft size={15} />
            <span>{t('generator.ready.backToConfig')}</span>
          </button>

          {/* Regenerate Button */}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isExportingPdf || isExportingEpub || isGenerating}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-[#444444] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[13px] font-medium flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={13} className={isGenerating ? 'animate-spin text-orange-500' : ''} />
            <span>{t('generator.ready.regenerate')}</span>
          </button>
        </div>

        {/* Done / Close Dialog Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isExportingPdf || isExportingEpub || isGenerating}
          className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-all text-[14px] font-medium flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer"
        >
          <Check size={15} />
          <span>{t('generator.ready.done')}</span>
        </button>
      </div>
    </div>
  );
}

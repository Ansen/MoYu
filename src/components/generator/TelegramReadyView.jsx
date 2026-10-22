import React from 'react';
import { Printer, Download, RefreshCw, Check, ChevronLeft, FileText, BookOpen, Layers, Hash, Type } from 'lucide-react';
import { useI18n } from '../../i18n';

/**
 * Step 2 View: Telegram Dataset Ready & Multi-format Export View
 */
export default function TelegramReadyView({
  dataset,
  selectedFormats = { pdf: true, epub: true },
  onToggleFormat,
  isExportingPdf,
  isExportingEpub,
  pdfExported,
  epubExported,
  onExportSelected,
  onRegenerate,
  onBackToConfig,
  onClose,
  isGenerating
}) {
  const { t, lang } = useI18n();
  const isEn = lang === 'en';

  if (!dataset) return null;

  const { totalPages, totalGroups, totalChars, previewRows = [], title } = dataset;
  const isExporting = isExportingPdf || isExportingEpub;
  const hasSelection = Boolean(selectedFormats.pdf || selectedFormats.epub);
  const allSelectedExported =
    hasSelection &&
    (!selectedFormats.pdf || pdfExported) &&
    (!selectedFormats.epub || epubExported);

  const getExportButtonLabel = () => {
    if (isExporting) {
      return t('generator.btn.exporting');
    }
    if (!hasSelection) {
      return isEn ? 'Select Format to Export' : '请勾选导出格式';
    }
    if (selectedFormats.pdf && selectedFormats.epub) {
      return isEn ? 'Export Both (PDF + EPUB)' : '导出报底 (PDF + EPUB)';
    }
    if (selectedFormats.pdf) {
      return t('generator.btn.exportPdf');
    }
    return t('generator.btn.exportEpub');
  };

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

        {/* Multi-Format Export Checkbox Cards */}
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[12px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              {t('generator.exportOptions')}
            </span>
            <span className="text-[11px] text-slate-400 dark:text-slate-500">
              {isEn ? 'Select formats to export together' : '勾选格式，一键同时生成同名文件'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* PDF Checkbox Card */}
            <div
              role="checkbox"
              aria-checked={selectedFormats.pdf}
              tabIndex={0}
              onClick={() => !isExporting && onToggleFormat?.('pdf')}
              onKeyDown={(e) => {
                if ((e.key === ' ' || e.key === 'Enter') && !isExporting) {
                  e.preventDefault();
                  onToggleFormat?.('pdf');
                }
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-xs select-none ${
                selectedFormats.pdf
                  ? 'border-emerald-500/80 dark:border-emerald-600/80 bg-emerald-50/35 dark:bg-emerald-950/20 ring-1 ring-emerald-500/20'
                  : 'border-slate-200 dark:border-[#333333] bg-white dark:bg-[#222222] opacity-70 hover:opacity-100 hover:border-slate-300 dark:hover:border-[#444]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                    selectedFormats.pdf
                      ? 'bg-emerald-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-[#2d2d2d] text-slate-400'
                  }`}>
                    <Printer size={17} />
                  </div>
                  <div>
                    <div className="font-bold text-[14px] text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                      <span>{t('generator.ready.pdfTitle')}</span>
                      {pdfExported && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                          <Check size={10} className="stroke-[3]" />
                          {t('generator.ready.exported')}
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug mt-1">
                      {t('generator.ready.pdfDesc')}
                    </div>
                  </div>
                </div>

                {/* Custom Checkbox Indicator */}
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all mt-0.5 ${
                    selectedFormats.pdf
                      ? 'bg-emerald-500 border-emerald-500 text-white shadow-2xs'
                      : 'border-slate-300 dark:border-[#4a4a4a] bg-white dark:bg-[#1a1a1a]'
                  }`}
                >
                  {selectedFormats.pdf && <Check size={13} className="stroke-[3]" />}
                </div>
              </div>
            </div>

            {/* EPUB Checkbox Card */}
            <div
              role="checkbox"
              aria-checked={selectedFormats.epub}
              tabIndex={0}
              onClick={() => !isExporting && onToggleFormat?.('epub')}
              onKeyDown={(e) => {
                if ((e.key === ' ' || e.key === 'Enter') && !isExporting) {
                  e.preventDefault();
                  onToggleFormat?.('epub');
                }
              }}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-xs select-none ${
                selectedFormats.epub
                  ? 'border-indigo-500/80 dark:border-indigo-600/80 bg-indigo-50/35 dark:bg-indigo-950/20 ring-1 ring-indigo-500/20'
                  : 'border-slate-200 dark:border-[#333333] bg-white dark:bg-[#222222] opacity-70 hover:opacity-100 hover:border-slate-300 dark:hover:border-[#444]'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5">
                  <div className={`p-2 rounded-lg shrink-0 transition-colors ${
                    selectedFormats.epub
                      ? 'bg-indigo-500 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-[#2d2d2d] text-slate-400'
                  }`}>
                    <BookOpen size={17} />
                  </div>
                  <div>
                    <div className="font-bold text-[14px] text-slate-800 dark:text-slate-100 flex items-center gap-1.5 flex-wrap">
                      <span>{t('generator.ready.epubTitle')}</span>
                      {epubExported && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                          <Check size={10} className="stroke-[3]" />
                          {t('generator.ready.exported')}
                        </span>
                      )}
                    </div>
                    <div className="text-[12px] text-slate-500 dark:text-slate-400 leading-snug mt-1">
                      {t('generator.ready.epubDesc')}
                    </div>
                  </div>
                </div>

                {/* Custom Checkbox Indicator */}
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all mt-0.5 ${
                    selectedFormats.epub
                      ? 'bg-indigo-500 border-indigo-500 text-white shadow-2xs'
                      : 'border-slate-300 dark:border-[#4a4a4a] bg-white dark:bg-[#1a1a1a]'
                  }`}
                >
                  {selectedFormats.epub && <Check size={13} className="stroke-[3]" />}
                </div>
              </div>
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
            disabled={isExporting || isGenerating}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-[#444444] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[13px] font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <ChevronLeft size={15} />
            <span>{t('generator.ready.backToConfig')}</span>
          </button>

          {/* Regenerate Button */}
          <button
            type="button"
            onClick={onRegenerate}
            disabled={isExporting || isGenerating}
            className="px-3 py-2 rounded-xl border border-slate-300 dark:border-[#444444] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[13px] font-medium flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw size={13} className={isGenerating ? 'animate-spin text-orange-500' : ''} />
            <span>{t('generator.ready.regenerate')}</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {allSelectedExported && (
            <button
              type="button"
              onClick={onClose}
              disabled={isExporting || isGenerating}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#444444] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[13px] font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} />
              <span>{t('generator.ready.done')}</span>
            </button>
          )}

          {/* Primary Export Button */}
          <button
            type="button"
            onClick={onExportSelected}
            disabled={!hasSelection || isExporting || isGenerating}
            className={`px-5 py-2 rounded-xl transition-all text-[14px] font-medium flex items-center gap-1.5 shadow-xs cursor-pointer ${
              !hasSelection || isExporting
                ? 'bg-slate-300 dark:bg-[#383838] text-slate-500 dark:text-slate-400 cursor-not-allowed'
                : allSelectedExported
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white hover:shadow-md'
                : 'bg-orange-500 hover:bg-orange-600 text-white hover:shadow-md'
            }`}
          >
            {isExporting ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : allSelectedExported ? (
              <Check size={15} className="stroke-[2.5]" />
            ) : (
              <Download size={15} />
            )}
            <span>
              {allSelectedExported && !isExporting
                ? `${t('generator.ready.exported')} · ${t('generator.ready.reExport')}`
                : getExportButtonLabel()}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

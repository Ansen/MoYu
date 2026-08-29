import React from 'react';
import { useI18n } from '../../i18n';

/**
 * Sub-component for export pages and paragraph marker settings
 */
export default function ExportSettingsSection({
  exportPages,
  setExportPages,
  effectiveLength,
  epubStartMarker,
  setEpubStartMarker,
  epubEndMarker,
  setEpubEndMarker
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#333333]">
      <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <span className="w-1.5 h-3.5 bg-emerald-500 rounded-full inline-block"></span>
        {t('generator.exportOptions')}
      </label>
      <div className="space-y-2">
        <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#252525]/60 border border-slate-200/80 dark:border-[#333333]">
          <div className="flex flex-col">
            <span className="text-[15px] text-slate-700 dark:text-slate-300 font-medium">
              {t('generator.exportPages')}
            </span>
            <span className="text-[12px] text-slate-400 dark:text-slate-500">
              {t('generator.pdfExport.desc')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="1000"
              value={exportPages}
              onChange={(e) => setExportPages(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-24 h-8 px-2.5 text-[15px] font-mono text-right bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#444444] rounded-lg focus:outline-hidden focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors shadow-2xs"
            />
            <span className="text-[13px] text-slate-500">{t('reader.pages.unit', '页')}</span>
          </div>
        </div>

        {/* Start & End Marker inputs for non-print / paragraph mode */}
        {effectiveLength > 5 && (
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#252525]/60 border border-slate-200/80 dark:border-[#333333]">
              <span className="text-[13px] text-slate-500 font-medium">{t('generator.epubStartMarker')}</span>
              <input
                type="text"
                value={epubStartMarker}
                onChange={(e) => setEpubStartMarker(e.target.value)}
                placeholder="e.g. ==="
                className="w-full h-8 px-2 text-[14px] font-mono bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#444444] rounded-lg focus:outline-hidden focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50 dark:bg-[#252525]/60 border border-slate-200/80 dark:border-[#333333]">
              <span className="text-[13px] text-slate-500 font-medium">{t('generator.epubEndMarker')}</span>
              <input
                type="text"
                value={epubEndMarker}
                onChange={(e) => setEpubEndMarker(e.target.value)}
                placeholder="e.g. iii"
                className="w-full h-8 px-2 text-[14px] font-mono bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#444444] rounded-lg focus:outline-hidden focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

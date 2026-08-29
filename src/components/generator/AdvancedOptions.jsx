import React from 'react';
import { useI18n } from '../../i18n';

export default function AdvancedOptions({
  presetMode,
  includeSymbols,
  setIncludeSymbols,
  includeCallsignSuffix,
  setIncludeCallsignSuffix,
  noAdjacentDup,
  setNoAdjacentDup
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-2.5">
      <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <span className="w-1.5 h-3.5 bg-orange-500 rounded-full inline-block"></span>
        {t('generator.options')}
      </label>
      <div className="space-y-2 bg-slate-50/80 dark:bg-[#1a1a1a] p-3 rounded-xl border border-slate-200/80 dark:border-[#2d2d2d]">
        {presetMode === 'callsigns' ? (
          /* Callsign Suffix Option */
          <label className="flex items-center justify-between text-slate-700 dark:text-slate-300 cursor-pointer select-none py-0.5">
            <span className="text-[16px]">{t('generator.options.includeCallsignSuffix')}</span>
            <input
              type="checkbox"
              checked={includeCallsignSuffix}
              onChange={(e) => setIncludeCallsignSuffix(e.target.checked)}
              className="w-4 h-4 rounded text-orange-600 accent-orange-500 cursor-pointer"
            />
          </label>
        ) : (
          <>
            {/* Option 1: Include Punctuation */}
            <label className="flex items-center justify-between text-slate-700 dark:text-slate-300 cursor-pointer select-none py-0.5">
              <span className="text-[16px]">{t('generator.options.includeSymbols')}</span>
              <input
                type="checkbox"
                checked={includeSymbols}
                onChange={(e) => setIncludeSymbols(e.target.checked)}
                className="w-4 h-4 rounded text-orange-600 accent-orange-500 cursor-pointer"
              />
            </label>

            <div className="h-px bg-slate-200/60 dark:bg-[#2c2c2c]" />

            {/* Option 2: Disallow Adjacent Duplicates */}
            <label className="flex items-center justify-between text-slate-700 dark:text-slate-300 cursor-pointer select-none py-0.5">
              <span className="text-[16px]">{t('generator.options.noAdjacentDup')}</span>
              <input
                type="checkbox"
                checked={noAdjacentDup}
                onChange={(e) => setNoAdjacentDup(e.target.checked)}
                className="w-4 h-4 rounded text-orange-600 accent-orange-500 cursor-pointer"
              />
            </label>
          </>
        )}
      </div>
    </div>
  );
}

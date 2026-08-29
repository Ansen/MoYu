import React from 'react';
import { useI18n } from '../../i18n';

export default function GroupCountSelector({
  groupCount,
  setGroupCount,
  isCustomCount,
  setIsCustomCount,
  customCountInput,
  setCustomCountInput
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-2">
      <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <span className="w-1.5 h-3.5 bg-orange-500 rounded-full inline-block"></span>
        {t('generator.groupCount')}
      </label>
      <div className="grid grid-cols-3 gap-2.5">
        {[50, 100].map((cnt) => (
          <button
            key={cnt}
            type="button"
            onClick={() => { setGroupCount(cnt); setIsCustomCount(false); }}
            className={`h-12 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              !isCustomCount && groupCount === cnt
                ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
            }`}
          >
            <span>{t(`generator.groupCount.${cnt}`)}</span>
          </button>
        ))}

        {/* Custom Count */}
        <div
          onClick={() => setIsCustomCount(true)}
          className={`h-12 px-3 rounded-xl border flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
            isCustomCount
              ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
              : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
          }`}
        >
          <span className="text-[16px]">{t('generator.groupLength.custom')}</span>
          <input
            type="number"
            min="1"
            max="10000"
            value={customCountInput}
            onFocus={() => setIsCustomCount(true)}
            onChange={(e) => {
              setIsCustomCount(true);
              setCustomCountInput(e.target.value);
            }}
            className="w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-center bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#444444] rounded px-1 py-0.5 text-[16px] font-mono focus:outline-hidden"
          />
        </div>
      </div>
    </div>
  );
}

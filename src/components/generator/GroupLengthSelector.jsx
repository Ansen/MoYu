import React from 'react';
import { useI18n } from '../../i18n';

export default function GroupLengthSelector({
  presetMode,
  groupLength,
  setGroupLength,
  isCustomLength,
  setIsCustomLength,
  customLengthInput,
  setCustomLengthInput,
  recommendedLength,
  maxDigitsPerGroup,
  setMaxDigitsPerGroup,
  isCustomMaxDigits,
  setIsCustomMaxDigits,
  customMaxDigitsInput,
  setCustomMaxDigitsInput,
  maxAllowedDigits
}) {
  const { t } = useI18n();

  if (presetMode === 'callsigns') return null;

  return (
    <>
      <div className="space-y-2">
        <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <span className="w-1.5 h-3.5 bg-orange-500 rounded-full inline-block"></span>
          {t('generator.groupLength')}
        </label>
        <div className="grid grid-cols-3 gap-2.5">
          {/* 4 Chars */}
          <button
            type="button"
            onClick={() => { setGroupLength(4); setIsCustomLength(false); }}
            className={`relative h-12 px-3 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              !isCustomLength && groupLength === 4
                ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
            }`}
          >
            <span>{t('generator.groupLength.4')}</span>
            {recommendedLength === 4 && (
              <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[15px] font-bold tracking-tight shadow-xs leading-none">
                {t('generator.recommended')}
              </span>
            )}
          </button>

          {/* 5 Chars */}
          <button
            type="button"
            onClick={() => { setGroupLength(5); setIsCustomLength(false); }}
            className={`relative h-12 px-3 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
              !isCustomLength && groupLength === 5
                ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
            }`}
          >
            <span>{t('generator.groupLength.5')}</span>
            {recommendedLength === 5 && (
              <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[15px] font-bold tracking-tight shadow-xs leading-none">
                {t('generator.recommended')}
              </span>
            )}
          </button>

          {/* Custom Chars */}
          <div
            onClick={() => setIsCustomLength(true)}
            className={`h-12 px-3 rounded-xl border flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
              isCustomLength
                ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
            }`}
          >
            <span className="text-[16px]">{t('generator.groupLength.custom')}</span>
            <input
              type="number"
              min="2"
              max="10"
              value={customLengthInput}
              onFocus={() => setIsCustomLength(true)}
              onChange={(e) => {
                setIsCustomLength(true);
                setCustomLengthInput(e.target.value);
              }}
              className="w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-center bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#444444] rounded px-1 py-0.5 text-[16px] font-mono focus:outline-hidden"
            />
          </div>
        </div>
      </div>

      {/* Max Digits Per Group (Only for Mixed Mode) */}
      {presetMode === 'mixed' && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-orange-500 rounded-full inline-block"></span>
              <span>{t('generator.maxDigitsPerGroup')}</span>
            </label>
            <span className="text-[15px] text-slate-400 dark:text-slate-500 font-mono">
              {t('generator.maxDigitsPerGroup.desc', { max: maxAllowedDigits })}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            {[1, 2].map((val) => {
              const isDisabled = val > maxAllowedDigits;
              return (
                <button
                  key={val}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => { setMaxDigitsPerGroup(val); setIsCustomMaxDigits(false); }}
                  className={`h-12 px-3 rounded-xl border flex items-center justify-center transition-all ${
                    isDisabled
                      ? 'border-slate-200 dark:border-[#333333] bg-slate-100/50 dark:bg-[#1a1a1a] text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                      : !isCustomMaxDigits && maxDigitsPerGroup === val
                        ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs cursor-pointer'
                        : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400 cursor-pointer'
                  }`}
                >
                  <div className="flex items-baseline gap-1">
                    <span className="text-[16px] font-medium leading-none">{val}</span>
                    <span className="text-[15px] font-mono leading-none">{t('generator.maxDigitsPerGroup.unit')}</span>
                  </div>
                </button>
              );
            })}

            {/* Custom Max Digits */}
            <div
              onClick={() => { if(maxAllowedDigits >= 3) setIsCustomMaxDigits(true); }}
              className={`h-12 px-3 rounded-xl border flex items-center justify-between gap-1.5 transition-all ${
                maxAllowedDigits < 3
                  ? 'border-slate-200 dark:border-[#333333] bg-slate-100/50 dark:bg-[#1a1a1a] text-slate-400 dark:text-slate-600 cursor-not-allowed opacity-50'
                  : isCustomMaxDigits
                    ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs cursor-pointer'
                    : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400 cursor-pointer'
              }`}
            >
              <span className="text-[16px]">{t('generator.groupLength.custom')}</span>
              <input
                type="number"
                min="1"
                max={maxAllowedDigits}
                value={customMaxDigitsInput}
                disabled={maxAllowedDigits < 3}
                onFocus={() => { if(maxAllowedDigits >= 3) setIsCustomMaxDigits(true); }}
                onChange={(e) => {
                  setIsCustomMaxDigits(true);
                  setCustomMaxDigitsInput(e.target.value);
                }}
                className="w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none text-center bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#444444] rounded px-1 py-0.5 text-[16px] font-mono focus:outline-hidden disabled:opacity-50"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}

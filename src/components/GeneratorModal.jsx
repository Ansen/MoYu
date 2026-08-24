import React, { useState, useMemo } from 'react';
import { X, Sparkles, RefreshCw, Check, Play, Settings2, Dices, CaseSensitive, Shuffle, Radio } from 'lucide-react';
import { useI18n } from '../i18n';
import { generateStructuredRandomContent } from '../utils/morse/structuredRandom';

export default function GeneratorModal({ isOpen, onClose, onGenerate }) {
  const { t } = useI18n();

  // Primary Mode: 'numbers' | 'letters' | 'mixed' | 'callsigns'
  const [presetMode, setPresetMode] = useState('mixed');
  const [includeSymbols, setIncludeSymbols] = useState(false);
  const [includeCallsignSuffix, setIncludeCallsignSuffix] = useState(false);
  const [groupLength, setGroupLength] = useState(4);
  const [isCustomLength, setIsCustomLength] = useState(false);
  const [customLengthInput, setCustomLengthInput] = useState('4');
  const [maxDigitsPerGroup, setMaxDigitsPerGroup] = useState(1);
  const [groupCount, setGroupCount] = useState(100);
  const [noAdjacentDup, setNoAdjacentDup] = useState(true);
  const [previewSeed, setPreviewSeed] = useState(0);

  // Recommended length: Letters -> 5 chars, Numbers / Mixed -> 4 chars
  const recommendedLength = useMemo(() => {
    if (presetMode === 'letters') return 5;
    return 4;
  }, [presetMode]);

  // Mode switcher: automatically sets recommended length
  const handleSelectPresetMode = (mode) => {
    setPresetMode(mode);
    setIsCustomLength(false);
    if (mode === 'letters') {
      setGroupLength(5);
    } else {
      setGroupLength(4);
    }
  };

  // Derive pool based on preset mode + optional punctuation
  const pool = useMemo(() => {
    const p = [];
    if (presetMode === 'numbers') {
      p.push(...'0123456789'.split(''));
    } else if (presetMode === 'letters') {
      p.push(...'abcdefghijklmnopqrstuvwxyz'.split(''));
    } else {
      p.push(...'0123456789abcdefghijklmnopqrstuvwxyz'.split(''));
    }
    if (includeSymbols) {
      p.push(...['/', '?', ',', '.', '=']);
    }
    return p;
  }, [presetMode, includeSymbols]);

  const effectiveLength = useMemo(() => {
    if (isCustomLength) {
      const parsed = parseInt(customLengthInput, 10);
      return Math.max(1, Math.min(12, isNaN(parsed) ? 4 : parsed));
    }
    return groupLength;
  }, [isCustomLength, customLengthInput, groupLength]);

  const maxAllowedDigits = useMemo(() => {
    return Math.max(1, effectiveLength - 1);
  }, [effectiveLength]);

  const effectiveMaxDigits = useMemo(() => {
    return Math.min(maxDigitsPerGroup, maxAllowedDigits);
  }, [maxDigitsPerGroup, maxAllowedDigits]);

  // Live preview snippet
  const previewText = useMemo(() => {
    if (previewSeed < 0) return '';
    try {
      if (presetMode === 'callsigns') {
        const sample = generateStructuredRandomContent({
          mode: 'callsigns',
          groupCount: 4,
          includeCallsignSuffix
        });
        if (sample && sample.groups && sample.groups.length > 0) {
          return `=== ${sample.groups.map(g => g.join('')).join(' ')} ... iii`;
        }
      }
      const sample = generateStructuredRandomContent({
        mode: 'custom',
        pool,
        charsPerGroup: effectiveLength,
        maxDigitsPerGroup: presetMode === 'mixed' ? effectiveMaxDigits : null,
        groupCount: 4,
        allowAdjacentDuplicate: !noAdjacentDup,
        customProfile: true
      });
      if (sample && sample.groups && sample.groups.length > 0) {
        return `=== ${sample.groups.map(g => g.join('')).join(' ')} ... iii`;
      }
    } catch {}
    return '=== 48AK 9B2Z 01XP M7D3 ... iii';
  }, [pool, effectiveLength, effectiveMaxDigits, presetMode, includeCallsignSuffix, noAdjacentDup, previewSeed]);

  if (!isOpen) return null;

  const handleStart = () => {
    let typeDesc = t('generator.title.mixed');
    if (presetMode === 'numbers') typeDesc = t('generator.title.numbers');
    else if (presetMode === 'letters') typeDesc = t('generator.title.letters');
    else if (presetMode === 'callsigns') typeDesc = t('generator.title.callsigns');

    if (presetMode === 'callsigns') {
      const suffixTag = includeCallsignSuffix ? ` · ${t('generator.title.withSymbols')}` : '';
      const config = {
        mode: 'callsigns',
        groupCount,
        includeCallsignSuffix,
        title: `${typeDesc} (${groupCount} ${t('generator.title.groups')}${suffixTag})`
      };
      onGenerate(config);
      onClose();
      return;
    }

    const suffix = includeSymbols ? ` ${t('generator.title.withSymbols')}` : '';
    const digitsInfo = presetMode === 'mixed' ? ` · ${t('generator.title.maxDigits', { count: effectiveMaxDigits })}` : '';
    const config = {
      mode: 'custom',
      pool,
      charsPerGroup: effectiveLength,
      maxDigitsPerGroup: presetMode === 'mixed' ? effectiveMaxDigits : null,
      groupCount,
      allowAdjacentDuplicate: !noAdjacentDup,
      customProfile: true,
      title: `${typeDesc} (${effectiveLength} ${t('generator.title.chars')}${digitsInfo} · ${groupCount} ${t('generator.title.groups')}${suffix})`
    };

    onGenerate(config);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-[#333333] rounded-2xl shadow-2xl w-[520px] max-w-[94vw] h-[580px] max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="shrink-0 h-12 flex items-center justify-between px-5 bg-slate-50 dark:bg-[#252526] border-b border-slate-200 dark:border-[#333333]">
          <div className="flex items-center gap-2 font-bold text-[14px] text-slate-800 dark:text-[#dddddd]">
            <Sparkles size={16} className="text-orange-500" />
            <span>{t('generator.modal.title')}</span>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-[#ffffff] hover:bg-slate-200/50 dark:hover:bg-[#333333] transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 p-6 space-y-5 text-[13px] text-slate-700 dark:text-[#cccccc] overflow-y-auto custom-scrollbar">
          
          {/* 1. Practice Mode (Single-click switch between 3 core types) */}
          <div className="space-y-2">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-orange-500 rounded-full inline-block"></span>
              {t('generator.mode.type')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              {/* Numbers */}
              <button
                type="button"
                onClick={() => handleSelectPresetMode('numbers')}
                className={`h-[68px] px-3.5 rounded-xl border flex flex-col justify-center gap-1 transition-all cursor-pointer ${
                  presetMode === 'numbers'
                    ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                    : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <Dices size={15} className="shrink-0" />
                    <span className="truncate text-[13px]">{t('generator.mode.numbers')}</span>
                  </div>
                  {presetMode === 'numbers' && <Check size={14} className="stroke-[2.5] shrink-0" />}
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono text-left">{t('generator.mode.numbers.sub')}</span>
              </button>

              {/* Letters */}
              <button
                type="button"
                onClick={() => handleSelectPresetMode('letters')}
                className={`h-[68px] px-3.5 rounded-xl border flex flex-col justify-center gap-1 transition-all cursor-pointer ${
                  presetMode === 'letters'
                    ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                    : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <CaseSensitive size={16} className="shrink-0" />
                    <span className="truncate text-[13px]">{t('generator.mode.letters')}</span>
                  </div>
                  {presetMode === 'letters' && <Check size={14} className="stroke-[2.5] shrink-0" />}
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono text-left">{t('generator.mode.letters.sub')}</span>
              </button>

              {/* Mixed */}
              <button
                type="button"
                onClick={() => handleSelectPresetMode('mixed')}
                className={`h-[68px] px-3.5 rounded-xl border flex flex-col justify-center gap-1 transition-all cursor-pointer ${
                  presetMode === 'mixed'
                    ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                    : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shuffle size={15} className="shrink-0" />
                    <span className="truncate text-[13px]">{t('generator.mode.mixed')}</span>
                  </div>
                  {presetMode === 'mixed' && <Check size={14} className="stroke-[2.5] shrink-0" />}
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono text-left">{t('generator.mode.mixed.sub')}</span>
              </button>

              {/* Radio Callsigns */}
              <button
                type="button"
                onClick={() => handleSelectPresetMode('callsigns')}
                className={`h-[68px] px-3.5 rounded-xl border flex flex-col justify-center gap-1 transition-all cursor-pointer ${
                  presetMode === 'callsigns'
                    ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                    : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <Radio size={15} className="shrink-0" />
                    <span className="truncate text-[13px]">{t('generator.mode.callsigns')}</span>
                  </div>
                  {presetMode === 'callsigns' && <Check size={14} className="stroke-[2.5] shrink-0" />}
                </div>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono text-left">{t('generator.mode.callsigns.sub')}</span>
              </button>
            </div>
          </div>

          {/* 2. Group Length (Only for Numbers, Letters, Mixed) */}
          {presetMode !== 'callsigns' && (
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
                  className={`relative h-10 px-3 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                    !isCustomLength && groupLength === 4
                      ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                      : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>{t('generator.groupLength.4')}</span>
                  {recommendedLength === 4 && (
                    <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[9px] font-bold tracking-tight shadow-xs leading-none">
                      {t('generator.recommended')}
                    </span>
                  )}
                </button>

                {/* 5 Chars */}
                <button
                  type="button"
                  onClick={() => { setGroupLength(5); setIsCustomLength(false); }}
                  className={`relative h-10 px-3 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                    !isCustomLength && groupLength === 5
                      ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                      : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>{t('generator.groupLength.5')}</span>
                  {recommendedLength === 5 && (
                    <span className="absolute -top-2 right-2 px-1.5 py-0.5 rounded-full bg-orange-500 text-white text-[9px] font-bold tracking-tight shadow-xs leading-none">
                      {t('generator.recommended')}
                    </span>
                  )}
                </button>

                {/* Custom Chars */}
                <div
                  onClick={() => setIsCustomLength(true)}
                  className={`h-10 px-3 rounded-xl border flex items-center justify-between gap-1.5 transition-all cursor-pointer ${
                    isCustomLength
                      ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                      : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span className="text-[12px]">{t('generator.groupLength.custom')}</span>
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
                    className="w-10 text-center bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#444444] rounded px-1 py-0.5 text-[12px] font-mono focus:outline-hidden"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 2.1 Max Digits Per Group (Only for Mixed Mode) */}
          {presetMode === 'mixed' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="flex items-center justify-between">
                <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <span className="w-1.5 h-3.5 bg-orange-500 rounded-full inline-block"></span>
                  <span>{t('generator.maxDigitsPerGroup')}</span>
                </label>
                <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                  {t('generator.maxDigitsPerGroup.desc', { max: maxAllowedDigits })}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {Array.from({ length: maxAllowedDigits }, (_, i) => i + 1).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMaxDigitsPerGroup(val)}
                    className={`h-10 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      effectiveMaxDigits === val
                        ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                        : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    <span>{val}</span>
                    <span className="text-[11px] font-mono">{t('generator.maxDigitsPerGroup.unit')}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Group Count Capacity */}
          <div className="space-y-2">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-orange-500 rounded-full inline-block"></span>
              {t('generator.groupCount')}
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[50, 100, 200].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setGroupCount(cnt)}
                  className={`h-10 px-3 rounded-xl border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    groupCount === cnt
                      ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                      : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                  }`}
                >
                  <span>{t(`generator.groupCount.${cnt}`)}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. Advanced Options */}
          <div className="space-y-2.5">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-orange-500 rounded-full inline-block"></span>
              {t('generator.options')}
            </label>
            <div className="space-y-2 bg-slate-50/80 dark:bg-[#1a1a1a] p-3 rounded-xl border border-slate-200/80 dark:border-[#2d2d2d]">
              {presetMode === 'callsigns' ? (
                /* Callsign Suffix Option */
                <label className="flex items-center justify-between text-slate-700 dark:text-slate-300 cursor-pointer select-none py-0.5">
                  <span className="text-[12.5px]">{t('generator.options.includeCallsignSuffix')}</span>
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
                    <span className="text-[12.5px]">{t('generator.options.includeSymbols')}</span>
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
                    <span className="text-[12.5px]">{t('generator.options.noAdjacentDup')}</span>
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

          {/* 5. Live Preview */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[12px]">
              <span className="font-medium flex items-center gap-1">
                <Settings2 size={13} />
                {t('generator.preview')}
              </span>
              <button
                type="button"
                onClick={() => setPreviewSeed(s => s + 1)}
                className="flex items-center gap-1 text-[11px] text-orange-600 dark:text-orange-400 hover:underline cursor-pointer"
              >
                <RefreshCw size={11} />
                <span>{t('generator.preview.refresh')}</span>
              </button>
            </div>
            <div className="p-3 rounded-xl bg-slate-100/90 dark:bg-[#141414] border border-slate-200 dark:border-[#2d2d2d] font-mono text-[13px] text-slate-800 dark:text-slate-200 tracking-wider text-center select-text min-h-[44px] flex items-center justify-center">
              {previewText}
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="shrink-0 px-5 py-3.5 bg-slate-50 dark:bg-[#252526] border-t border-slate-200 dark:border-[#333333] flex justify-end gap-3 items-center">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#555555] text-slate-600 dark:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[13px] font-medium cursor-pointer"
          >
            {t('generator.btn.cancel')}
          </button>
          <button
            type="button"
            onClick={handleStart}
            className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-all text-[13px] font-medium flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer"
          >
            <Play size={14} className="fill-current" />
            <span>{t('generator.btn.generate')}</span>
          </button>
        </div>

      </div>
    </div>
  );
}

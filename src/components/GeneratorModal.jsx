import React, { useState, useMemo } from 'react';
import { X, Sparkles, RefreshCw, Check, Play, Dices, CaseSensitive, Shuffle, Radio, Download } from 'lucide-react';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { useI18n } from '../i18n';
import { generateStructuredRandomContent } from '../utils/morse/structuredRandom';

export default function GeneratorModal({ isOpen, onClose, onGenerate }) {
  const { t } = useI18n();

  // Primary Mode: 'numbers' | 'letters' | 'mixed' | 'callsigns'
  const [presetMode, setPresetMode] = useState('mixed');
  const [includeSymbols, setIncludeSymbols] = useState(false);
  const [includeCallsignSuffix, setIncludeCallsignSuffix] = useState(false);
  const [groupLength, setGroupLength] = useState(5);
  const [isCustomLength, setIsCustomLength] = useState(false);
  const [customLengthInput, setCustomLengthInput] = useState('5');
  const [maxDigitsPerGroup, setMaxDigitsPerGroup] = useState(1);
  const [isCustomMaxDigits, setIsCustomMaxDigits] = useState(false);
  const [customMaxDigitsInput, setCustomMaxDigitsInput] = useState('3');
  const [groupCount, setGroupCount] = useState(100);
  const [isCustomCount, setIsCustomCount] = useState(false);
  const [customCountInput, setCustomCountInput] = useState('200');
  const [noAdjacentDup, setNoAdjacentDup] = useState(true);

  const effectiveGroupCount = isCustomCount ? Math.max(1, parseInt(customCountInput) || 100) : groupCount;

  // EPUB Export Config
  const [epubPages, setEpubPages] = useState(40);
  const [epubStartMarker, setEpubStartMarker] = useState('===');
  const [epubEndMarker, setEpubEndMarker] = useState('iii');
  const [isExportingEpub, setIsExportingEpub] = useState(false);
  const [exportStatus, setExportStatus] = useState(null); // 'success' | 'error' | null

  // Recommended length: Letters & Mixed -> 5 chars, Numbers -> 4 chars
  const recommendedLength = useMemo(() => {
    if (presetMode === 'letters' || presetMode === 'mixed') return 5;
    return 4;
  }, [presetMode]);

  // Mode switcher: automatically sets recommended length
  const handleSelectPresetMode = (mode) => {
    setPresetMode(mode);
    setIsCustomLength(false);
    if (mode === 'letters' || mode === 'mixed') {
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
    let raw = isCustomMaxDigits ? parseInt(customMaxDigitsInput, 10) || 1 : maxDigitsPerGroup;
    return Math.min(Math.max(1, raw), maxAllowedDigits);
  }, [isCustomMaxDigits, customMaxDigitsInput, maxDigitsPerGroup, maxAllowedDigits]);

  if (!isOpen) return null;

  const handleStart = () => {
    let typeDesc = t('generator.title.mixed');
    if (presetMode === 'numbers') typeDesc = t('generator.title.numbers');
    else if (presetMode === 'letters') typeDesc = t('generator.title.letters');
    else if (presetMode === 'callsigns') typeDesc = t('generator.title.callsigns');

    if (presetMode === 'callsigns') {
      const suffixTag = includeCallsignSuffix ? ` ${t('generator.title.withSymbols')}` : '';
      const config = {
        mode: 'callsigns',
        groupCount: effectiveGroupCount,
        includeCallsignSuffix,
        title: `${typeDesc} (${effectiveGroupCount} ${t('generator.title.groups')}${suffixTag})`
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
      groupCount: effectiveGroupCount,
      allowAdjacentDuplicate: !noAdjacentDup,
      customProfile: true,
      title: `${typeDesc} (${effectiveLength} ${t('generator.title.chars')}${digitsInfo} · ${effectiveGroupCount} ${t('generator.title.groups')}${suffix})`
    };

    onGenerate(config);
    onClose();
  };

  const handleExportEpub = async () => {
    try {
      setIsExportingEpub(true);
      setExportStatus(null);
      
      let typeDesc = t('generator.title.mixed');
      if (presetMode === 'numbers') typeDesc = t('generator.title.numbers');
      else if (presetMode === 'letters') typeDesc = t('generator.title.letters');
      else if (presetMode === 'callsigns') typeDesc = t('generator.title.callsigns');

      const title = `${typeDesc} - ${epubPages} ${t('generator.epubPages')}`;
      const chapters = [];
      
      for (let i = 0; i < epubPages; i++) {
        let textContent = '';
        if (presetMode === 'callsigns') {
          const sample = generateStructuredRandomContent({
            mode: 'callsigns',
            groupCount: effectiveGroupCount,
            includeCallsignSuffix
          });
          textContent = sample.groups.map(g => g.join('')).join(' ');
        } else {
          const sample = generateStructuredRandomContent({
            mode: 'custom',
            pool,
            charsPerGroup: effectiveLength,
            maxDigitsPerGroup: presetMode === 'mixed' ? effectiveMaxDigits : null,
            groupCount: effectiveGroupCount,
            allowAdjacentDuplicate: !noAdjacentDup,
            customProfile: true
          });
          textContent = sample.groups.map(g => g.join('')).join(' ');
        }
        
        let fullPageText = textContent;
        if (epubStartMarker) fullPageText = `${epubStartMarker} ${fullPageText}`;
        if (epubEndMarker) fullPageText = `${fullPageText} ${epubEndMarker}`;
        
        chapters.push(fullPageText);
      }
      
      const filePath = await save({
        filters: [{ name: 'EPUB', extensions: ['epub'] }],
        defaultPath: `${title}.epub`
      });
      
      if (filePath) {
        const epubData = await invoke('generate_epub', { title, chapters });
        await writeFile(filePath, new Uint8Array(epubData));
        setExportStatus('success');
        setTimeout(() => setExportStatus(null), 3000);
      } else {
        setExportStatus(null);
      }
    } catch (e) {
      console.error(e);
      setExportStatus('error');
      setTimeout(() => setExportStatus(null), 3000);
    } finally {
      setIsExportingEpub(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-[#333333] rounded-2xl shadow-2xl w-[600px] max-w-[94vw] h-[660px] max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="shrink-0 h-12 flex items-center justify-between px-5 bg-slate-50 dark:bg-[#252526] border-b border-slate-200 dark:border-[#333333]">
          <div className="flex items-center gap-2 font-bold text-[16px] text-slate-800 dark:text-[#dddddd]">
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
        <div className="flex-1 p-6 space-y-5 text-[15px] text-slate-700 dark:text-[#cccccc] overflow-y-auto custom-scrollbar">
          
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
                className={`h-[80px] px-3.5 rounded-xl border flex flex-col justify-center gap-1 transition-all cursor-pointer ${
                  presetMode === 'numbers'
                    ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                    : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <Dices size={15} className="shrink-0" />
                    <span className="truncate text-[15px]">{t('generator.mode.numbers')}</span>
                  </div>
                  {presetMode === 'numbers' && <Check size={14} className="stroke-[2.5] shrink-0" />}
                </div>
                <span className="text-[15px] text-slate-400 dark:text-slate-500 font-mono text-left">{t('generator.mode.numbers.sub')}</span>
              </button>

              {/* Letters */}
              <button
                type="button"
                onClick={() => handleSelectPresetMode('letters')}
                className={`h-[80px] px-3.5 rounded-xl border flex flex-col justify-center gap-1 transition-all cursor-pointer ${
                  presetMode === 'letters'
                    ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                    : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <CaseSensitive size={16} className="shrink-0" />
                    <span className="truncate text-[15px]">{t('generator.mode.letters')}</span>
                  </div>
                  {presetMode === 'letters' && <Check size={14} className="stroke-[2.5] shrink-0" />}
                </div>
                <span className="text-[15px] text-slate-400 dark:text-slate-500 font-mono text-left">{t('generator.mode.letters.sub')}</span>
              </button>

              {/* Mixed */}
              <button
                type="button"
                onClick={() => handleSelectPresetMode('mixed')}
                className={`h-[80px] px-3.5 rounded-xl border flex flex-col justify-center gap-1 transition-all cursor-pointer ${
                  presetMode === 'mixed'
                    ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                    : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <Shuffle size={15} className="shrink-0" />
                    <span className="truncate text-[15px]">{t('generator.mode.mixed')}</span>
                  </div>
                  {presetMode === 'mixed' && <Check size={14} className="stroke-[2.5] shrink-0" />}
                </div>
                <span className="text-[15px] text-slate-400 dark:text-slate-500 font-mono text-left">{t('generator.mode.mixed.sub')}</span>
              </button>

              {/* Radio Callsigns */}
              <button
                type="button"
                onClick={() => handleSelectPresetMode('callsigns')}
                className={`h-[80px] px-3.5 rounded-xl border flex flex-col justify-center gap-1 transition-all cursor-pointer ${
                  presetMode === 'callsigns'
                    ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                    : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-2 min-w-0">
                    <Radio size={15} className="shrink-0" />
                    <span className="truncate text-[15px]">{t('generator.mode.callsigns')}</span>
                  </div>
                  {presetMode === 'callsigns' && <Check size={14} className="stroke-[2.5] shrink-0" />}
                </div>
                <span className="text-[15px] text-slate-400 dark:text-slate-500 font-mono text-left">{t('generator.mode.callsigns.sub')}</span>
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
          )}

          {/* 2.1 Max Digits Per Group (Only for Mixed Mode) */}
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

          {/* 3. Group Count Capacity */}
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

          {/* 5. EPUB Export Settings */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-[#333333]">
            <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-indigo-500 rounded-full inline-block"></span>
              {t('generator.epubOptions')}
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[15px] text-slate-500 font-medium">{t('generator.epubPages')}</span>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={epubPages}
                  onChange={(e) => setEpubPages(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full h-8 px-2 text-[16px] bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#444444] rounded-lg focus:outline-hidden focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[15px] text-slate-500 font-medium">{t('generator.epubStartMarker')}</span>
                <input
                  type="text"
                  value={epubStartMarker}
                  onChange={(e) => setEpubStartMarker(e.target.value)}
                  placeholder="e.g. ==="
                  className="w-full h-8 px-2 text-[16px] font-mono bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#444444] rounded-lg focus:outline-hidden focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-[15px] text-slate-500 font-medium">{t('generator.epubEndMarker')}</span>
                <input
                  type="text"
                  value={epubEndMarker}
                  onChange={(e) => setEpubEndMarker(e.target.value)}
                  placeholder="e.g. iii"
                  className="w-full h-8 px-2 text-[16px] font-mono bg-white dark:bg-[#1a1a1a] border border-slate-300 dark:border-[#444444] rounded-lg focus:outline-hidden focus:border-indigo-400 dark:focus:border-indigo-500 transition-colors"
                />
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="shrink-0 px-5 py-3.5 bg-slate-50 dark:bg-[#252526] border-t border-slate-200 dark:border-[#333333] flex justify-between gap-3 items-center">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportEpub}
              disabled={isExportingEpub}
              className={`px-4 py-2 rounded-xl border flex items-center gap-1.5 transition-all text-[15px] font-medium shadow-xs cursor-pointer ${
                isExportingEpub 
                  ? 'border-slate-300 dark:border-[#444444] bg-slate-100 dark:bg-[#222222] text-slate-400 dark:text-slate-500' 
                  : 'border-indigo-300 dark:border-indigo-800/80 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:shadow-md'
              }`}
            >
              {isExportingEpub ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              <span>{isExportingEpub ? t('generator.btn.exporting') : t('generator.btn.exportEpub')}</span>
            </button>
            {exportStatus === 'success' && (
              <span className="text-emerald-600 dark:text-emerald-500 text-[16px] font-medium flex items-center gap-1.5 animate-in fade-in slide-in-from-left-2 duration-300">
                <Check size={14} className="stroke-[2.5]" />
                {t('generator.epubExport.successToast')}
              </span>
            )}
            {exportStatus === 'error' && (
              <span className="text-red-500 text-[16px] font-medium animate-in fade-in slide-in-from-left-2 duration-300">
                {t('generator.epubExport.errorToast')}
              </span>
            )}
          </div>
          
          <div className="flex gap-3 items-center">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#555555] text-slate-600 dark:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[15px] font-medium cursor-pointer"
            >
              {t('generator.btn.cancel')}
            </button>
            <button
              type="button"
              onClick={handleStart}
              className="px-5 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white transition-all text-[15px] font-medium flex items-center gap-1.5 shadow-xs hover:shadow-md cursor-pointer"
            >
              <Play size={14} className="fill-current" />
              <span>{t('generator.btn.generate')}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

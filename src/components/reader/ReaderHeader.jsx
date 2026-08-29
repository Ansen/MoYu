import audioPlayer from '../../utils/audioPlayer';
import React, { useState, useRef } from 'react';
import { 
  ArrowLeft, 
  List, 
  ChevronDown,
  ChevronRight, 
  Type, 
  Activity, 
  Music, 
  Check, 
  Radio, 
  Hash, 
  Pause, 
  Play, 
  RefreshCw, 
  Square, 
  Plus, 
  Minus, 
  SlidersHorizontal
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { FONT_OPTIONS } from '../../config/fonts';

export default function ReaderHeader({
  bookData,
  handleClose,
  isTocOpen,
  setIsTocOpen,
  baseFontSize,
  setBaseFontSize,
  morseSpeed,
  setMorseSpeed,
  morseFreq,
  setMorseFreq,
  useHarmonics,
  setUseHarmonics,
  numberMode,
  setNumberMode,
  viewMode = 'grid',
  setViewMode,
  isGridEligible = true,
  fontFamily = 'Consolas',
  setFontFamily,
  enableMarkers = true,
  setEnableMarkers,
  prefixMarker = '===',
  setPrefixMarker,
  suffixMarker = 'iii',
  setSuffixMarker,
  autoFit = true,
  setAutoFit,
  isPlaying,
  isPaused,
  togglePlay,
  stopPlay,
  onRegenerate,
  isAudioReady = true,
}) {
  const { t } = useI18n();
  const [isNumberModeOpen, setIsNumberModeOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isFontSubmenuOpen, setIsFontSubmenuOpen] = useState(false);
  
  const numberModeRef = useRef(null);
  const moreMenuRef = useRef(null);
  const fontSubmenuTimeoutRef = useRef(null);

  const handleFontMouseEnter = () => {
    if (fontSubmenuTimeoutRef.current) clearTimeout(fontSubmenuTimeoutRef.current);
    setIsFontSubmenuOpen(true);
  };

  const handleFontMouseLeave = () => {
    if (fontSubmenuTimeoutRef.current) clearTimeout(fontSubmenuTimeoutRef.current);
    fontSubmenuTimeoutRef.current = setTimeout(() => {
      setIsFontSubmenuOpen(false);
    }, 200);
  };

  const hasToc = Boolean(
    bookData.isFolder ||
    (bookData.type === 'epub' && bookData.toc && bookData.toc.length > 1) ||
    (bookData.siblings && bookData.siblings.length > 1)
  );

  return (
    <div className="h-12 bg-slate-100 dark:bg-[#111111] border-b border-slate-300 dark:border-[#333333] flex items-center px-2.5 sm:px-3 shrink-0 shadow-xs z-20 justify-between gap-1.5 sm:gap-2 select-none">
      
      {/* Left: Nav Action Buttons */}
      <div className="flex items-center justify-start gap-1.5 shrink-0">
        <button
          onClick={handleClose}
          className="h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border border-slate-300/80 dark:border-[#383838] bg-white dark:bg-[#1f1f1f] text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#282828] hover:border-slate-400 text-[12px] font-medium transition-all shadow-2xs active:scale-98 cursor-pointer whitespace-nowrap shrink-0"
          title={t('reader.back')}
        >
          <ArrowLeft size={14} className="shrink-0" />
          <span className="whitespace-nowrap">{t('reader.back')}</span>
        </button>

        {hasToc && (
          <button
            onClick={() => setIsTocOpen(!isTocOpen)}
            className={`h-8 flex items-center gap-1.5 px-2.5 sm:px-3 rounded-lg border text-[12px] font-medium transition-all cursor-pointer shadow-2xs active:scale-98 whitespace-nowrap shrink-0 ${
              isTocOpen 
                ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold' 
                : 'border-slate-300/80 dark:border-[#383838] bg-white dark:bg-[#1f1f1f] text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#282828]'
            }`}
            title={bookData.isFolder ? t('reader.filelist') : t('reader.toc')}
          >
            <List size={14} className="shrink-0" />
            <span className="whitespace-nowrap">{bookData.isFolder ? t('reader.filelist') : t('reader.toc')}</span>
          </button>
        )}
      </div>

      {/* Center: Floating Island Parameter & Tone Console */}
      <div className="flex items-center justify-center shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-200/80 dark:bg-[#181818] px-2.5 py-1 rounded-xl border border-slate-300/70 dark:border-[#2d2d2d] shadow-2xs">
          
          {/* Font Size Stepper */}
          <div className="flex items-center gap-1 shrink-0" title={`${t('reader.font.size')} (支持点击+-或滚轮微调)`}>
            <Type size={13} className="text-slate-500 shrink-0" />
            <div className="flex items-center bg-white dark:bg-[#252525] border border-slate-300 dark:border-[#383838] rounded-md overflow-hidden shadow-2xs h-7">
              <button
                type="button"
                onClick={() => setBaseFontSize(Math.max(10, Math.round(baseFontSize) - 2))}
                className="w-4.5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="减小字号 (-2)"
              >
                <Minus size={10} className="stroke-[2.5]" />
              </button>
              <input
                type="number"
                min="10"
                max="120"
                value={Math.round(baseFontSize)}
                onWheel={(e) => {
                  e.currentTarget.blur();
                  if (e.deltaY < 0) {
                    setBaseFontSize(Math.min(120, Math.round(baseFontSize) + 2));
                  } else {
                    setBaseFontSize(Math.max(10, Math.round(baseFontSize) - 2));
                  }
                }}
                onChange={(e) => {
                  const num = parseInt(e.target.value, 10);
                  if (!isNaN(num)) {
                    const val = Math.max(10, Math.min(120, num));
                    setBaseFontSize(val);
                  }
                }}
                className="w-6.5 text-[11.5px] font-bold font-mono text-center bg-transparent focus:outline-hidden text-slate-800 dark:text-[#dddddd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 select-none"
              />
              <button
                type="button"
                onClick={() => setBaseFontSize(Math.min(120, Math.round(baseFontSize) + 2))}
                className="w-4.5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="增大字号 (+2)"
              >
                <Plus size={10} className="stroke-[2.5]" />
              </button>
            </div>
          </div>

          <div className="h-3 w-px bg-slate-300 dark:bg-[#333333]"></div>

          {/* Speed Stepper (WPM) */}
          <div className="flex items-center gap-1 shrink-0" title={`${t('reader.speed')} (支持点击+-或滚轮微调)`}>
            <Activity size={13} className="text-slate-500 shrink-0" />
            <div className="flex items-center bg-white dark:bg-[#252525] border border-slate-300 dark:border-[#383838] rounded-md overflow-hidden shadow-2xs h-7">
              <button
                type="button"
                onClick={() => setMorseSpeed(Math.max(5, morseSpeed - 1))}
                className="w-4.5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="减速 (-1 WPM)"
              >
                <Minus size={10} className="stroke-[2.5]" />
              </button>
              <input
                type="number"
                min="5"
                max="60"
                value={morseSpeed}
                onWheel={(e) => {
                  e.currentTarget.blur();
                  if (e.deltaY < 0) {
                    setMorseSpeed(Math.min(60, morseSpeed + 1));
                  } else {
                    setMorseSpeed(Math.max(5, morseSpeed - 1));
                  }
                }}
                onChange={(e) => setMorseSpeed(Math.max(5, Math.min(60, Number(e.target.value) || 20)))}
                className="w-5.5 text-[11.5px] font-bold font-mono text-center bg-transparent focus:outline-hidden text-slate-800 dark:text-[#dddddd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 select-none"
              />
              <button
                type="button"
                onClick={() => setMorseSpeed(Math.min(60, morseSpeed + 1))}
                className="w-4.5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="加速 (+1 WPM)"
              >
                <Plus size={10} className="stroke-[2.5]" />
              </button>
            </div>
            <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold select-none">WPM</span>
          </div>

          <div className="h-3 w-px bg-slate-300 dark:bg-[#333333]"></div>

          {/* Frequency Stepper (Hz) */}
          <div className="flex items-center gap-1 shrink-0" title={`${t('reader.freq')} (支持点击+-或滚轮微调)`}>
            <Music size={13} className="text-slate-500 shrink-0" />
            <div className="flex items-center bg-white dark:bg-[#252525] border border-slate-300 dark:border-[#383838] rounded-md overflow-hidden shadow-2xs h-7">
              <button
                type="button"
                onClick={() => setMorseFreq(Math.max(100, morseFreq - 20))}
                className="w-4.5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="降调 (-20 Hz)"
              >
                <Minus size={10} className="stroke-[2.5]" />
              </button>
              <input
                type="number"
                min="100"
                max="1500"
                step="10"
                value={morseFreq}
                onWheel={(e) => {
                  e.currentTarget.blur();
                  if (e.deltaY < 0) {
                    setMorseFreq(Math.min(1500, morseFreq + 20));
                  } else {
                    setMorseFreq(Math.max(100, morseFreq - 20));
                  }
                }}
                onChange={(e) => setMorseFreq(Math.max(100, Math.min(1500, Number(e.target.value) || 380)))}
                className="w-8.5 text-[11.5px] font-bold font-mono text-center bg-transparent focus:outline-hidden text-slate-800 dark:text-[#dddddd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 select-none"
              />
              <button
                type="button"
                onClick={() => setMorseFreq(Math.min(1500, morseFreq + 20))}
                className="w-4.5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="升调 (+20 Hz)"
              >
                <Plus size={10} className="stroke-[2.5]" />
              </button>
            </div>
            <span className="text-[10.5px] text-slate-500 dark:text-slate-400 font-semibold select-none">Hz</span>
          </div>

          <div className="h-3 w-px bg-slate-300 dark:bg-[#333333]"></div>

          {/* Number Mode Pill Dropdown (Stay outside on main toolbar) */}
          <div className="relative flex items-center shrink-0" ref={numberModeRef}>
            <button
              type="button"
              onClick={() => {
                setIsNumberModeOpen(!isNumberModeOpen);
                setIsMoreMenuOpen(false);
              }}
              className="h-7 flex items-center gap-1 px-2 rounded-md bg-white dark:bg-[#252525] border border-slate-300 dark:border-[#383838] text-slate-700 dark:text-[#cccccc] text-[11.5px] font-medium hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer whitespace-nowrap shadow-2xs"
              title={t('reader.number.mode')}
            >
              <Hash size={12} className="text-slate-400 shrink-0" />
              <span>
                {numberMode === 'long' ? t('reader.number.long') : (numberMode === 'short5' ? t('reader.number.short5') : t('reader.number.short10'))}
              </span>
              <ChevronDown size={11} className={`opacity-60 transition-transform duration-200 ${isNumberModeOpen ? 'rotate-180' : ''}`} />
            </button>

            {isNumberModeOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onMouseDown={() => setIsNumberModeOpen(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-32 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333333] shadow-xl py-1.5 z-50 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 select-none">
                  <button
                    type="button"
                    onClick={() => { setNumberMode('long'); setIsNumberModeOpen(false); }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] flex justify-between items-center text-[12px] text-slate-700 dark:text-[#cccccc] transition-colors cursor-pointer"
                  >
                    <span>{t('reader.number.long')}</span>
                    {numberMode === 'long' && <Check size={13} className="text-indigo-500" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNumberMode('short5'); setIsNumberModeOpen(false); }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] flex justify-between items-center text-[12px] text-slate-700 dark:text-[#cccccc] transition-colors cursor-pointer"
                  >
                    <span>{t('reader.number.short5')}</span>
                    {numberMode === 'short5' && <Check size={13} className="text-indigo-500" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNumberMode('short10'); setIsNumberModeOpen(false); }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] flex justify-between items-center text-[12px] text-slate-700 dark:text-[#cccccc] transition-colors cursor-pointer"
                  >
                    <span>{t('reader.number.short10')}</span>
                    {numberMode === 'short10' && <Check size={13} className="text-indigo-500" />}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="h-3 w-px bg-slate-300 dark:bg-[#333333]"></div>

          {/* Radio Harmonics One-Click Toggle Switch */}
          <button
            type="button"
            onClick={() => setUseHarmonics(!useHarmonics)}
            className={`h-7 flex items-center gap-1 px-2 rounded-md text-[11.5px] font-medium transition-all cursor-pointer whitespace-nowrap select-none border ${
              useHarmonics
                ? 'bg-indigo-50/90 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-600 text-indigo-600 dark:text-indigo-300 font-semibold shadow-2xs ring-1 ring-indigo-400/20'
                : 'bg-white dark:bg-[#252525] border-slate-300 dark:border-[#383838] text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-[#4a4a4a] hover:text-slate-800 dark:hover:text-[#dddddd] shadow-2xs'
            }`}
            title={useHarmonics ? `${t('reader.harmonics')} (已开启)` : t('reader.harmonics.desc')}
          >
            <Radio size={12} className={useHarmonics ? "text-indigo-500 dark:text-indigo-400 shrink-0" : "text-slate-400 shrink-0"} />
            <span>{t('reader.harmonics.short')}</span>
          </button>

          <div className="h-3 w-px bg-slate-300 dark:bg-[#333333]"></div>

          {/* More Settings Dropdown Menu (Contains Layout Mode & Font Selector) */}
          <div className="relative flex items-center shrink-0" ref={moreMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsMoreMenuOpen(!isMoreMenuOpen);
                setIsNumberModeOpen(false);
              }}
              className={`h-7 flex items-center gap-1.5 px-2.5 rounded-md text-[11.5px] font-medium transition-all cursor-pointer whitespace-nowrap select-none border ${
                isMoreMenuOpen
                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-600 dark:text-indigo-300 font-semibold shadow-2xs'
                  : 'bg-white dark:bg-[#252525] border-slate-300 dark:border-[#383838] text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-[#4a4a4a] hover:text-slate-800 dark:hover:text-[#dddddd] shadow-2xs'
              }`}
              title={t('reader.more')}
            >
              <SlidersHorizontal size={12} className={isMoreMenuOpen ? "text-indigo-500 shrink-0" : "text-slate-400 shrink-0"} />
              <span>{t('reader.more')}</span>
              <ChevronDown size={11} className={`opacity-60 transition-transform duration-200 ${isMoreMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            {isMoreMenuOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onMouseDown={() => { setIsMoreMenuOpen(false); setIsFontSubmenuOpen(false); }}
                />
                <div className="absolute top-full right-0 mt-2 w-64 bg-white/95 dark:bg-[#1c1c1c]/95 backdrop-blur-md border border-slate-200 dark:border-[#333333] shadow-2xl rounded-xl p-2 z-50 animate-in fade-in slide-in-from-top-1 duration-150 select-none text-slate-800 dark:text-slate-200 space-y-1">
                  
                  {/* Row 1: Auto-Fit Single Screen Switch */}
                  {setAutoFit && (
                    <div className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#252525]/60 transition-colors">
                      <span className="text-[12px] text-slate-700 dark:text-slate-300 font-medium">
                        {t('reader.more.autofit')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAutoFit(!autoFit)}
                        className={`h-4.5 w-8 shrink-0 rounded-full transition-colors relative cursor-pointer ${
                          autoFit ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-[#3e3e3e]'
                        }`}
                      >
                        <span
                          className={`absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-xs ${
                            autoFit ? 'translate-x-3.5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  )}

                  {/* Row 2: Layout Mode Segmented Control */}
                  {setViewMode && (
                    <div className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#252525]/60 transition-colors">
                      <span className="text-[12px] text-slate-700 dark:text-slate-300 font-medium">
                        {t('reader.more.layout')}
                      </span>
                      <div className="flex items-center p-0.5 rounded-lg bg-slate-100 dark:bg-[#252525] border border-slate-200/80 dark:border-[#333333]">
                        <button
                          type="button"
                          onClick={() => { if (isGridEligible) setViewMode('grid'); }}
                          disabled={!isGridEligible}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                            viewMode === 'grid' && isGridEligible
                              ? 'bg-white dark:bg-[#383838] text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                          } ${!isGridEligible ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          {t('reader.view.grid')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode('text')}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded-md transition-all cursor-pointer ${
                            viewMode === 'text'
                              ? 'bg-white dark:bg-[#383838] text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                              : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                          }`}
                        >
                          {t('reader.view.text')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Row 3: Font Family Flyout Submenu */}
                  {setFontFamily && (
                    <div 
                      className="relative"
                      onMouseEnter={handleFontMouseEnter}
                      onMouseLeave={handleFontMouseLeave}
                    >
                      <button
                        type="button"
                        onClick={() => setIsFontSubmenuOpen(!isFontSubmenuOpen)}
                        className={`w-full flex items-center justify-between py-1 px-1.5 rounded-lg transition-colors cursor-pointer ${
                          isFontSubmenuOpen
                            ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-medium'
                            : 'hover:bg-slate-50 dark:hover:bg-[#252525]/60 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <span className="text-[12px] font-medium">
                          {t('reader.more.font')}
                        </span>
                        <div className="flex items-center gap-1">
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-mono">
                            {FONT_OPTIONS.find(f => f.id === fontFamily)?.shortName || fontFamily}
                          </span>
                          <ChevronRight size={13} className="text-slate-400 opacity-70" />
                        </div>
                      </button>

                      {/* Font Flyout Submenu to the Left */}
                      {isFontSubmenuOpen && (
                        <div 
                          className="absolute right-full top-0 mr-1.5 w-max min-w-[200px] flex flex-col gap-0.5 p-1.5 bg-white/98 dark:bg-[#1e1e1e]/98 backdrop-blur-md border border-slate-200 dark:border-[#333333] rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-100 select-none text-slate-800 dark:text-slate-200"
                          onMouseEnter={handleFontMouseEnter}
                          onMouseLeave={handleFontMouseLeave}
                        >
                          <div className="px-2 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            {t('reader.more.font')}
                          </div>
                          {FONT_OPTIONS.map((font) => {
                            const isSelected = fontFamily === font.id;
                            return (
                              <button
                                key={font.id}
                                type="button"
                                onClick={() => {
                                  setFontFamily(font.id);
                                  setIsFontSubmenuOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold'
                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-[#282828]'
                                }`}
                              >
                                <span 
                                  className="text-[12px]" 
                                  style={{ fontFamily: font.fontFamily }}
                                >
                                  {t(font.labelKey, font.shortName)}
                                </span>
                                {isSelected && (
                                  <Check size={13} className="text-indigo-600 dark:text-indigo-400 ml-2 shrink-0" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Divider */}
                  {setEnableMarkers && (
                    <div className="h-px bg-slate-100 dark:bg-[#282828] my-1" />
                  )}

                  {/* Row 4: Transmission Markers Enable Toggle */}
                  {setEnableMarkers && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between py-1 px-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#252525]/60 transition-colors">
                        <span className="text-[12px] text-slate-700 dark:text-slate-300 font-medium">
                          {t('reader.markers.title')}
                        </span>
                        <button
                          type="button"
                          onClick={() => setEnableMarkers(!enableMarkers)}
                          className={`h-4.5 w-8 shrink-0 rounded-full transition-colors relative cursor-pointer ${
                            enableMarkers ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-[#3e3e3e]'
                          }`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 h-3.5 w-3.5 rounded-full bg-white transition-transform shadow-xs ${
                              enableMarkers ? 'translate-x-3.5' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>

                      {/* Row 5 & 6: Prefix & Suffix Single Compact Input Rows (No Pills, 0 Horizontal Scrollbar) */}
                      {enableMarkers && (
                        <div className="space-y-1 pt-0.5">
                          {/* Prefix Single Row */}
                          <div className="flex items-center justify-between py-0.5 px-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#252525]/60 transition-colors">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {t('reader.markers.prefix')}
                            </span>
                            <input
                              type="text"
                              value={prefixMarker || ''}
                              onChange={(e) => setPrefixMarker && setPrefixMarker(e.target.value)}
                              placeholder="=== / KA"
                              className="w-24 h-6 px-2 text-[11.5px] font-mono text-right rounded-md bg-slate-100 dark:bg-[#252525] border border-slate-200/80 dark:border-[#333333] text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500 shadow-2xs transition-all"
                            />
                          </div>

                          {/* Suffix Single Row */}
                          <div className="flex items-center justify-between py-0.5 px-1.5 rounded-lg hover:bg-slate-50 dark:hover:bg-[#252525]/60 transition-colors">
                            <span className="text-[11px] text-slate-500 dark:text-slate-400">
                              {t('reader.markers.suffix')}
                            </span>
                            <input
                              type="text"
                              value={suffixMarker || ''}
                              onChange={(e) => setSuffixMarker && setSuffixMarker(e.target.value)}
                              placeholder="iii + / AR"
                              className="w-24 h-6 px-2 text-[11.5px] font-mono text-right rounded-md bg-slate-100 dark:bg-[#252525] border border-slate-200/80 dark:border-[#333333] text-slate-800 dark:text-slate-200 focus:outline-hidden focus:border-indigo-500 shadow-2xs transition-all"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Right: Playback Controls (Protected with shrink-0, never clipped) */}
      <div className="flex items-center justify-end gap-1.5 sm:gap-2 shrink-0">
        {onRegenerate && (
          <button
            onClick={() => { stopPlay(); onRegenerate(); }}
            disabled={isPlaying}
            className="h-8 w-8 rounded-lg font-medium flex items-center justify-center shrink-0 transition-all border border-slate-300/80 dark:border-[#383838] bg-white dark:bg-[#1f1f1f] hover:bg-slate-50 dark:hover:bg-[#282828] text-slate-600 dark:text-[#cccccc] disabled:opacity-30 disabled:pointer-events-none shadow-2xs active:scale-95 cursor-pointer whitespace-nowrap"
            title={t('reader.regenerate')}
          >
            <RefreshCw size={14} />
          </button>
        )}
        
        {/* Stop Button */}
        <button
          onClick={stopPlay}
          disabled={!isPlaying}
          className={`h-8 w-8 rounded-lg font-medium flex items-center justify-center shrink-0 transition-all border whitespace-nowrap ${
            isPlaying 
              ? 'border-slate-300/80 dark:border-[#383838] bg-white dark:bg-[#202020] text-slate-500 dark:text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:border-rose-300 dark:hover:border-rose-800/60 hover:bg-rose-50/50 dark:hover:bg-rose-950/30 shadow-2xs active:scale-95 cursor-pointer' 
              : 'border-slate-200 dark:border-[#2d2d2d] bg-slate-100/50 dark:bg-[#181818] text-slate-300 dark:text-[#444444] opacity-50 cursor-not-allowed pointer-events-none'
          }`}
          title={t('reader.stop')}
        >
          <Square size={13} className="fill-current" />
        </button>

        {/* Primary Play / Pause / Resume Button */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => { if (audioPlayer?.ensureReady) audioPlayer.ensureReady(); }}
          onClick={togglePlay}
          disabled={!isAudioReady}
          className={`h-8 px-3 min-w-[78px] sm:min-w-[84px] rounded-lg font-medium flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-xs active:scale-95 cursor-pointer select-none text-[12.5px] whitespace-nowrap ${
            !isAudioReady
              ? 'bg-slate-200 dark:bg-[#2a2a2a] text-slate-400 dark:text-slate-500 cursor-not-allowed opacity-60'
              : (isPlaying && !isPaused
              ? 'bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60 hover:bg-amber-500/25 dark:hover:bg-amber-500/30'
              : isPaused
              ? 'bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-300/70 dark:border-emerald-700/60 hover:bg-emerald-500/25 dark:hover:bg-emerald-500/30'
              : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500/80 dark:hover:bg-indigo-500 dark:border dark:border-indigo-400/30 text-white')
          }`}
        >
          {isPlaying && !isPaused ? (
            <Pause size={13} className="stroke-[2.5]" />
          ) : (
            <Play size={13} className="stroke-[2.5] ml-0.5 fill-current" />
          )}
          <span>
            {!isAudioReady ? t('reader.initializing') : (isPlaying && !isPaused ? t('reader.pause') : isPaused ? t('reader.resume') : t('reader.play'))}
          </span>
        </button>
      </div>

    </div>
  );
}

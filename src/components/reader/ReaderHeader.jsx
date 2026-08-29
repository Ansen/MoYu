import React, { useState, useRef } from 'react';
import { ArrowLeft, List, ChevronDown, Type, Activity, Music, Check, Radio, Hash, Pause, Play, RefreshCw, Square, Plus, Minus, LayoutGrid, FileText } from 'lucide-react';
import { useI18n } from '../../i18n';

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
  isPlaying,
  isPaused,
  togglePlay,
  stopPlay,
  onRegenerate,
  isAudioReady = true,
}) {
  const { t } = useI18n();
  const [isNumberModeOpen, setIsNumberModeOpen] = useState(false);
  const numberModeRef = useRef(null);

  const hasToc = Boolean(
    bookData.isFolder ||
    (bookData.type === 'epub' && bookData.toc && bookData.toc.length > 1) ||
    (bookData.siblings && bookData.siblings.length > 1)
  );

  return (
    <div className="h-12 bg-slate-100 dark:bg-[#111111] border-b border-slate-300 dark:border-[#333333] flex items-center px-3.5 shrink-0 shadow-xs z-10 justify-between gap-2 select-none">
      {/* Left: Nav Action Buttons */}
      <div className="flex items-center justify-start gap-2 shrink-0">
        <button
          onClick={handleClose}
          className="h-8 flex items-center gap-1.5 px-3 rounded-lg border border-slate-300/80 dark:border-[#383838] bg-white dark:bg-[#1f1f1f] text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#282828] hover:border-slate-400 text-[12px] font-medium transition-all shadow-2xs active:scale-98 cursor-pointer whitespace-nowrap shrink-0"
          title={t('reader.back')}
        >
          <ArrowLeft size={15} className="shrink-0" />
          <span className="whitespace-nowrap">{t('reader.back')}</span>
        </button>

        {hasToc && (
          <button
            onClick={() => setIsTocOpen(!isTocOpen)}
            className={`h-8 flex items-center gap-1.5 px-3 rounded-lg border text-[12px] font-medium transition-all cursor-pointer shadow-2xs active:scale-98 whitespace-nowrap shrink-0 ${
              isTocOpen 
                ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold' 
                : 'border-slate-300/80 dark:border-[#383838] bg-white dark:bg-[#1f1f1f] text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#282828]'
            }`}
            title={bookData.isFolder ? t('reader.filelist') : t('reader.toc')}
          >
            <List size={15} className="shrink-0" />
            <span className="whitespace-nowrap">{bookData.isFolder ? t('reader.filelist') : t('reader.toc')}</span>
          </button>
        )}
      </div>

      {/* Center: Floating Island Parameter & Tone Console */}
      <div className="flex items-center justify-center shrink-0">
        <div className="flex items-center gap-2 sm:gap-2.5 bg-slate-200/80 dark:bg-[#181818] px-3 py-1 rounded-xl border border-slate-300/70 dark:border-[#2d2d2d] shadow-2xs">
          
          {/* Font Size Stepper */}
          <div className="flex items-center gap-1 shrink-0" title={`${t('reader.font.size')} (支持点击+-或滚轮微调)`}>
            <Type size={14} className="text-slate-500 shrink-0" />
            <div className="flex items-center bg-white dark:bg-[#252525] border border-slate-300 dark:border-[#383838] rounded-md overflow-hidden shadow-2xs h-7">
              <button
                type="button"
                onClick={() => setBaseFontSize(Math.max(10, Math.round(baseFontSize) - 2))}
                className="w-5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="减小字号 (-2)"
              >
                <Minus size={11} className="stroke-[2.5]" />
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
                className="w-7 text-[12px] font-bold font-mono text-center bg-transparent focus:outline-hidden text-slate-800 dark:text-[#dddddd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 select-none"
              />
              <button
                type="button"
                onClick={() => setBaseFontSize(Math.min(120, Math.round(baseFontSize) + 2))}
                className="w-5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="增大字号 (+2)"
              >
                <Plus size={11} className="stroke-[2.5]" />
              </button>
            </div>
          </div>

          <div className="h-3.5 w-px bg-slate-300 dark:bg-[#333333]"></div>

          {/* Speed Stepper (WPM) */}
          <div className="flex items-center gap-1 shrink-0" title={`${t('reader.speed')} (支持点击+-或滚轮微调)`}>
            <Activity size={14} className="text-slate-500 shrink-0" />
            <div className="flex items-center bg-white dark:bg-[#252525] border border-slate-300 dark:border-[#383838] rounded-md overflow-hidden shadow-2xs h-7">
              <button
                type="button"
                onClick={() => setMorseSpeed(Math.max(5, morseSpeed - 1))}
                className="w-5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="减速 (-1 WPM)"
              >
                <Minus size={11} className="stroke-[2.5]" />
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
                className="w-6 text-[12px] font-bold font-mono text-center bg-transparent focus:outline-hidden text-slate-800 dark:text-[#dddddd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 select-none"
              />
              <button
                type="button"
                onClick={() => setMorseSpeed(Math.min(60, morseSpeed + 1))}
                className="w-5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="加速 (+1 WPM)"
              >
                <Plus size={11} className="stroke-[2.5]" />
              </button>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold select-none">WPM</span>
          </div>

          <div className="h-3.5 w-px bg-slate-300 dark:bg-[#333333]"></div>

          {/* Frequency Stepper (Hz) */}
          <div className="flex items-center gap-1 shrink-0" title={`${t('reader.freq')} (支持点击+-或滚轮微调)`}>
            <Music size={14} className="text-slate-500 shrink-0" />
            <div className="flex items-center bg-white dark:bg-[#252525] border border-slate-300 dark:border-[#383838] rounded-md overflow-hidden shadow-2xs h-7">
              <button
                type="button"
                onClick={() => setMorseFreq(Math.max(100, morseFreq - 20))}
                className="w-5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="降调 (-20 Hz)"
              >
                <Minus size={11} className="stroke-[2.5]" />
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
                className="w-9 text-[12px] font-bold font-mono text-center bg-transparent focus:outline-hidden text-slate-800 dark:text-[#dddddd] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none p-0 select-none"
              />
              <button
                type="button"
                onClick={() => setMorseFreq(Math.min(1500, morseFreq + 20))}
                className="w-5 h-full flex items-center justify-center text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors cursor-pointer select-none active:bg-slate-200 dark:active:bg-[#3a3a3a]"
                title="升调 (+20 Hz)"
              >
                <Plus size={11} className="stroke-[2.5]" />
              </button>
            </div>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold select-none">Hz</span>
          </div>

          <div className="h-3.5 w-px bg-slate-300 dark:bg-[#333333]"></div>

          {/* Number Mode Pill Dropdown */}
          <div className="relative flex items-center shrink-0" ref={numberModeRef}>
            <button
              type="button"
              onClick={() => setIsNumberModeOpen(!isNumberModeOpen)}
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

          <div className="h-3.5 w-px bg-slate-300 dark:bg-[#333333]"></div>

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

          {/* View Mode (10-Col Table vs Plain Text) */}
          {setViewMode && (
            <>
              <div className="h-3.5 w-px bg-slate-300 dark:bg-[#333333]"></div>
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'grid' ? 'text' : 'grid')}
                className={`h-7 flex items-center gap-1 px-2.5 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer whitespace-nowrap select-none border ${
                  viewMode === 'grid'
                    ? 'bg-amber-50/90 dark:bg-amber-950/50 border-amber-300 dark:border-amber-600 text-amber-700 dark:text-amber-300 font-semibold shadow-2xs'
                    : 'bg-white dark:bg-[#252525] border-slate-300 dark:border-[#383838] text-slate-600 dark:text-slate-400 hover:border-slate-400 dark:hover:border-[#4a4a4a] hover:text-slate-800 dark:hover:text-[#dddddd] shadow-2xs'
                }`}
                title={viewMode === 'grid' ? t('reader.view.grid') : t('reader.view.text')}
              >
                {viewMode === 'grid' ? <LayoutGrid size={13} className="text-amber-600 dark:text-amber-400 shrink-0" /> : <FileText size={13} className="text-slate-400 shrink-0" />}
                <span>{viewMode === 'grid' ? t('reader.view.grid') : t('reader.view.text')}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Right: Playback Controls */}
      <div className="flex items-center justify-end gap-2 shrink-0">
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
              ? 'border-rose-300 dark:border-rose-900/60 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 text-rose-600 dark:text-rose-400 shadow-2xs active:scale-95 cursor-pointer' 
              : 'border-slate-200 dark:border-[#2d2d2d] bg-slate-100/50 dark:bg-[#181818] text-slate-300 dark:text-[#444444] opacity-60 cursor-not-allowed pointer-events-none'
          }`}
          title={t('reader.stop')}
        >
          <Square size={14} className="fill-current" />
        </button>

        {/* Primary Play / Pause / Resume Button */}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={togglePlay}
          disabled={!isAudioReady}
          className={`h-8 px-3.5 min-w-[84px] rounded-lg font-semibold flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-xs active:scale-95 cursor-pointer select-none text-[13px] whitespace-nowrap ${
            !isAudioReady
              ? 'bg-slate-300 dark:bg-[#333333] text-white cursor-not-allowed opacity-60'
              : (isPlaying && !isPaused
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25'
              : isPaused
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/25'
              : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-indigo-500/25')
          }`}
        >
          {isPlaying && !isPaused ? (
            <Pause size={14} className="stroke-[2.5]" />
          ) : (
            <Play size={14} className="stroke-[2.5] ml-0.5 fill-current" />
          )}
          <span>
            {!isAudioReady ? t('reader.initializing') : (isPlaying && !isPaused ? t('reader.pause') : isPaused ? t('reader.resume') : t('reader.play'))}
          </span>
        </button>
      </div>
    </div>
  );
}

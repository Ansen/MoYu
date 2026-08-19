import React, { useState, useRef } from 'react';
import { ArrowLeft, List, ChevronDown, Type, Activity, Music, Check, Radio, Hash, Pause, Play, RefreshCw, Square } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function ReaderHeader({
  bookData,
  handleClose,
  isTocOpen,
  setIsTocOpen,
  displayFontSize,
  setBaseFontSize,
  fontScale,
  morseSpeed,
  setMorseSpeed,
  morseFreq,
  setMorseFreq,
  useHarmonics,
  setUseHarmonics,
  numberMode,
  setNumberMode,
  isPlaying,
  isPaused,
  togglePlay,
  stopPlay,
  onRegenerate
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
    <div className="h-12 bg-slate-100 dark:bg-[#111111] border-b border-slate-300 dark:border-[#333333] flex items-center px-4 shrink-0 shadow-xs z-10 justify-between gap-4">
      {/* Left: Nav Action Buttons (Consistent visual style) */}
      <div className="flex-1 flex items-center justify-start gap-2 shrink-0">
        <button
          onClick={handleClose}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg border border-slate-300/80 dark:border-[#383838] bg-white dark:bg-[#1f1f1f] text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#282828] hover:border-slate-400 text-[12px] font-medium transition-all shadow-2xs cursor-pointer"
          title={t('reader.back')}
        >
          <ArrowLeft size={14} />
          <span>{t('reader.back')}</span>
        </button>

        {hasToc && (
          <button
            onClick={() => setIsTocOpen(!isTocOpen)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[12px] font-medium transition-all cursor-pointer shadow-2xs ${
              isTocOpen 
                ? 'border-indigo-300 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold' 
                : 'border-slate-300/80 dark:border-[#383838] bg-white dark:bg-[#1f1f1f] text-slate-700 dark:text-[#cccccc] hover:bg-slate-50 dark:hover:bg-[#282828]'
            }`}
            title={bookData.isFolder ? t('reader.filelist') : t('reader.toc')}
          >
            <List size={14} />
            <span>{bookData.isFolder ? t('reader.filelist') : t('reader.toc')}</span>
          </button>
        )}
      </div>

      {/* Center: Floating Island Parameter & Tone Console */}
      <div className="shrink-0 flex items-center justify-center">
        <div className="flex items-center gap-2.5 sm:gap-3 bg-slate-200/80 dark:bg-[#181818] px-3.5 py-1 rounded-xl border border-slate-300/70 dark:border-[#2d2d2d] shadow-2xs">
          {/* Font Size */}
          <div className="flex items-center gap-1.5" title={t('reader.font.size')}>
            <Type size={14} className="text-slate-500 shrink-0" />
            <input
              type="number"
              min="10"
              max="60"
              value={displayFontSize}
              onChange={(e) => {
                const val = Math.max(10, Math.min(60, Number(e.target.value) || 20));
                setBaseFontSize(Math.round(val / fontScale));
              }}
              className="w-10 text-[12px] text-center bg-white dark:bg-[#2a2a2a] border border-slate-300 dark:border-[#3a3a3a] rounded px-1 font-mono focus:outline-hidden text-slate-700 dark:text-[#cccccc]"
            />
          </div>

          <div className="h-3.5 w-px bg-slate-300/90 dark:bg-[#333333]"></div>

          {/* Speed */}
          <div className="flex items-center gap-1.5" title={t('reader.speed')}>
            <Activity size={14} className="text-slate-500 shrink-0" />
            <input
              type="number"
              min="5"
              max="60"
              value={morseSpeed}
              onChange={(e) => setMorseSpeed(Math.max(5, Math.min(60, Number(e.target.value) || 20)))}
              className="w-10 text-[12px] text-center bg-white dark:bg-[#2a2a2a] border border-slate-300 dark:border-[#3a3a3a] rounded px-1 font-mono focus:outline-hidden text-slate-700 dark:text-[#cccccc]"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">WPM</span>
          </div>

          <div className="h-3.5 w-px bg-slate-300/90 dark:bg-[#333333]"></div>

          {/* Frequency */}
          <div className="flex items-center gap-1.5" title={t('reader.freq')}>
            <Music size={14} className="text-slate-500 shrink-0" />
            <input
              type="number"
              min="100"
              max="1500"
              step="10"
              value={morseFreq}
              onChange={(e) => setMorseFreq(Math.max(100, Math.min(1500, Number(e.target.value) || 380)))}
              className="w-12 text-[12px] text-center bg-white dark:bg-[#2a2a2a] border border-slate-300 dark:border-[#3a3a3a] rounded px-1 font-mono focus:outline-hidden text-slate-700 dark:text-[#cccccc]"
            />
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Hz</span>
          </div>

          <div className="h-3.5 w-px bg-slate-300/90 dark:bg-[#333333]"></div>

          {/* Number Mode Pill Dropdown */}
          <div className="relative flex items-center shrink-0" ref={numberModeRef}>
            <button
              type="button"
              onClick={() => setIsNumberModeOpen(!isNumberModeOpen)}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-white dark:bg-[#2a2a2a] border border-slate-300 dark:border-[#3a3a3a] text-slate-700 dark:text-[#cccccc] text-[11px] font-medium hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer whitespace-nowrap"
              title={t('reader.number.mode')}
            >
              <Hash size={11} className="text-slate-400 shrink-0" />
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
                <div className="absolute top-full right-0 mt-1.5 w-28 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333333] shadow-xl py-1 z-50 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 select-none">
                  <button
                    type="button"
                    onClick={() => { setNumberMode('long'); setIsNumberModeOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] flex justify-between items-center text-[12px] text-slate-700 dark:text-[#cccccc] transition-colors cursor-pointer"
                  >
                    <span>{t('reader.number.long')}</span>
                    {numberMode === 'long' && <Check size={13} className="text-indigo-500" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNumberMode('short5'); setIsNumberModeOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] flex justify-between items-center text-[12px] text-slate-700 dark:text-[#cccccc] transition-colors cursor-pointer"
                  >
                    <span>{t('reader.number.short5')}</span>
                    {numberMode === 'short5' && <Check size={13} className="text-indigo-500" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setNumberMode('short10'); setIsNumberModeOpen(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] flex justify-between items-center text-[12px] text-slate-700 dark:text-[#cccccc] transition-colors cursor-pointer"
                  >
                    <span>{t('reader.number.short10')}</span>
                    {numberMode === 'short10' && <Check size={13} className="text-indigo-500" />}
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="h-3.5 w-px bg-slate-300/90 dark:bg-[#333333]"></div>

          {/* Radio Harmonics One-Click Toggle Switch */}
          <button
            type="button"
            onClick={() => setUseHarmonics(!useHarmonics)}
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium transition-all cursor-pointer whitespace-nowrap select-none ${useHarmonics
              ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-2xs'
              : 'bg-white dark:bg-[#2a2a2a] border border-slate-300 dark:border-[#3a3a3a] text-slate-600 dark:text-[#cccccc] hover:border-indigo-400 dark:hover:border-indigo-500/50 hover:text-indigo-600 dark:hover:text-indigo-400'
              }`}
            title={useHarmonics ? `${t('reader.harmonics')} (已开启)` : t('reader.harmonics.desc')}
          >
            <Radio size={12} className={useHarmonics ? "text-white" : "text-slate-400 shrink-0"} />
            <span>{t('reader.harmonics.short')}</span>
          </button>
        </div>
      </div>

      {/* Right: Playback Controls */}
      <div className="flex-1 flex items-center justify-end gap-2 shrink-0">
        {onRegenerate && (
          <button
            onClick={() => { stopPlay(); onRegenerate(); }}
            disabled={isPlaying}
            className="p-2 rounded-lg font-medium flex items-center justify-center shrink-0 transition-all border border-slate-300/80 dark:border-[#383838] bg-white dark:bg-[#1f1f1f] hover:bg-slate-50 dark:hover:bg-[#282828] text-slate-600 dark:text-[#cccccc] disabled:opacity-30 disabled:pointer-events-none shadow-2xs active:scale-95 cursor-pointer"
            title={t('reader.regenerate')}
          >
            <RefreshCw size={14} />
          </button>
        )}
        
        {/* Stop Button */}
        <button
          onClick={stopPlay}
          disabled={!isPlaying}
          className={`p-2 rounded-lg font-medium flex items-center justify-center shrink-0 transition-all border ${
            isPlaying 
              ? 'border-rose-200 dark:border-rose-900/60 bg-rose-50/80 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 shadow-2xs active:scale-95 cursor-pointer' 
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
          className={`w-[84px] h-[34px] rounded-lg font-medium flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-xs active:scale-95 cursor-pointer select-none text-[13px] ${
            isPlaying && !isPaused
              ? 'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/20'
              : isPaused
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
              : 'bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white shadow-indigo-500/20'
          }`}
        >
          {isPlaying && !isPaused ? (
            <Pause size={14} className="fill-current" />
          ) : (
            <Play size={14} className="fill-current" />
          )}
          <span>
            {isPlaying && !isPaused
              ? t('reader.pause')
              : isPaused
              ? t('reader.resume')
              : t('reader.play')}
          </span>
        </button>
      </div>
    </div>
  );
}

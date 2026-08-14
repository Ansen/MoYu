import React from 'react';
import { ArrowLeft, List, ChevronRight, Type, Activity, Music, Settings2, Check, Radio, Hash, Pause, Play, RefreshCw, Square, Folder, BookOpen, FileText, Sparkles } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function ReaderHeader({
  bookData,
  handleClose,
  isTocOpen,
  setIsTocOpen,
  currentChapterTitle,
  displayFontSize,
  setBaseFontSize,
  fontScale,
  morseSpeed,
  setMorseSpeed,
  morseFreq,
  setMorseFreq,
  moreMenuRef,
  isMoreMenuOpen,
  setIsMoreMenuOpen,
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

  return (
    <div className="h-12 bg-slate-100 dark:bg-[#111111] border-b border-slate-300 dark:border-[#333333] flex items-center px-4 shrink-0 shadow-sm z-10 justify-between">
      <div className="flex items-center gap-3">
        <button 
          onClick={handleClose}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-600 dark:text-[#cccccc] transition-colors"
          title={t('reader.back')}
        >
          <ArrowLeft size={18} />
        </button>
        <button 
          onClick={() => setIsTocOpen(!isTocOpen)}
          className={`p-1.5 rounded hover:bg-slate-200 dark:hover:bg-[#333333] transition-colors ${isTocOpen ? 'bg-slate-200 dark:bg-[#333333] text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-[#cccccc]'}`}
          title={t('reader.toc.toggle')}
        >
          <List size={18} />
        </button>
        <div className="h-4 w-px bg-slate-200 dark:bg-[#333333] mx-1"></div>
        <div className="flex items-center gap-2 overflow-hidden max-w-sm sm:max-w-md">
          {/* Distinct Source Icon */}
          {bookData.isFolder ? (
            <Folder size={15} className="text-amber-500 shrink-0" />
          ) : bookData.type === 'epub' ? (
            <BookOpen size={15} className="text-indigo-500 shrink-0" />
          ) : bookData.isGenerated ? (
            <Sparkles size={15} className="text-orange-500 shrink-0" />
          ) : (
            <FileText size={15} className="text-blue-500 shrink-0" />
          )}

          {/* Breadcrumb Hierarchy */}
          {bookData.isFolder ? (
            <>
              <span className="font-semibold text-[13px] truncate text-slate-700 dark:text-[#cccccc]" title={bookData.folderName || bookData.name}>
                {bookData.folderName || bookData.name}
              </span>
              <ChevronRight size={14} className="text-slate-400 shrink-0" />
              <span className="text-[12px] text-slate-500 dark:text-[#888888] truncate font-medium" title={bookData.name}>
                {bookData.name}
              </span>
              {currentChapterTitle && bookData.type === 'epub' && (
                <>
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  <span className="text-[12px] text-slate-500 dark:text-[#888888] truncate" title={currentChapterTitle}>
                    {currentChapterTitle}
                  </span>
                </>
              )}
            </>
          ) : (
            <>
              <span className="font-semibold text-[13px] truncate text-slate-700 dark:text-[#cccccc]" title={bookData.name}>
                {bookData.name}
              </span>
              {currentChapterTitle && (
                <>
                  <ChevronRight size={14} className="text-slate-400 shrink-0" />
                  <span className="text-[12px] text-slate-500 dark:text-[#888888] truncate" title={currentChapterTitle}>
                    {currentChapterTitle}
                  </span>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Controls & Quick Settings */}
      <div className="flex items-center gap-3">
        
        {/* Unified Capsule for Font, Speed, Frequency & More Settings */}
        <div className="flex items-center gap-3 md:gap-4 bg-slate-200/80 dark:bg-[#1a1a1a] px-3 py-1 rounded-lg border border-slate-300/60 dark:border-[#2d2d2d]">
          {/* Font Size */}
          <div className="flex items-center gap-1.5" title={t('reader.font.size')}>
            <Type size={14} className="text-slate-500" />
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

          {/* Speed */}
          <div className="flex items-center gap-1.5" title={t('reader.speed')}>
            <Activity size={14} className="text-slate-500" />
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

          {/* Frequency */}
          <div className="flex items-center gap-1.5" title={t('reader.freq')}>
            <Music size={14} className="text-slate-500" />
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

          <div className="h-3.5 w-px bg-slate-300 dark:bg-[#3a3a3a] mx-0.5"></div>

          {/* More Settings inside capsule */}
          <div className="relative flex items-center" ref={moreMenuRef}>
            <button 
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className={`p-1 rounded hover:bg-slate-300/70 dark:hover:bg-[#333333] transition-colors ${isMoreMenuOpen ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-600 dark:text-[#cccccc]'}`}
              title={t('reader.more.settings')}
            >
              <Settings2 size={15} />
            </button>
            
            {isMoreMenuOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onMouseDown={() => setIsMoreMenuOpen(false)}
                />
                <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333333] shadow-2xl py-2 z-50 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  <button 
                    onClick={() => { setUseHarmonics(!useHarmonics); setIsMoreMenuOpen(false); }}
                    className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] flex justify-between items-center transition-colors group"
                    title={t('reader.harmonics.desc')}
                  >
                    <div className="flex items-center gap-3">
                      <Radio size={15} className="text-slate-400 group-hover:text-indigo-500" />
                      <span className="text-[13px] font-medium text-slate-700 dark:text-[#cccccc]">{t('reader.harmonics')}</span>
                    </div>
                    {useHarmonics && <Check size={14} className="text-indigo-500" />}
                  </button>
                  
                  <div className="h-px bg-slate-100 dark:bg-[#333333] my-1.5 mx-3"></div>
                  
                  <div className="px-4 py-1.5 flex items-center gap-2">
                    <Hash size={12} className="text-slate-400" />
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t('reader.number.mode')}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 px-3 mb-1">
                    <button 
                      onClick={() => { setNumberMode('long'); setIsMoreMenuOpen(false); }}
                      className={`py-1.5 rounded-lg text-[12px] font-medium flex items-center justify-center transition-colors ${numberMode === 'long' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-[#2a2a2a] text-slate-600 dark:text-[#999999]'}`}
                    >
                      {t('reader.number.long')}
                    </button>
                    <button 
                      onClick={() => { setNumberMode('short5'); setIsMoreMenuOpen(false); }}
                      className={`py-1.5 rounded-lg text-[12px] font-medium flex items-center justify-center transition-colors ${numberMode === 'short5' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-[#2a2a2a] text-slate-600 dark:text-[#999999]'}`}
                    >
                      {t('reader.number.short5')}
                    </button>
                    <button 
                      onClick={() => { setNumberMode('short10'); setIsMoreMenuOpen(false); }}
                      className={`py-1.5 rounded-lg text-[12px] font-medium flex items-center justify-center transition-colors ${numberMode === 'short10' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-[#2a2a2a] text-slate-600 dark:text-[#999999]'}`}
                    >
                      {t('reader.number.short10')}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Divider separating settings capsule from player buttons */}
        <div className="h-5 w-px bg-slate-300 dark:bg-[#333333] mx-0.5"></div>

        {/* Playback Controls with fixed width layout */}
        <div className="flex items-center gap-1.5">
          {onRegenerate && (
            <button 
              onClick={() => { stopPlay(); onRegenerate(); }}
              disabled={isPlaying}
              className="p-2 rounded-lg font-medium flex items-center justify-center shrink-0 transition-colors bg-slate-200/60 dark:bg-[#252525] hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-600 dark:text-[#cccccc] disabled:opacity-40"
              title={t('reader.regenerate')}
            >
              <RefreshCw size={14} />
            </button>
          )}
          <button 
            onClick={stopPlay}
            disabled={!isPlaying}
            className={`p-2 rounded-lg font-medium flex items-center justify-center shrink-0 transition-colors ${isPlaying ? 'bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-[#2e2e2e] dark:hover:bg-[#3e3e3e] dark:text-[#cccccc]' : 'opacity-25 pointer-events-none text-slate-400 dark:text-slate-600'}`}
            title="停止"
          >
            <Square size={14} className="fill-current" />
          </button>
          <button 
            onMouseDown={(e) => e.preventDefault()}
            onClick={togglePlay}
            className={`w-[84px] h-[34px] rounded-lg font-medium flex items-center justify-center gap-1.5 shrink-0 transition-colors ${isPlaying && !isPaused ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
          >
            {isPlaying && !isPaused ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying && !isPaused ? t('reader.pause') : (isPaused ? t('reader.resume') : t('reader.play'))}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

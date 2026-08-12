import React from 'react';
import { ArrowLeft, List, ChevronRight, Type, Activity, Music, Settings2, SkipForward, Check, Heading1, Radio, Hash, Pause, Play, RefreshCw } from 'lucide-react';

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
  skipTitle,
  setSkipTitle,
  hideBodyTitle,
  setHideBodyTitle,
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
  return (
    <div className="h-12 bg-slate-100 dark:bg-[#111111] border-b border-slate-300 dark:border-[#333333] flex items-center px-4 shrink-0 shadow-sm z-10 justify-between">
      <div className="flex items-center gap-3">
        <button 
          onClick={handleClose}
          className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-600 dark:text-[#cccccc] transition-colors"
          title="返回书库"
        >
          <ArrowLeft size={18} />
        </button>
        
        <button 
          onClick={() => setIsTocOpen(!isTocOpen)}
          className={`p-1.5 rounded transition-colors ${isTocOpen ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-600 dark:text-[#cccccc]'}`}
          title="侧边栏"
        >
          <List size={18} />
        </button>
        
        <div className="h-4 w-px bg-slate-300 dark:bg-[#444444] mx-1"></div>
        
        <span className="text-[13px] font-semibold truncate max-w-[200px] md:max-w-md flex items-center gap-1.5 text-slate-800 dark:text-[#cccccc]">
          <span className="truncate">{bookData.name}</span>
          {currentChapterTitle && (
            <>
              <ChevronRight size={14} className="text-slate-400 shrink-0" />
              <span className="text-indigo-600 dark:text-indigo-400 truncate">{currentChapterTitle}</span>
            </>
          )}
        </span>
      </div>

      {/* Quick Settings & Player Controls */}
      <div className="flex items-center gap-1 md:gap-2 text-[12px] h-full justify-end">
        
        {/* Scrollable Adjustments */}
        <div className="flex items-center overflow-x-auto custom-scrollbar pr-1 hide-scrollbar-on-idle">
          <div className="flex items-center gap-2 md:gap-4 bg-slate-200 dark:bg-[#111111] px-2 md:px-3 py-1 rounded shrink-0">
            <div className="flex items-center gap-1.5" title="字号 (px)">
              <Type size={14} className="text-slate-500" />
              <input 
                type="number" 
                min="10" max="150" step="1" 
                value={displayFontSize} 
                onChange={e => setBaseFontSize(Number(e.target.value) / fontScale)} 
                className="w-12 bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-[#333333] rounded px-1 text-center font-mono focus:outline-none focus:border-indigo-500" 
              />
            </div>
            
            <div className="flex items-center gap-1.5" title="发报速度 (WPM)">
              <Activity size={14} className="text-slate-500" />
              <input 
                type="number" 
                min="5" max="60" 
                value={morseSpeed} 
                onChange={e => setMorseSpeed(Number(e.target.value))} 
                className="w-12 bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-[#333333] rounded px-1 text-center font-mono focus:outline-none focus:border-indigo-500" 
              />
              <span className="text-slate-500 hidden md:inline">WPM</span>
            </div>
            
            <div className="flex items-center gap-1.5" title="侧音频率 (Hz)">
              <Music size={14} className="text-slate-500" />
              <input 
                type="number" 
                min="100" max="1500" step="10" 
                value={morseFreq} 
                onChange={e => setMorseFreq(Number(e.target.value))} 
                className="w-14 bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-[#333333] rounded px-1 text-center font-mono focus:outline-none focus:border-indigo-500" 
              />
              <span className="text-slate-500 hidden md:inline">Hz</span>
            </div>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-300 dark:bg-[#444444] mx-0.5 shrink-0"></div>

        {/* More Menu */}
        <div className="relative shrink-0" ref={moreMenuRef}>
          <button 
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            className={`p-1.5 rounded transition-colors ${isMoreMenuOpen ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-600 dark:text-[#cccccc]'}`}
            title="更多设置"
          >
            <Settings2 size={16} />
          </button>
          
          {isMoreMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onMouseDown={() => setIsMoreMenuOpen(false)}
              />
              <div className="absolute top-full right-0 mt-2 w-64 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333333] shadow-2xl py-2 z-50 rounded-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <button 
                onClick={() => { setSkipTitle(!skipTitle); setIsMoreMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] flex justify-between items-center transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <SkipForward size={15} className="text-slate-400 group-hover:text-indigo-500" />
                  <span className="text-[13px] font-medium text-slate-700 dark:text-[#cccccc]">跳过标题播放</span>
                </div>
                {skipTitle && <Check size={14} className="text-indigo-500" />}
              </button>
              {bookData.type === 'epub' && (
                <button 
                  onClick={() => { setHideBodyTitle(!hideBodyTitle); setIsMoreMenuOpen(false); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] flex justify-between items-center transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <Heading1 size={15} className="text-slate-400 group-hover:text-indigo-500" />
                    <span className="text-[13px] font-medium text-slate-700 dark:text-[#cccccc]">隐藏正文大标题</span>
                  </div>
                  {hideBodyTitle && <Check size={14} className="text-indigo-500" />}
                </button>
              )}
              <button 
                onClick={() => { setUseHarmonics(!useHarmonics); setIsMoreMenuOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-[#2a2a2a] flex justify-between items-center transition-colors group"
                title="开启后模拟真实老式电台的过载失真音色"
              >
                <div className="flex items-center gap-3">
                  <Radio size={15} className="text-slate-400 group-hover:text-indigo-500" />
                  <span className="text-[13px] font-medium text-slate-700 dark:text-[#cccccc]">电台失真音色 (谐波)</span>
                </div>
                {useHarmonics && <Check size={14} className="text-indigo-500" />}
              </button>
              
              <div className="h-px bg-slate-100 dark:bg-[#333333] my-1.5 mx-3"></div>
              
              <div className="px-4 py-1.5 flex items-center gap-2">
                <Hash size={12} className="text-slate-400" />
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">数字报底模式</span>
              </div>
              <div className="grid grid-cols-3 gap-1 px-3 mb-1">
                <button 
                  onClick={() => { setNumberMode('long'); setIsMoreMenuOpen(false); }}
                  className={`py-1.5 rounded-lg text-[12px] font-medium flex items-center justify-center transition-colors ${numberMode === 'long' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-[#2a2a2a] text-slate-600 dark:text-[#999999]'}`}
                >
                  长码
                </button>
                <button 
                  onClick={() => { setNumberMode('short5'); setIsMoreMenuOpen(false); }}
                  className={`py-1.5 rounded-lg text-[12px] font-medium flex items-center justify-center transition-colors ${numberMode === 'short5' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-[#2a2a2a] text-slate-600 dark:text-[#999999]'}`}
                >
                  短五
                </button>
                <button 
                  onClick={() => { setNumberMode('short10'); setIsMoreMenuOpen(false); }}
                  className={`py-1.5 rounded-lg text-[12px] font-medium flex items-center justify-center transition-colors ${numberMode === 'short10' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'hover:bg-slate-50 dark:hover:bg-[#2a2a2a] text-slate-600 dark:text-[#999999]'}`}
                >
                  短十
                </button>
              </div>

            </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onRegenerate && (
            <button 
              onClick={() => { stopPlay(); onRegenerate(); }}
              className="px-3 py-1.5 rounded font-medium flex items-center gap-1.5 shrink-0 transition-colors bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-[#333333] dark:hover:bg-[#444444] dark:text-[#cccccc]"
              title="重新生成"
            >
              <RefreshCw size={14} />
            </button>
          )}
          {isPlaying && (
            <button 
              onClick={stopPlay}
              className="px-3 py-1.5 rounded font-medium flex items-center gap-1.5 shrink-0 transition-colors bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-[#333333] dark:hover:bg-[#444444] dark:text-[#cccccc]"
            >
              <div className="w-3 h-3 bg-current rounded-sm"></div>
            </button>
          )}
          <button 
            onMouseDown={(e) => e.preventDefault()}
            onClick={togglePlay}
            className={`px-4 py-1.5 rounded font-medium flex items-center gap-2 shrink-0 transition-colors ${isPlaying && !isPaused ? 'bg-orange-500 hover:bg-orange-600 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}
          >
            {isPlaying && !isPaused ? <Pause size={14} /> : <Play size={14} />}
            <span>{isPlaying && !isPaused ? '暂停' : (isPaused ? '继续' : '播放')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

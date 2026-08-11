import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Play, Pause, Settings2, BookOpen, ChevronLeft, ChevronRight, Type, Activity, Music, SkipForward, Hash, List, Check, Radio, Heading1 } from 'lucide-react';
import audioPlayer from '../utils/audioPlayer';
import EpubEngine from './reader/EpubEngine';
import TxtEngine from './reader/TxtEngine';
import TocSidebar from './reader/TocSidebar';

export default function Reader({ bookData, onClose, jumpToSibling }) {
  const engineRef = useRef(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [toc, setToc] = useState([]);
  const [isTocOpen, setIsTocOpen] = useState(true);
  const [currentChapterTitle, setCurrentChapterTitle] = useState('');
  
  // Settings
  const [baseFontSize, setBaseFontSize] = useState(() => Number(localStorage.getItem('pref_base_font_size') || 20)); // px (baseline at 800px width)
  const [morseSpeed, setMorseSpeed] = useState(() => Number(localStorage.getItem('pref_morse_speed') || 20));
  const [morseFreq, setMorseFreq] = useState(() => Number(localStorage.getItem('pref_morse_freq')) || 380);
  const [skipTitle, setSkipTitle] = useState(localStorage.getItem('pref_skip_title') !== 'false');
  const [hideBodyTitle, setHideBodyTitle] = useState(localStorage.getItem('pref_hide_body_title') === 'true');
  const [numberMode, setNumberMode] = useState(localStorage.getItem('pref_number_mode') || 'long');
  const [useHarmonics, setUseHarmonics] = useState(localStorage.getItem('pref_use_harmonics') === 'true');
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // 纯算法驱动的响应式字号计算：以 800px 宽度为基准 1.0x
  const fontScale = Math.max(0.5, windowWidth / 800);
  const displayFontSize = Math.round(baseFontSize * fontScale);

  useEffect(() => {
    let timeout;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setWindowWidth(window.innerWidth);
      }, 150);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const moreMenuRef = useRef(null);

  // Update localStorage when audio settings change in quick bar
  useEffect(() => {
    localStorage.setItem('pref_base_font_size', baseFontSize.toString());
    localStorage.setItem('pref_morse_speed', morseSpeed);
    localStorage.setItem('pref_morse_freq', morseFreq);
    localStorage.setItem('pref_skip_title', skipTitle);
    localStorage.setItem('pref_hide_body_title', hideBodyTitle);
    localStorage.setItem('pref_number_mode', numberMode);
    localStorage.setItem('pref_use_harmonics', useHarmonics);

    audioPlayer.updateConfig({
      wpm: morseSpeed,
      freq: morseFreq,
      numberMode: numberMode,
      useHarmonics: useHarmonics
    });
  }, [baseFontSize, morseSpeed, morseFreq, skipTitle, hideBodyTitle, numberMode, useHarmonics]);

  // Click outside to close more menu
  useEffect(() => {
    function handleClickOutside(e) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setIsMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const togglePlay = async () => {
    if (isPlaying && !isPaused) {
      audioPlayer.pause();
      setIsPaused(true);
      if (engineRef.current) engineRef.current.saveProgress();
    } else if (isPlaying && isPaused) {
      audioPlayer.resume();
      setIsPaused(false);
    } else {
      if (!engineRef.current) return;
      const { text, startIndex } = await engineRef.current.getChapterText(skipTitle);
      if (!text.trim()) return;

      setIsPlaying(true);
      setIsPaused(false);
      
      audioPlayer.playMorseText(text, {
        wpm: morseSpeed,
        freq: morseFreq,
        numberMode: numberMode,
        startIndex: startIndex,
        onCharPlay: (token, idx) => {
          if (engineRef.current) engineRef.current.highlightToken(token);
        },
        onComplete: () => {
          setIsPlaying(false);
          setIsPaused(false);
          if (engineRef.current) engineRef.current.clearHighlight();
        }
      });
    }
  };

  const stopPlay = () => {
    audioPlayer.stop();
    setIsPlaying(false);
    setIsPaused(false);
    if (engineRef.current) {
      engineRef.current.clearHighlight();
      engineRef.current.saveProgress();
    }
  };

  const handleClose = () => {
    stopPlay();
    if (engineRef.current) {
      engineRef.current.saveProgress();
    }
    onClose();
  };

  const handleTocClick = (item) => {
    if (engineRef.current) {
      engineRef.current.jumpTo(item);
    }
  };

  const handlePrev = () => {
    if (engineRef.current) engineRef.current.prevPage();
  };

  const handleNext = () => {
    if (engineRef.current) engineRef.current.nextPage();
  };

  // Keyboard Shortcuts (Space, ArrowLeft, ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore shortcuts if the user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handlePrev, handleNext]);

  const paginationLabel = engineRef.current ? engineRef.current.getPaginationLabel() : (bookData.type === 'epub' ? 'EPUB Navigation' : 'TXT Navigation');

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#1e1e1e] flex flex-col transition-colors select-none text-slate-800 dark:text-slate-200">
      
      {/* 注入滚动条等样式 */}
      <style>{`
        .epub-container { overflow-x: hidden !important; }
        
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
          border-radius: 4px;
        }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(75, 85, 99, 0.5);
        }
        .hide-scrollbar-on-idle::-webkit-scrollbar-thumb {
          background-color: transparent;
        }
        .hide-scrollbar-on-idle:hover::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.5);
        }
        .dark .hide-scrollbar-on-idle:hover::-webkit-scrollbar-thumb {
          background-color: rgba(75, 85, 99, 0.5);
        }
      `}</style>

      {/* 原生标题栏控制区域 */}
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

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* TOC Sidebar */}
        <TocSidebar 
          isOpen={isTocOpen} 
          toc={toc} 
          bookType={bookData.type} 
          onTocClick={handleTocClick}
        />

        {/* Reader Core */}
        <div className="flex-1 flex flex-col relative bg-white dark:bg-[#1e1e1e] border-l border-slate-300 dark:border-[#333333] min-w-0">
          <div className="flex-1 relative">
            <div className="absolute inset-0 px-4 md:px-8">
              {bookData.type === 'epub' ? (
                <EpubEngine 
                  ref={engineRef}
                  bookData={bookData} 
                  fontSize={displayFontSize}
                  hideBodyTitle={hideBodyTitle} 
 
                  onTocLoaded={setToc}
                  onChapterChange={setCurrentChapterTitle}
                />
              ) : (
                <TxtEngine 
                  ref={engineRef}
                  bookData={bookData}
                  fontSize={displayFontSize}
                  jumpToSibling={jumpToSibling}
                  onTocLoaded={setToc}
                  onChapterChange={setCurrentChapterTitle}
                />
              )}
            </div>
          </div>
          
          {/* Bottom Paginator */}
          <div className="h-12 border-t border-slate-200 dark:border-[#333333] bg-slate-50/80 dark:bg-[#252526]/80 backdrop-blur flex items-center justify-center gap-6 shrink-0">
            <button 
              onClick={handlePrev}
              className="px-4 py-1.5 rounded hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-600 dark:text-[#cccccc] flex items-center gap-2 text-[13px] transition-colors"
            >
              <ChevronLeft size={16} /> 上一页
            </button>
            <span className="text-[12px] text-slate-400 font-mono">
              {paginationLabel}
            </span>
            <button 
              onClick={handleNext}
              className="px-4 py-1.5 rounded hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-600 dark:text-[#cccccc] flex items-center gap-2 text-[13px] transition-colors"
            >
              下一页 <ChevronRight size={16} />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

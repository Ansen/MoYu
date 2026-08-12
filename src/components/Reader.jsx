import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ReaderHeader from './reader/ReaderHeader';
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
  const [txtProgress, setTxtProgress] = useState(0);
  
  // Settings
  const [baseFontSize, setBaseFontSize] = useState(() => Number(localStorage.getItem('pref_base_font_size') || 20)); // px (baseline at 800px width)
  const [morseSpeed, setMorseSpeed] = useState(() => Number(localStorage.getItem('pref_morse_speed') || 20));
  const [morseFreq, setMorseFreq] = useState(() => Number(localStorage.getItem('pref_morse_freq')) || 380);
  const [skipTitle, setSkipTitle] = useState(localStorage.getItem('pref_skip_title') !== 'false');
  const [hideBodyTitle, setHideBodyTitle] = useState(localStorage.getItem('pref_hide_body_title') !== 'false');
  const [numberMode, setNumberMode] = useState(localStorage.getItem('pref_number_mode') || 'long');
  const [useHarmonics, setUseHarmonics] = useState(localStorage.getItem('pref_use_harmonics') === 'true');


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
    stopPlay();
    if (engineRef.current) {
      engineRef.current.jumpTo(item);
    }
  };

  const handlePrev = () => {
    stopPlay();
    if (engineRef.current) engineRef.current.prevPage();
  };

  const handleNext = () => {
    stopPlay();
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

  const paginationLabel = engineRef.current ? engineRef.current.getPaginationLabel() : (bookData.type === 'epub' ? 'EPUB Navigation' : `进度: ${txtProgress}%`);

  return (
    <div className="fixed top-8 left-0 right-0 bottom-0 z-40 bg-white dark:bg-[#1e1e1e] flex flex-col transition-colors select-none text-slate-800 dark:text-slate-200">
      
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
      <ReaderHeader 
        bookData={bookData}
        handleClose={handleClose}
        isTocOpen={isTocOpen}
        setIsTocOpen={setIsTocOpen}
        currentChapterTitle={currentChapterTitle}
        displayFontSize={displayFontSize}
        setBaseFontSize={setBaseFontSize}
        fontScale={fontScale}
        morseSpeed={morseSpeed}
        setMorseSpeed={setMorseSpeed}
        morseFreq={morseFreq}
        setMorseFreq={setMorseFreq}
        moreMenuRef={moreMenuRef}
        isMoreMenuOpen={isMoreMenuOpen}
        setIsMoreMenuOpen={setIsMoreMenuOpen}
        skipTitle={skipTitle}
        setSkipTitle={setSkipTitle}
        hideBodyTitle={hideBodyTitle}
        setHideBodyTitle={setHideBodyTitle}
        useHarmonics={useHarmonics}
        setUseHarmonics={setUseHarmonics}
        numberMode={numberMode}
        setNumberMode={setNumberMode}
        isPlaying={isPlaying}
        isPaused={isPaused}
        togglePlay={togglePlay}
        stopPlay={stopPlay}
      />

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
                  onProgressChange={setTxtProgress}
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

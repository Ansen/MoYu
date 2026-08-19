import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, FileText, BookOpen, Folder } from 'lucide-react';
import ReaderHeader from './reader/ReaderHeader';
import audioPlayer from '../utils/audioPlayer';
import TxtEngine from './reader/TxtEngine';
import TocSidebar from './reader/TocSidebar';

export default function Reader({ bookData, onClose, jumpToSibling, jumpToChapter, onRegenerate }) {
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
  const [numberMode, setNumberMode] = useState(localStorage.getItem('pref_number_mode') || 'long');
  const [useHarmonics, setUseHarmonics] = useState(localStorage.getItem('pref_use_harmonics') === 'true');

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

  // 进入阅读器页面时提前预热 AudioContext，避免点击播放时声卡驱动冷启动导致开头卡顿/断续
  useEffect(() => {
    audioPlayer.init().catch(() => {});
  }, []);

  const moreMenuRef = useRef(null);

  // Update localStorage when audio settings change in quick bar
  useEffect(() => {
    localStorage.setItem('pref_base_font_size', baseFontSize.toString());
    localStorage.setItem('pref_morse_speed', morseSpeed);
    localStorage.setItem('pref_morse_freq', morseFreq);
    localStorage.setItem('pref_number_mode', numberMode);
    localStorage.setItem('pref_use_harmonics', useHarmonics);

    audioPlayer.updateConfig({
      wpm: morseSpeed,
      freq: morseFreq,
      numberMode: numberMode,
      useHarmonics: useHarmonics
    });
  }, [baseFontSize, morseSpeed, morseFreq, numberMode, useHarmonics]);

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

  const togglePlay = useCallback(async () => {
    if (isPlaying && !isPaused) {
      audioPlayer.pause();
      setIsPaused(true);
      if (engineRef.current) engineRef.current.saveProgress();
    } else if (isPlaying && isPaused) {
      audioPlayer.resume();
      setIsPaused(false);
    } else {
      if (!engineRef.current) return;
      const { text, startIndex } = await engineRef.current.getChapterText();
      if (!text.trim()) return;

      setIsPlaying(true);
      setIsPaused(false);
      
      audioPlayer.playMorseText(text, {
        wpm: morseSpeed,
        freq: morseFreq,
        numberMode: numberMode,
        startIndex: startIndex,
        onCharPlay: (token) => {
          if (engineRef.current) engineRef.current.highlightToken(token);
        },
        onComplete: () => {
          setIsPlaying(false);
          setIsPaused(false);
          if (engineRef.current) engineRef.current.clearHighlight();
        }
      });
    }
  }, [isPlaying, isPaused, morseSpeed, morseFreq, numberMode]);

  const stopPlay = useCallback(() => {
    audioPlayer.stop();
    setIsPlaying(false);
    setIsPaused(false);
    if (engineRef.current) {
      engineRef.current.clearHighlight();
      engineRef.current.saveProgress();
    }
  }, []);

  const handleClose = useCallback(() => {
    stopPlay();
    if (engineRef.current) {
      engineRef.current.saveProgress();
    }
    onClose();
  }, [stopPlay, onClose]);

  const handleTocClick = useCallback((item) => {
    stopPlay();
    if (engineRef.current) {
      engineRef.current.jumpTo(item);
    }
  }, [stopPlay]);

  const handlePrev = useCallback(() => {
    stopPlay();
    if (engineRef.current) engineRef.current.prevPage();
  }, [stopPlay]);

  const handleNext = useCallback(() => {
    stopPlay();
    if (engineRef.current) engineRef.current.nextPage();
  }, [stopPlay]);

  // Keep latest actions in ref for stable keyboard shortcut listener
  const actionsRef = useRef({ togglePlay, handlePrev, handleNext });
  actionsRef.current = { togglePlay, handlePrev, handleNext };

  // Keyboard Shortcuts (Space, ArrowLeft, ArrowRight) - mounted once
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore shortcuts if the user is typing in an input or textarea
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        actionsRef.current.togglePlay();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        actionsRef.current.handlePrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        actionsRef.current.handleNext();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const paginationLabel = engineRef.current && typeof engineRef.current.getPaginationLabel === 'function' ? engineRef.current.getPaginationLabel() : '';

  return (
    <div className="fixed top-8 left-0 right-0 bottom-0 z-40 bg-white dark:bg-[#1e1e1e] flex flex-col transition-colors select-none text-slate-800 dark:text-slate-200">
      
      {/* 注入滚动条等样式 */}
      <style>{`
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
        useHarmonics={useHarmonics}
        setUseHarmonics={setUseHarmonics}
        numberMode={numberMode}
        setNumberMode={setNumberMode}
        isPlaying={isPlaying}
        isPaused={isPaused}
        togglePlay={togglePlay}
        stopPlay={stopPlay}
        onRegenerate={onRegenerate}
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
              <TxtEngine 
                ref={engineRef}
                bookData={bookData}
                fontSize={displayFontSize}
                jumpToSibling={jumpToSibling}
                jumpToChapter={jumpToChapter}
                onTocLoaded={setToc}
                onChapterChange={setCurrentChapterTitle}
              />
            </div>
          </div>
          
          {/* Bottom Unified Status Bar */}
          <div className="h-9 border-t border-slate-200 dark:border-[#2d2d2d] bg-slate-50/90 dark:bg-[#181818]/90 backdrop-blur px-4 flex items-center justify-between shrink-0 select-none text-[12px] text-slate-500 dark:text-[#888888]">
            {((bookData.type === 'epub' && bookData.toc && bookData.toc.length > 1) ||
              (bookData.siblings && bookData.siblings.length > 1)) ? (
              /* Multi-Page Pagination Mode */
              <>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                    {bookData.type === 'epub' ? (
                      <>
                        <BookOpen size={12} className="text-indigo-500" />
                        <span>EPUB 电子书</span>
                      </>
                    ) : (
                      <>
                        <Folder size={12} className="text-amber-500" />
                        <span>文件夹文档</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Classic Centered Pagination Group: [ < 上一页 ] [ 章节 2 / 29 ] [ 下一页 > ] */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handlePrev}
                    disabled={bookData.type === 'epub' ? (bookData.currentChapterIndex <= 0) : (bookData.currentIndex <= 0)}
                    className={`px-2.5 py-0.5 rounded flex items-center gap-1 transition-colors text-[11px] font-medium ${
                      (bookData.type === 'epub' ? (bookData.currentChapterIndex > 0) : (bookData.currentIndex > 0))
                        ? 'hover:bg-slate-200 dark:hover:bg-[#282828] text-slate-700 dark:text-[#cccccc] cursor-pointer'
                        : 'opacity-30 cursor-not-allowed text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    <ChevronLeft size={13} /> 上一页
                  </button>

                  {paginationLabel && (
                    <span className="font-mono text-slate-700 dark:text-[#cccccc] font-medium text-[11px] px-2 py-0.5 rounded bg-slate-200/60 dark:bg-[#252525] border border-slate-300/40 dark:border-[#333333]">
                      {paginationLabel}
                    </span>
                  )}

                  <button 
                    onClick={handleNext}
                    disabled={
                      bookData.type === 'epub'
                        ? ((bookData.currentChapterIndex || 0) >= (bookData.toc?.length || 1) - 1)
                        : (bookData.currentIndex >= (bookData.siblings?.length || 1) - 1)
                    }
                    className={`px-2.5 py-0.5 rounded flex items-center gap-1 transition-colors text-[11px] font-medium ${
                      (bookData.type === 'epub'
                        ? ((bookData.currentChapterIndex || 0) < (bookData.toc?.length || 1) - 1)
                        : (bookData.currentIndex < (bookData.siblings?.length || 1) - 1))
                        ? 'hover:bg-slate-200 dark:hover:bg-[#282828] text-slate-700 dark:text-[#cccccc] cursor-pointer'
                        : 'opacity-30 cursor-not-allowed text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    下一页 <ChevronRight size={13} />
                  </button>
                </div>

                <div className="flex items-center gap-2 text-slate-400 dark:text-[#666666] text-[11px]">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-[#252525] text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-[#383838]">← / →</kbd>
                    <span>翻页</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-[#252525] text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-[#383838]">Space</kbd>
                    <span>播放</span>
                  </span>
                </div>
              </>
            ) : bookData.isGenerated ? (
              /* Random Generated Morse Practice Mode */
              <>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5 font-medium text-orange-600 dark:text-orange-400">
                    <Sparkles size={12} />
                    <span>随机练习报底</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span>{bookData.generatorConfig ? `${bookData.generatorConfig.charsPerGroup || 4} 字/组 · ${bookData.generatorConfig.groupCount || 100} 组` : '100 组'}</span>
                </div>

                <div className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                  共 {bookData.data ? bookData.data.replace(/\s+/g, '').length : 0} 字符
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 dark:text-[#666666] text-[11px]">
                  <kbd className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-[#252525] text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-[#383838]">Space</kbd>
                  <span>播放 / 暂停</span>
                </div>
              </>
            ) : (
              /* Single File TXT Mode */
              <>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                    <FileText size={12} className="text-blue-500" />
                    <span>纯文本文档</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span>UTF-8</span>
                </div>

                <div className="font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                  共 {bookData.data ? bookData.data.length.toLocaleString() : 0} 字符
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 dark:text-[#666666] text-[11px]">
                  <kbd className="px-1 py-0.5 rounded bg-slate-200/80 dark:bg-[#252525] text-[10px] font-mono text-slate-600 dark:text-slate-300 border border-slate-300/60 dark:border-[#383838]">Space</kbd>
                  <span>播放 / 暂停</span>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

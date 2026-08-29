import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, FileText, BookOpen, Folder } from 'lucide-react';
import ReaderHeader from './reader/ReaderHeader';
import audioPlayer from '../utils/audioPlayer';
import TxtEngine from './reader/TxtEngine';
import TocSidebar from './reader/TocSidebar';
import { useI18n } from '../i18n';

export default function Reader({ bookData, onClose, jumpToSibling, jumpToChapter, onRegenerate }) {
  const { t } = useI18n();
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
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('pref_reader_view_mode') || 'grid');

  const [windowSize, setWindowSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  // 纯算法驱动的响应式字号计算：为了保证放大/缩小窗口时，文本在屏幕中的面积占比（铺满率）恒定
  // 使用几何平均值(面积的平方根)替代单维度的宽度线性缩放。以 800x600 为基准 1.0x
  const currentGeo = Math.sqrt(windowSize.width * windowSize.height);
  const baseGeo = Math.sqrt(800 * 600);
  const fontScale = Math.max(0.5, currentGeo / baseGeo);
  const displayFontSize = Math.round(baseFontSize * fontScale);

  const [isAudioReady, setIsAudioReady] = useState(false);

  useEffect(() => {
    let timeout;
    const handleResize = () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        setWindowSize({ width: window.innerWidth, height: window.innerHeight });
      }, 50);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeout);
    };
  }, []);

  // 进入阅读器页面时提前预热 AudioContext，避免点击播放时声卡驱动冷启动导致开头卡顿/断续
  useEffect(() => {
    let isMounted = true;
    audioPlayer.init()
      .then(() => { if (isMounted) setIsAudioReady(true); })
      .catch(() => { if (isMounted) setIsAudioReady(true); });
      
    return () => {
      isMounted = false;
      audioPlayer.stop();
    };
  }, []);

  // 当书籍内容更新（如切换章节、点击重新生成报底）时，彻底重置播放与高亮状态
  useEffect(() => {
    audioPlayer.stop();
    setIsPlaying(false);
    setIsPaused(false);
    if (engineRef.current) {
      engineRef.current.clearHighlight();
    }
  }, [bookData?.data, bookData?.name]);

  const moreMenuRef = useRef(null);

  // Update localStorage when audio settings change in quick bar
  useEffect(() => {
    localStorage.setItem('pref_base_font_size', baseFontSize.toString());
    localStorage.setItem('pref_morse_speed', morseSpeed);
    localStorage.setItem('pref_morse_freq', morseFreq);
    localStorage.setItem('pref_number_mode', numberMode);
    localStorage.setItem('pref_use_harmonics', useHarmonics);
    localStorage.setItem('pref_reader_view_mode', viewMode);

    audioPlayer.updateConfig({
      wpm: morseSpeed,
      freq: morseFreq,
      numberMode: numberMode,
      useHarmonics: useHarmonics
    });
  }, [baseFontSize, morseSpeed, morseFreq, numberMode, useHarmonics, viewMode]);

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
        baseFontSize={baseFontSize}
        setBaseFontSize={setBaseFontSize}
        morseSpeed={morseSpeed}
        setMorseSpeed={setMorseSpeed}
        morseFreq={morseFreq}
        setMorseFreq={setMorseFreq}
        useHarmonics={useHarmonics}
        setUseHarmonics={setUseHarmonics}
        numberMode={numberMode}
        setNumberMode={setNumberMode}
        viewMode={viewMode}
        setViewMode={setViewMode}
        isPlaying={isPlaying}
        isPaused={isPaused}
        togglePlay={togglePlay}
        stopPlay={stopPlay}
        isAudioReady={isAudioReady}
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
            <div className="absolute inset-0 px-2 md:px-4">
              <TxtEngine 
                ref={engineRef}
                bookData={bookData}
                fontSize={displayFontSize}
                viewMode={viewMode}
                jumpToSibling={jumpToSibling}
                jumpToChapter={jumpToChapter}
                onTocLoaded={setToc}
                onChapterChange={setCurrentChapterTitle}
              />
            </div>
          </div>
          
          {/* Bottom Unified Status Bar */}
          <div className="h-10 border-t border-slate-200 dark:border-[#2d2d2d] bg-slate-50/90 dark:bg-[#181818]/90 backdrop-blur px-4 flex items-center justify-between shrink-0 select-none text-[12px] text-slate-500 dark:text-[#888888]">
            {((bookData.type === 'epub' && bookData.toc && bookData.toc.length > 1) ||
              (bookData.siblings && bookData.siblings.length > 1)) ? (
              /* Multi-Page Pagination Mode */
              <>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                    {bookData.type === 'epub' ? (
                      <>
                        <BookOpen size={14} className="text-indigo-500" />
                        <span>{t('reader.doc.epub')}</span>
                      </>
                    ) : (
                      <>
                        <Folder size={14} className="text-amber-500" />
                        <span>{t('reader.doc.folder')}</span>
                      </>
                    )}
                  </span>
                </div>

                {/* Classic Centered Pagination Group: [ < 上一页 ] [ 章节 2 / 29 ] [ 下一页 > ] */}
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handlePrev}
                    disabled={bookData.type === 'epub' ? (bookData.currentChapterIndex <= 0) : (bookData.currentIndex <= 0)}
                    className={`h-7 px-3 rounded-lg flex items-center gap-1.5 transition-colors text-[12px] font-medium ${
                      (bookData.type === 'epub' ? (bookData.currentChapterIndex > 0) : (bookData.currentIndex > 0))
                        ? 'hover:bg-slate-200 dark:hover:bg-[#282828] text-slate-700 dark:text-[#cccccc] active:scale-95 cursor-pointer'
                        : 'opacity-30 cursor-not-allowed text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    <ChevronLeft size={14} /> {t('reader.prev')}
                  </button>

                  {paginationLabel && (
                    <span className="font-mono text-slate-700 dark:text-[#dddddd] font-semibold text-[12px] px-2.5 py-1 rounded-md bg-slate-200/80 dark:bg-[#252525] border border-slate-300/60 dark:border-[#383838] shadow-2xs">
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
                    className={`h-7 px-3 rounded-lg flex items-center gap-1.5 transition-colors text-[12px] font-medium ${
                      (bookData.type === 'epub'
                        ? ((bookData.currentChapterIndex || 0) < (bookData.toc?.length || 1) - 1)
                        : (bookData.currentIndex < (bookData.siblings?.length || 1) - 1))
                        ? 'hover:bg-slate-200 dark:hover:bg-[#282828] text-slate-700 dark:text-[#cccccc] active:scale-95 cursor-pointer'
                        : 'opacity-30 cursor-not-allowed text-slate-400 dark:text-slate-600'
                    }`}
                  >
                    {t('reader.next')} <ChevronRight size={14} />
                  </button>
                </div>

                <div className="flex items-center gap-2.5 text-slate-400 dark:text-[#888888] text-[12px]">
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-200/90 dark:bg-[#252525] text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-[#383838] shadow-2xs">← / →</kbd>
                    <span>{t('reader.shortcut.flip')}</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-200/90 dark:bg-[#252525] text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-[#383838] shadow-2xs">Space</kbd>
                    <span>{t('reader.shortcut.play')}</span>
                  </span>
                </div>
              </>
            ) : bookData.isGenerated ? (
              /* Random Generated Morse Practice Mode */
              <>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5 font-medium text-orange-600 dark:text-orange-400">
                    <Sparkles size={14} />
                    <span>{t('reader.doc.generated')}</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span>{bookData.generatorConfig ? `${bookData.generatorConfig.charsPerGroup || 4} ${t('reader.chars.unit')} · ${bookData.generatorConfig.groupCount || 100} ${t('reader.groups.unit')}` : `100 ${t('reader.groups.unit')}`}</span>
                </div>

                <div className="font-mono text-slate-600 dark:text-slate-400 text-[12px] font-medium">
                  {t('reader.stats.totalChars', '共 {count} 字符').replace('{count}', (bookData.data ? bookData.data.replace(/\s+/g, '').length : 0).toLocaleString())}
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 dark:text-[#888888] text-[12px]">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200/90 dark:bg-[#252525] text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-[#383838] shadow-2xs">Space</kbd>
                  <span>{t('reader.shortcut.playPause')}</span>
                </div>
              </>
            ) : (
              /* Single File TXT Mode */
              <>
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300">
                    <FileText size={14} className="text-blue-500" />
                    <span>{t('reader.doc.txt')}</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">|</span>
                  <span>UTF-8</span>
                </div>

                <div className="font-mono text-slate-600 dark:text-slate-400 text-[12px] font-medium">
                  {t('reader.stats.totalChars', '共 {count} 字符').replace('{count}', (bookData.data ? bookData.data.length : 0).toLocaleString())}
                </div>

                <div className="flex items-center gap-1.5 text-slate-400 dark:text-[#888888] text-[12px]">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200/90 dark:bg-[#252525] text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-[#383838] shadow-2xs">Space</kbd>
                  <span>{t('reader.shortcut.playPause')}</span>
                </div>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

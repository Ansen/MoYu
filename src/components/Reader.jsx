import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Sparkles, FileText, BookOpen, Folder, Radio } from 'lucide-react';
import ReaderHeader from './reader/ReaderHeader';
import { useMorseAudio } from '../hooks/useMorseAudio';
import TxtEngine from './reader/TxtEngine';
import { parseTelegramContent } from '../utils/telegramParser';
import TocSidebar from './reader/TocSidebar';
import { useI18n } from '../i18n';
import { ALL_FONTS, getDefaultFontId } from '../config/fonts';

export default function Reader({ bookData, onClose, jumpToSibling, jumpToChapter, onRegenerate }) {
  const { t } = useI18n();
  const engineRef = useRef(null);
  
  const parsedTelegram = useMemo(() => {
    return parseTelegramContent(bookData?.data || '');
  }, [bookData?.data]);
  
  const isGridEligible = parsedTelegram.isGridEligible;
  
  // 接入企业级音频播放中枢 (SSOT 响应式状态与控制)
  const {
    isPlaying,
    isPaused,
    activeMarker,
    toggle: toggleAudio,
    stop: stopAudio,
    warmUp,
    updateConfig: updateAudioConfig
  } = useMorseAudio();

  // 进入播放界面解析文本的同时预热硬件声卡，消除首次发声切音
  useEffect(() => {
    warmUp().catch(() => {});
  }, [warmUp]);

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
  const [fontFamily, setFontFamily] = useState(() => {
    const saved = localStorage.getItem('pref_reader_font_family');
    const valid = ALL_FONTS.map(f => f.id);
    return valid.includes(saved) ? saved : getDefaultFontId();
  });
  const [enableMarkers, setEnableMarkers] = useState(() => localStorage.getItem('pref_reader_enable_markers') !== 'false');
  const [prefixMarker, setPrefixMarker] = useState(() => localStorage.getItem('pref_reader_prefix_marker') || '===');
  const [suffixMarker, setSuffixMarker] = useState(() => localStorage.getItem('pref_reader_suffix_marker') || 'iii');


  // 离开阅读器时清理播放器
  useEffect(() => {
    return () => {
      stopAudio();
    };
  }, [stopAudio]);

  const prevBookRef = useRef({ data: bookData?.data, name: bookData?.name });
  // 书籍内容更新（切换书籍、重新生成报底等）时才重置播放状态与高亮
  useEffect(() => {
    const prev = prevBookRef.current;
    const hasChanged = prev.data !== bookData?.data || prev.name !== bookData?.name;
    prevBookRef.current = { data: bookData?.data, name: bookData?.name };

    if (hasChanged) {
      stopAudio();
      if (engineRef.current) {
        engineRef.current.clearHighlight();
      }
    }
  }, [bookData?.data, bookData?.name, stopAudio]);

  // Update localStorage when audio settings change in quick bar
  useEffect(() => {
    localStorage.setItem('pref_base_font_size', baseFontSize.toString());
    localStorage.setItem('pref_morse_speed', morseSpeed);
    localStorage.setItem('pref_morse_freq', morseFreq);
    localStorage.setItem('pref_number_mode', numberMode);
    localStorage.setItem('pref_use_harmonics', useHarmonics);
    localStorage.setItem('pref_reader_view_mode', viewMode);
    localStorage.setItem('pref_reader_font_family', fontFamily);
    localStorage.setItem('pref_reader_enable_markers', enableMarkers.toString());
    localStorage.setItem('pref_reader_prefix_marker', prefixMarker);
    localStorage.setItem('pref_reader_suffix_marker', suffixMarker);

    updateAudioConfig({
      wpm: morseSpeed,
      freq: morseFreq,
      numberMode: numberMode,
      useHarmonics: useHarmonics
    });
  }, [baseFontSize, morseSpeed, morseFreq, numberMode, useHarmonics, viewMode, fontFamily, enableMarkers, prefixMarker, suffixMarker, updateAudioConfig]);

  // 统一播放/暂停控制：直接委托给中枢的自适应 toggle，杜绝业务层推演状态
  const togglePlay = useCallback(async () => {
    // 关键：在用户原生手势同步第一行唤醒底层 AudioContext，获取操作系统授权
    warmUp().catch(() => {});

    if (isPlaying && !isPaused && engineRef.current) {
      engineRef.current.saveProgress();
    }

    const effectivePrefix = enableMarkers ? (prefixMarker || parsedTelegram.startMarker || '') : '';
    const effectiveSuffix = enableMarkers ? (suffixMarker || parsedTelegram.endMarker || '') : '';

    await toggleAudio(async () => {
      if (!engineRef.current) return null;
      return await engineRef.current.getChapterText();
    }, {
      wpm: morseSpeed,
      freq: morseFreq,
      numberMode: numberMode,
      useHarmonics: useHarmonics,
      enableMarkers: enableMarkers,
      prefixMarker: effectivePrefix,
      suffixMarker: effectiveSuffix,
      onCharPlay: (token) => {
        if (engineRef.current) engineRef.current.highlightToken(token);
      },
      onComplete: () => {
        if (engineRef.current) engineRef.current.clearHighlight();
      }
    });
  }, [warmUp, toggleAudio, isPlaying, isPaused, morseSpeed, morseFreq, numberMode, useHarmonics, enableMarkers, prefixMarker, suffixMarker, parsedTelegram]);

  const stopPlay = useCallback(() => {
    stopAudio();
    if (engineRef.current) {
      engineRef.current.clearHighlight();
      engineRef.current.saveProgress();
    }
  }, [stopAudio]);

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

  const paginationLabel = engineRef.current ? engineRef.current.getPaginationLabel() : '';

  return (
    <div className="fixed top-8 inset-x-0 bottom-0 z-40 flex flex-col bg-white dark:bg-[#181818] text-slate-800 dark:text-[#cccccc] select-none">
      {/* Dynamic Unified Header Control Bar */}
      <ReaderHeader 
        bookData={bookData}
        handleClose={handleClose}
        isTocOpen={isTocOpen}
        setIsTocOpen={setIsTocOpen}
        toc={toc}
        currentChapterTitle={currentChapterTitle}
        baseFontSize={baseFontSize}
        setBaseFontSize={setBaseFontSize}
        morseSpeed={morseSpeed}
        setMorseSpeed={setMorseSpeed}
        morseFreq={morseFreq}
        setMorseFreq={setMorseFreq}
        numberMode={numberMode}
        setNumberMode={setNumberMode}
        useHarmonics={useHarmonics}
        setUseHarmonics={setUseHarmonics}
        viewMode={viewMode}
        setViewMode={setViewMode}
        fontFamily={fontFamily}
        setFontFamily={setFontFamily}
        isGridEligible={isGridEligible}
        enableMarkers={enableMarkers}
        setEnableMarkers={setEnableMarkers}
        prefixMarker={prefixMarker}
        setPrefixMarker={setPrefixMarker}
        suffixMarker={suffixMarker}
        setSuffixMarker={setSuffixMarker}
        isPlaying={isPlaying}
        isPaused={isPaused}
        togglePlay={togglePlay}
        stopPlay={stopPlay}
        onRegenerate={bookData.isGenerated ? onRegenerate : undefined}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Collapsible Sidebar TOC Panel */}
        {((bookData.type === 'epub' && toc.length > 0) || (bookData.siblings && bookData.siblings.length > 0)) && (
          <TocSidebar 
            isOpen={isTocOpen}
            onClose={() => setIsTocOpen(false)}
            toc={toc}
            bookType={bookData.type}
            onTocClick={handleTocClick}
            onItemClick={handleTocClick}
          />
        )}

        {/* Text Engine Viewer */}
        <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-[#1c1c1c] relative overflow-hidden">
          <div className="flex-1 relative">
            <div className="absolute inset-0">
              <TxtEngine 
                ref={engineRef}
                bookData={bookData}
                fontSize={baseFontSize}
                fontFamily={fontFamily}
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
            {/* Left Section: Document Type / Active Marker Pulse Capsule */}
            <div className="flex items-center gap-2 text-[12px] min-w-0">
              {activeMarker ? (
                activeMarker.type === 'prefix' ? (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-mono font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/80 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 shadow-2xs animate-pulse">
                    <Radio size={12} className="text-indigo-500 animate-spin shrink-0" style={{ animationDuration: '3s' }} />
                    <span className="truncate">{t('reader.marker.prefixSending', { marker: activeMarker.text }, `报头起始符: ${activeMarker.text} (发送中)`)}</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-mono font-semibold bg-emerald-50 text-emerald-600 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 shadow-2xs animate-pulse">
                    <Radio size={12} className="text-emerald-500 animate-spin shrink-0" style={{ animationDuration: '3s' }} />
                    <span className="truncate">{t('reader.marker.suffixSending', { marker: activeMarker.text }, `报尾结束符: ${activeMarker.text} (发送中)`)}</span>
                  </div>
                )
              ) : (
                <span className="flex items-center gap-1.5 font-medium text-slate-600 dark:text-slate-300 truncate">
                  {bookData.type === 'epub' ? (
                    <>
                      <BookOpen size={14} className="text-indigo-500 shrink-0" />
                      <span>{t('reader.doc.epub')}</span>
                    </>
                  ) : (bookData.siblings && bookData.siblings.length > 1) ? (
                    <>
                      <Folder size={14} className="text-amber-500 shrink-0" />
                      <span>{t('reader.doc.folder')}</span>
                    </>
                  ) : bookData.isGenerated ? (
                    <>
                      <Sparkles size={14} className="text-orange-600 dark:text-orange-400 shrink-0" />
                      <span className="text-orange-600 dark:text-orange-400">{t('reader.doc.generated')}</span>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <span className="truncate">{bookData.generatorConfig ? `${bookData.generatorConfig.charsPerGroup || 4} ${t('reader.chars.unit')} · ${bookData.generatorConfig.groupCount || 100} ${t('reader.groups.unit')}` : `100 ${t('reader.groups.unit')}`}</span>
                    </>
                  ) : (
                    <>
                      <FileText size={14} className="text-blue-500 shrink-0" />
                      <span>{t('reader.doc.txt')}</span>
                      <span className="text-slate-300 dark:text-slate-700">|</span>
                      <span>UTF-8</span>
                    </>
                  )}
                </span>
              )}
            </div>

            {/* Center Section: Pagination Controls for Multi-Page OR Total Stats for Single-Page */}
            {((bookData.type === 'epub' && bookData.toc && bookData.toc.length > 1) ||
              (bookData.siblings && bookData.siblings.length > 1)) ? (
              <div className="flex items-center gap-3 shrink-0">
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
            ) : (
              <div className="font-mono text-slate-600 dark:text-slate-400 text-[12px] font-medium shrink-0">
                {t('reader.stats.totalChars', { count: (parsedTelegram.cleanText ? parsedTelegram.cleanText.replace(/\s+/g, '').length : (bookData.data?.length || 0)).toLocaleString() }, `共 ${(parsedTelegram.cleanText ? parsedTelegram.cleanText.replace(/\s+/g, '').length : (bookData.data?.length || 0)).toLocaleString()} 字符`)}
              </div>
            )}

            {/* Right Section: Keyboard Shortcuts */}
            <div className="flex items-center gap-2.5 text-slate-400 dark:text-[#888888] text-[12px] shrink-0">
              {((bookData.type === 'epub' && bookData.toc && bookData.toc.length > 1) ||
                (bookData.siblings && bookData.siblings.length > 1)) ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-200/90 dark:bg-[#252525] text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-[#383838] shadow-2xs">← / →</kbd>
                    <span>{t('reader.shortcut.flip')}</span>
                  </span>
                  <span className="text-slate-300 dark:text-slate-700">·</span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-slate-200/90 dark:bg-[#252525] text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-[#383838] shadow-2xs">Space</kbd>
                    <span>{t('reader.shortcut.play')}</span>
                  </span>
                </>
              ) : (
                <div className="flex items-center gap-1.5 text-slate-400 dark:text-[#888888] text-[12px]">
                  <kbd className="px-1.5 py-0.5 rounded bg-slate-200/90 dark:bg-[#252525] text-[11px] font-mono text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-[#383838] shadow-2xs">Space</kbd>
                  <span>{t('reader.shortcut.playPause')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

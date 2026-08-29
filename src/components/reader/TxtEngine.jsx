import React, { useEffect, useState, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import useHighlighter from './useHighlighter';
import { saveReadingProgress, loadReadingProgress } from '../../utils/store';
import { getFontFamilyCss } from '../../config/fonts';
import { parseTelegramContent } from '../../utils/telegramParser';
import { useI18n } from '../../i18n';

const TxtEngine = forwardRef(({ bookData, fontSize, fontFamily = 'Cascadia Mono', viewMode = 'grid', autoFit = true, onTocLoaded, onChapterChange, jumpToSibling, jumpToChapter }, ref) => {
  const { t } = useI18n();
  const viewerRef = useRef(null);
  const tableRef = useRef(null);
  const [fitFontSize, setFitFontSize] = useState(fontSize);
  const scrollTimeoutRef = useRef(null);
  const cachedDataRef = useRef({ text: '', nodes: [] });
  const currentFontFamily = useMemo(() => getFontFamilyCss(fontFamily), [fontFamily]);

  // 单帧比例自适应算法 (Ratio-based Auto Scale)：彻底消除多余滚动条，0循环重绘，0闪烁
  useEffect(() => {
    if (!autoFit) {
      setFitFontSize(fontSize);
      return;
    }

    const container = viewerRef.current;
    if (!container) return;

    let timeoutId;
    const measureAndFit = () => {
      if (!container) return;
      const targetEl = tableRef.current || container.firstElementChild;
      if (!targetEl) return;

      const clientH = container.clientHeight;
      const clientW = container.clientWidth;
      const scrollH = targetEl.scrollHeight || container.scrollHeight;
      const scrollW = targetEl.scrollWidth || container.scrollWidth;

      if (clientH <= 0 || clientW <= 0 || scrollH <= 0 || scrollW <= 0) return;

      if (scrollH > clientH + 2 || scrollW > clientW + 2) {
        const ratioH = clientH / scrollH;
        const ratioW = clientW / scrollW;
        const fitRatio = Math.min(ratioH, ratioW, 1.0);
        const calculated = Math.max(10, Math.min(fontSize, Math.floor(fontSize * fitRatio)));
        setFitFontSize(calculated);
      } else {
        setFitFontSize(fontSize);
      }
    };

    // 延迟 30ms 测算，确保 DOM 布局及自定义字体包围盒计算完成
    timeoutId = setTimeout(measureAndFit, 30);

    const ro = new ResizeObserver(() => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(measureAndFit, 30);
    });
    ro.observe(container);

    return () => {
      clearTimeout(timeoutId);
      ro.disconnect();
    };
  }, [autoFit, fontSize, fontFamily, viewMode, bookData?.data]);

  const effectiveFontSize = autoFit ? fitFontSize : fontSize;

  const handleScrollRequest = useCallback((rect) => {
    if (autoFit) return; // In auto-fit mode, entire table is visible without scrolling
    const container = viewerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      if (rect.top < containerRect.top + 30 || rect.bottom > containerRect.bottom - 30) {
        container.scrollTo({ top: container.scrollTop + (rect.top - containerRect.top) - containerRect.height / 2, behavior: 'auto' });
      }
    }
  }, [autoFit]);

  const { textRootRef, textNodesRef, clearHighlight, resetHighlightState, highlightToken } = useHighlighter(handleScrollRequest);

  // 解析电报内容：自动剥离报头报尾起止符，获取纯净 10 列表格数据与纯净正文
  const { rows, cleanText, isGridEligible } = useMemo(() => {
    return parseTelegramContent(bookData?.data || '');
  }, [bookData?.data]);

  const extractNodes = useCallback(() => {
    const root = viewerRef.current;
    if (!root) return { text: '', nodes: [] };

    textRootRef.current = root;
    let text = '';
    const nodes = [];
    const walker = root.ownerDocument.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: (node) => {
          if (node.parentElement?.closest('[data-skip-speech="true"]')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      },
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      const nodeText = node.nodeValue;
      text += nodeText;
      nodes.push({ node, length: nodeText.length });
    }
    textNodesRef.current = nodes;
    cachedDataRef.current = { text, nodes };
    return { text, nodes };
  }, [textRootRef, textNodesRef]);

  // Setup book data, TOC, initial scroll position, and pre-index DOM nodes
  useEffect(() => {
    clearHighlight();
    resetHighlightState();
    cachedDataRef.current = { text: '', nodes: [] };

    if (bookData?.type === 'epub') {
      const parsedToc = (bookData.toc || []).map((t, idx) => ({
        id: t.id !== undefined ? t.id : idx,
        label: t.label,
        index: idx,
        href: t.href,
        isActive: idx === (bookData.currentChapterIndex || 0)
      }));
      if (onTocLoaded) onTocLoaded(parsedToc);
      if (onChapterChange) onChapterChange(bookData.currentChapterLabel || '');
    } else if (bookData?.siblings && bookData.siblings.length > 0) {
      const parsedToc = bookData.siblings.map((sib, idx) => ({
        id: idx,
        label: sib.name,
        index: idx,
        isActive: idx === bookData.currentIndex
      }));
      if (onTocLoaded) onTocLoaded(parsedToc);
      if (onChapterChange) onChapterChange('');
    } else {
      if (onTocLoaded) onTocLoaded([]);
      if (onChapterChange) onChapterChange('');
    }

    const progressKey = bookData?.type === 'epub' 
      ? `${bookData.name}_ch_${bookData.currentChapterIndex || 0}` 
      : bookData?.name || 'untitled';

    loadReadingProgress(progressKey).then(scrollPos => {
      if (scrollPos && typeof scrollPos === 'number' && viewerRef.current) {
        viewerRef.current.scrollTop = scrollPos;
      } else if (viewerRef.current) {
        viewerRef.current.scrollTop = 0;
      }
    });

    // 预提取并缓存文本节点，避免用户点击播放时产生主线程 TreeWalker 卡顿
    const timer = setTimeout(() => {
      extractNodes();
    }, 50);

    return () => clearTimeout(timer);
  }, [bookData, onTocLoaded, onChapterChange, clearHighlight, resetHighlightState, extractNodes]);

  const getProgressKey = useCallback(() => {
    return bookData?.type === 'epub' 
      ? `${bookData.name}_ch_${bookData.currentChapterIndex || 0}` 
      : bookData?.name || 'untitled';
  }, [bookData?.name, bookData?.type, bookData?.currentChapterIndex]);

  // Debounced scroll handler (300ms)
  const handleTxtScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop;
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
    scrollTimeoutRef.current = setTimeout(() => {
      saveReadingProgress(getProgressKey(), scrollTop);
    }, 300);
  }, [getProgressKey]);

  // Flush scroll position on unmount
  useEffect(() => {
    const viewer = viewerRef.current;
    const key = getProgressKey();
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (viewer) {
        saveReadingProgress(key, viewer.scrollTop);
      }
      clearHighlight();
    };
  }, [getProgressKey, clearHighlight]);

  useImperativeHandle(ref, () => ({
    getChapterText: async () => {
      const root = viewerRef.current;
      if (!root) return { text: '', startIndex: 0 };

      let { text, nodes } = cachedDataRef.current;
      if (!nodes || nodes.length === 0 || !text) {
        const extracted = extractNodes();
        text = extracted.text;
        nodes = extracted.nodes;
      } else {
        textNodesRef.current = nodes;
      }

      resetHighlightState();
      
      let startIndex = 0;

      // Selection support: start playback from selected text
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        let currentLength = 0;
        for (const n of nodes) {
          if (n.node === range.startContainer) {
            startIndex = currentLength + range.startOffset;
            break;
          }
          currentLength += n.length;
        }
        sel.removeAllRanges();
      }

      return { text, startIndex };
    },
    highlightToken,
    clearHighlight,
    saveProgress: () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
      if (viewerRef.current) {
        try { saveReadingProgress(getProgressKey(), viewerRef.current.scrollTop); } catch {}
      }
    },
    jumpTo: (item) => {
      if (bookData?.type === 'epub' && jumpToChapter) {
        jumpToChapter(item.index !== undefined ? item.index : item.href);
      } else if (jumpToSibling) {
        jumpToSibling(item.index);
      }
    },
    prevPage: () => {
      if (bookData?.type === 'epub' && jumpToChapter) {
        if (bookData.currentChapterIndex > 0) {
          jumpToChapter(bookData.currentChapterIndex - 1);
        }
      } else if (jumpToSibling && bookData?.currentIndex > 0) {
        jumpToSibling(bookData.currentIndex - 1);
      }
    },
    nextPage: () => {
      if (bookData?.type === 'epub' && jumpToChapter) {
        const total = bookData.toc?.length || 0;
        if (bookData.currentChapterIndex < total - 1) {
          jumpToChapter(bookData.currentChapterIndex + 1);
        }
      } else if (jumpToSibling && bookData?.siblings && bookData.currentIndex < bookData.siblings.length - 1) {
        jumpToSibling(bookData.currentIndex + 1);
      }
    },
    getPaginationLabel: () => {
      if (bookData?.type === 'epub') {
        const total = bookData.toc?.length || 1;
        return total > 1 ? t('reader.chapter.info', { current: (bookData.currentChapterIndex || 0) + 1, total }, `第 ${(bookData.currentChapterIndex || 0) + 1} / ${total} 章`) : '';
      }
      const total = bookData?.siblings?.length || 1;
      return total > 1 ? t('reader.file.info', { current: (bookData?.currentIndex || 0) + 1, total }, `文件 ${(bookData?.currentIndex || 0) + 1} / ${total}`) : '';
    }
  }));

  const isGridView = viewMode === 'grid' && isGridEligible;

  return (
    <div 
      ref={viewerRef}
      onScroll={handleTxtScroll}
      className={`w-full h-full overflow-y-auto overflow-x-auto select-text relative custom-scrollbar ${
        isGridView ? 'p-1 sm:p-2' : 'py-2 md:py-3 px-2 md:px-4'
      }`}
    >
      {isGridView ? (
        /* 100% 纯净 10 列表格电报稿纸排版：无任何起止符侵入单元格 */
        <table ref={tableRef} className="w-full border-collapse select-text font-mono table-fixed min-w-[700px]">
          <colgroup>
            <col style={{ width: '32px' }} />
            {Array.from({ length: 10 }).map((_, i) => (
              <col key={i} />
            ))}
          </colgroup>
          <thead>
            <tr data-skip-speech="true" className="text-[11.5px] text-slate-400 dark:text-[#888888] select-none border-b border-slate-300 dark:border-[#383838]">
              {/* Left Line Number Gutter (Tight fixed width) */}
              <th className="w-7 sm:w-8 pb-2 px-1 text-center font-medium select-none border-r border-slate-300 dark:border-[#383838]">
                #
              </th>
              {/* 10 Column Headers: Evenly distributed across viewport */}
              {Array.from({ length: 10 }).map((_, colIdx) => (
                <th key={colIdx} className="pb-2 px-1 text-center font-medium tracking-wider select-none">
                  {String(colIdx + 1).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/80 dark:divide-[#303030]">
            {rows.map((row, rowIdx) => (
              <tr 
                key={rowIdx} 
                className={`group ${
                  rowIdx % 2 === 1 
                    ? 'bg-slate-100/85 dark:bg-[#262626] hover:bg-indigo-100/70 dark:hover:bg-indigo-950/60' 
                    : 'bg-white dark:bg-[#181818] hover:bg-slate-50 dark:hover:bg-[#202020]'
                }`}
              >
                {/* Left Line Number Gutter */}
                <td 
                  data-skip-speech="true" 
                  className="w-7 sm:w-8 py-2 px-1 text-center text-slate-400 dark:text-[#666666] group-hover:text-slate-700 dark:group-hover:text-slate-300 select-none text-[11px] font-medium border-r border-slate-300 dark:border-[#383838]"
                >
                  {String(rowIdx + 1).padStart(2, '0')}
                </td>
                {/* 10 Data Columns */}
                {Array.from({ length: 10 }).map((_, colIdx) => {
                  const token = row[colIdx];
                  return (
                    <td
                      key={colIdx}
                      className="py-2 px-1 text-center whitespace-nowrap font-normal"
                      style={{
                        fontSize: `${effectiveFontSize}px`,
                        lineHeight: 1.3,
                        fontFamily: currentFontFamily,
                        fontVariantLigatures: 'none',
                        fontVariantNumeric: 'tabular-nums',
                        fontFeatureSettings: '"liga" 0, "calt" 0, "dlig" 0'
                      }}
                    >
                      {token ? (
                        <span className="morse-word px-1.5 py-0.5 rounded-md text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 tracking-wide">
                          {token}
                        </span>
                      ) : (
                        <span className="text-transparent select-none">&nbsp;</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        /* 纯文本视图：展示剥离起止符后的纯净电文正文 */
        <div 
          className="w-full h-full whitespace-pre-wrap font-normal text-slate-800 dark:text-[#cccccc]"
          style={{ 
            fontSize: `${effectiveFontSize}px`, 
            lineHeight: 1.2,
            fontFamily: currentFontFamily,
            fontVariantLigatures: 'none',
            fontFeatureSettings: '"liga" 0, "calt" 0, "dlig" 0'
          }}
        >
          {cleanText || bookData?.data}
        </div>
      )}
    </div>
  );
});

export default TxtEngine;

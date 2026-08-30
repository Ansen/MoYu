import React, { useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import useHighlighter from './useHighlighter';
import { saveReadingProgress, loadReadingProgress } from '../../utils/store';
import { getFontFamilyCss } from '../../config/fonts';
import { parseTelegramContent } from '../../utils/telegramParser';
import { useI18n } from '../../i18n';

const TxtEngine = forwardRef(({ bookData, fontSize = 20, fontFamily = 'Cascadia Mono', viewMode = 'grid', onTocLoaded, onChapterChange, jumpToSibling, jumpToChapter }, ref) => {
  const { t } = useI18n();
  const viewerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);
  const cachedDataRef = useRef({ text: '', nodes: [] });
  const currentFontFamily = useMemo(() => getFontFamilyCss(fontFamily), [fontFamily]);

  // 解析电报内容：自动剥离报头报尾起止符，获取纯净 10 列表格数据与纯净正文
  const { rows, cleanText, isGridEligible } = useMemo(() => {
    return parseTelegramContent(bookData?.data || '');
  }, [bookData?.data]);

  const handleScrollRequest = useCallback((rect) => {
    const container = viewerRef.current;
    if (container && container.scrollHeight > container.clientHeight + 10) {
      const containerRect = container.getBoundingClientRect();
      if (rect.top < containerRect.top + 30 || rect.bottom > containerRect.bottom - 30) {
        container.scrollTo({ top: container.scrollTop + (rect.top - containerRect.top) - containerRect.height / 2, behavior: 'auto' });
      }
    }
  }, []);

  const { textRootRef, textNodesRef, clearHighlight, resetHighlightState, highlightToken } = useHighlighter(handleScrollRequest);

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
        isGridView ? 'p-2 sm:p-3 md:p-4' : 'p-3 sm:p-5 md:p-6'
      }`}
    >
      {isGridView ? (
        /* 100% 纯净 10 列表格电报稿纸排版：紧凑字距、自然列宽、无大片空白浪费、行距与文本模式严格一致 */
        <table 
          className="border-collapse select-text font-mono border border-slate-200 dark:border-[#2e2e2e] shadow-2xs rounded-lg overflow-hidden"
        >
          <thead>
            <tr data-skip-speech="true" className="text-[11.5px] text-slate-400 dark:text-[#888888] select-none bg-slate-50/90 dark:bg-[#1a1a1a] border-b border-slate-200 dark:border-[#2e2e2e]">
              {/* Left Line Number Gutter */}
              <th className="py-1 px-1.5 text-center font-medium select-none border-r border-slate-200 dark:border-[#2e2e2e] min-w-[28px]">
                #
              </th>
              {/* 10 Column Headers: 1 space width spacing */}
              {Array.from({ length: 10 }).map((_, colIdx) => (
                <th 
                  key={colIdx} 
                  className="py-1 px-1 text-center font-medium tracking-wider select-none border-r last:border-r-0 border-slate-200/60 dark:border-[#262626]"
                >
                  {String(colIdx + 1).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-[#303030]">
            {rows.map((row, rowIdx) => (
              <tr 
                key={rowIdx} 
                className={`group transition-colors ${
                  rowIdx % 2 === 1 
                    ? 'bg-slate-100/90 dark:bg-[#292929] hover:bg-indigo-100/70 dark:hover:bg-indigo-950/60' 
                    : 'bg-white dark:bg-[#181818] hover:bg-slate-50 dark:hover:bg-[#202020]'
                }`}
              >
                {/* Left Line Number Gutter */}
                <td 
                  data-skip-speech="true" 
                  className={`py-0 px-1.5 text-center select-none text-[11px] font-medium border-r border-slate-300 dark:border-[#3a3a3a] align-middle ${
                    rowIdx % 2 === 1
                      ? 'bg-slate-200/60 dark:bg-[#2f2f2f] text-slate-500 dark:text-[#888888] group-hover:text-slate-800 dark:group-hover:text-slate-200'
                      : 'bg-slate-100/50 dark:bg-[#1c1c1c] text-slate-400 dark:text-[#666666] group-hover:text-slate-700 dark:group-hover:text-slate-300'
                  }`}
                  style={{ lineHeight: 1.3 }}
                >
                  {String(rowIdx + 1).padStart(2, '0')}
                </td>
                {/* 10 Data Columns */}
                {Array.from({ length: 10 }).map((_, colIdx) => {
                  const token = row[colIdx];
                  return (
                    <td
                      key={colIdx}
                      className="py-0 px-1 text-center whitespace-nowrap font-normal align-middle border-r last:border-r-0 border-slate-200/60 dark:border-[#303030]"
                      style={{
                        fontSize: `${fontSize}px`,
                        lineHeight: 1.3,
                        fontFamily: currentFontFamily,
                        fontVariantLigatures: 'none',
                        fontVariantNumeric: 'tabular-nums',
                        fontFeatureSettings: '"liga" 0, "calt" 0, "dlig" 0'
                      }}
                    >
                      {token ? (
                        <span className="morse-word px-0.5 rounded-sm text-slate-800 dark:text-slate-200 hover:text-indigo-600 dark:hover:text-indigo-400 inline-block leading-[1.3]">
                          {token}
                        </span>
                      ) : (
                        <span className="text-transparent select-none inline-block leading-[1.3]">&nbsp;</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        /* 纯文本视图：铺满视口宽度自适应 (w-full)、自然折行排版、行距与字号完全由用户掌控 */
        <div 
          className="w-full min-h-full whitespace-pre-wrap font-normal text-slate-800 dark:text-[#cccccc]"
          style={{ 
            fontSize: `${fontSize}px`, 
            lineHeight: 1.3,
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

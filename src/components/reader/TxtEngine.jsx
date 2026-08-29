import React, { useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import useHighlighter from './useHighlighter';
import { saveReadingProgress, loadReadingProgress } from '../../utils/store';

// Intelligent Telegram token parser: separates start/end markers and chunks long continuous strings
function parseTelegramContent(rawText) {
  if (!rawText) return { startMarker: '', rows: [], endMarker: '', rawTokens: [] };

  let text = rawText.trim();
  let startMarker = '';
  let endMarker = '';

  // 1. Extract start marker if present (e.g. ===, = = =, KA, etc.)
  const startMatch = text.match(/^((?:=+\s*)+|(?:KA|HR|BT)\s+)/i);
  if (startMatch) {
    startMarker = startMatch[0].trim();
    text = text.slice(startMatch[0].length).trim();
  }

  // 2. Extract end marker if present (e.g. iii, ===, AR, SK, K)
  const endMatch = text.match(/(\s+(?:iii|[iI]{1,5}|(?:=+\s*)+|AR|SK|K))$/i);
  if (endMatch) {
    endMarker = endMatch[0].trim();
    text = text.slice(0, text.length - endMatch[0].length).trim();
  }

  // 3. Process data tokens (split by whitespace)
  const splitTokens = text.split(/\s+/).filter(Boolean);
  const dataTokens = [];

  for (const t of splitTokens) {
    // If a token is a continuous sequence of digits >= 8 (e.g. 40 numbers without spaces in some telegraph EPUBs)
    if (/^\d{8,}$/.test(t)) {
      const chunkLen = (t.length % 5 === 0 && t.length % 4 !== 0) ? 5 : 4;
      for (let i = 0; i < t.length; i += chunkLen) {
        dataTokens.push(t.slice(i, i + chunkLen));
      }
    } else if (/^[a-zA-Z]{10,}$/.test(t) && t.length % 5 === 0) {
      // Continuous 5-char letter groups
      for (let i = 0; i < t.length; i += 5) {
        dataTokens.push(t.slice(i, i + 5));
      }
    } else {
      dataTokens.push(t);
    }
  }

  // 4. Organize data tokens into rows of 10 groups
  const rows = [];
  const COLS = 10;
  for (let i = 0; i < dataTokens.length; i += COLS) {
    rows.push(dataTokens.slice(i, i + COLS));
  }

  return { startMarker, rows, endMarker, rawTokens: dataTokens };
}

const TxtEngine = forwardRef(({ bookData, fontSize, viewMode = 'grid', onTocLoaded, onChapterChange, jumpToSibling, jumpToChapter }, ref) => {
  const viewerRef = useRef(null);
  const scrollTimeoutRef = useRef(null);

  const handleScrollRequest = useCallback((rect) => {
    const container = viewerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
        container.scrollTo({ top: container.scrollTop + (rect.top - containerRect.top) - containerRect.height / 2, behavior: 'smooth' });
      }
    }
  }, []);

  const { textRootRef, textNodesRef, clearHighlight, resetHighlightState, highlightToken } = useHighlighter(handleScrollRequest);

  // Parse text into 10-column table rows, start marker, and end marker
  const { startMarker, rows, endMarker, rawTokens } = useMemo(() => {
    return parseTelegramContent(bookData?.data || '');
  }, [bookData?.data]);

  // Setup book data, TOC, and initial scroll position
  useEffect(() => {
    if (bookData.type === 'epub') {
      const parsedToc = (bookData.toc || []).map((t, idx) => ({
        id: t.id !== undefined ? t.id : idx,
        label: t.label,
        index: idx,
        href: t.href,
        isActive: idx === (bookData.currentChapterIndex || 0)
      }));
      if (onTocLoaded) onTocLoaded(parsedToc);
      if (onChapterChange) onChapterChange(bookData.currentChapterLabel || '');
    } else if (bookData.siblings && bookData.siblings.length > 0) {
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

    const progressKey = bookData.type === 'epub' 
      ? `${bookData.name}_ch_${bookData.currentChapterIndex || 0}` 
      : bookData.name;

    loadReadingProgress(progressKey).then(scrollPos => {
      if (scrollPos && typeof scrollPos === 'number' && viewerRef.current) {
        viewerRef.current.scrollTop = scrollPos;
      } else if (viewerRef.current) {
        viewerRef.current.scrollTop = 0;
      }
    });
  }, [bookData, onTocLoaded, onChapterChange]);

  // Dynamic theme highlight styles for reader (CW Player style solid inverted highlight)
  useEffect(() => {
    const updateHighlightTheme = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      const playedColor = isDarkMode ? '#64748b' : '#94a3b8';
      const activeColor = '#ffffff'; // White text
      const activeBg = '#ea580c'; // Vibrant CW Player solid orange block

      let styleEl = document.getElementById('moyu-reader-highlight-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'moyu-reader-highlight-style';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        ::highlight(morse-played) { 
          color: ${playedColor} !important; 
          opacity: 0.65;
        }
        ::highlight(morse-active) { 
          background-color: ${activeBg} !important; 
          color: ${activeColor} !important; 
          font-weight: 800 !important; 
          border-radius: 2px !important;
        }
      `;
    };

    updateHighlightTheme();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.attributeName === 'class') {
          updateHighlightTheme();
        }
      }
    });

    observer.observe(document.documentElement, { attributes: true });

    return () => {
      observer.disconnect();
      const el = document.getElementById('moyu-reader-highlight-style');
      if (el) el.remove();
    };
  }, []);

  const getProgressKey = useCallback(() => {
    return bookData.type === 'epub' 
      ? `${bookData.name}_ch_${bookData.currentChapterIndex || 0}` 
      : bookData.name;
  }, [bookData.name, bookData.type, bookData.currentChapterIndex]);

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

      textRootRef.current = root;
      let text = "";
      const nodes = [];
      const walker = root.ownerDocument.createTreeWalker(
        root, 
        NodeFilter.SHOW_TEXT, 
        {
          acceptNode: (node) => {
            // Skip line/col number headers and decorative label elements
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
      if (bookData.type === 'epub' && jumpToChapter) {
        jumpToChapter(item.index !== undefined ? item.index : item.href);
      } else if (jumpToSibling) {
        jumpToSibling(item.index);
      }
    },
    prevPage: () => {
      if (bookData.type === 'epub' && jumpToChapter) {
        if (bookData.currentChapterIndex > 0) {
          jumpToChapter(bookData.currentChapterIndex - 1);
        }
      } else if (jumpToSibling && bookData.currentIndex > 0) {
        jumpToSibling(bookData.currentIndex - 1);
      }
    },
    nextPage: () => {
      if (bookData.type === 'epub' && jumpToChapter) {
        const total = bookData.toc?.length || 0;
        if (bookData.currentChapterIndex < total - 1) {
          jumpToChapter(bookData.currentChapterIndex + 1);
        }
      } else if (jumpToSibling && bookData.siblings && bookData.currentIndex < bookData.siblings.length - 1) {
        jumpToSibling(bookData.currentIndex + 1);
      }
    },
    getPaginationLabel: () => {
      if (bookData.type === 'epub') {
        const total = bookData.toc?.length || 1;
        return total > 1 ? `章节 ${(bookData.currentChapterIndex || 0) + 1} / ${total}` : '';
      }
      const total = bookData.siblings?.length || 1;
      return total > 1 ? `文件 ${bookData.currentIndex + 1} / ${total}` : '';
    }
  }));

  const isGridView = viewMode === 'grid' && (rawTokens.length > 0 || startMarker || endMarker);

  return (
    <div 
      ref={viewerRef}
      onScroll={handleTxtScroll}
      className={`w-full h-full overflow-y-auto overflow-x-auto select-text relative custom-scrollbar ${
        isGridView ? 'p-3 md:p-6 flex flex-col items-center' : 'py-2 md:py-3 px-2 md:px-4'
      }`}
    >
      {isGridView ? (
        /* Clean Lightweight IDE Layout (Left Gutter + Top Column Markers + 10 Aligned Columns) */
        <div className="w-full flex justify-center py-2 px-2 min-w-fit">
          <div className="flex flex-col">
            
            {/* Top Bar with Start/End Status */}
            {(startMarker || endMarker) && (
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-[#2d2d2d] text-[12px] font-mono select-none text-slate-400 dark:text-[#666666]">
                <div className="flex items-center gap-1.5">
                  <span data-skip-speech="true" className="text-slate-400">开始:</span>
                  {startMarker ? (
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/60">
                      <span className="morse-word">{startMarker}</span>{' '}
                    </span>
                  ) : <span className="text-slate-300">-</span>}
                </div>
                <div className="flex items-center gap-1.5">
                  <span data-skip-speech="true" className="text-slate-400">结束:</span>
                  {endMarker ? (
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200/80 dark:border-indigo-800/60">
                      <span className="morse-word">{endMarker}</span>{' '}
                    </span>
                  ) : <span className="text-slate-300">-</span>}
                </div>
              </div>
            )}

            <table className="border-collapse select-text font-mono border border-slate-200/80 dark:border-[#2e2e2e] shadow-2xs rounded-lg overflow-hidden">
              <thead>
                <tr data-skip-speech="true" className="text-[11px] text-slate-500 dark:text-[#777777] select-none bg-slate-50/70 dark:bg-[#1a1a1a]">
                  <th className="w-12 py-1.5 pr-2.5 text-right font-normal border border-slate-200/80 dark:border-[#2e2e2e]">
                    #
                  </th>
                  {Array.from({ length: 10 }).map((_, colIdx) => (
                    <th key={colIdx} className="py-1.5 px-3 text-center font-normal tracking-wide min-w-[58px] border border-slate-200/80 dark:border-[#2e2e2e]">
                      {String(colIdx + 1).padStart(2, '0')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, rowIdx) => (
                  <tr key={rowIdx} className="transition-colors group">
                    {/* Left Line Number (IDE Gutter) */}
                    <td data-skip-speech="true" className="w-12 py-1.5 pr-2.5 text-right text-slate-400 dark:text-[#555555] border border-slate-200/80 dark:border-[#2e2e2e] bg-slate-50/40 dark:bg-[#181818]/40 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors select-none text-[11px]">
                      {String(rowIdx + 1).padStart(2, '0')}
                    </td>
                    {/* 10 Data Columns with subtle light gray inner borders */}
                    {Array.from({ length: 10 }).map((_, colIdx) => {
                      const token = row[colIdx];
                      return (
                        <td
                          key={colIdx}
                          className="border border-slate-200/80 dark:border-[#2e2e2e] py-1.5 px-2.5 text-center whitespace-nowrap font-normal hover:bg-slate-50/80 dark:hover:bg-[#222222] transition-colors"
                          style={{
                            fontSize: `${fontSize}px`,
                            lineHeight: 1.25,
                            fontFamily: 'Consolas, "Cascadia Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace',
                            fontVariantLigatures: 'none',
                            fontFeatureSettings: '"liga" 0, "calt" 0, "dlig" 0'
                          }}
                        >
                          {token ? (
                            <>
                              <span className="morse-word hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{token}</span>{' '}
                            </>
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

          </div>
        </div>
      ) : (
        /* Plain Text View */
        <div 
          className="w-full h-full whitespace-pre-wrap font-normal text-slate-800 dark:text-[#cccccc]"
          style={{ 
            fontSize: `${fontSize}px`, 
            lineHeight: 1.2,
            fontFamily: 'Consolas, "Cascadia Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", "Courier New", monospace',
            fontVariantLigatures: 'none',
            fontFeatureSettings: '"liga" 0, "calt" 0, "dlig" 0'
          }}
        >
          {bookData.data}
        </div>
      )}
    </div>
  );
});

export default TxtEngine;

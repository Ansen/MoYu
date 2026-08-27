import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import useHighlighter from './useHighlighter';
import { saveReadingProgress, loadReadingProgress } from '../../utils/store';

const TxtEngine = forwardRef(({ bookData, fontSize, onTocLoaded, onChapterChange, jumpToSibling, jumpToChapter }, ref) => {
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

  // Dynamic theme highlight styles for reader
  useEffect(() => {
    const updateHighlightTheme = () => {
      const isDarkMode = document.documentElement.classList.contains('dark');
      const playedColor = isDarkMode ? '#475569' : '#94a3b8';
      const activeColor = isDarkMode ? '#fdba74' : '#ea580c';

      let styleEl = document.getElementById('moyu-reader-highlight-style');
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'moyu-reader-highlight-style';
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = `
        ::highlight(morse-played) { color: ${playedColor} !important; }
        ::highlight(morse-active) { background-color: rgba(251, 146, 60, 0.4) !important; color: ${activeColor} !important; border-bottom: 2px solid ${activeColor} !important; }
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
      const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
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

  return (
    <div 
      ref={viewerRef}
      onScroll={handleTxtScroll}
      className="w-full h-full overflow-y-auto overflow-x-hidden py-8 text-slate-800 dark:text-[#cccccc] whitespace-pre-wrap font-medium [text-rendering:optimizeLegibility] [&::-webkit-scrollbar]:hidden select-text relative"
      style={{ 
        fontSize: `${fontSize}px`, 
        lineHeight: 1.8,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace, "Microsoft YaHei", "PingFang SC", "Segoe UI", Roboto, sans-serif',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none'
      }}
    >
      {bookData.data}
    </div>
  );
});

export default TxtEngine;

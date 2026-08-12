import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import useHighlighter from './useHighlighter';
import { saveReadingProgress, loadReadingProgress } from '../../utils/store';

const TxtEngine = forwardRef(({ bookData, fontSize, onTocLoaded, onChapterChange, jumpToSibling }, ref) => {
  const viewerRef = useRef(null);

  const handleScrollRequest = useCallback((rect, targetRange, win, doc, scrollY, scrollX, overlay) => {
    const container = viewerRef.current;
    if (container) {
      const containerRect = container.getBoundingClientRect();
      if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
        container.scrollTo({ top: container.scrollTop + (rect.top - containerRect.top) - containerRect.height / 2, behavior: 'smooth' });
      }
    }
  }, []);

  const { textRootRef, textNodesRef, clearHighlight, resetHighlightState, highlightToken } = useHighlighter('txt', handleScrollRequest);

  useEffect(() => {
    if (bookData.siblings && bookData.siblings.length > 0) {
      const parsedToc = bookData.siblings.map((sib, idx) => ({
        id: idx,
        label: sib.name,
        index: idx,
        isActive: idx === bookData.currentIndex
      }));
      if (onTocLoaded) onTocLoaded(parsedToc);
    } else {
      if (onTocLoaded) onTocLoaded([]);
    }
    if (onChapterChange) onChapterChange(''); // TXT files usually don't have chapter sub-titles in header

    loadReadingProgress(bookData.name).then(scrollPos => {
      if (scrollPos && viewerRef.current) {
        viewerRef.current.scrollTop = scrollPos;
      }
    });

    try {
      const isDarkMode = document.documentElement.classList.contains('dark');
      const playedColor = isDarkMode ? '#475569' : '#94a3b8';
      const activeColor = isDarkMode ? '#fdba74' : '#ea580c';

      const styleEl = document.createElement("style");
      styleEl.textContent = `
        ::highlight(morse-played-txt) { color: ${playedColor} !important; }
        ::highlight(morse-active-txt) { background-color: rgba(251, 146, 60, 0.4) !important; color: ${activeColor} !important; border-bottom: 2px solid ${activeColor} !important; }
      `;
      document.head.appendChild(styleEl);
      return () => styleEl.remove();
    } catch (e) {
      console.warn("TXT Highlight API not supported", e);
    }
  }, [bookData, onTocLoaded, onChapterChange]);

  const handleTxtScroll = (e) => {
    saveReadingProgress(bookData.name, e.target.scrollTop);
  };

  useImperativeHandle(ref, () => ({
    getChapterText: async (skipTitle) => {
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
      return { text, startIndex };
    },
    highlightToken,
    clearHighlight,
    saveProgress: () => {
      if (viewerRef.current) {
        try { saveReadingProgress(bookData.name, viewerRef.current.scrollTop); } catch(e){}
      }
    },
    jumpTo: (item) => {
      if (jumpToSibling) jumpToSibling(item.index);
    },
    prevPage: () => {
      if (jumpToSibling && bookData.currentIndex > 0) {
        jumpToSibling(bookData.currentIndex - 1);
      }
    },
    nextPage: () => {
      if (jumpToSibling && bookData.siblings && bookData.currentIndex < bookData.siblings.length - 1) {
        jumpToSibling(bookData.currentIndex + 1);
      }
    },
    getPaginationLabel: () => {
      const total = bookData.siblings?.length || 1;
      return total > 1 ? `文件 ${bookData.currentIndex + 1} / ${total}` : '';
    }
  }));

  return (
    <div 
      ref={viewerRef}
      onScroll={handleTxtScroll}
      className="w-full h-full overflow-y-auto overflow-x-hidden py-8 text-slate-800 dark:text-[#cccccc] whitespace-pre-wrap font-medium [text-rendering:optimizeLegibility] [&::-webkit-scrollbar]:hidden"
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

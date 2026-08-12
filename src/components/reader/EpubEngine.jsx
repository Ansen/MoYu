import React, { useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import useHighlighter from './useHighlighter';
import { saveReadingProgress, loadReadingProgress } from '../../utils/store';

const EpubEngine = forwardRef(({ bookData, fontSize, hideBodyTitle, onTocLoaded, onChapterChange }, ref) => {
  const viewerRef = useRef(null);
  const renditionRef = useRef(null);
  const bookRef = useRef(null);

  const handleScrollRequest = useCallback((rect, targetRange, win, doc, scrollY, scrollX, overlay) => {


    const innerHeight = win ? win.innerHeight : (doc.documentElement?.clientHeight || 800);
    const innerWidth = win ? win.innerWidth : (doc.documentElement?.clientWidth || 800);
    
    // Vertical scrolling for 'scrolled' mode
    if (rect.top < 0) {
      const targetScroll = scrollY + rect.top - 20;
      if (win && win.scrollTo) {
        win.scrollTo({ top: targetScroll, behavior: 'smooth' });
      } else if (doc.documentElement) {
        doc.documentElement.scrollTop = targetScroll;
      }
    } else if (rect.bottom > innerHeight) {
      const targetScroll = scrollY + rect.bottom - innerHeight + 20;
      if (win && win.scrollTo) {
        win.scrollTo({ top: targetScroll, behavior: 'smooth' });
      } else if (doc.documentElement) {
        doc.documentElement.scrollTop = targetScroll;
      }
    }
    
    // Horizontal page turning for 'paginated' mode
    if (rect.left > innerWidth || rect.right < 0) {
      if (renditionRef.current) {
        if (rect.left > innerWidth) {
          renditionRef.current.next();
        } else {
          renditionRef.current.prev();
        }
        
        setTimeout(() => {
          const newRect = targetRange.getBoundingClientRect();
          const newScrollX = win ? (win.scrollX || win.pageXOffset) : (doc.documentElement?.scrollLeft || 0);
          const newScrollY = win ? (win.scrollY || win.pageYOffset) : (doc.documentElement?.scrollTop || 0);
          overlay.style.left = (newRect.left + newScrollX) + 'px';
          overlay.style.top = (newRect.top + newScrollY) + 'px';
        }, 200);
      }
    }
  }, []);

  const { textRootRef, textNodesRef, clearHighlight, resetHighlightState, highlightToken } = useHighlighter('epub', handleScrollRequest);

  const renderEpub = useCallback(() => {
    if (!viewerRef.current) return;
    
    if (renditionRef.current) {
      renditionRef.current.destroy();
    }

    const book = bookData.data;
    bookRef.current = book;
    const rendition = book.renderTo(viewerRef.current, {
      width: '100%',
      height: '100%',
      flow: 'scrolled-doc',
      manager: 'default',
    });
    renditionRef.current = rendition;

    if (fontSize) {
      rendition.themes.fontSize(`${fontSize}px`);
    }

    book.loaded.navigation.then(nav => {
      const parsedToc = nav.toc.map(item => ({
        id: item.id,
        label: item.label,
        href: item.href
      }));
      if (onTocLoaded) onTocLoaded(parsedToc);
    });

    loadReadingProgress(bookData.name).then(cfi => {
      if (cfi) {
        rendition.display(cfi);
      } else {
        rendition.display();
      }
    });

    rendition.on('relocated', (location) => {
      saveReadingProgress(bookData.name, location.start.cfi);
      
      const navItem = book.navigation.get(location.start.href);
      if (navItem) {
        if (onChapterChange) onChapterChange(navItem.label.trim());
      } else {
        const currentHref = location.start.href.split('#')[0];
        book.loaded.navigation.then(nav => {
          const item = nav.toc.find(t => t.href.includes(currentHref));
          if (onChapterChange) onChapterChange(item ? item.label.trim() : '');
        });
      }
    });

    rendition.hooks.content.register((contents) => {
      if (contents.document && contents.document.documentElement) {
        contents.document.documentElement.style.setProperty('overflow-x', 'hidden', 'important');
      }
      if (contents.document && contents.document.body) {
        contents.document.body.style.setProperty('overflow-x', 'hidden', 'important');
      }

      const rules = [
        ['html', ['overflow-x', 'hidden !important']],
        ['body', 
          ['padding', '20px 0 50px 0 !important'], 
          ['margin', '0 !important'], 
          ['box-sizing', 'border-box !important'], 
          ['line-height', '1.8 !important'], 
          ['word-wrap', 'break-word !important'],
          ['font-family', '"Microsoft YaHei", "PingFang SC", "Segoe UI", Roboto, sans-serif !important'],
          ['font-weight', '500 !important'],
          ['text-rendering', 'optimizeLegibility !important']
        ],
        ['p, div, span, a', ['word-wrap', 'break-word !important'], ['max-width', '100% !important']],
        ['img, video, audio', ['max-width', '100% !important'], ['height', 'auto !important']],
        ['::selection', ['background', 'rgba(99, 102, 241, 0.3) !important']]
      ];
      
      if (hideBodyTitle) {
        rules.push(['h1, h2, h3, h4, h5, h6, .title, .chapter-title', ['display', 'none !important']]);
      }
      const isDarkMode = document.documentElement.classList.contains('dark');
      const defaultColor = isDarkMode ? '#e2e8f0' : '#1e293b';
      const playedColor = isDarkMode ? '#475569' : '#94a3b8';
      const activeColor = isDarkMode ? '#fdba74' : '#ea580c';

      rules.push(['body', ['color', `${defaultColor} !important`]]);
      contents.addStylesheetRules(rules);

      try {
        const styleEl = contents.document.createElement("style");
        styleEl.textContent = `
          html, body { overflow-x: hidden !important; max-width: 100% !important; }
          ::-webkit-scrollbar { display: none !important; }
          * { -ms-overflow-style: none; scrollbar-width: none; }
          ::highlight(morse-played) { color: ${playedColor} !important; }
          ::highlight(morse-active) { background-color: rgba(251, 146, 60, 0.4) !important; color: ${activeColor} !important; border-bottom: 2px solid ${activeColor} !important; }
        `;
        contents.document.head.appendChild(styleEl);
      } catch (e) {
        console.warn("Failed to inject highlight styles", e);
      }
    });
  }, [bookData, hideBodyTitle, onTocLoaded, onChapterChange]);

  useEffect(() => {
    if (renditionRef.current && fontSize) {
      renditionRef.current.themes.fontSize(`${fontSize}px`);
    }
  }, [fontSize]);

  useEffect(() => {
    renderEpub();
    return () => {
      if (renditionRef.current) {
        renditionRef.current.destroy();
      }
    };
  }, [renderEpub]);

  useImperativeHandle(ref, () => ({
    getChapterText: async (skipTitle) => {
      let root = null;
      let targetContents = null;
      let hasSelection = false;
      let startNode = null;
      let startOffset = 0;

      if (renditionRef.current) {
        const contents = renditionRef.current.getContents();
        if (contents && contents.length > 0) {
          // Check for user selection across all iframes
          for (let i = 0; i < contents.length; i++) {
            const doc = contents[i].document;
            const sel = doc.getSelection();
            if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
              targetContents = contents[i];
              hasSelection = true;
              const range = sel.getRangeAt(0);
              startNode = range.startContainer;
              startOffset = range.startOffset;
              sel.removeAllRanges();
              break;
            }
          }

          if (!targetContents) {
            targetContents = contents[0];
          }
          
          root = targetContents.document.body;
        }
      }
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
      
      if (hasSelection && startNode) {
        let currentLength = 0;
        for (const n of nodes) {
          if (n.node === startNode) {
            startIndex = currentLength + startOffset;
            break;
          }
          currentLength += n.length;
        }
      } else if (skipTitle) {
        const lines = text.split('\n');
        let currentLength = 0;
        for (let i = 0; i < Math.min(5, lines.length); i++) {
          if (lines[i].trim().length > 0 && lines[i].trim().length < 50) {
            startIndex = currentLength + lines[i].length + 1;
          } else if (lines[i].trim().length >= 50) {
            break;
          }
          currentLength += lines[i].length + 1;
        }
      }
      
      return { text, startIndex };
    },
    highlightToken,
    clearHighlight,
    saveProgress: () => {
      if (renditionRef.current && renditionRef.current.location) {
        try { saveReadingProgress(bookData.name, renditionRef.current.location.start.cfi); } catch(e){}
      }
    },
    jumpTo: (item) => {
      if (renditionRef.current) {
        renditionRef.current.display(item.href);
      }
    },
    prevPage: () => {
      if (renditionRef.current) renditionRef.current.prev();
    },
    nextPage: () => {
      if (renditionRef.current) renditionRef.current.next();
    },
    getPaginationLabel: () => ''
  }));

  return <div ref={viewerRef} className="w-full h-full overflow-hidden" />;
});

export default EpubEngine;

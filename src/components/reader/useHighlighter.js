import { useRef, useCallback } from 'react';

export default function useHighlighter(bookType, onScrollRequest) {
  const textRootRef = useRef(null);
  const textNodesRef = useRef([]);
  const lastNodeIdxRef = useRef(0);
  const lastCharIdxRef = useRef(0);

  const clearHighlight = useCallback(() => {
    try {
      if (textRootRef.current && textRootRef.current.ownerDocument) {
        const doc = textRootRef.current.ownerDocument;
        if (doc.defaultView && doc.defaultView.CSS && doc.defaultView.CSS.highlights) {
          doc.defaultView.CSS.highlights.delete('morse-active');
          doc.defaultView.CSS.highlights.delete('morse-played');
          doc.defaultView.CSS.highlights.delete('morse-played-txt');
        }
        const overlay = doc.getElementById('morse-active-overlay');
        if (overlay) overlay.remove();
      }
    } catch (e) {
      console.warn("Failed to clear highlight", e);
    }
  }, []);

  const resetHighlightState = useCallback(() => {
    lastNodeIdxRef.current = 0;
    lastCharIdxRef.current = 0;
  }, []);

  const highlightToken = useCallback((token) => {
    if (!token || token.index === undefined || !textRootRef.current || !textNodesRef.current.length) return;
    
    const nodes = textNodesRef.current;
    let targetRange = null;
    let targetNode = null;
    let targetOffset = 0;
    
    // Fast path tracking
    if (token.index < lastCharIdxRef.current) {
       // user jumped back? Reset search
       lastNodeIdxRef.current = 0;
       lastCharIdxRef.current = 0;
    }
    
    let currentIndex = lastCharIdxRef.current;
    
    for (let i = lastNodeIdxRef.current; i < nodes.length; i++) {
      const { node, length } = nodes[i];
      if (token.index >= currentIndex && token.index < currentIndex + length) {
        const offset = token.index - currentIndex;
        targetRange = node.ownerDocument.createRange();
        targetRange.setStart(node, offset);
        targetRange.setEnd(node, offset + 1);
        targetNode = node;
        targetOffset = offset;
        lastNodeIdxRef.current = i;
        lastCharIdxRef.current = currentIndex;
        break;
      }
      currentIndex += length;
    }

    if (targetRange) {
      const doc = textRootRef.current.ownerDocument;
      const win = doc.defaultView;
      
      const scrollX = win ? (win.scrollX || win.pageXOffset) : (doc.documentElement?.scrollLeft || doc.body?.scrollLeft || 0);
      const scrollY = win ? (win.scrollY || win.pageYOffset) : (doc.documentElement?.scrollTop || doc.body?.scrollTop || 0);
      
      // Apply morse-played highlight to text before the current token
      if (win && win.CSS && win.CSS.highlights && nodes.length > 0) {
        try {
          const playedRange = doc.createRange();
          playedRange.setStart(nodes[0].node, 0);
          playedRange.setEnd(targetNode, targetOffset);
          const highlightName = bookType === 'epub' ? 'morse-played' : 'morse-played-txt';
          win.CSS.highlights.set(highlightName, new win.Highlight(playedRange));
        } catch(e) {}
      }

      // ALWAYS use DOM overlay because CSS.highlights silently fails in some WebView2 versions for background color
      let overlay = doc.getElementById('morse-active-overlay');
      if (!overlay) {
        overlay = doc.createElement('div');
        overlay.id = 'morse-active-overlay';
        overlay.style.position = 'absolute';
        overlay.style.backgroundColor = 'rgba(251, 146, 60, 0.4)';
        overlay.style.borderBottom = '2px solid #ea580c';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '99999';
        overlay.style.transition = 'all 0.05s linear';
        if (doc.body) doc.body.appendChild(overlay);
      }
      
      const rect = targetRange.getBoundingClientRect();
      overlay.style.left = (rect.left + scrollX) + 'px';
      overlay.style.top = (rect.top + scrollY) + 'px';
      overlay.style.width = rect.width + 'px';
      overlay.style.height = rect.height + 'px';
        
      // Request parent to handle scroll if needed
      if (onScrollRequest) {
        onScrollRequest(rect, targetRange, win, doc, scrollY, scrollX, overlay);
      }
    }
  }, [bookType, onScrollRequest]);

  return {
    textRootRef,
    textNodesRef,
    clearHighlight,
    resetHighlightState,
    highlightToken
  };
}

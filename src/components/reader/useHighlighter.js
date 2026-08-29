import { useRef, useCallback } from 'react';

export default function useHighlighter(onScrollRequest) {
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
        }
        const overlay = textRootRef.current.querySelector('#morse-active-overlay') || doc.getElementById('morse-active-overlay');
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
      const rect = targetRange.getBoundingClientRect();
      const char = targetNode.nodeValue[targetOffset];

      const doc = textRootRef.current.ownerDocument;
      const win = doc.defaultView;

      // Apply morse-played and morse-active highlights
      if (win && win.CSS && win.CSS.highlights && nodes.length > 0) {
        try {
          const playedRange = doc.createRange();
          playedRange.setStart(nodes[0].node, 0);
          playedRange.setEnd(targetNode, targetOffset);
          win.CSS.highlights.set('morse-played', new win.Highlight(playedRange));
          
          if (char && char !== '\n' && char !== '\r') {
            win.CSS.highlights.set('morse-active', new win.Highlight(targetRange));
          } else {
            win.CSS.highlights.delete('morse-active');
          }
        } catch {}
      }

      // Use DOM overlay inside the scroll container for guaranteed fallback visibility
      const container = textRootRef.current;
      let overlay = container.querySelector('#morse-active-overlay') || doc.getElementById('morse-active-overlay');
      if (!overlay) {
        overlay = doc.createElement('div');
        overlay.id = 'morse-active-overlay';
        overlay.style.position = 'absolute';
        overlay.style.backgroundColor = 'rgba(234, 88, 12, 0.4)';
        overlay.style.borderBottom = '2px solid #ea580c';
        overlay.style.borderRadius = '2px';
        overlay.style.pointerEvents = 'none';
        overlay.style.zIndex = '50';
        overlay.style.transition = 'none';
        container.appendChild(overlay);
      } else {
        overlay.style.transition = 'none';
        if (overlay.parentElement !== container) {
          container.appendChild(overlay);
        }
      }
      
      const containerRect = container.getBoundingClientRect();
      
      // Do not show overlay for newlines, or invalid zero rects
      if (!char || char === '\n' || char === '\r' || rect.width <= 0 || rect.height <= 0) {
        overlay.style.opacity = '0';
      } else {
        const left = rect.left - containerRect.left + container.scrollLeft;
        const top = rect.top - containerRect.top + container.scrollTop;

        overlay.style.left = left + 'px';
        overlay.style.top = top + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';
        overlay.style.opacity = '1';
      }
        
      // Request parent to handle auto-scroll if needed
      if (onScrollRequest) {
        const scrollX = win ? (win.scrollX || win.pageXOffset) : (doc.documentElement?.scrollLeft || doc.body?.scrollLeft || 0);
        const scrollY = win ? (win.scrollY || win.pageYOffset) : (doc.documentElement?.scrollTop || doc.body?.scrollTop || 0);
        onScrollRequest(rect, targetRange, win, doc, scrollY, scrollX, overlay);
      }
    }
  }, [onScrollRequest]);

  return {
    textRootRef,
    textNodesRef,
    clearHighlight,
    resetHighlightState,
    highlightToken
  };
}

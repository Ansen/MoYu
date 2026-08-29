import { useRef, useCallback } from 'react';

/**
 * High-Performance Smooth Highlighter for Morse Audio Playback
 * - Zero Layout-Thrashing: Defers getBoundingClientRect to scroll boundaries
 * - Incremental Range Caching: Preserves completed cell ranges instead of allocating 100s of DOM ranges per frame
 * - Native CSS Custom Highlight API with 60/120fps compositor updates
 */
export default function useHighlighter(onScrollRequest) {
  const textRootRef = useRef(null);
  const textNodesRef = useRef([]);
  const lastNodeIdxRef = useRef(0);
  const lastCharIdxRef = useRef(0);
  const startNodeIdxRef = useRef(0);
  const startOffsetRef = useRef(0);

  // Cached completed ranges for morse-played
  const completedRangesRef = useRef([]);
  const lastProcessedNodeIdxRef = useRef(-1);
  const lastScrollCheckTimeRef = useRef(0);

  const clearHighlight = useCallback(() => {
    try {
      startNodeIdxRef.current = 0;
      startOffsetRef.current = 0;
      completedRangesRef.current = [];
      lastProcessedNodeIdxRef.current = -1;

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
    startNodeIdxRef.current = 0;
    startOffsetRef.current = 0;
    completedRangesRef.current = [];
    lastProcessedNodeIdxRef.current = -1;
  }, []);

  const highlightToken = useCallback((token) => {
    if (!token || token.index === undefined || !textRootRef.current || !textNodesRef.current.length) return;
    
    const nodes = textNodesRef.current;
    let targetRange = null;
    let targetNode = null;
    let targetOffset = 0;
    let targetNodeIdx = 0;
    
    // Fast path tracking
    if (token.index < lastCharIdxRef.current) {
      // User jumped back / seeked: reset search
      lastNodeIdxRef.current = 0;
      lastCharIdxRef.current = 0;
      completedRangesRef.current = [];
      lastProcessedNodeIdxRef.current = -1;
      startNodeIdxRef.current = 0;
      startOffsetRef.current = 0;
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
        targetNodeIdx = i;
        lastNodeIdxRef.current = i;
        lastCharIdxRef.current = currentIndex;
        break;
      }
      currentIndex += length;
    }

    if (targetRange) {
      const doc = textRootRef.current.ownerDocument;
      const win = doc.defaultView;
      const char = targetNode.nodeValue[targetOffset];

      // Track start position on first played token
      if (lastProcessedNodeIdxRef.current === -1) {
        startNodeIdxRef.current = targetNodeIdx;
        startOffsetRef.current = targetOffset;
        lastProcessedNodeIdxRef.current = targetNodeIdx;
      }

      // If we crossed node boundaries, commit previous completed nodes into cached completedRanges
      if (targetNodeIdx > lastProcessedNodeIdxRef.current) {
        for (let pIdx = lastProcessedNodeIdxRef.current; pIdx < targetNodeIdx; pIdx++) {
          const prevN = nodes[pIdx];
          const isStartNode = pIdx === startNodeIdxRef.current;
          const sOffset = isStartNode ? startOffsetRef.current : 0;
          const eOffset = prevN.length;
          if (eOffset > sOffset) {
            const completedRange = doc.createRange();
            completedRange.setStart(prevN.node, sOffset);
            completedRange.setEnd(prevN.node, eOffset);
            completedRangesRef.current.push(completedRange);
          }
        }
        lastProcessedNodeIdxRef.current = targetNodeIdx;
      }

      const hasNativeHighlight = !!(win && win.CSS && win.CSS.highlights);

      if (hasNativeHighlight) {
        try {
          // Construct current node's active played slice (Incremental - O(1) allocation)
          const isCurrentStart = targetNodeIdx === startNodeIdxRef.current;
          const curStartOffset = isCurrentStart ? startOffsetRef.current : 0;
          const curEndOffset = targetOffset;

          const playedRanges = [...completedRangesRef.current];
          if (curEndOffset > curStartOffset) {
            const currentSliceRange = doc.createRange();
            currentSliceRange.setStart(targetNode, curStartOffset);
            currentSliceRange.setEnd(targetNode, curEndOffset);
            playedRanges.push(currentSliceRange);
          }

          if (playedRanges.length > 0) {
            win.CSS.highlights.set('morse-played', new win.Highlight(...playedRanges));
          } else {
            win.CSS.highlights.delete('morse-played');
          }
          
          if (char && char !== '\n' && char !== '\r') {
            win.CSS.highlights.set('morse-active', new win.Highlight(targetRange));
          } else {
            win.CSS.highlights.delete('morse-active');
          }
        } catch {}
      } else {
        // Fallback DOM Overlay mode (only when CSS highlights API unavailable)
        const container = textRootRef.current;
        let overlay = container.querySelector('#morse-active-overlay') || doc.getElementById('morse-active-overlay');
        if (!overlay) {
          overlay = doc.createElement('div');
          overlay.id = 'morse-active-overlay';
          overlay.style.position = 'absolute';
          overlay.style.backgroundColor = '#4f46e5';
          overlay.style.color = '#ffffff';
          overlay.style.borderRadius = '2px';
          overlay.style.pointerEvents = 'none';
          overlay.style.zIndex = '50';
          overlay.style.transition = 'none';
          container.appendChild(overlay);
        }

        const rect = targetRange.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
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
      }

      // Smooth auto-scroll request (throttled to 250ms to prevent layout thrashing)
      if (onScrollRequest) {
        const now = performance.now();
        if (now - lastScrollCheckTimeRef.current > 250) {
          lastScrollCheckTimeRef.current = now;
          const rect = targetRange.getBoundingClientRect();
          onScrollRequest(rect);
        }
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

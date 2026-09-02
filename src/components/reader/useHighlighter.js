import { useRef, useCallback } from 'react';

/**
 * 二分查找：根据全局字符索引快速定位对应的文本节点
 * 相比线性累加遍历，将长文本与跳转寻址复杂度从 O(N) 降至 O(log N)
 */
function findNodeIndex(tokenIndex, nodes) {
  let low = 0;
  let high = nodes.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const n = nodes[mid];
    const start = n.start !== undefined ? n.start : 0;
    const end = n.end !== undefined ? n.end : (start + n.length);
    if (tokenIndex < start) {
      high = mid - 1;
    } else if (tokenIndex >= end) {
      low = mid + 1;
    } else {
      return mid;
    }
  }
  return -1;
}

/**
 * High-Performance Smooth Highlighter for Morse Audio Playback
 * - Zero Layout-Thrashing: Defers getBoundingClientRect to scroll boundaries
 * - Incremental Range Caching & Range Pooling: 复用持久化 Range 实例，杜绝每帧高频分配与 GC 顿挫
 * - Prefix-Sum Fast-Path + Binary Search: 前缀和 O(1) 连续单调命中与 O(log N) 毫秒级跳转定位
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

  // 持久化复用的 Range 实例池，杜绝每字符高频 new/createRange
  const activeRangeRef = useRef(null);
  const currentSliceRangeRef = useRef(null);

  const clearHighlight = useCallback(() => {
    try {
      startNodeIdxRef.current = 0;
      startOffsetRef.current = 0;
      completedRangesRef.current = [];
      lastProcessedNodeIdxRef.current = -1;
      lastNodeIdxRef.current = 0;
      lastCharIdxRef.current = 0;
      activeRangeRef.current = null;
      currentSliceRangeRef.current = null;

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
    activeRangeRef.current = null;
    currentSliceRangeRef.current = null;
  }, []);

  const highlightToken = useCallback((token) => {
    if (!token || token.index === undefined || !textRootRef.current || !textNodesRef.current.length) return;
    
    const nodes = textNodesRef.current;
    const doc = textRootRef.current.ownerDocument;
    const win = doc.defaultView;

    // 1. 高性能三级寻址：Fast-Path 优先，失效时二分查找
    let targetNodeIdx = -1;
    const lastIdx = lastNodeIdxRef.current;
    
    // Fast Path A: 仍然落在当前节点内部 (0 次循环，1 次判断，最常见连续发音场景)
    if (
      lastIdx >= 0 && 
      lastIdx < nodes.length && 
      token.index >= (nodes[lastIdx].start !== undefined ? nodes[lastIdx].start : 0) && 
      token.index < (nodes[lastIdx].end !== undefined ? nodes[lastIdx].end : ((nodes[lastIdx].start || 0) + nodes[lastIdx].length))
    ) {
      targetNodeIdx = lastIdx;
    } 
    // Fast Path B: 步入相邻的下一个节点 (0 次循环，1 次判断)
    else if (
      lastIdx + 1 < nodes.length && 
      token.index >= (nodes[lastIdx + 1].start !== undefined ? nodes[lastIdx + 1].start : 0) && 
      token.index < (nodes[lastIdx + 1].end !== undefined ? nodes[lastIdx + 1].end : ((nodes[lastIdx + 1].start || 0) + nodes[lastIdx + 1].length))
    ) {
      targetNodeIdx = lastIdx + 1;
    } 
    // Slow Path: 进度拖拽、跳转或倒退时，执行 O(log N) 纳秒级二分查找
    else {
      targetNodeIdx = findNodeIndex(token.index, nodes);
      if (targetNodeIdx === -1) {
        // 容错兜底：若节点未预计算前缀，执行线性累加寻址
        let currentIndex = 0;
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const len = n.length;
          if (token.index >= currentIndex && token.index < currentIndex + len) {
            targetNodeIdx = i;
            break;
          }
          currentIndex += len;
        }
      }
    }

    if (targetNodeIdx === -1) return;

    const targetNodeInfo = nodes[targetNodeIdx];
    const targetNode = targetNodeInfo.node;
    const nodeStart = targetNodeInfo.start !== undefined ? targetNodeInfo.start : 0;
    const targetOffset = token.index - nodeStart;

    lastNodeIdxRef.current = targetNodeIdx;
    lastCharIdxRef.current = nodeStart;

    // 首次播放时锚定会话起点
    if (lastProcessedNodeIdxRef.current === -1) {
      startNodeIdxRef.current = targetNodeIdx;
      startOffsetRef.current = targetOffset;
      lastProcessedNodeIdxRef.current = targetNodeIdx;
    }

    // 处理用户倒退或重新 Seek
    if (targetNodeIdx < lastProcessedNodeIdxRef.current) {
      if (targetNodeIdx <= startNodeIdxRef.current) {
        startNodeIdxRef.current = targetNodeIdx;
        startOffsetRef.current = targetOffset;
        completedRangesRef.current = [];
      } else {
        completedRangesRef.current = completedRangesRef.current.slice(0, targetNodeIdx - startNodeIdxRef.current);
      }
      lastProcessedNodeIdxRef.current = targetNodeIdx;
    } 
    // 跨越节点向前推进时，将中间走完的节点增量封存到 completedRanges
    else if (targetNodeIdx > lastProcessedNodeIdxRef.current) {
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

    // 2. 复用持久化的 activeRangeRef (0 临时 Range 对象分配)
    if (!activeRangeRef.current || activeRangeRef.current.startContainer?.ownerDocument !== doc) {
      activeRangeRef.current = doc.createRange();
    }
    const targetRange = activeRangeRef.current;
    targetRange.setStart(targetNode, targetOffset);
    targetRange.setEnd(targetNode, targetOffset + 1);

    const hasNativeHighlight = !!(win && win.CSS && win.CSS.highlights);

    if (hasNativeHighlight) {
      try {
        // 3. 复用持久化的 currentSliceRangeRef (0 临时 Range 对象分配)
        const isCurrentStart = targetNodeIdx === startNodeIdxRef.current;
        const curStartOffset = isCurrentStart ? startOffsetRef.current : 0;
        const curEndOffset = targetOffset;

        if (!currentSliceRangeRef.current || currentSliceRangeRef.current.startContainer?.ownerDocument !== doc) {
          currentSliceRangeRef.current = doc.createRange();
        }
        const currentSliceRange = currentSliceRangeRef.current;

        const playedRanges = [...completedRangesRef.current];
        if (curEndOffset > curStartOffset) {
          currentSliceRange.setStart(targetNode, curStartOffset);
          currentSliceRange.setEnd(targetNode, curEndOffset);
          playedRanges.push(currentSliceRange);
        }

        if (playedRanges.length > 0) {
          win.CSS.highlights.set('morse-played', new win.Highlight(...playedRanges));
        } else {
          win.CSS.highlights.delete('morse-played');
        }
        
        const char = targetNode.nodeValue[targetOffset];
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
      const char = targetNode.nodeValue[targetOffset];
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
  }, [onScrollRequest]);

  /**
   * 排版切换或 DOM 重构时，在全新 DOM 节点树上 100% 还原已播浅蓝选区与深蓝活动字符
   */
  const restoreHighlight = useCallback((token, playbackStartIndex = 0) => {
    if (!token || token.index === undefined || !textRootRef.current || !textNodesRef.current.length) return;

    const nodes = textNodesRef.current;
    const doc = textRootRef.current.ownerDocument;
    const win = doc.defaultView;

    // 清空历史引用
    resetHighlightState();

    const targetIdx = token.index;
    const startIdx = Math.min(playbackStartIndex, targetIdx);

    // 采用 O(log N) 二分查找快速定位起始与目标节点
    let startNodeIdx = findNodeIndex(startIdx, nodes);
    let targetNodeIdx = findNodeIndex(targetIdx, nodes);

    // 兜底回退：若未包含 start/end 字段，则进行顺序累加查找
    if (startNodeIdx === -1 || targetNodeIdx === -1) {
      let charOffset = 0;
      for (let i = 0; i < nodes.length; i++) {
        const { length } = nodes[i];
        const nodeStart = charOffset;
        const nodeEnd = charOffset + length;
        if (startNodeIdx === -1 && startIdx >= nodeStart && startIdx < nodeEnd) {
          startNodeIdx = i;
        }
        if (targetNodeIdx === -1 && targetIdx >= nodeStart && targetIdx < nodeEnd) {
          targetNodeIdx = i;
        }
        charOffset += length;
      }
    }

    if (targetNodeIdx === -1) return;
    if (startNodeIdx === -1) startNodeIdx = 0;

    const targetNodeInfo = nodes[targetNodeIdx];
    const targetNode = targetNodeInfo.node;
    const targetNodeStart = targetNodeInfo.start !== undefined ? targetNodeInfo.start : 0;
    const targetOffset = targetIdx - targetNodeStart;

    const startNodeInfo = nodes[startNodeIdx];
    const startNodeStart = startNodeInfo.start !== undefined ? startNodeInfo.start : 0;
    const startOffset = startIdx - startNodeStart;

    // 复用持久化 activeRange
    if (!activeRangeRef.current || activeRangeRef.current.startContainer?.ownerDocument !== doc) {
      activeRangeRef.current = doc.createRange();
    }
    const targetRange = activeRangeRef.current;
    targetRange.setStart(targetNode, targetOffset);
    targetRange.setEnd(targetNode, targetOffset + 1);

    // 累积 targetNodeIdx 之前所有已完全播放完毕的节点范围
    const completedRanges = [];
    for (let pIdx = startNodeIdx; pIdx < targetNodeIdx; pIdx++) {
      const prevN = nodes[pIdx];
      const sOffset = (pIdx === startNodeIdx) ? startOffset : 0;
      const eOffset = prevN.length;
      if (eOffset > sOffset) {
        const r = doc.createRange();
        r.setStart(prevN.node, sOffset);
        r.setEnd(prevN.node, eOffset);
        completedRanges.push(r);
      }
    }

    // 关键状态同步：对齐游标与节点索引，确保后续 highlightToken() 平滑衔接且绝不误触发 seek 重置
    lastNodeIdxRef.current = targetNodeIdx;
    lastCharIdxRef.current = targetNodeStart;
    startNodeIdxRef.current = startNodeIdx;
    startOffsetRef.current = startOffset;
    completedRangesRef.current = completedRanges;
    lastProcessedNodeIdxRef.current = targetNodeIdx;

    const char = targetNode.nodeValue[targetOffset];
    const hasNativeHighlight = !!(win && win.CSS && win.CSS.highlights);

    if (hasNativeHighlight) {
      try {
        // 当前活动节点自身的已播放切片（从起始点到 targetOffset）
        const curStartOffset = (targetNodeIdx === startNodeIdx) ? startOffset : 0;
        const curEndOffset = targetOffset;

        if (!currentSliceRangeRef.current || currentSliceRangeRef.current.startContainer?.ownerDocument !== doc) {
          currentSliceRangeRef.current = doc.createRange();
        }
        const currentSliceRange = currentSliceRangeRef.current;

        const playedRanges = [...completedRanges];
        if (curEndOffset > curStartOffset) {
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

    if (onScrollRequest) {
      const rect = targetRange.getBoundingClientRect();
      onScrollRequest(rect);
    }
  }, [resetHighlightState, onScrollRequest]);

  return {
    textRootRef,
    textNodesRef,
    clearHighlight,
    resetHighlightState,
    highlightToken,
    restoreHighlight
  };
}

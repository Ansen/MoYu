import { useState, useRef, useEffect, useCallback } from 'react';

export function useResizable(initialWidth = 224, minWidth = 140, maxWidth = 400) {
  const [width, setWidth] = useState(initialWidth);
  const isResizing = useRef(false);
  const rafIdRef = useRef(null);

  const cancelPendingFrame = useCallback(() => {
    if (rafIdRef.current !== null) {
      window.cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);

  const startResizing = useCallback((e, customCursor = 'ew-resize') => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = customCursor;
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    cancelPendingFrame();
    if (isResizing.current) {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }
  }, [cancelPendingFrame]);

  const resize = useCallback((e) => {
    if (!isResizing.current) return;
    const clientX = e.clientX;
    cancelPendingFrame();
    rafIdRef.current = window.requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!isResizing.current) return;
      let newWidth = clientX;
      if (newWidth < minWidth) newWidth = minWidth;
      if (newWidth > maxWidth) newWidth = maxWidth;
      setWidth(newWidth);
    });
  }, [minWidth, maxWidth, cancelPendingFrame]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    window.addEventListener('blur', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
      window.removeEventListener('blur', stopResizing);
      cancelPendingFrame();
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };
  }, [resize, stopResizing, cancelPendingFrame]);

  return { width, startResizing, setWidth };
}

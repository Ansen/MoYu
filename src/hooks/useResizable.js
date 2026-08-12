import { useState, useRef, useEffect, useCallback } from 'react';

export function useResizable(initialWidth = 224, minWidth = 140, maxWidth = 400) {
  const [width, setWidth] = useState(initialWidth);
  const isResizing = useRef(false);

  const startResizing = useCallback((e, customCursor = 'ew-resize') => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = customCursor;
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    if (isResizing.current) {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = 'auto';
    }
  }, []);

  const resize = useCallback((e) => {
    if (isResizing.current) {
      // Use requestAnimationFrame for smoother performance
      window.requestAnimationFrame(() => {
        let newWidth = e.clientX;
        if (newWidth < minWidth) newWidth = minWidth;
        if (newWidth > maxWidth) newWidth = maxWidth;
        setWidth(newWidth);
      });
    }
  }, [minWidth, maxWidth]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return { width, startResizing, setWidth };
}

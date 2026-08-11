import React, { useState, useRef, useEffect } from 'react';

export default function TocSidebar({ isOpen, toc, bookType, onTocClick }) {
  const [width, setWidth] = useState(120);
  const isResizing = useRef(false);

  useEffect(() => {
    function handleMouseMove(e) {
      if (!isResizing.current) return;
      const newWidth = Math.max(120, Math.min(e.clientX, 400));
      setWidth(newWidth);
    }
    function handleMouseUp() {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
      }
    }
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  if (!isOpen || toc.length === 0) return null;

  return (
    <div className="flex shrink-0 relative h-full" style={{ width }}>
      <div className="w-full h-full bg-slate-50 dark:bg-[#1a1a1a] flex flex-col">
        <div className="p-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-[#333333]">
          {bookType === 'epub' ? '目录' : '文件列表'}
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
          {toc.map((item, idx) => (
            <button
              key={item.id || idx}
              onClick={() => onTocClick(item)}
              className={`w-full text-left px-3 py-2 text-[13px] rounded mb-1 truncate transition-colors ${
                item.isActive 
                  ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400 font-medium' 
                  : 'text-slate-600 dark:text-[#cccccc] hover:bg-slate-200 dark:hover:bg-[#333333]'
              }`}
              title={item.label}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      {/* Resizer Handle */}
      <div 
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-indigo-500/50 transition-colors z-10"
        onMouseDown={(e) => {
          e.preventDefault();
          isResizing.current = true;
          document.body.style.cursor = 'col-resize';
        }}
      ></div>
    </div>
  );
}

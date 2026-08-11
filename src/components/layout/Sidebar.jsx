import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Languages, Library, PanelLeftClose, PanelLeft, Home } from 'lucide-react';
import { useI18n } from '../../i18n/index';

export default function Sidebar({ currentView, setView }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(224); // 224px is w-56
  const isResizing = useRef(false);
  const { t } = useI18n();

  const startResizing = useCallback((e) => {
    isResizing.current = true;
    document.body.style.cursor = 'ew-resize';
    document.body.style.userSelect = 'none';
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  const resize = useCallback((e) => {
    if (isResizing.current) {
      let newWidth = e.clientX;
      if (newWidth < 140) newWidth = 140;
      if (newWidth > 400) newWidth = 400;
      setSidebarWidth(newWidth);
      if (newWidth <= 140 && !isCollapsed) {
        // Optionally auto collapse if dragged too small
      }
    }
  }, [isCollapsed]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  const menuItems = [
    { id: 'home', icon: <Home size={20} strokeWidth={2} />, label: t('sidebar.home') },
    { id: 'translator', icon: <Languages size={20} strokeWidth={2} />, label: t('sidebar.translator') },
    { id: 'library', icon: <Library size={20} strokeWidth={2} />, label: t('sidebar.library') },
  ];

  return (
    <div 
      style={{ width: isCollapsed ? 56 : sidebarWidth }}
      className={`h-full bg-slate-50 dark:bg-[#111111] border-r border-slate-300 dark:border-[#333333] flex flex-col shrink-0 select-none relative ${isCollapsed ? 'transition-[width] duration-300' : ''}`}
    >
      <div className="h-10 flex items-center justify-between px-3 border-b border-transparent">
        {!isCollapsed && (
          <span className="text-xs font-bold text-slate-500 uppercase tracking-widest pl-1">{t('sidebar.explorer')}</span>
        )}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className={`p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors ${isCollapsed ? 'mx-auto' : ''}`}
          title={isCollapsed ? "Expand" : "Collapse"}
        >
          {isCollapsed ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto mt-2">
        {menuItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`w-full flex items-center h-9 transition-colors ${
                isActive 
                  ? 'bg-indigo-50/80 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-400 font-semibold relative' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800/80 hover:text-slate-900 dark:hover:text-slate-200'
              } ${isCollapsed ? 'justify-center px-0' : 'px-4 gap-3'}`}
              title={isCollapsed ? item.label : undefined}
            >
              {isActive && !isCollapsed && <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-400"></div>}
              {item.icon}
              {!isCollapsed && <span className="text-sm font-medium">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      {/* Resizer Handle */}
      {!isCollapsed && (
        <div 
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-indigo-500/30 transition-colors z-10 translate-x-1/2"
          onMouseDown={startResizing}
        ></div>
      )}
    </div>
  );
}

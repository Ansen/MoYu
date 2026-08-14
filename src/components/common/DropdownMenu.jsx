import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';

export default function DropdownMenu({ isOpen, items, onSelect, onClose, isSubmenu = false }) {
  const [activeSubmenu, setActiveSubmenu] = useState(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const handleMouseEnter = (itemId, hasSubmenu) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (hasSubmenu) {
      setActiveSubmenu(itemId);
    } else {
      setActiveSubmenu(null);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setActiveSubmenu(null);
    }, 200); // 200ms grace window for smooth diagonal cursor movement
  };

  const handleSubmenuEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const containerClass = isSubmenu
    ? "w-max min-w-[160px] flex flex-col gap-0.5 p-1.5 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#333]/80 rounded-xl shadow-2xl shadow-slate-200/40 dark:shadow-black/40 animate-in fade-in zoom-in-95 duration-100"
    : "absolute top-full left-0 mt-1.5 w-max min-w-[180px] flex flex-col gap-0.5 p-1.5 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#333]/80 rounded-xl shadow-2xl shadow-slate-200/40 dark:shadow-black/40 z-50 animate-in fade-in slide-in-from-top-1 duration-100";

  return (
    <div className={containerClass}>
      {items.map((item, idx) => {
        if (item.type === 'divider') {
          return <div key={idx} className="h-px w-full bg-slate-100 dark:bg-[#333] my-1"></div>;
        }

        if (item.type === 'header') {
          return (
            <div key={idx} className="px-2.5 py-1 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              {item.label}
            </div>
          );
        }

        const Icon = item.icon;
        const Check = item.checkIcon;
        const hasSubmenu = Boolean(item.submenuItems && item.submenuItems.length);

        return (
          <div 
            key={item.id || idx} 
            className="relative"
            onMouseEnter={() => handleMouseEnter(item.id, hasSubmenu)}
            onMouseLeave={handleMouseLeave}
          >
            <button 
              className={`w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap transition-colors text-slate-700 dark:text-slate-300 group text-[13px] ${
                activeSubmenu === item.id 
                  ? 'bg-indigo-500 text-white dark:bg-indigo-600 dark:text-white' 
                  : 'hover:bg-indigo-500 hover:text-white'
              }`}
              onClick={(e) => {
                if (hasSubmenu) {
                  e.stopPropagation();
                } else {
                  if (item.id) onSelect(item.id);
                  onClose();
                }
              }}
            >
              {Icon && (
                <Icon 
                  size={15} 
                  className={`shrink-0 transition-colors ${
                    activeSubmenu === item.id 
                      ? 'text-white' 
                      : 'text-slate-400 group-hover:text-white'
                  }`} 
                />
              )}
              <span className="flex-1">{item.label}</span>
              {item.checked && Check && <Check size={14} className="opacity-80 shrink-0" />}
              {hasSubmenu && (
                <ChevronRight 
                  size={14} 
                  className={`shrink-0 ml-1 transition-colors ${
                    activeSubmenu === item.id 
                      ? 'text-white' 
                      : 'text-slate-400 group-hover:text-white'
                  }`} 
                />
              )}
            </button>

            {/* Seamless Submenu Popover aligned directly with current item */}
            {hasSubmenu && activeSubmenu === item.id && (
              <div 
                className="absolute left-full -top-1.5 pl-2 z-50"
                onMouseEnter={handleSubmenuEnter}
                onMouseLeave={handleMouseLeave}
              >
                <DropdownMenu 
                  isOpen={true} 
                  isSubmenu={true}
                  items={item.submenuItems} 
                  onSelect={(id) => { onSelect(id); onClose(); }} 
                  onClose={onClose} 
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

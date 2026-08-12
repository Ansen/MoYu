import React from 'react';

export default function DropdownMenu({ isOpen, items, onSelect, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="absolute top-full left-0 mt-1.5 w-max flex flex-col gap-0.5 p-1.5 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#333]/80 rounded-xl shadow-2xl shadow-slate-200/40 dark:shadow-black/40 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
      {items.map((item, idx) => {
        if (item.type === 'divider') {
          return <div key={idx} className="h-px w-full bg-slate-100 dark:bg-[#333] my-1"></div>;
        }

        const Icon = item.icon;
        const Check = item.checkIcon;
        return (
          <button 
            key={item.id}
            className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap hover:bg-indigo-500 hover:text-white transition-colors text-slate-700 dark:text-slate-300 group" 
            onClick={() => { onSelect(item.id); onClose(); }}
          >
            {Icon && <Icon size={15} className="text-slate-400 group-hover:text-white transition-colors" />}
            <span className="flex-1">{item.label}</span>
            {item.checked && Check && <Check size={14} className="opacity-80" />}
          </button>
        );
      })}
    </div>
  );
}

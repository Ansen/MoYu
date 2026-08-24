import React, { useState, useRef, useEffect } from 'react';
import { Dices, Shuffle, CaseSensitive, SlidersHorizontal, ChevronDown, Sparkles, Radio } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function GeneratorDropdown({ 
  onSelectMode, 
  onOpenCustomModal, 
  disabled = false,
  variant = 'default', // 'default' | 'large'
  color = 'indigo' // 'indigo' | 'orange'
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { t } = useI18n();

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (mode) => {
    setIsOpen(false);
    onSelectMode(mode);
  };

  const handleOpenCustom = () => {
    setIsOpen(false);
    onOpenCustomModal();
  };

  const isLarge = variant === 'large';
  const isIndigo = color === 'indigo';

  const colorStyles = isIndigo
    ? 'border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
    : 'border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20';

  const triggerClass = isLarge
    ? `flex items-center gap-2 px-5 py-2.5 rounded-lg border ${colorStyles} transition-all font-medium text-[13px] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50`
    : `flex items-center gap-2 px-4 py-2 rounded-lg border ${colorStyles} transition-all font-medium text-[13px] whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50`;

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={triggerClass}
      >
        <Dices size={isLarge ? 18 : 16} className={isIndigo ? "text-indigo-500 shrink-0" : "text-orange-500 shrink-0"} />
        <span>{t('library.gen.button')}</span>
        <ChevronDown 
          size={14} 
          className={`transition-transform duration-200 opacity-60 ${isOpen ? 'rotate-180' : ''}`} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-64 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333333] shadow-xl rounded-xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150 select-none">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1.5">
            <Sparkles size={12} className="text-orange-400" />
            <span>{t('library.gen.button')}</span>
          </div>

          {/* Quick Presets */}
          <div className="space-y-0.5">
            {/* Numbers: 4-digit standard */}
            <button
              type="button"
              onClick={() => handleSelect('numbers')}
              className="w-full flex items-start gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors group cursor-pointer"
            >
              <div className="p-1.5 rounded-md bg-orange-100/70 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0 group-hover:scale-105 transition-transform">
                <Dices size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-slate-800 dark:text-[#dddddd] group-hover:text-orange-600 dark:group-hover:text-orange-400">
                  {t('library.gen.numbers')}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-[#888888]">
                  {t('library.gen.numbers.desc')}
                </div>
              </div>
            </button>

            {/* Letters: 5-letter standard */}
            <button
              type="button"
              onClick={() => handleSelect('letters')}
              className="w-full flex items-start gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors group cursor-pointer"
            >
              <div className="p-1.5 rounded-md bg-orange-100/70 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0 group-hover:scale-105 transition-transform">
                <CaseSensitive size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-slate-800 dark:text-[#dddddd] group-hover:text-orange-600 dark:group-hover:text-orange-400">
                  {t('library.gen.letters')}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-[#888888]">
                  {t('library.gen.letters.desc')}
                </div>
              </div>
            </button>

            {/* Mixed: 4-char Alphanumeric standard */}
            <button
              type="button"
              onClick={() => handleSelect('mixed')}
              className="w-full flex items-start gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors group cursor-pointer"
            >
              <div className="p-1.5 rounded-md bg-orange-100/70 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0 group-hover:scale-105 transition-transform">
                <Shuffle size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-slate-800 dark:text-[#dddddd] group-hover:text-orange-600 dark:group-hover:text-orange-400">
                  {t('library.gen.mixed')}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-[#888888]">
                  {t('library.gen.mixed.desc')}
                </div>
              </div>
            </button>

            {/* Callsigns: Realistic ITU Callsigns standard */}
            <button
              type="button"
              onClick={() => handleSelect('callsigns')}
              className="w-full flex items-start gap-3 px-2.5 py-2 rounded-lg text-left hover:bg-orange-50 dark:hover:bg-orange-500/10 transition-colors group cursor-pointer"
            >
              <div className="p-1.5 rounded-md bg-orange-100/70 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0 group-hover:scale-105 transition-transform">
                <Radio size={15} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-slate-800 dark:text-[#dddddd] group-hover:text-orange-600 dark:group-hover:text-orange-400">
                  {t('library.gen.callsigns')}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-[#888888]">
                  {t('library.gen.callsigns.desc')}
                </div>
              </div>
            </button>
          </div>

          <div className="h-px bg-slate-100 dark:bg-[#333333] my-1 mx-1" />

          {/* Custom Configuration Modal trigger */}
          <button
            type="button"
            onClick={handleOpenCustom}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-slate-100 dark:hover:bg-[#2a2a2a] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <SlidersHorizontal size={15} className="text-slate-400" />
            <div className="flex-1 min-w-0">
              <span className="text-[12px] font-medium block">{t('library.gen.custom')}</span>
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

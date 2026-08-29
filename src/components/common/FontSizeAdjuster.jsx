import React from 'react';
import { Type, Minus, Plus } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function FontSizeAdjuster({ fontSize, setFontSize, uiScale }) {
  const { t } = useI18n();

  return (
    <div className="flex items-center bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2a2a2a] shadow-xs rounded-lg shrink-0" style={{ gap: `${2 * uiScale}px`, padding: `${4 * uiScale}px ${6 * uiScale}px`, height: `${28 * uiScale}px` }}>
      <div className="flex items-center text-slate-400 dark:text-[#666] mr-1" style={{ paddingLeft: `${4 * uiScale}px` }}>
        <Type size={12 * uiScale} />
      </div>
      <div className="bg-slate-200 dark:bg-[#333]" style={{ width: '1px', height: `${12 * uiScale}px`, margin: `0 ${4 * uiScale}px` }}></div>
      <button onClick={() => setFontSize(f => Math.max(12, f - 1))} className="text-slate-500 hover:text-slate-800 dark:text-[#888] dark:hover:text-[#ccc] transition-colors" style={{ padding: `${2 * uiScale}px` }} title={t('common.fontSize.decrease', '减小字号')}>
        <Minus size={13 * uiScale} />
      </button>
      <span className="font-mono text-slate-500 dark:text-[#888] font-bold text-center" style={{ fontSize: `${11 * uiScale}px`, width: `${18 * uiScale}px` }}>{fontSize}</span>
      <button onClick={() => setFontSize(f => Math.min(48, f + 1))} className="text-slate-500 hover:text-slate-800 dark:text-[#888] dark:hover:text-[#ccc] transition-colors" style={{ padding: `${2 * uiScale}px` }} title={t('common.fontSize.increase', '增大字号')}>
        <Plus size={13 * uiScale} />
      </button>
    </div>
  );
}

import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function OutputCard({ title, content, visible, icon: Icon, colorClass, uiScale, effectiveFontSize }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col flex-1 min-h-[140px] bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-xs border border-slate-200 dark:border-[#2a2a2a] overflow-hidden transition-all hover:shadow-md group relative`}>
      <div className="flex items-center justify-between px-5 bg-slate-50/80 dark:bg-[#252526] border-b border-slate-100 dark:border-[#2a2a2a]" style={{ height: `${44 * uiScale}px` }}>
        <div className="flex items-center" style={{ gap: `${10 * uiScale}px` }}>
          {Icon && <Icon size={14 * uiScale} className={colorClass} />}
          <span style={{ fontSize: `${11 * uiScale}px` }} className="font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">{title}</span>
        </div>
        <button 
          onClick={handleCopy}
          style={{ width: `${28 * uiScale}px`, height: `${28 * uiScale}px` }}
          className="flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-400 dark:text-[#888888] hover:text-slate-700 dark:hover:text-[#cccccc] transition-colors cursor-pointer"
          title={copied ? t('common.copied', '已复制') : t('common.copy', '复制到剪贴板')}
        >
          {copied ? <Check size={15 * uiScale} className="text-emerald-500" /> : <Copy size={15 * uiScale} />}
        </button>
      </div>
      <div className="flex-1 relative">
        <textarea
          readOnly
          style={{ fontSize: `${effectiveFontSize * 0.9}px` }}
          className="absolute inset-0 w-full h-full bg-transparent p-5 resize-none focus:outline-hidden text-slate-700 dark:text-[#d4d4d4] font-mono custom-scrollbar leading-relaxed"
          value={content}
        />
      </div>
    </div>
  );
}

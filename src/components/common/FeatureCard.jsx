import React from 'react';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '../../i18n/index';

export default function FeatureCard({ icon: Icon, title, desc, onClick, colorClass }) {
  const { t } = useI18n();
  // `colorClass` logic to apply proper styling
  const isIndigo = colorClass === 'indigo';
  
  return (
    <div 
      onClick={onClick}
      className="group relative bg-white dark:bg-[#252526] rounded-xl border border-slate-200 dark:border-[#333333] p-8 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none">
        <Icon size={120} />
      </div>
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm ${
        isIndigo ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400' 
                 : 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
      }`}>
        <Icon size={28} className={!isIndigo ? "ml-1" : ""} />
      </div>
      <h2 className="text-xl font-bold mb-3">{title}</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed mb-6">
        {desc}
      </p>
      <div className={`flex items-center font-medium text-sm gap-1 group-hover:gap-2 transition-all ${
        isIndigo ? 'text-indigo-600 dark:text-indigo-400' : 'text-emerald-600 dark:text-emerald-400'
      }`}>
        {t('home.card.launch')} <ArrowRight size={16} />
      </div>
    </div>
  );
}

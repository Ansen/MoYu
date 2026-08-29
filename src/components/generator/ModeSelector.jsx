import React from 'react';
import { Dices, CaseSensitive, Shuffle, Radio, Check } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function ModeSelector({ presetMode, onSelectMode }) {
  const { t } = useI18n();

  const modes = [
    {
      id: 'numbers',
      label: t('generator.mode.numbers'),
      sub: t('generator.mode.numbers.sub'),
      icon: <Dices size={15} className="shrink-0" />
    },
    {
      id: 'letters',
      label: t('generator.mode.letters'),
      sub: t('generator.mode.letters.sub'),
      icon: <CaseSensitive size={16} className="shrink-0" />
    },
    {
      id: 'mixed',
      label: t('generator.mode.mixed'),
      sub: t('generator.mode.mixed.sub'),
      icon: <Shuffle size={14} className="shrink-0" />
    },
    {
      id: 'callsigns',
      label: t('generator.mode.callsigns'),
      sub: t('generator.mode.callsigns.sub'),
      icon: <Radio size={14} className="shrink-0" />
    }
  ];

  return (
    <div className="space-y-2">
      <label className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
        <span className="w-1.5 h-3.5 bg-orange-500 rounded-full inline-block"></span>
        {t('generator.mode.type')}
      </label>
      <div className="grid grid-cols-2 gap-3">
        {modes.map((m) => {
          const isSelected = presetMode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onSelectMode(m.id)}
              className={`h-[80px] px-3.5 rounded-xl border flex flex-col justify-center gap-1 transition-all cursor-pointer ${
                isSelected
                  ? 'border-orange-400 dark:border-orange-500/60 bg-orange-50/70 dark:bg-orange-500/15 text-orange-600 dark:text-orange-400 font-semibold shadow-xs'
                  : 'border-slate-200 dark:border-[#333333] hover:bg-slate-50 dark:hover:bg-[#252525] text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 min-w-0">
                  {m.icon}
                  <span className="truncate text-[15px]">{m.label}</span>
                </div>
                {isSelected && <Check size={14} className="stroke-[2.5] shrink-0" />}
              </div>
              <span className="text-[15px] text-slate-400 dark:text-slate-500 font-mono text-left">{m.sub}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

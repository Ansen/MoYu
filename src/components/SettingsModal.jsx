import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { useI18n } from '../i18n/index';

export default function SettingsModal({ isOpen, onClose }) {
  const [dictionary, setDictionary] = useState('1983_mainland');
  const [morseSpeed, setMorseSpeed] = useState(20);
  const [morseFreq, setMorseFreq] = useState(700);
  const [startupBehavior, setStartupBehavior] = useState('restore');
  
  const { t } = useI18n();

  // 模拟读取保存的设置
  useEffect(() => {
    const savedDict = localStorage.getItem('pref_dictionary');
    const savedSpeed = localStorage.getItem('pref_morse_speed');
    const savedFreq = localStorage.getItem('pref_morse_freq');
    const savedStartup = localStorage.getItem('pref_startup');
    if (savedDict) setDictionary(savedDict);
    if (savedSpeed) setMorseSpeed(Number(savedSpeed));
    if (savedFreq) setMorseFreq(Number(savedFreq));
    if (savedStartup) setStartupBehavior(savedStartup);
  }, [isOpen]);

  const handleSave = () => {
    localStorage.setItem('pref_dictionary', dictionary);
    localStorage.setItem('pref_morse_speed', morseSpeed);
    localStorage.setItem('pref_morse_freq', morseFreq);
    localStorage.setItem('pref_startup', startupBehavior);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[100] flex items-center justify-center backdrop-blur-sm select-none">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-[#333333] rounded-lg shadow-2xl w-[480px] max-w-[90vw] overflow-hidden flex flex-col">

        {/* Modal Header */}
        <div className="h-10 flex items-center justify-between px-4 bg-slate-50 dark:bg-[#252526] border-b border-slate-200 dark:border-[#333333]">
          <span className="font-bold text-[13px] text-slate-700 dark:text-[#cccccc]">{t('settings.title')}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-[#ffffff] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 text-[13px] text-slate-700 dark:text-[#cccccc]">
          
          {/* Startup Behavior */}
          <div className="space-y-2">
            <label className="font-bold block">{t('settings.startup')}</label>
            <select
              value={startupBehavior}
              onChange={(e) => setStartupBehavior(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="home">{t('settings.startup.home')}</option>
              <option value="restore">{t('settings.startup.restore')}</option>
            </select>
          </div>

          <div className="h-px w-full bg-slate-200 dark:bg-[#333333]"></div>

          {/* Dictionary Setting */}
          <div className="space-y-2">
            <label className="font-bold block">{t('settings.dict')}</label>
            <select
              value={dictionary}
              onChange={(e) => setDictionary(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#111111] border border-slate-300 dark:border-[#333333] rounded-md px-3 py-1.5 focus:outline-none focus:border-indigo-500"
            >
              <option value="1983_mainland">{t('settings.dict.1983m')}</option>
              <option value="1983_taiwan">{t('settings.dict.1983t')}</option>
              <option value="custom">{t('settings.dict.custom')}</option>
            </select>
          </div>

          <div className="h-px w-full bg-slate-200 dark:bg-[#333333]"></div>

          {/* Morse Code Setting */}
          <div className="space-y-4">
            <label className="font-bold block">{t('settings.audio')}</label>

            <div className="grid grid-cols-[130px_1fr_40px] items-center gap-3">
              <span className="text-slate-500 dark:text-[#999999]">{t('settings.audio.speed')}</span>
              <input
                type="range"
                min="5" max="40"
                value={morseSpeed}
                onChange={(e) => setMorseSpeed(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <span className="font-mono text-right">{morseSpeed}</span>
            </div>

            <div className="grid grid-cols-[130px_1fr_40px] items-center gap-3">
              <span className="text-slate-500 dark:text-[#999999]">{t('settings.audio.freq')}</span>
              <input
                type="range"
                min="100" max="1200" step="10"
                value={morseFreq}
                onChange={(e) => setMorseFreq(Number(e.target.value))}
                className="w-full accent-indigo-500"
              />
              <span className="font-mono text-right">{morseFreq}</span>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-[#252526] border-t border-slate-200 dark:border-[#333333] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md border border-slate-300 dark:border-[#555555] text-slate-600 dark:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[13px] font-medium"
          >
            {t('settings.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition-colors text-[13px] font-medium flex items-center gap-1.5"
          >
            <Save size={14} /> {t('settings.save')}
          </button>
        </div>

      </div>
    </div>
  );
}

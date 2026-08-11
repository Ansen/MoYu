import React, { useState, useEffect } from 'react';
import { chineseToCodes, codesToMorse, morseToCodes, codesToChinese, isMainlyMorse, isMainlyCodes } from '../utils/translator';
import { useI18n } from '../i18n/index';
import { Edit3, MessageSquare, Hash, Radio, Copy, Check, Wand2, Minus, Plus } from 'lucide-react';

export default function TranslatorView() {
  const [inputText, setInputText] = useState(() => localStorage.getItem('moyu_translator_last_input') || '');
  const [inputType, setInputType] = useState('none');
  const [chineseOutput, setChineseOutput] = useState('');
  const [codesOutput, setCodesOutput] = useState('');
  const [morseOutput, setMorseOutput] = useState('');
  const [dictionary, setDictionary] = useState(null);
  const [fontSize, setFontSize] = useState(15);
  
  const { t } = useI18n();

  useEffect(() => {
    fetch('/dict/mapping.json')
      .then(res => res.json())
      .then(data => setDictionary(data))
      .catch(err => console.error("Failed to load dictionary", err));
  }, []);

  useEffect(() => {
    if (!dictionary) return;
    
    localStorage.setItem('moyu_translator_last_input', inputText);

    const text = inputText;
    if (text.trim() === '') {
      setInputType('none');
      setChineseOutput('');
      setCodesOutput('');
      setMorseOutput('');
      return;
    }

    if (isMainlyMorse(text)) {
      setInputType('morse');
      const codes = morseToCodes(text);
      setCodesOutput(codes);
      setChineseOutput(codesToChinese(codes, dictionary.codeToChar));
      setMorseOutput(text);
    } else if (isMainlyCodes(text)) {
      setInputType('codes');
      setMorseOutput(codesToMorse(text));
      setChineseOutput(codesToChinese(text, dictionary.codeToChar));
      setCodesOutput(text);
    } else {
      setInputType('chinese');
      const codes = chineseToCodes(text, dictionary.charToCode);
      setCodesOutput(codes);
      setMorseOutput(codesToMorse(codes));
      setChineseOutput(text);
    }
  }, [inputText, dictionary]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  if (!dictionary) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-[#121212]">
        <div className="flex flex-col items-center gap-3 text-indigo-500">
          <Wand2 className="animate-pulse" size={32} />
          <span className="text-sm font-medium">{t('translator.loading')}</span>
        </div>
      </div>
    );
  }

  const scale = fontSize / 15;

  return (
    <div className="h-full flex flex-col bg-slate-50/50 dark:bg-[#121212] p-4 md:p-6 gap-4 md:gap-6 overflow-hidden">
      
      {/* Input Panel (Premium Card) */}
      <div className="flex-[0.8] flex flex-col bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2a2a2a] overflow-hidden transition-all hover:shadow-md">
        <div className="h-12 flex items-center justify-between px-5 bg-slate-50/80 dark:bg-[#252526] border-b border-slate-100 dark:border-[#2a2a2a]">
          <div className="flex items-center gap-2">
            <Edit3 size={16 * scale} className="text-indigo-500" />
            <span style={{ fontSize: `${12 * scale}px` }} className="font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">{t('translator.editor.title')}</span>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Font Size Adjuster */}
            <div className="flex items-center gap-1 bg-slate-200/50 dark:bg-[#333333] rounded-lg px-1.5 py-0.5">
              <button onClick={() => setFontSize(f => Math.max(12, f - 1))} className="p-1 text-slate-500 hover:text-slate-800 dark:text-[#888] dark:hover:text-[#ccc] transition-colors" title="减小字号">
                <Minus size={14} />
              </button>
              <span className="text-[11px] font-mono text-slate-500 dark:text-[#888] font-bold w-4 text-center">{fontSize}</span>
              <button onClick={() => setFontSize(f => Math.min(48, f + 1))} className="p-1 text-slate-500 hover:text-slate-800 dark:text-[#888] dark:hover:text-[#ccc] transition-colors" title="增大字号">
                <Plus size={14} />
              </button>
            </div>

            {inputType !== 'none' && (
              <div style={{ fontSize: `${10 * scale}px`, padding: `${4 * scale}px ${10 * scale}px` }} className="rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold tracking-widest uppercase flex items-center gap-1.5">
                <span style={{ width: `${6 * scale}px`, height: `${6 * scale}px` }} className="rounded-full bg-indigo-500 animate-pulse"></span>
                {inputType === 'chinese' ? 'Text' : inputType === 'codes' ? 'Codes' : 'Morse'}
              </div>
            )}
          </div>
        </div>
        <textarea
          style={{ fontSize: `${fontSize}px` }}
          className="flex-1 w-full p-6 bg-transparent resize-none focus:outline-none text-slate-800 dark:text-[#e0e0e0] placeholder-slate-400 dark:placeholder-[#666666] custom-scrollbar font-sans leading-relaxed transition-colors"
          placeholder={t('translator.editor.placeholder')}
          value={inputText}
          onChange={handleInputChange}
          autoFocus
        />
      </div>

      {/* Output Panels (Horizontal Row) */}
      <div className="flex-[1.2] flex flex-col md:flex-row min-w-0 gap-4 md:gap-5">
        {inputType === 'none' ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white/50 dark:bg-[#1e1e1e]/50 border border-dashed border-slate-300 dark:border-[#333333] rounded-2xl text-slate-400 dark:text-[#666666] select-none p-8 text-center backdrop-blur-sm">
            <Wand2 size={48} className="mb-4 opacity-20" strokeWidth={1} />
            <p className="text-[14px] font-medium">{t('translator.output.placeholder')}</p>
            <p className="text-[12px] mt-2 opacity-70">Type anything on the left to see magic happen</p>
          </div>
        ) : (
          <>
            <OutputCard title={t('translator.chinese')} content={chineseOutput} visible={inputType !== 'chinese'} icon={MessageSquare} colorClass="text-emerald-500" scale={scale} />
            <OutputCard title={t('translator.codes')} content={codesOutput} visible={inputType !== 'codes'} icon={Hash} colorClass="text-blue-500" scale={scale} />
          </>
        )}
      </div>
      
    </div>
  );
}

function OutputCard({ title, content, visible, icon: Icon, colorClass, scale }) {
  const [copied, setCopied] = useState(false);

  if (!visible) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex flex-col flex-1 min-h-[140px] bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2a2a2a] overflow-hidden transition-all hover:shadow-md group relative`}>
      <div className="h-11 flex items-center justify-between px-5 bg-slate-50/80 dark:bg-[#252526] border-b border-slate-100 dark:border-[#2a2a2a]">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={14 * scale} className={colorClass} />}
          <span style={{ fontSize: `${11 * scale}px` }} className="font-bold text-slate-700 dark:text-[#cccccc] uppercase tracking-wider">{title}</span>
        </div>
        <button 
          onClick={handleCopy}
          style={{ width: `${28 * scale}px`, height: `${28 * scale}px` }}
          className="flex items-center justify-center rounded-md hover:bg-slate-200 dark:hover:bg-[#333333] text-slate-400 dark:text-[#888888] hover:text-slate-700 dark:hover:text-[#cccccc] transition-colors"
          title={copied ? '已复制' : '复制到剪贴板'}
        >
          {copied ? <Check size={15 * scale} className="text-emerald-500" /> : <Copy size={15 * scale} />}
        </button>
      </div>
      <div className="flex-1 relative">
        <textarea
          readOnly
          style={{ fontSize: `${14 * scale}px` }}
          className="absolute inset-0 w-full h-full bg-transparent p-5 resize-none focus:outline-none text-slate-700 dark:text-[#d4d4d4] font-mono custom-scrollbar leading-relaxed"
          value={content}
        />
      </div>
    </div>
  );
}

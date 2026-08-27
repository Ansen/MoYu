import React, { useState, useEffect, useRef } from 'react';
import { chineseToCodes, morseToCodes, codesToChinese, isMainlyMorse, isMainlyCodes } from '../utils/translator';
import { useI18n } from '../i18n/index';
import { Edit3, MessageSquare, Hash, Wand2, Upload, Trash2, ChevronDown, Mic, Keyboard } from 'lucide-react';
import ImportDictModal from '../components/ImportDictModal';
import OutputCard from '../components/common/OutputCard';
import FontSizeAdjuster from '../components/common/FontSizeAdjuster';
import { useSpeechRecognition } from '../hooks/useSpeechRecognition';

export default function TranslatorView() {
  const [inputText, setInputText] = useState(() => localStorage.getItem('moyu_translator_last_input') || '');
  const [inputType, setInputType] = useState('none');
  const [chineseOutput, setChineseOutput] = useState('');
  const [codesOutput, setCodesOutput] = useState('');
  const [dictionary, setDictionary] = useState(null);
  const [prefDictionaryId, setPrefDictionaryId] = useState(() => localStorage.getItem('pref_dictionary') || '1983_mainland');
  const [customDicts, setCustomDicts] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('moyu_custom_dicts') || '[]');
    } catch {
      return [];
    }
  });
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDictDropdownOpen, setIsDictDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [fontSize, setFontSize] = useState(15);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Voice Mode states
  const [mode, setMode] = useState('text'); // 'text' | 'voice'
  const [conversationHistory, setConversationHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('moyu_voice_history') || '[]');
    } catch {
      return [];
    }
  });
  const chatScrollRef = useRef(null);
  
  const { t } = useI18n();
  
  const handleFinalResult = React.useCallback((finalText) => {
    if (!dictionary || !finalText) return;
    const codes = chineseToCodes(finalText, dictionary.charToCode);
    const newItem = { id: Date.now(), text: finalText, codes };
    setConversationHistory(prev => {
      const next = [...prev, newItem].slice(-50);
      localStorage.setItem('moyu_voice_history', JSON.stringify(next));
      return next;
    });
  }, [dictionary]);

  const { isListening, transcript, error, startListening, stopListening, isSupported } = useSpeechRecognition({
    onFinalResult: handleFinalResult
  });

  useEffect(() => {
    let timeoutId;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setWindowWidth(window.innerWidth);
      }, 100);
    };
    window.addEventListener('resize', handleResize);
    
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDictDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timeoutId);
    };
  }, []);

  useEffect(() => {
    const loadDictionary = () => {
      if (prefDictionaryId.startsWith('custom_')) {
        try {
          const dictData = JSON.parse(localStorage.getItem(`moyu_dict_${prefDictionaryId}`));
          if (dictData) {
            setDictionary(dictData);
            return;
          }
        } catch (e) {
          console.error("Failed to load custom dictionary", e);
        }
      }
      
      // Fallback to builtin
      const file = '/dict/mapping.json';
      fetch(file)
        .then(res => res.json())
        .then(data => setDictionary(data))
        .catch(err => console.error(`Failed to load ${file}`, err));
    };
    
    loadDictionary();
    localStorage.setItem('pref_dictionary', prefDictionaryId);
  }, [prefDictionaryId]);

  useEffect(() => {
    if (!dictionary || mode === 'voice') return;
    
    localStorage.setItem('moyu_translator_last_input', inputText);

    const text = inputText;
    if (text.trim() === '') {
      setInputType('none');
      setChineseOutput('');
      setCodesOutput('');
      return;
    }

    if (isMainlyMorse(text)) {
      setInputType('morse');
      const codes = morseToCodes(text);
      setCodesOutput(codes);
      setChineseOutput(codesToChinese(codes, dictionary.codeToChar));
    } else if (isMainlyCodes(text)) {
      setInputType('codes');
      setCodesOutput(text);
      setChineseOutput(codesToChinese(text, dictionary.codeToChar));
    } else {
      setInputType('chinese');
      const codes = chineseToCodes(text, dictionary.charToCode);
      setCodesOutput(codes);
      setChineseOutput(text);
    }
  }, [inputText, dictionary, mode]);

  // Handle Speech Recognition manual end (flush any leftover interim transcript)
  useEffect(() => {
    if (!isListening && transcript.trim() && dictionary) {
      handleFinalResult(transcript.trim());
    }
  }, [isListening, transcript, dictionary, handleFinalResult]);

  // Auto scroll chat
  useEffect(() => {
    if (mode === 'voice' && chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [conversationHistory, transcript, mode]);

  const handleInputChange = (e) => {
    setInputText(e.target.value);
  };

  const toggleMic = () => {
    if (!isSupported) {
      alert(t('translator.voice.notsupported'));
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const handleImportFile = (file) => {
    const reader = new FileReader();
    reader.onerror = () => alert(t('dict.import.error.read'));
    reader.onload = (event) => {
      try {
        const text = event.target.result;
        const charToCode = {};
        const codeToChar = {};
        
        if (file.name.endsWith('.json')) {
          const data = JSON.parse(text);
          const mapping = data.charToCode || data;
          for (const [char, code] of Object.entries(mapping)) {
            if (typeof code === 'string' || typeof code === 'number') {
              charToCode[char] = code;
              codeToChar[code] = char;
            }
          }
        } else {
          text.split('\n').forEach(line => {
            const parts = line.split('=');
            if (parts.length === 2) {
              const char = parts[0].trim();
              const code = parts[1].trim();
              if (char && code) {
                charToCode[char] = code;
                codeToChar[code] = char;
              }
            }
          });
        }
        
        const newId = `custom_${Date.now()}`;
        const newDictName = file.name;
        
        localStorage.setItem(`moyu_dict_${newId}`, JSON.stringify({ charToCode, codeToChar }));
        
        const newDicts = [...customDicts, { id: newId, name: newDictName }];
        setCustomDicts(newDicts);
        localStorage.setItem('moyu_custom_dicts', JSON.stringify(newDicts));
        
        setPrefDictionaryId(newId);
        setIsImportModalOpen(false);
      } catch (err) {
        console.error("Failed to parse dict file", err);
        alert(t('dict.import.error.format'));
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteDict = () => {
    if (!prefDictionaryId.startsWith('custom_')) return;
    if (confirm(t('dict.delete.confirm'))) {
      localStorage.removeItem(`moyu_dict_${prefDictionaryId}`);
      const newDicts = customDicts.filter(d => d.id !== prefDictionaryId);
      setCustomDicts(newDicts);
      localStorage.setItem('moyu_custom_dicts', JSON.stringify(newDicts));
      setPrefDictionaryId('1983_mainland');
    }
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

  const uiScale = Math.max(1, Math.min(1.8, windowWidth / 800));
  const effectiveFontSize = fontSize * uiScale;

  return (
    <div className="h-full flex flex-col bg-slate-50/50 dark:bg-[#121212] p-4 md:p-6 gap-4 md:gap-6 overflow-hidden">
      
      {/* Top Header / Mode Switcher */}
      <div className="shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {mode === 'text' ? <Edit3 size={20 * uiScale} className="text-indigo-500" /> : <Mic size={20 * uiScale} className="text-indigo-500" />}
          <span style={{ fontSize: `${14 * uiScale}px` }} className="font-bold text-slate-700 dark:text-[#cccccc] tracking-wider">
            {t('translator.editor.title')}
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-4 flex-wrap justify-end">
          {/* Dictionary Selector */}
          <div className="flex items-center bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#2a2a2a] shadow-sm rounded-lg shrink-0 relative z-50" style={{ gap: `${6 * uiScale}px`, padding: `${4 * uiScale}px ${8 * uiScale}px`, height: `${28 * uiScale}px` }}>
            <div className="relative" ref={dropdownRef}>
              <div 
                className="flex items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-[#252525] rounded transition-colors"
                style={{ gap: `${4 * uiScale}px`, padding: `0 ${4 * uiScale}px`, marginLeft: `-${4 * uiScale}px`, height: `${20 * uiScale}px` }}
                onClick={() => setIsDictDropdownOpen(!isDictDropdownOpen)}
              >
                <span className="font-medium text-slate-600 dark:text-[#ccc] select-none truncate" style={{ fontSize: `${11 * uiScale}px`, maxWidth: `${80 * uiScale}px` }}>
                  {prefDictionaryId === '1983_mainland' ? t('settings.dict.1983m') :
                  customDicts.find(d => d.id === prefDictionaryId)?.name || t('dict.selector.notfound')}
                </span>
                <ChevronDown size={13 * uiScale} className="text-slate-400 shrink-0" />
              </div>

              {isDictDropdownOpen && (
                <div className="absolute top-full right-0 mt-2 bg-white dark:bg-[#1e1e1e] border border-slate-200 dark:border-[#333] shadow-lg rounded-lg z-50 animate-in fade-in slide-in-from-top-1" style={{ width: `${192 * uiScale}px`, padding: `${4 * uiScale}px 0` }}>
                  <div style={{ padding: `${4 * uiScale}px ${8 * uiScale}px` }}>
                    <div className="font-bold text-slate-400 dark:text-[#666] uppercase tracking-wider mb-1" style={{ fontSize: `${10 * uiScale}px`, padding: `0 ${8 * uiScale}px` }}>{t('dict.selector.builtin')}</div>
                    <div 
                      className={`rounded cursor-pointer ${prefDictionaryId === '1983_mainland' ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-600 dark:text-[#ccc] hover:bg-slate-50 dark:hover:bg-[#252525]'}`}
                      style={{ padding: `${6 * uiScale}px ${8 * uiScale}px`, fontSize: `${12 * uiScale}px` }}
                      onClick={() => { setPrefDictionaryId('1983_mainland'); setIsDictDropdownOpen(false); }}
                    >
                      {t('settings.dict.1983m')}
                    </div>
                  </div>
                  
                  {customDicts.length > 0 && (
                    <>
                      <div className="bg-slate-100 dark:bg-[#333]" style={{ height: '1px', margin: `${4 * uiScale}px ${8 * uiScale}px` }}></div>
                      <div className="overflow-y-auto custom-scrollbar" style={{ padding: `${4 * uiScale}px ${8 * uiScale}px`, maxHeight: `${160 * uiScale}px` }}>
                        <div className="font-bold text-slate-400 dark:text-[#666] uppercase tracking-wider mb-1" style={{ fontSize: `${10 * uiScale}px`, padding: `0 ${8 * uiScale}px` }}>{t('dict.selector.custom')}</div>
                        {customDicts.map(d => (
                          <div 
                            key={d.id}
                            className={`rounded cursor-pointer truncate ${prefDictionaryId === d.id ? 'bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-medium' : 'text-slate-600 dark:text-[#ccc] hover:bg-slate-50 dark:hover:bg-[#252525]'}`}
                            style={{ padding: `${6 * uiScale}px ${8 * uiScale}px`, fontSize: `${12 * uiScale}px` }}
                            onClick={() => { setPrefDictionaryId(d.id); setIsDictDropdownOpen(false); }}
                            title={d.name}
                          >
                            {d.name}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            
            {prefDictionaryId.startsWith('custom_') && (
              <button onClick={handleDeleteDict} className="text-rose-400 hover:text-rose-500 transition-colors hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded" style={{ padding: `${2 * uiScale}px`, marginLeft: `${4 * uiScale}px` }} title={t('dict.btn.delete')}>
                <Trash2 size={12 * uiScale} />
              </button>
            )}
            
            <div className="bg-slate-200 dark:bg-[#333]" style={{ width: '1px', height: `${12 * uiScale}px`, margin: `0 ${6 * uiScale}px` }}></div>
            
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="text-indigo-500 hover:text-indigo-600 dark:text-indigo-400 flex items-center transition-colors font-medium"
              style={{ gap: `${4 * uiScale}px`, fontSize: `${11 * uiScale}px` }}
              title={t('dict.import.title')}
            >
              <Upload size={12 * uiScale} />
              <span className="hidden sm:inline">{t('dict.btn.import')}</span>
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center bg-slate-200/50 dark:bg-[#2a2a2a] p-1 rounded-lg">
            <button 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${mode === 'text' ? 'bg-white dark:bg-[#333] shadow-sm text-indigo-500 dark:text-indigo-400 font-medium' : 'text-slate-500 dark:text-[#888] hover:text-slate-700 dark:hover:text-[#ccc]'}`}
              onClick={() => setMode('text')}
              style={{ fontSize: `${12 * uiScale}px` }}
            >
              <Keyboard size={14 * uiScale} />
              <span className="hidden sm:inline">{t('translator.mode.text')}</span>
            </button>
            <button 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-all ${mode === 'voice' ? 'bg-white dark:bg-[#333] shadow-sm text-indigo-500 dark:text-indigo-400 font-medium' : 'text-slate-500 dark:text-[#888] hover:text-slate-700 dark:hover:text-[#ccc]'}`}
              onClick={() => setMode('voice')}
              style={{ fontSize: `${12 * uiScale}px` }}
            >
              <Mic size={14 * uiScale} />
              <span className="hidden sm:inline">{t('translator.mode.voice')}</span>
            </button>
          </div>
        </div>
      </div>

      {mode === 'text' ? (
        <>
          {/* Input Panel (Premium Card) */}
          <div className="flex-[0.8] flex flex-col bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2a2a2a] overflow-hidden transition-all hover:shadow-md">
            <div className="flex flex-wrap items-center justify-between px-4 md:px-5 py-2 bg-slate-50/80 dark:bg-[#252526] border-b border-slate-100 dark:border-[#2a2a2a]" style={{ minHeight: `${48 * uiScale}px`, gap: `${8 * uiScale}px` }}>
              <div className="flex items-center gap-2 shrink-0 opacity-0 w-0">
                {/* Spacer to keep layout aligned with original */}
              </div>
              
              <div className="flex flex-wrap items-center justify-end flex-1" style={{ gap: `${8 * uiScale}px` }}>
                {/* Font Size Adjuster */}
                <FontSizeAdjuster fontSize={fontSize} setFontSize={setFontSize} uiScale={uiScale} />

                {inputType !== 'none' && (
                  <div className="shrink-0 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 font-bold tracking-widest uppercase flex items-center" style={{ fontSize: `${10 * uiScale}px`, padding: `${4 * uiScale}px ${8 * uiScale}px`, gap: `${6 * uiScale}px` }}>
                    <span className="rounded-full bg-indigo-500 animate-pulse" style={{ width: `${6 * uiScale}px`, height: `${6 * uiScale}px` }}></span>
                    <span className="hidden sm:inline">{inputType === 'chinese' ? 'Text' : inputType === 'codes' ? 'Codes' : 'Morse'}</span>
                  </div>
                )}
              </div>
            </div>
            <textarea
              style={{ fontSize: `${effectiveFontSize}px` }}
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
                <OutputCard title={t('translator.chinese')} content={chineseOutput} visible={inputType !== 'chinese'} icon={MessageSquare} colorClass="text-emerald-500" uiScale={uiScale} effectiveFontSize={effectiveFontSize} />
                <OutputCard title={t('translator.codes')} content={codesOutput} visible={inputType !== 'codes'} icon={Hash} colorClass="text-blue-500" uiScale={uiScale} effectiveFontSize={effectiveFontSize} />
              </>
            )}
          </div>
        </>
      ) : (
        /* Voice Mode UI */
        <div className="flex-1 flex flex-col bg-white dark:bg-[#1e1e1e] rounded-2xl shadow-sm border border-slate-200 dark:border-[#2a2a2a] overflow-hidden relative">
          
          {/* Chat History Area */}
          <div 
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar flex flex-col gap-6"
            style={{ paddingBottom: `${120 * uiScale}px` }}
          >
            {conversationHistory.length === 0 && !isListening && (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 dark:text-[#666]">
                <Mic size={48} className="mb-4 opacity-20" />
                <p>{t('translator.voice.tapToTalk')}</p>
              </div>
            )}
            
            {conversationHistory.map(item => (
              <div key={item.id} className="group flex flex-col gap-2 border-b border-slate-100 dark:border-[#2a2a2a] pb-4 last:border-0 last:pb-0 transition-opacity">
                {/* User Input (Original Text) */}
                <div className="flex items-start gap-3">
                  <div className="mt-1 shrink-0 bg-slate-100 dark:bg-[#333] text-slate-400 dark:text-[#666] text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest select-none">
                    ZH
                  </div>
                  <p style={{ fontSize: `${effectiveFontSize}px` }} className="break-words font-sans text-slate-800 dark:text-[#e0e0e0] leading-relaxed flex-1">
                    {item.text}
                  </p>
                </div>
                {/* Bot Translation (Codes) */}
                <div className="flex items-start gap-3">
                  <div className="mt-1 shrink-0 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest select-none">
                    CODE
                  </div>
                  <p style={{ fontSize: `${effectiveFontSize}px` }} className="break-words font-mono text-indigo-600 dark:text-indigo-400 leading-relaxed flex-1">
                    {item.codes}
                  </p>
                </div>
              </div>
            ))}

            {/* Interim Transcript */}
            {isListening && transcript && (
              <div className="flex items-start gap-3 animate-pulse opacity-70">
                <div className="mt-1 shrink-0 bg-slate-100 dark:bg-[#333] text-slate-400 dark:text-[#666] text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-widest select-none">
                  ZH
                </div>
                <p style={{ fontSize: `${effectiveFontSize}px` }} className="break-words font-sans text-slate-500 dark:text-[#aaa] leading-relaxed flex-1">
                  {transcript}
                </p>
              </div>
            )}
            {error && (
              <div className="self-center bg-rose-50 dark:bg-rose-500/10 text-rose-500 px-4 py-2 rounded-full text-sm mt-4">
                {error === 'not-supported' ? t('translator.voice.notsupported') : t('translator.voice.error')}
              </div>
            )}
          </div>

          {/* Bottom Voice Control */}
          <div className="absolute bottom-0 left-0 right-0 p-4 md:p-6 bg-gradient-to-t from-white via-white to-transparent dark:from-[#1e1e1e] dark:via-[#1e1e1e] dark:to-transparent flex flex-col items-center justify-end pointer-events-none">
            <div className="pointer-events-auto flex flex-col items-center gap-3">
              <span className={`text-sm font-medium transition-opacity ${isListening ? 'text-indigo-500 opacity-100' : 'text-slate-400 opacity-0'}`}>
                {t('translator.voice.listening')}
              </span>
              <button
                onClick={toggleMic}
                className={`relative group flex items-center justify-center rounded-full transition-all duration-300 ${isListening ? 'bg-indigo-500 text-white scale-110 shadow-lg shadow-indigo-500/30' : 'bg-slate-100 dark:bg-[#333] text-slate-500 dark:text-[#aaa] hover:bg-indigo-50 dark:hover:bg-[#252525] hover:text-indigo-500 shadow-sm'}`}
                style={{ width: `${64 * uiScale}px`, height: `${64 * uiScale}px` }}
              >
                {/* Ripple Effect */}
                {isListening && (
                  <>
                    <span className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20" style={{ animationDuration: '1.5s' }}></span>
                    <span className="absolute inset-0 rounded-full bg-indigo-500 animate-ping opacity-20" style={{ animationDuration: '1.5s', animationDelay: '0.5s' }}></span>
                  </>
                )}
                <Mic size={28 * uiScale} className="relative z-10" />
              </button>
            </div>
          </div>

        </div>
      )}
      
      <ImportDictModal 
        isOpen={isImportModalOpen} 
        onClose={() => setIsImportModalOpen(false)} 
        onImport={handleImportFile} 
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Moon, Sun, Monitor, Languages, Hash, Radio } from 'lucide-react';
import { chineseToCodes, codesToMorse, morseToCodes, codesToChinese, isMainlyMorse, isMainlyCodes } from './utils/translator';

function App() {
  const [inputText, setInputText] = useState('');
  const [inputType, setInputType] = useState('none'); // 'chinese', 'codes', 'morse', 'none'
  const [chineseOutput, setChineseOutput] = useState('');
  const [codesOutput, setCodesOutput] = useState('');
  const [morseOutput, setMorseOutput] = useState('');
  const [dictionary, setDictionary] = useState(null);
  
  // Theme state: 'light', 'dark', 'system'
  const [theme, setTheme] = useState('system');

  useEffect(() => {
    // Check local storage for theme
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) {
      setTheme(storedTheme);
    }
  }, []);

  useEffect(() => {
    // Apply theme
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
    
    if (theme !== 'system') {
      localStorage.setItem('theme', theme);
    } else {
      localStorage.removeItem('theme');
    }
  }, [theme]);

  useEffect(() => {
    fetch('/dict/mapping.json')
      .then(res => res.json())
      .then(data => setDictionary(data))
      .catch(err => console.error("Failed to load dictionary", err));
  }, []);

  const handleInputChange = (e) => {
    const text = e.target.value;
    setInputText(text);

    if (!dictionary) return;

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
    } else if (isMainlyCodes(text)) {
      setInputType('codes');
      setMorseOutput(codesToMorse(text));
      setChineseOutput(codesToChinese(text, dictionary.codeToChar));
    } else {
      setInputType('chinese');
      const codes = chineseToCodes(text, dictionary.charToCode);
      setCodesOutput(codes);
      setMorseOutput(codesToMorse(codes));
    }
  };

  if (!dictionary) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 md:w-16 md:h-16 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <div className="text-xl md:text-2xl font-bold tracking-wide">加载字典中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-12 transition-colors duration-300 flex flex-col">
      <div className="max-w-6xl mx-auto space-y-8 md:space-y-12 flex-1 w-full">
        {/* Header Area */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 pb-6 md:pb-8 border-b-2 border-slate-200 dark:border-slate-800">
          <div>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 pb-1 md:pb-2">
              摩语 (MoYu)
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 font-bold mt-2">中文 · 标准电码 · 摩尔斯码实时引擎</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 w-full md:w-auto justify-between md:justify-end">
            {/* Dictionary Hover Dropdown */}
            <div className="relative group">
              <button 
                className="flex items-center gap-1.5 px-4 md:px-5 py-2 md:py-2.5 text-sm md:text-base font-bold text-indigo-800 bg-indigo-100 dark:text-indigo-200 dark:bg-indigo-900/50 rounded-full shadow-md border-2 border-indigo-200 dark:border-indigo-700 transition-colors hover:bg-indigo-200 dark:hover:bg-indigo-800/60 focus:outline-none"
                title="选择字典数据源"
              >
                📚 字典
                <svg className="w-4 h-4 ml-1 opacity-70 group-hover:rotate-180 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19 9l-7 7-7-7"></path></svg>
              </button>
              
              {/* Dropdown Menu (Visible on Hover) */}
              <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 border-2 border-slate-200 dark:border-slate-700 opacity-0 invisible group-hover:opacity-100 group-hover:visible translate-y-2 group-hover:translate-y-0 transition-all duration-300 z-50 overflow-hidden">
                <div className="py-1">
                  <div className="px-4 py-3 text-xs md:text-sm font-bold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 cursor-pointer flex items-center justify-between">
                    <span>{dictionary.name.includes('1983') ? '1983大陆版' : dictionary.name}</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></span>
                  </div>
                  <div className="px-4 py-3 text-xs md:text-sm font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    1983台湾版 <span className="text-[10px] ml-1 opacity-70">(待添加)</span>
                  </div>
                  <div className="px-4 py-3 text-xs md:text-sm font-medium text-slate-400 dark:text-slate-500 cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors border-t border-slate-100 dark:border-slate-700/50">
                    自定义加密字典 <span className="text-[10px] ml-1 opacity-70">(待添加)</span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Theme Toggle */}
            <div className="flex items-center p-1.5 bg-slate-200/80 dark:bg-slate-800/80 rounded-full shadow-inner border-2 border-slate-300 dark:border-slate-700">
              <button 
                onClick={() => setTheme('light')}
                className={`p-2 md:p-3 rounded-full transition-all duration-200 ${theme === 'light' ? 'bg-white shadow-md text-amber-600 scale-110' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="亮色模式"
              >
                <Sun size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.5} />
              </button>
              <button 
                onClick={() => setTheme('system')}
                className={`p-2 md:p-3 rounded-full transition-all duration-200 ${theme === 'system' ? 'bg-white dark:bg-slate-700 shadow-md text-indigo-600 dark:text-indigo-400 scale-110' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="跟随系统"
              >
                <Monitor size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.5} />
              </button>
              <button 
                onClick={() => setTheme('dark')}
                className={`p-2 md:p-3 rounded-full transition-all duration-200 ${theme === 'dark' ? 'bg-slate-700 shadow-md text-blue-400 scale-110' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'}`}
                title="暗色模式"
              >
                <Moon size={20} className="md:w-[24px] md:h-[24px]" strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
          
          {/* Input Section */}
          <section className="flex flex-col space-y-4 md:space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-xl md:text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
                <span className="p-2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-lg shadow-sm border border-indigo-200 dark:border-indigo-800">
                  <Languages size={24} className="md:w-7 md:h-7" />
                </span>
                智能输入区
              </h2>
              <span className="text-sm md:text-base font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-3 py-1 rounded-md">
                自动识别 中文 / 数字 / 摩尔斯
              </span>
            </div>
            
            <textarea
              className="w-full flex-1 min-h-[180px] sm:min-h-[250px] md:min-h-[350px] p-5 md:p-8 text-xl md:text-2xl bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-2xl md:rounded-3xl shadow-xl shadow-slate-200/50 dark:shadow-black/50 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 dark:focus:ring-indigo-500/40 focus:border-indigo-500 transition-all resize-y text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 custom-scrollbar font-medium leading-relaxed"
              placeholder="欢迎使用 MoYu 智能翻译！&#10;&#10;请直接在这里输入：&#10;1. 中文汉字（例如：你好）&#10;2. 标准数字电码（例如：0375 0048）&#10;3. 摩尔斯码（例如：--. --..）&#10;&#10;系统会自动帮您翻译出来哦~"
              value={inputText}
              onChange={handleInputChange}
            />
          </section>

          {/* Outputs Section */}
          <section className="flex flex-col space-y-6 md:space-y-8">
            {inputType === 'none' && (
              <div className="flex-1 flex items-center justify-center bg-slate-100/50 dark:bg-slate-800/20 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl p-10 text-center">
                <p className="text-xl md:text-2xl text-slate-500 dark:text-slate-400 font-bold">
                  左侧输入内容后，此处将自动显示翻译结果
                </p>
              </div>
            )}
            
            {inputType !== 'chinese' && inputType !== 'none' && 
             chineseOutput.replace(/\s+/g, '') !== codesOutput.replace(/\s+/g, '') && (
              <OutputCard 
                icon={<Languages size={22} className="md:w-6 md:h-6" />}
                title="中文 (Chinese)" 
                content={chineseOutput} 
                themeColor="emerald" 
              />
            )}
            
            {inputType !== 'codes' && inputType !== 'none' && (
              <OutputCard 
                icon={<Hash size={22} className="md:w-6 md:h-6" />}
                title="标准电码 (Codes)" 
                content={codesOutput} 
                themeColor="amber" 
              />
            )}
            
            {inputType !== 'morse' && inputType !== 'none' && (
              <OutputCard 
                icon={<Radio size={22} className="md:w-6 md:h-6" />}
                title="摩尔斯码 (Morse)" 
                content={morseOutput} 
                themeColor="blue" 
              />
            )}
          </section>
        </div>
      </div>
      
      {/* Footer with ICP License */}
      <footer className="w-full text-center mt-auto pt-10 pb-4">
        <a 
          href="https://beian.miit.gov.cn/" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="text-xs md:text-sm font-medium text-slate-400 hover:text-indigo-500 dark:text-slate-500 dark:hover:text-indigo-400 transition-colors duration-300"
        >
          蜀ICP备2021007588号-2
        </a>
      </footer>
    </div>
  );
}

function OutputCard({ icon, title, content, themeColor }) {
  const colors = {
    emerald: 'from-emerald-500/15 to-emerald-500/5 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 focus-within:ring-emerald-500/30 focus-within:border-emerald-500',
    amber: 'from-amber-500/15 to-amber-500/5 border-amber-300 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 focus-within:ring-amber-500/30 focus-within:border-amber-500',
    blue: 'from-blue-500/15 to-blue-500/5 border-blue-300 dark:border-blue-800/60 text-blue-800 dark:text-blue-300 focus-within:ring-blue-500/30 focus-within:border-blue-500',
  };

  return (
    <div className={`relative flex flex-col bg-gradient-to-br bg-white dark:bg-slate-900 border-2 rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-lg shadow-slate-200/50 dark:shadow-black/30 transition-all duration-300 hover:scale-[1.01] group ${colors[themeColor]}`}>
      <div className="flex items-center gap-3 mb-3 md:mb-4">
        <div className="p-1.5 md:p-2 rounded-xl bg-white/70 dark:bg-slate-950/70 backdrop-blur-sm shadow-sm border border-black/10 dark:border-white/10">
          {icon}
        </div>
        <h3 className="text-base md:text-lg font-black tracking-widest uppercase opacity-95">
          {title}
        </h3>
      </div>
      <textarea
        readOnly
        className="w-full flex-1 min-h-[100px] md:min-h-[120px] bg-transparent text-slate-900 dark:text-slate-100 p-2 md:p-3 resize-y focus:outline-none text-xl md:text-2xl leading-relaxed rounded-xl font-bold overflow-y-auto custom-scrollbar tracking-wide"
        value={content}
        placeholder="翻译结果..."
      />
    </div>
  );
}

export default App;

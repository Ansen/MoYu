import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/index';
import AboutModal from '../AboutModal';
import { FolderOpen, LogOut, Sun, Moon, Monitor, Languages, Type, Settings, Info, Check, BookOpen, Minus, Square, Copy, X as CloseIcon } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function Titlebar({ theme, setTheme, setView, openSettings, openHelp }) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const menubarRef = useRef(null);
  const { t, langSetting, setLangSetting } = useI18n();

  // 监听窗口最大化状态
  useEffect(() => {
    let unlisten;
    const win = getCurrentWindow();
    win.isMaximized().then(setIsMaximized).catch(() => {});
    
    win.onResized(() => {
      win.isMaximized().then(setIsMaximized).catch(() => {});
    }).then(u => unlisten = u).catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    function handleClickOutside(e) {
      if (menubarRef.current && !menubarRef.current.contains(e.target)) {
        setActiveMenu(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMenuClick = (menuId) => {
    setActiveMenu(activeMenu === menuId ? null : menuId);
  };

  const handleMenuHover = (menuId) => {
    if (activeMenu) setActiveMenu(menuId);
  };

  return (
    <div className="flex flex-col bg-white dark:bg-[#1e1e1e] border-b border-slate-200 dark:border-[#333333] shrink-0 select-none relative z-50">
      
      {/* 菜单栏 (Menubar) */}
      <div 
        className="h-8 flex items-center pl-2 text-[13px] font-medium text-slate-700 dark:text-[#cccccc] relative" 
        ref={menubarRef} 
        data-tauri-drag-region
        onPointerDown={(e) => {
          if (e.buttons === 1 && e.target.hasAttribute('data-tauri-drag-region')) {
            getCurrentWindow().startDragging();
          }
        }}
      >
        
        {/* App Logo / Title */}
        <div className="flex items-center gap-2 mr-4 pointer-events-none" data-tauri-drag-region>
          <img src="/logo.png" className="w-4 h-4 object-contain" alt="MoYu" />
          <span className="font-bold text-slate-900 dark:text-white tracking-wide">摩语</span>
        </div>
        
        {/* 1. 主题 (Theme) */}
        <div className="relative">
          <button 
            onClick={() => handleMenuClick('view')} 
            onMouseEnter={() => handleMenuHover('view')}
            className={`px-3 py-1 rounded-sm transition-colors ${activeMenu === 'view' ? 'bg-slate-300/50 dark:bg-white/10 text-black dark:text-white' : 'hover:bg-slate-200 dark:hover:bg-white/5'}`}
          >
            {t('menu.view')}
          </button>
          {activeMenu === 'view' && (
            <div className="absolute top-full left-0 mt-1.5 w-max flex flex-col gap-0.5 p-1.5 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#333]/80 rounded-xl shadow-2xl shadow-slate-200/40 dark:shadow-black/40 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
              <button 
                className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap hover:bg-indigo-500 hover:text-white transition-colors text-slate-700 dark:text-slate-300 group" 
                onClick={() => { setTheme('system'); setActiveMenu(null); }}
              >
                <Monitor size={15} className="text-slate-400 group-hover:text-white transition-colors" />
                <span className="flex-1">{t('menu.view.system')}</span>
                {theme === 'system' && <Check size={14} className="opacity-80" />}
              </button>
              
              <div className="h-px w-full bg-slate-100 dark:bg-[#333] my-1"></div>
              
              <button 
                className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap hover:bg-indigo-500 hover:text-white transition-colors text-slate-700 dark:text-slate-300 group" 
                onClick={() => { setTheme('light'); setActiveMenu(null); }}
              >
                <Sun size={15} className="text-slate-400 group-hover:text-white transition-colors" />
                <span className="flex-1">{t('menu.view.light')}</span>
                {theme === 'light' && <Check size={14} className="opacity-80" />}
              </button>
              
              <button 
                className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap hover:bg-indigo-500 hover:text-white transition-colors text-slate-700 dark:text-slate-300 group" 
                onClick={() => { setTheme('dark'); setActiveMenu(null); }}
              >
                <Moon size={15} className="text-slate-400 group-hover:text-white transition-colors" />
                <span className="flex-1">{t('menu.view.dark')}</span>
                {theme === 'dark' && <Check size={14} className="opacity-80" />}
              </button>
            </div>
          )}
        </div>

        {/* 3. 语言 (Language) */}
        <div className="relative">
          <button 
            onClick={() => handleMenuClick('lang')} 
            onMouseEnter={() => handleMenuHover('lang')}
            className={`px-3 py-1 rounded-sm transition-colors ${activeMenu === 'lang' ? 'bg-slate-300/50 dark:bg-white/10 text-black dark:text-white' : 'hover:bg-slate-200 dark:hover:bg-white/5'}`}
          >
            {t('menu.language')}
          </button>
          {activeMenu === 'lang' && (
            <div className="absolute top-full left-0 mt-1.5 w-max flex flex-col gap-0.5 p-1.5 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#333]/80 rounded-xl shadow-2xl shadow-slate-200/40 dark:shadow-black/40 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
              <button 
                className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap hover:bg-indigo-500 hover:text-white transition-colors text-slate-700 dark:text-slate-300 group" 
                onClick={() => { setLangSetting('system'); setActiveMenu(null); }}
              >
                <Monitor size={15} className="text-slate-400 group-hover:text-white transition-colors" />
                <span className="flex-1">{t('menu.language.system')}</span>
                {langSetting === 'system' && <Check size={14} className="opacity-80" />}
              </button>
              
              <div className="h-px w-full bg-slate-100 dark:bg-[#333] my-1"></div>
              
              <button 
                className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap hover:bg-indigo-500 hover:text-white transition-colors text-slate-700 dark:text-slate-300 group" 
                onClick={() => { setLangSetting('zh'); setActiveMenu(null); }}
              >
                <Type size={15} className="text-slate-400 group-hover:text-white transition-colors" />
                <span className="flex-1">{t('menu.language.zh')}</span>
                {langSetting === 'zh' && <Check size={14} className="opacity-80" />}
              </button>
              
              <button 
                className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap hover:bg-indigo-500 hover:text-white transition-colors text-slate-700 dark:text-slate-300 group" 
                onClick={() => { setLangSetting('en'); setActiveMenu(null); }}
              >
                <Languages size={15} className="text-slate-400 group-hover:text-white transition-colors" />
                <span className="flex-1">{t('menu.language.en')}</span>
                {langSetting === 'en' && <Check size={14} className="opacity-80" />}
              </button>
            </div>
          )}
        </div>

        {/* 4. 设置 (Settings) */}
        <div className="relative">
          <button 
            onClick={() => handleMenuClick('settings')} 
            onMouseEnter={() => handleMenuHover('settings')}
            className={`px-3 py-1 rounded-sm transition-colors ${activeMenu === 'settings' ? 'bg-slate-300/50 dark:bg-white/10 text-black dark:text-white' : 'hover:bg-slate-200 dark:hover:bg-white/5'}`}
          >
            {t('menu.settings')}
          </button>
          {activeMenu === 'settings' && (
            <div className="absolute top-full left-0 mt-1.5 w-max flex flex-col gap-0.5 p-1.5 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#333]/80 rounded-xl shadow-2xl shadow-slate-200/40 dark:shadow-black/40 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
              <button 
                className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap hover:bg-indigo-500 hover:text-white transition-colors text-slate-700 dark:text-slate-300 group" 
                onClick={() => { openSettings(); setActiveMenu(null); }}
              >
                <Settings size={15} className="text-slate-400 group-hover:text-white transition-colors" />
                <span>{t('menu.settings.prefs')}</span>
              </button>
            </div>
          )}
        </div>
        
        {/* 5. 帮助 (Help) */}
        <div className="relative">
          <button 
            onClick={() => handleMenuClick('help')} 
            onMouseEnter={() => handleMenuHover('help')}
            className={`px-3 py-1 rounded-sm transition-colors ${activeMenu === 'help' ? 'bg-slate-300/50 dark:bg-white/10 text-black dark:text-white' : 'hover:bg-slate-200 dark:hover:bg-white/5'}`}
          >
            {t('menu.help')}
          </button>
          {activeMenu === 'help' && (
            <div className="absolute top-full left-0 mt-1.5 w-max flex flex-col gap-0.5 p-1.5 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-md border border-slate-200/80 dark:border-[#333]/80 rounded-xl shadow-2xl shadow-slate-200/40 dark:shadow-black/40 z-50 animate-in fade-in slide-in-from-top-1 duration-100">
              <button 
                className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap hover:bg-indigo-500 hover:text-white transition-colors text-slate-700 dark:text-slate-300 group" 
                onClick={() => { openHelp(); setActiveMenu(null); }}
              >
                <BookOpen size={15} className="text-slate-400 group-hover:text-white transition-colors" />
                <span>{t('menu.help.guide')}</span>
              </button>
              <button 
                className="w-full text-left px-2.5 py-1.5 rounded-md flex items-center gap-2.5 whitespace-nowrap hover:bg-indigo-500 hover:text-white transition-colors text-slate-700 dark:text-slate-300 group" 
                onClick={() => { setIsAboutOpen(true); setActiveMenu(null); }}
              >
                <Info size={15} className="text-slate-400 group-hover:text-white transition-colors" />
                <span>{t('menu.help.about')}</span>
              </button>
            </div>
          )}
        </div>
        
        {/* Spacer for drag region */}
        <div 
          className="flex-1 h-full" 
          data-tauri-drag-region
          onPointerDown={(e) => {
            if (e.buttons === 1 && e.target.hasAttribute('data-tauri-drag-region')) {
              getCurrentWindow().startDragging();
            }
          }}
        ></div>

        {/* Window Controls (Custom Native Titlebar) */}
        <div className="flex h-full items-center">
          <button 
            onClick={() => getCurrentWindow().minimize()}
            className="h-full px-3.5 hover:bg-slate-200 dark:hover:bg-[#333] transition-colors flex items-center justify-center text-slate-600 dark:text-slate-400"
          >
            <Minus size={14} />
          </button>
          <button 
            onClick={() => getCurrentWindow().toggleMaximize()}
            className="h-full px-3.5 hover:bg-slate-200 dark:hover:bg-[#333] transition-colors flex items-center justify-center text-slate-600 dark:text-slate-400"
            title={isMaximized ? "向下还原" : "最大化"}
          >
            {isMaximized ? <Copy size={13} strokeWidth={2.5} /> : <Square size={13} strokeWidth={2.5} />}
          </button>
          <button 
            onClick={() => getCurrentWindow().close()}
            className="h-full px-4 hover:bg-red-500 hover:text-white transition-colors flex items-center justify-center text-slate-600 dark:text-slate-400"
          >
            <CloseIcon size={14} />
          </button>
        </div>
      </div>

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}

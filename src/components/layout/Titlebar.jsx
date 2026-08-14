import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/index';
import DropdownMenu from '../common/DropdownMenu';
import { Sun, Moon, Monitor, Languages, Type, Settings, Info, Check, BookOpen, Minus, Square, Copy, X as CloseIcon, ChevronDown } from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';

export default function Titlebar({ theme, setTheme, openSettings, openHelp, openAbout }) {
  const [activeMenu, setActiveMenu] = useState(null);
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

  const handleSelect = (id) => {
    if (id === 'settings') openSettings();
    else if (id === 'theme-system') setTheme('system');
    else if (id === 'theme-light') setTheme('light');
    else if (id === 'theme-dark') setTheme('dark');
    else if (id === 'lang-system') setLangSetting('system');
    else if (id === 'lang-zh') setLangSetting('zh');
    else if (id === 'lang-en') setLangSetting('en');
    else if (id === 'guide') openHelp();
    else if (id === 'about') openAbout();
  };

  const appMenuItems = [
    { id: 'settings', icon: Settings, label: t('menu.settings.prefs') },
    { type: 'divider' },
    { 
      id: 'theme', 
      icon: Sun, 
      label: t('menu.view'), 
      submenuItems: [
        { id: 'theme-system', icon: Monitor, label: t('menu.view.system'), checked: theme === 'system', checkIcon: Check },
        { type: 'divider' },
        { id: 'theme-light', icon: Sun, label: t('menu.view.light'), checked: theme === 'light', checkIcon: Check },
        { id: 'theme-dark', icon: Moon, label: t('menu.view.dark'), checked: theme === 'dark', checkIcon: Check },
      ]
    },
    { 
      id: 'lang', 
      icon: Languages, 
      label: t('menu.language'), 
      submenuItems: [
        { id: 'lang-system', icon: Monitor, label: t('menu.language.system'), checked: langSetting === 'system', checkIcon: Check },
        { type: 'divider' },
        { id: 'lang-zh', icon: Type, label: t('menu.language.zh'), checked: langSetting === 'zh', checkIcon: Check },
        { id: 'lang-en', icon: Languages, label: t('menu.language.en'), checked: langSetting === 'en', checkIcon: Check },
      ]
    },
    { type: 'divider' },
    { id: 'guide', icon: BookOpen, label: t('menu.help.guide') },
    { id: 'about', icon: Info, label: t('menu.help.about') }
  ];

  return (
    <div className="flex flex-col bg-white dark:bg-[#1e1e1e] border-b border-slate-200 dark:border-[#333333] shrink-0 select-none relative z-50">
      
      {/* 菜单栏 (Menubar) */}
      <div 
        className="h-8 flex items-center pl-2 text-[13px] font-medium text-slate-700 dark:text-[#cccccc] relative" 
        ref={menubarRef} 
        data-tauri-drag-region
      >
        
        {/* App Brand Menu: [logo] 摩语 ▾ */}
        <div className="relative">
          <button 
            onClick={() => setActiveMenu(activeMenu === 'app' ? null : 'app')} 
            className={`px-2 py-1 rounded flex items-center gap-1.5 transition-colors ${activeMenu === 'app' ? 'bg-slate-200 dark:bg-white/10 text-black dark:text-white' : 'hover:bg-slate-100 dark:hover:bg-white/5'}`}
          >
            <img src="/logo.png" className="w-4 h-4 object-contain" alt="MoYu" />
            <span className="font-bold text-slate-900 dark:text-white tracking-wide">{t('app.name')}</span>
            <ChevronDown size={13} className="text-slate-400 dark:text-slate-500" />
          </button>

          <DropdownMenu 
            isOpen={activeMenu === 'app'}
            items={appMenuItems}
            onSelect={handleSelect}
            onClose={() => setActiveMenu(null)}
          />
        </div>
        
        {/* Spacer for drag region */}
        <div 
          className="flex-1 h-full" 
          data-tauri-drag-region
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
            title={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
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
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { useI18n } from '../../i18n/index';
import AboutModal from '../AboutModal';
import DropdownMenu from '../common/DropdownMenu';
import { Sun, Moon, Monitor, Languages, Type, Settings, Info, Check, BookOpen, Minus, Square, Copy, X as CloseIcon } from 'lucide-react';
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
          <span className="font-bold text-slate-900 dark:text-white tracking-wide">{t('app.name')}</span>
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
          <DropdownMenu 
            isOpen={activeMenu === 'view'}
            items={[
              { id: 'system', icon: Monitor, label: t('menu.view.system'), checked: theme === 'system', checkIcon: Check },
              { type: 'divider' },
              { id: 'light', icon: Sun, label: t('menu.view.light'), checked: theme === 'light', checkIcon: Check },
              { id: 'dark', icon: Moon, label: t('menu.view.dark'), checked: theme === 'dark', checkIcon: Check },
            ]}
            onSelect={(id) => setTheme(id)}
            onClose={() => setActiveMenu(null)}
          />
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
          <DropdownMenu 
            isOpen={activeMenu === 'lang'}
            items={[
              { id: 'system', icon: Monitor, label: t('menu.language.system'), checked: langSetting === 'system', checkIcon: Check },
              { type: 'divider' },
              { id: 'zh', icon: Type, label: t('menu.language.zh'), checked: langSetting === 'zh', checkIcon: Check },
              { id: 'en', icon: Languages, label: t('menu.language.en'), checked: langSetting === 'en', checkIcon: Check },
            ]}
            onSelect={(id) => setLangSetting(id)}
            onClose={() => setActiveMenu(null)}
          />
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
          <DropdownMenu 
            isOpen={activeMenu === 'settings'}
            items={[
              { id: 'settings', icon: Settings, label: t('menu.settings.prefs') }
            ]}
            onSelect={() => openSettings()}
            onClose={() => setActiveMenu(null)}
          />
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
          <DropdownMenu 
            isOpen={activeMenu === 'help'}
            items={[
              { id: 'guide', icon: BookOpen, label: t('menu.help.guide') },
              { id: 'about', icon: Info, label: t('menu.help.about') }
            ]}
            onSelect={(id) => id === 'guide' ? openHelp() : setIsAboutOpen(true)}
            onClose={() => setActiveMenu(null)}
          />
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

      <AboutModal isOpen={isAboutOpen} onClose={() => setIsAboutOpen(false)} />
    </div>
  );
}

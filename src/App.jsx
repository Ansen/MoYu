import React, { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Titlebar from './components/layout/Titlebar';
import Sidebar from './components/layout/Sidebar';
import TranslatorView from './views/Translator';
import LibraryView from './views/Library';
import HomeView from './views/Home';
import SettingsModal from './components/SettingsModal';
import HelpModal from './components/HelpModal';
import AboutModal from './components/AboutModal';
import { useEbook } from './hooks/useEbook';
import { checkForUpdates, installUpdate } from './utils/updater';
import { useI18n } from './i18n';

function App() {
  const [currentView, setView] = useState('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [theme, setTheme] = useState('system');
  const [isReady, setIsReady] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const { t } = useI18n();

  // Lift ebook state up to share between Home and Library
  const ebook = useEbook();

  // 开发者调试工具快捷键 (F12 或 Ctrl+Shift+Alt+D)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
        (e.ctrlKey && e.shiftKey && e.altKey && (e.key === 'D' || e.key === 'd'))
      ) {
        e.preventDefault();
        invoke('toggle_devtools').catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    if (storedTheme) setTheme(storedTheme);

    const startupBehavior = localStorage.getItem('pref_startup') || 'restore';
    
    // Check if it's the very first time launch
    const hasSeenGuide = localStorage.getItem('moyu_has_seen_guide');
    if (!hasSeenGuide) {
      // First launch onboarding: open Help modal directly
      setIsHelpModalOpen(true);
      localStorage.setItem('moyu_has_seen_guide', 'true');
    }
    
    if (startupBehavior === 'restore') {
      const lastView = localStorage.getItem('moyu_last_view');
      if (lastView && ['home', 'translator', 'library'].includes(lastView)) {
        setView(lastView);
      }
    }
    setIsReady(true);

    // Silent update check
    // Silent update check
    setTimeout(() => {
      checkForUpdates().then(({ hasUpdate, updateInfo }) => {
        if (hasUpdate) {
          setUpdateInfo(updateInfo);
        }
      }).catch(() => {});
    }, 2000); // Wait 2s to not block startup
  }, []);

  // Save current view on change
  useEffect(() => {
    if (isReady) {
      localStorage.setItem('moyu_last_view', currentView);
    }
  }, [currentView, isReady]);

  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Apply theme to document root element
  const applyDocumentTheme = (targetTheme) => {
    const root = window.document.documentElement;
    let isDark = false;
    if (targetTheme === 'system') {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    } else {
      isDark = targetTheme === 'dark';
    }

    if (isDark) {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  };

  // 1. Sync theme changes to DOM and persistence
  useEffect(() => {
    applyDocumentTheme(theme);

    if (theme !== 'system') {
      localStorage.setItem('theme', theme);
    } else {
      localStorage.removeItem('theme');
    }
  }, [theme]);

  // 2. Listen for OS theme changes (only active when current setting is 'system')
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (themeRef.current === 'system') {
        applyDocumentTheme('system');
      }
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    } else {
      mediaQuery.addListener(handleSystemThemeChange);
      return () => mediaQuery.removeListener(handleSystemThemeChange);
    }
  }, []);

  // Disable default document scrolling to make it feel like an app
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-[#1e1e1e] transition-colors select-none text-slate-800 dark:text-slate-200">
      <Titlebar 
        theme={theme} 
        setTheme={setTheme} 
        setView={setView} 
        openSettings={() => setSettingsOpen(true)}
        openHelp={() => setIsHelpModalOpen(true)}
        openAbout={() => setIsAboutOpen(true)}
        activeDoc={ebook.bookData}
      />
      
      <div className="flex flex-1 min-h-0">
        <Sidebar currentView={currentView} setView={setView} openAbout={() => setIsAboutOpen(true)} />
        
        <main className="flex-1 relative overflow-hidden bg-white dark:bg-[#1e1e1e]">
          {isReady && currentView === 'home' && (
            <HomeView 
              setView={setView} 
              recentFiles={ebook.recentFiles} 
              openFileProgrammatically={ebook.openFileProgrammatically} 
            />
          )}
          {isReady && currentView === 'translator' && <TranslatorView />}
          {isReady && currentView === 'library' && <LibraryView ebook={ebook} />}
        </main>
      </div>

      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
      />
      <HelpModal 
        isOpen={isHelpModalOpen} 
        onClose={() => setIsHelpModalOpen(false)} 
      />
      <AboutModal 
        isOpen={isAboutOpen} 
        onClose={() => setIsAboutOpen(false)} 
      />
      
      {/* Update Banner */}
      {updateInfo && (
        <div className="fixed bottom-6 right-6 z-50 bg-white dark:bg-[#252525] shadow-2xl rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-4 animate-in slide-in-from-bottom-5 fade-in duration-300 w-84 max-w-[90vw]">
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-bold text-indigo-600 dark:text-indigo-400 text-sm flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              {t('update.available')} (v{updateInfo.version})
            </h3>
            <button onClick={() => setUpdateInfo(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
          
          {/* Release Notes Preview */}
          {(updateInfo.body || updateInfo.notes) && (
            <div className="my-2 p-2.5 bg-slate-50 dark:bg-[#1a1a1a] rounded-lg border border-slate-100 dark:border-[#333333] max-h-32 overflow-y-auto custom-scrollbar text-[12px] text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
              {updateInfo.body || updateInfo.notes}
            </div>
          )}

          <div className="flex mt-3">
            <button 
              onClick={async () => {
                const btn = document.getElementById('btn-silent-update');
                if (btn) btn.innerText = t('update.downloading');
                try {
                  await installUpdate(updateInfo);
                } catch {
                  if (btn) btn.innerText = t('update.failed');
                }
              }}
              id="btn-silent-update"
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-center shadow-xs"
            >
              {t('update.install.restart')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

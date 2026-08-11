import React, { useState, useEffect } from 'react';
import Titlebar from './components/layout/Titlebar';
import Sidebar from './components/layout/Sidebar';
import TranslatorView from './views/Translator';
import LibraryView from './views/Library';
import HomeView from './views/Home';
import SettingsModal from './components/SettingsModal';
import HelpModal from './components/HelpModal';
import { useEbook } from './hooks/useEbook';

function App() {
  const [currentView, setView] = useState('home');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [theme, setTheme] = useState('system');
  const [isReady, setIsReady] = useState(false);

  // Lift ebook state up to share between Home and Library
  const ebook = useEbook();

  // Startup behavior & theme initialization
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
  }, []);

  // Save current view on change
  useEffect(() => {
    if (isReady) {
      localStorage.setItem('moyu_last_view', currentView);
    }
  }, [currentView, isReady]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');

    let resolvedTheme = theme;
    if (theme === 'system') {
      resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    
    root.classList.add(resolvedTheme);
    
    // Update native Tauri window theme so the titlebar matches
    try {
      import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
        getCurrentWindow().setTheme(theme === 'system' ? null : theme).catch(() => {});
      }).catch(() => {});
    } catch (e) {}
    
    if (theme !== 'system') {
      localStorage.setItem('theme', theme);
    } else {
      localStorage.removeItem('theme');
    }
  }, [theme]);

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
      />
      
      <div className="flex flex-1 min-h-0">
        <Sidebar currentView={currentView} setView={setView} />
        
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
    </div>
  );
}

export default App;

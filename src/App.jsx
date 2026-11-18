import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { invoke } from '@tauri-apps/api/core';
import Titlebar from './components/layout/Titlebar';
import Sidebar from './components/layout/Sidebar';
import HomeView from './views/Home';
import { useEbook } from './hooks/useEbook';
import { useI18n } from './i18n';

const loadTranslatorView = () => import('./views/Translator');
const loadLibraryView = () => import('./views/Library');

const TranslatorView = lazy(loadTranslatorView);
const LibraryView = lazy(loadLibraryView);
const SettingsModal = lazy(() => import('./components/SettingsModal'));
const HelpModal = lazy(() => import('./components/HelpModal'));
const AboutModal = lazy(() => import('./components/AboutModal'));

function getInitialTheme() {
  try {
    return localStorage.getItem('theme') || 'system';
  } catch {
    return 'system';
  }
}

function getInitialView() {
  try {
    const startupBehavior = localStorage.getItem('pref_startup') || 'restore';
    if (startupBehavior === 'restore') {
      const lastView = localStorage.getItem('moyu_last_view');
      if (lastView && ['home', 'translator', 'library'].includes(lastView)) {
        return lastView;
      }
    }
  } catch {
    // 忽略存储异常
  }
  return 'home';
}

function resolveIsDark(targetTheme) {
  if (targetTheme === 'system') {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  }
  return targetTheme === 'dark';
}

function App() {
  const [currentView, setView] = useState(getInitialView);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [theme, setTheme] = useState(getInitialTheme);
  const [updateInfo, setUpdateInfo] = useState(null);
  const { t } = useI18n();

  // Lift ebook state up to share between Home and Library
  const ebook = useEbook();

  // 开发者调试工具快捷键 (仅在开发环境中允许 F12 / Ctrl+Shift+I 唤出；正式版本全局拦截并禁用 F12 避免调出控制台)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (
        e.key === 'F12' || 
        (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) ||
        (e.ctrlKey && e.shiftKey && e.altKey && (e.key === 'D' || e.key === 'd'))
      ) {
        e.preventDefault();
        if (import.meta.env.DEV) {
          invoke('toggle_devtools').catch(() => {});
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    // Check if it's the very first time launch
    const hasSeenGuide = localStorage.getItem('moyu_has_seen_guide');
    if (!hasSeenGuide) {
      // First launch onboarding: open Help modal directly
      setIsHelpModalOpen(true);
      localStorage.setItem('moyu_has_seen_guide', 'true');
    }

    // Silent update check
    const updateTimer = setTimeout(() => {
      import('./utils/updater')
        .then(({ checkForUpdates }) => checkForUpdates())
        .then(({ hasUpdate, updateInfo }) => {
          if (hasUpdate) {
            setUpdateInfo(updateInfo);
          }
        })
        .catch(() => {});
    }, 2000); // Wait 2s to not block startup
    return () => clearTimeout(updateTimer);
  }, []);

  // Save current view on change
  useEffect(() => {
    localStorage.setItem('moyu_last_view', currentView);
  }, [currentView]);

  const themeRef = useRef(theme);
  themeRef.current = theme;

  // Apply theme to document root element
  const applyDocumentTheme = (targetTheme) => {
    const root = window.document.documentElement;
    const isDark = resolveIsDark(targetTheme);

    if (isDark) {
      root.classList.remove('light');
      root.classList.add('dark');
      root.style.backgroundColor = '#1e1e1e';
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
      root.style.backgroundColor = '#ffffff';
    }
  };

  // 首帧挂载后立即通过 DWM Cloak 唤醒 WebView2 GPU 合成首帧，确认绘制完成即瞬时揭开
  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return;
    }

    let cancelled = false;
    let rafId = null;
    let raceTimer = null;
    let prefetchTimer = null;

    const waitPaintFrames = (frameCount) =>
      new Promise((resolve) => {
        let remaining = frameCount;
        const step = () => {
          if (cancelled) {
            resolve();
            return;
          }
          remaining -= 1;
          if (remaining <= 0) {
            resolve();
          } else {
            rafId = requestAnimationFrame(step);
          }
        };
        rafId = requestAnimationFrame(step);
      });

    const revealWithCompositorWarmup = async () => {
      // 若启动恢复到非首页视图，等待目标懒加载视图就绪并完成 React 提交后再统计布局
      const initialView = getInitialView();
      if (initialView === 'translator') {
        await loadTranslatorView();
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 0));
      } else if (initialView === 'library') {
        await loadLibraryView();
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (cancelled) return;

      // 强制同步刷新一次布局，确保首帧样式已计算
      void document.documentElement.offsetHeight;

      const isDark = resolveIsDark(themeRef.current);
      try {
        await invoke('show_main_window', { isDark });
        if (cancelled) return;
        try {
          await Promise.race([
            waitPaintFrames(2),
            new Promise((resolve) => {
              raceTimer = setTimeout(resolve, 80);
            }),
          ]);
        } finally {
          if (raceTimer !== null) {
            clearTimeout(raceTimer);
            raceTimer = null;
          }
        }
        if (!cancelled) {
          await invoke('uncloak_main_window');
          // 窗口可见后空闲预热其余子视图，兼顾冷启动速度与切换即时感
          prefetchTimer = setTimeout(() => {
            loadTranslatorView().catch(() => {});
            loadLibraryView().catch(() => {});
          }, 1200);
        }
      } catch {
        // 忽略窗口控制异常，后端设有兜底解封超时
      }
    };

    revealWithCompositorWarmup();

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (raceTimer !== null) clearTimeout(raceTimer);
      if (prefetchTimer !== null) clearTimeout(prefetchTimer);
    };
  }, []);

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
          {currentView === 'home' && (
            <HomeView 
              setView={setView} 
              recentFiles={ebook.recentFiles} 
              openFileProgrammatically={ebook.openFileProgrammatically} 
            />
          )}
          <Suspense fallback={null}>
            {currentView === 'translator' && <TranslatorView />}
            {currentView === 'library' && <LibraryView ebook={ebook} />}
          </Suspense>
        </main>
      </div>

      <Suspense fallback={null}>
        {settingsOpen && (
          <SettingsModal 
            isOpen={settingsOpen} 
            onClose={() => setSettingsOpen(false)} 
          />
        )}
        {isHelpModalOpen && (
          <HelpModal 
            isOpen={isHelpModalOpen} 
            onClose={() => setIsHelpModalOpen(false)} 
          />
        )}
        {isAboutOpen && (
          <AboutModal 
            isOpen={isAboutOpen} 
            onClose={() => setIsAboutOpen(false)} 
          />
        )}
      </Suspense>
      
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
                  const { installUpdate } = await import('./utils/updater');
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

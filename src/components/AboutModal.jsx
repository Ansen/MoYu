import React, { useEffect, useState } from 'react';
import { X, Mail, Globe, Info } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { checkForUpdates, installUpdate } from '../utils/updater';
import { useI18n } from '../i18n';

const GithubIcon = ({ size = 16, className = "" }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

export default function AboutModal({ isOpen, onClose }) {
  const [version, setVersion] = useState('v...');
  const { t } = useI18n();
  const [updateStatus, setUpdateStatus] = useState('idle'); // idle, checking, available, installing, uptodate, error
  const [latestVer, setLatestVer] = useState('');
  const [updateObj, setUpdateObj] = useState(null);
  const [installProgress, setInstallProgress] = useState(null);

  useEffect(() => {
    getVersion().then(v => setVersion('v' + v)).catch(() => setVersion('v1.0.0'));
  }, []);

  const handleCheckUpdate = async () => {
    try {
      setUpdateStatus('checking');
      setInstallProgress(null);
      const { hasUpdate, updateInfo } = await checkForUpdates();
      if (hasUpdate) {
        setLatestVer(updateInfo.version);
        setUpdateObj(updateInfo);
        setUpdateStatus('available');
      } else {
        setUpdateStatus('uptodate');
      }
    } catch (err) {
      setUpdateStatus('error');
    }
  };

  const handleInstall = async () => {
    if (!updateObj) return;
    try {
      setUpdateStatus('installing');
      await installUpdate(updateObj, (downloaded, total) => {
        setInstallProgress({ downloaded, total });
      });
    } catch (e) {
      console.error(e);
      setUpdateStatus('error');
    }
  };

  // ESC key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-sm bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-[#333333]">
        
        {/* Header Background */}
        <div className="h-28 bg-gradient-to-br from-indigo-600 to-slate-900 relative flex flex-col items-center justify-center pt-2">
          <img src="/logo.png" className="w-10 h-10 object-contain drop-shadow-md mb-1" alt="MoYu Logo" />
          <h1 className="text-2xl font-extrabold text-white tracking-wider drop-shadow-md z-10 flex items-center gap-2">
            MoYu 摩语
          </h1>
          <button 
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-full bg-black/20 text-white/80 hover:bg-black/40 hover:text-white transition-colors z-20"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 pt-5">
          <div className="text-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 dark:text-[#eeeeee]">{version}</h2>
            <p className="text-[13px] text-slate-500 dark:text-[#999999] mt-1">{t('home.subtitle')}</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-100 dark:border-[#2a2a2a]">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                <Info size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{t('about.author')}</p>
                <p className="text-[14px] font-medium text-slate-700 dark:text-[#cccccc] truncate">BA8BAK</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-100 dark:border-[#2a2a2a]">
              <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center shrink-0">
                <GithubIcon size={16} className="text-purple-600 dark:text-purple-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{t('about.repo')}</p>
                <a 
                  href="https://github.com/Ansen/MoYu" 
                  target="_blank" rel="noopener noreferrer"
                  className="text-[14px] font-medium text-purple-600 dark:text-purple-400 hover:underline truncate block"
                >
                  https://github.com/Ansen/MoYu
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-100 dark:border-[#2a2a2a]">
              <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center shrink-0">
                <Globe size={16} className="text-sky-600 dark:text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{t('about.website')}</p>
                <a 
                  href="https://ba8bak.de" 
                  target="_blank" rel="noopener noreferrer"
                  className="text-[14px] font-medium text-sky-600 dark:text-sky-400 hover:underline truncate block"
                >
                  https://ba8bak.de
                </a>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-100 dark:border-[#2a2a2a]">
              <div className="w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center shrink-0">
                <Mail size={16} className="text-rose-600 dark:text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">{t('about.email')}</p>
                <a 
                  href="mailto:cq.ba8bak@gmail.com" 
                  className="text-[14px] font-medium text-rose-600 dark:text-rose-400 hover:underline truncate block"
                >
                  cq.ba8bak@gmail.com
                </a>
              </div>
            </div>
          </div>
          
          <div className="mt-6 flex flex-col items-center">
            {updateStatus === 'idle' || updateStatus === 'error' || updateStatus === 'uptodate' ? (
              <button 
                onClick={handleCheckUpdate}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-sm"
              >
                {t('update.check')}
              </button>
            ) : updateStatus === 'checking' ? (
              <div className="flex items-center gap-2 text-sm text-indigo-600 dark:text-indigo-400">
                <span className="animate-spin h-4 w-4 border-2 border-indigo-600 border-t-transparent rounded-full"></span>
                {t('update.checking')}
              </div>
            ) : updateStatus === 'available' ? (
              <div className="w-full flex flex-col items-center space-y-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
                  {t('update.available')} (v{latestVer})
                </p>
                <div className="flex gap-2 w-full">
                  <button 
                    onClick={handleInstall}
                    className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors text-center"
                  >
                    {t('update.install.restart')}
                  </button>
                </div>
              </div>
            ) : updateStatus === 'installing' ? (
              <div className="w-full flex flex-col items-center space-y-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800/30">
                <p className="text-sm font-bold text-indigo-700 dark:text-indigo-400">
                  {t('update.downloading')}
                </p>
                {installProgress && installProgress.total > 0 && (
                  <div className="w-full">
                    <div className="w-full bg-indigo-200 dark:bg-indigo-900 rounded-full h-1.5 mb-1">
                      <div 
                        className="bg-indigo-600 h-1.5 rounded-full" 
                        style={{ width: `${Math.min(100, Math.round((installProgress.downloaded / installProgress.total) * 100))}%` }}
                      ></div>
                    </div>
                    <p className="text-[10px] text-center text-indigo-500">
                      {Math.round(installProgress.downloaded / 1024 / 1024 * 10) / 10} MB / {Math.round(installProgress.total / 1024 / 1024 * 10) / 10} MB
                    </p>
                  </div>
                )}
              </div>
            ) : null}
            
            {updateStatus === 'uptodate' && (
              <p className="mt-2 text-xs text-green-600 dark:text-green-400 font-medium">{t('update.uptodate')}</p>
            )}
            {updateStatus === 'error' && (
              <p className="mt-2 text-xs text-rose-500 font-medium">{t('update.failed')}</p>
            )}
          </div>
          
          <div className="mt-6 text-center">
            <p className="text-[11px] text-slate-400 dark:text-[#666666]">
              &copy; {new Date().getFullYear()} BA8BAK. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

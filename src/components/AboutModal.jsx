import React, { useEffect, useState } from 'react';
import { X, Mail, Globe, Info } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';

export default function AboutModal({ isOpen, onClose }) {
  const [version, setVersion] = useState('v...');

  useEffect(() => {
    getVersion().then(v => setVersion('v' + v)).catch(() => setVersion('v1.0.0'));
  }, []);

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
            <p className="text-[13px] text-slate-500 dark:text-[#999999] mt-1">Professional Morse Code Training Terminal</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-100 dark:border-[#2a2a2a]">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center shrink-0">
                <Info size={16} className="text-indigo-600 dark:text-indigo-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">作者 (Author)</p>
                <p className="text-[14px] font-medium text-slate-700 dark:text-[#cccccc] truncate">BA8BAK</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-[#222222] border border-slate-100 dark:border-[#2a2a2a]">
              <div className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center shrink-0">
                <Globe size={16} className="text-sky-600 dark:text-sky-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">网站 (Website)</p>
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
                <p className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider">联系邮箱 (Email)</p>
                <a 
                  href="mailto:cq.ba8bak@gmail.com" 
                  className="text-[14px] font-medium text-rose-600 dark:text-rose-400 hover:underline truncate block"
                >
                  cq.ba8bak@gmail.com
                </a>
              </div>
            </div>
          </div>
          
          <div className="mt-8 text-center">
            <p className="text-[11px] text-slate-400 dark:text-[#666666]">
              &copy; {new Date().getFullYear()} BA8BAK. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

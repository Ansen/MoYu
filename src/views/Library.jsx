import React from 'react';
import Reader from '../components/Reader';
import { FileText, Folder, Clock, PlusCircle } from 'lucide-react';
import { useI18n } from '../i18n/index';

export default function LibraryView({ ebook }) {
  const { 
    bookData, loading, openBookDialog, openFolderDialog, 
    closeBook, recentFiles, openFileProgrammatically, jumpToSibling,
    clearRecentFiles, removeRecentFile
  } = ebook;
  const { t } = useI18n();

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1e1e1e]">
      
      {/* 书库列表区 / 最近打开 */}
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        {recentFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-[#555555] select-none space-y-6">
            <FileText size={48} className="opacity-30" strokeWidth={1} />
            <div className="text-center">
              <p className="text-[15px] font-semibold text-slate-600 dark:text-[#cccccc] mb-2">{t('library.empty.title')}</p>
              <p className="text-[13px] text-slate-400 dark:text-[#777777]">{t('library.empty.desc')}</p>
            </div>
            <div className="flex gap-4 mt-8">
              <button 
                onClick={openBookDialog}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all font-medium text-[13px]"
              >
                <PlusCircle size={18} />
                {loading ? t('library.opening') : t('library.import.file')}
              </button>
              <button 
                onClick={openFolderDialog}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all font-medium text-[13px]"
              >
                <Folder size={18} />
                {t('library.import.folder')}
              </button>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto select-none space-y-8">
            
            {/* Primary Action Buttons */}
            <div className="flex items-center gap-4 border-b border-slate-200 dark:border-[#333333] pb-6">
              <button 
                onClick={openBookDialog}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all font-medium text-[13px]"
              >
                <PlusCircle size={16} />
                {loading ? t('library.opening') : t('library.import.file')}
              </button>
              <button 
                onClick={openFolderDialog}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all font-medium text-[13px]"
              >
                <Folder size={16} />
                {t('library.import.folder')}
              </button>
            </div>

            {/* Recent Files List */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-slate-500 dark:text-[#888888]">
                  <Clock size={16} />
                  <h2 className="text-[13px] font-bold uppercase tracking-wider">{t('library.recent')}</h2>
                </div>
                {recentFiles.length > 0 && (
                  <button 
                    onClick={clearRecentFiles}
                    className="text-[12px] text-slate-400 hover:text-red-500 transition-colors px-2 py-1"
                  >
                    全部清除
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {recentFiles.map((item, idx) => (
                  <div 
                    key={idx}
                    onClick={() => openFileProgrammatically(item.path, item.name, item.type === 'folder')}
                    className="group relative flex items-center gap-3 p-3.5 bg-white dark:bg-[#252525] rounded-xl border border-slate-200 dark:border-[#333333] hover:border-indigo-300 dark:hover:border-indigo-600 hover:shadow-md cursor-pointer transition-all"
                  >
                    <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 dark:text-indigo-400 flex items-center justify-center shrink-0">
                      {item.type === 'folder' ? <Folder size={20} strokeWidth={2} /> : <FileText size={20} strokeWidth={2} />}
                    </div>
                    <div className="flex-1 min-w-0 pr-6">
                      <h3 className="text-[13px] font-semibold text-slate-800 dark:text-[#dddddd] truncate">{item.name}</h3>
                      <p className="text-[11px] text-slate-400 dark:text-[#666666] truncate mt-0.5">{item.path}</p>
                    </div>
                    <button
                      onClick={(e) => removeRecentFile(e, item.path)}
                      className="absolute right-3 opacity-0 group-hover:opacity-100 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
                      title="清除此记录"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
            
          </div>
        )}
      </div>

      {bookData && (
        <Reader 
          bookData={bookData} 
          onClose={closeBook} 
          jumpToSibling={jumpToSibling}
        />
      )}
    </div>
  );
}

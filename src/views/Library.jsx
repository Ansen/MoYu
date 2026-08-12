import React from 'react';
import Reader from '../components/Reader';
import { FileText, Folder, Clock, PlusCircle, Dices, Shuffle } from 'lucide-react';
import { useI18n } from '../i18n/index';
import RecentFileItem from '../components/common/RecentFileItem';

export default function LibraryView({ ebook }) {
  const { 
    bookData, loading, openBookDialog, openFolderDialog, 
    closeBook, recentFiles, openFileProgrammatically, jumpToSibling,
    clearRecentFiles, removeRecentFile, loadGeneratedContent
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
              <button 
                onClick={() => loadGeneratedContent('numbers')}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all font-medium text-[13px]"
              >
                <Dices size={18} />
                生成数码报底
              </button>
              <button 
                onClick={() => loadGeneratedContent('letters')}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg border border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all font-medium text-[13px]"
              >
                <Shuffle size={18} />
                生成英文分组报底
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
              <div className="w-px h-6 bg-slate-200 dark:bg-[#333333] mx-2"></div>
              <button 
                onClick={() => loadGeneratedContent('numbers')}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg border border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all font-medium text-[13px]"
              >
                <Dices size={16} />
                生成数码报底
              </button>
              <button 
                onClick={() => loadGeneratedContent('letters')}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 rounded-lg border border-orange-100 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-500/20 transition-all font-medium text-[13px]"
              >
                <Shuffle size={16} />
                生成英文分组报底
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
                  <RecentFileItem
                    key={idx}
                    item={item}
                    onClick={() => openFileProgrammatically(item.path, item.name, item.type === 'folder')}
                    onRemove={removeRecentFile}
                    styleVariant="library"
                  />
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
          onRegenerate={bookData.isGenerated ? () => loadGeneratedContent(bookData.generatorMode) : undefined}
        />
      )}
    </div>
  );
}

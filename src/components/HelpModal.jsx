import React, { useEffect } from 'react';
import { X, Keyboard, Settings2, PlayCircle, BookOpen } from 'lucide-react';

export default function HelpModal({ isOpen, onClose }) {
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
      <div className="relative w-full max-w-lg max-h-[85vh] flex flex-col bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-[#333333]">
        
        {/* Header Background */}
        <div className="h-20 shrink-0 bg-gradient-to-r from-teal-500 to-emerald-600 relative flex items-center justify-between px-6">
          <div className="absolute inset-0 bg-black/10"></div>
          <h1 className="text-xl font-bold text-white drop-shadow-md z-10 flex items-center gap-2">
            <BookOpen size={20} />
            使用帮助指南
          </h1>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full bg-black/20 text-white/80 hover:bg-black/40 hover:text-white transition-colors z-20"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6 text-slate-700 dark:text-[#cccccc]">
          
          {/* 基础操作 */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400 mb-3 flex items-center gap-2">
              <PlayCircle size={16} />
              核心功能 (Core)
            </h2>
            <div className="bg-slate-50 dark:bg-[#222222] p-4 rounded-xl border border-slate-100 dark:border-[#2a2a2a] text-[13px] leading-relaxed">
              <p className="mb-2"><strong>听读文章：</strong> 点击顶部工具栏的“播放”按钮，软件会将当前高亮的单词转换为摩斯电码声音播报。</p>
              <p className="mb-2"><strong>指定起点：</strong> 在阅读界面，点击任意单词/段落，即可直接从该位置开始播放。</p>
              <p><strong>导入书籍：</strong> 在“阅读器”界面，点击侧边栏下方的导入按钮，支持选择本地的 <code>.txt</code> 或 <code>.epub</code> 文件。也可直接将文件拖拽进窗口。</p>
            </div>
          </section>

          {/* 发报参数 */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-3 flex items-center gap-2">
              <Settings2 size={16} />
              发报参数 (Settings)
            </h2>
            <div className="bg-slate-50 dark:bg-[#222222] p-4 rounded-xl border border-slate-100 dark:border-[#2a2a2a] text-[13px] leading-relaxed">
              <p className="mb-2"><strong>WPM (词语速度)：</strong> Words Per Minute。数值越大，发报速度越快。新手建议设置在 15~20 左右，熟练后可逐渐提高。</p>
              <p className="mb-2"><strong>Hz (音调频率)：</strong> 控制摩斯电码的音高。通常在 600Hz ~ 800Hz 之间听感最佳。如果您觉得高频刺耳，可适当调低至 500Hz。</p>
              <p><strong>数字模式：</strong> 短码（只发报单个点或划，适合专业比赛）；长码（标准全码发送，适合日常训练）。</p>
            </div>
          </section>

          {/* 快捷键 */}
          <section>
            <h2 className="text-sm font-bold uppercase tracking-widest text-indigo-600 dark:text-indigo-400 mb-3 flex items-center gap-2">
              <Keyboard size={16} />
              快捷操作 (Shortcuts)
            </h2>
            <div className="bg-slate-50 dark:bg-[#222222] p-4 rounded-xl border border-slate-100 dark:border-[#2a2a2a] text-[13px]">
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-[#333333]">
                <span>播放 / 暂停</span>
                <kbd className="px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#444] rounded shadow-sm text-xs font-mono font-bold">Space / 空格键</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-[#333333]">
                <span>上一个段落</span>
                <kbd className="px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#444] rounded shadow-sm text-xs font-mono font-bold">↑ 向上方向键</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-slate-200 dark:border-[#333333]">
                <span>下一个段落</span>
                <kbd className="px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#444] rounded shadow-sm text-xs font-mono font-bold">↓ 向下方向键</kbd>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span>全屏模式</span>
                <kbd className="px-2 py-1 bg-white dark:bg-[#1a1a1a] border border-slate-200 dark:border-[#444] rounded shadow-sm text-xs font-mono font-bold">F11</kbd>
              </div>
            </div>
          </section>

        </div>
      </div>
    </div>
  );
}

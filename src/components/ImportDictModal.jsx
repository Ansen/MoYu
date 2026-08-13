import React, { useRef } from 'react';
import { X, FileText, FileJson, Upload } from 'lucide-react';
import { useI18n } from '../i18n';

export default function ImportDictModal({ isOpen, onClose, onImport }) {
  const { t } = useI18n();
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const txtExample = `中=0001\n国=0002`;
  const jsonExample = JSON.stringify({
    charToCode: {
      "中": "0001",
      "国": "0002"
    }
  }, null, 2);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImport(file);
    }
    // 清空 input，以便重复选择同一个文件
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/60 z-[110] flex items-center justify-center backdrop-blur-sm select-none">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-[#333333] rounded-lg shadow-2xl w-[400px] max-w-[90vw] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="h-10 flex items-center justify-between px-4 bg-slate-50 dark:bg-[#252526] border-b border-slate-200 dark:border-[#333333]">
          <span className="font-bold text-[13px] text-slate-700 dark:text-[#cccccc]">{t('dict.import.title')}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-[#ffffff] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-[13px] text-slate-600 dark:text-[#bbbbbb]">
          <p>
            {t('dict.import.desc').split('.txt').map((part, i, arr) => 
              i === 0 ? part : 
              i === 1 ? <><span className="font-bold text-slate-700 dark:text-[#ddd]">.txt</span>{part.split('.json')[0]}<span className="font-bold text-slate-700 dark:text-[#ddd]">.json</span>{part.split('.json')[1]}</> : part
            )}
          </p>

          <div className="grid grid-cols-2 gap-4">
            {/* TXT Example */}
            <div className="border border-slate-200 dark:border-[#333] rounded-lg p-3 bg-slate-50 dark:bg-[#111]">
              <div className="flex items-center gap-2 mb-2 text-slate-700 dark:text-[#ccc] font-medium">
                <FileText size={16} className="text-blue-500" />
                {t('dict.import.format.txt')}
              </div>
              <pre className="text-[11px] font-mono text-slate-500 dark:text-[#888] mb-1">
中=0001<br/>国=0002
              </pre>
            </div>

            {/* JSON Example */}
            <div className="border border-slate-200 dark:border-[#333] rounded-lg p-3 bg-slate-50 dark:bg-[#111]">
              <div className="flex items-center gap-2 mb-2 text-slate-700 dark:text-[#ccc] font-medium">
                <FileJson size={16} className="text-emerald-500" />
                {t('dict.import.format.json')}
              </div>
              <pre className="text-[11px] font-mono text-slate-500 dark:text-[#888] mb-1 leading-tight">
{`{
  "charToCode": {
    "中": "0001"
  }
}`}
              </pre>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-slate-50 dark:bg-[#252526] border-t border-slate-200 dark:border-[#333333] flex justify-end gap-3">
          <input 
            type="file" 
            accept=".txt,.json" 
            className="hidden" 
            ref={fileInputRef}
            onChange={handleFileChange} 
          />
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md border border-slate-300 dark:border-[#555555] text-slate-600 dark:text-[#cccccc] hover:bg-slate-100 dark:hover:bg-[#333333] transition-colors text-[13px] font-medium"
          >
            {t('settings.cancel')}
          </button>
          <button
            onClick={handleUploadClick}
            className="px-4 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white transition-colors text-[13px] font-medium flex items-center gap-1.5"
          >
            <Upload size={14} /> {t('dict.import.btn')}
          </button>
        </div>
      </div>
    </div>
  );
}

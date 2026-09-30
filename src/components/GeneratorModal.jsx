import React, { useState, useMemo } from 'react';
import { X, Sparkles, CheckCircle2 } from 'lucide-react';
import { useI18n } from '../i18n';
import { generateStructuredRandomContent } from '../utils/morse/structuredRandom';
import { exportPdfPractice } from '../services/pdfExportService';
import { exportEpubPractice } from '../services/epubExportService';
import ModeSelector from './generator/ModeSelector';
import GroupLengthSelector from './generator/GroupLengthSelector';
import GroupCountSelector from './generator/GroupCountSelector';
import AdvancedOptions from './generator/AdvancedOptions';
import ExportSettingsSection from './generator/ExportSettingsSection';
import ExportProgressBanner from './generator/ExportProgressBanner';
import ModalFooter from './generator/ModalFooter';
import TelegramReadyView from './generator/TelegramReadyView';

export default function GeneratorModal({ isOpen, onClose, onGenerate }) {
  const { t } = useI18n();

  // Primary Mode: 'numbers' | 'letters' | 'mixed' | 'callsigns'
  const [presetMode, setPresetMode] = useState('mixed');
  const [includeSymbols, setIncludeSymbols] = useState(false);
  const [includeCallsignSuffix, setIncludeCallsignSuffix] = useState(false);
  const [groupLength, setGroupLength] = useState(5);
  const [isCustomLength, setIsCustomLength] = useState(false);
  const [customLengthInput, setCustomLengthInput] = useState('5');
  const [maxDigitsPerGroup, setMaxDigitsPerGroup] = useState(1);
  const [isCustomMaxDigits, setIsCustomMaxDigits] = useState(false);
  const [customMaxDigitsInput, setCustomMaxDigitsInput] = useState('3');
  const [groupCount, setGroupCount] = useState(100);
  const [isCustomCount, setIsCustomCount] = useState(false);
  const [customCountInput, setCustomCountInput] = useState('200');
  const [noAdjacentDup, setNoAdjacentDup] = useState(true);

  // Mixed Mode Digit Slot Position (0-based array, empty means random default)
  const [selectedDigitSlots, setSelectedDigitSlots] = useState([]);
  const [digitSlotsInput, setDigitSlotsInput] = useState('');

  // Export / Dataset Config
  const [exportPages, setExportPages] = useState(40);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedDataset, setGeneratedDataset] = useState(null);

  // Multi-format export progress & statuses
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isExportingEpub, setIsExportingEpub] = useState(false);
  const [pdfExported, setPdfExported] = useState(false);
  const [epubExported, setEpubExported] = useState(false);
  const [exportType, setExportType] = useState('pdf'); // 'pdf' | 'epub'
  const [exportStatus, setExportStatus] = useState(null); // 'success' | 'error' | null
  const [exportProgress, setExportProgress] = useState(null); // { current, total, percent, text }

  const effectiveGroupCount = isCustomCount ? Math.max(1, parseInt(customCountInput) || 100) : groupCount;

  // Recommended length: Letters & Mixed -> 5 chars, Numbers -> 4 chars
  const recommendedLength = useMemo(() => {
    if (presetMode === 'letters' || presetMode === 'mixed') return 5;
    return 4;
  }, [presetMode]);

  // Mode switcher: automatically sets recommended length
  const handleSelectPresetMode = (mode) => {
    setPresetMode(mode);
    setIsCustomLength(false);
    setSelectedDigitSlots([]);
    setDigitSlotsInput('');
    if (mode === 'letters' || mode === 'mixed') {
      setGroupLength(5);
    } else {
      setGroupLength(4);
    }
  };

  // Derive pool based on preset mode + optional punctuation
  const pool = useMemo(() => {
    const p = [];
    if (presetMode === 'numbers') {
      p.push(...'0123456789'.split(''));
    } else if (presetMode === 'letters') {
      p.push(...'abcdefghijklmnopqrstuvwxyz'.split(''));
    } else {
      p.push(...'0123456789abcdefghijklmnopqrstuvwxyz'.split(''));
    }
    if (includeSymbols) {
      p.push(...['/', '?', ',', '.', '=']);
    }
    return p;
  }, [presetMode, includeSymbols]);

  const effectiveLength = useMemo(() => {
    if (isCustomLength) {
      const parsed = parseInt(customLengthInput, 10);
      return Math.max(1, Math.min(12, isNaN(parsed) ? 4 : parsed));
    }
    return groupLength;
  }, [isCustomLength, customLengthInput, groupLength]);

  const maxAllowedDigits = useMemo(() => {
    return Math.max(1, effectiveLength - 2);
  }, [effectiveLength]);

  const effectiveMaxDigits = useMemo(() => {
    let raw = isCustomMaxDigits ? parseInt(customMaxDigitsInput, 10) || 1 : maxDigitsPerGroup;
    return Math.min(Math.max(1, raw), maxAllowedDigits);
  }, [isCustomMaxDigits, customMaxDigitsInput, maxDigitsPerGroup, maxAllowedDigits]);

  // Derived safe digit slots bounded by effectiveLength and effectiveMaxDigits
  const effectiveDigitSlots = useMemo(() => {
    if (presetMode !== 'mixed' || !selectedDigitSlots.length) return [];
    return selectedDigitSlots
      .filter(s => s >= 0 && s < effectiveLength)
      .slice(0, effectiveMaxDigits);
  }, [presetMode, selectedDigitSlots, effectiveLength, effectiveMaxDigits]);

  // Reset dataset and close
  const handleClose = () => {
    setGeneratedDataset(null);
    onClose();
  };

  if (!isOpen) return null;

  // Rapid 1-page practice directly into software player without multi-page export workflow
  const handleStartPracticeDirect = () => {
    let typeDesc = t('generator.title.mixed');
    if (presetMode === 'numbers') typeDesc = t('generator.title.numbers');
    else if (presetMode === 'letters') typeDesc = t('generator.title.letters');
    else if (presetMode === 'callsigns') typeDesc = t('generator.title.callsigns');

    if (presetMode === 'callsigns') {
      const suffixTag = includeCallsignSuffix ? ` ${t('generator.title.withSymbols')}` : '';
      const config = {
        mode: 'callsigns',
        groupCount: effectiveGroupCount,
        includeCallsignSuffix,
        title: `${typeDesc} (${effectiveGroupCount} ${t('generator.title.groups')}${suffixTag})`
      };
      onGenerate(config);
      handleClose();
      return;
    }

    const suffix = includeSymbols ? ` ${t('generator.title.withSymbols')}` : '';
    const digitsInfo = presetMode === 'mixed' ? ` · ${t('generator.title.maxDigits', { count: effectiveMaxDigits })}` : '';
    const slotInfo = (presetMode === 'mixed' && effectiveDigitSlots.length > 0)
      ? ` ${t('generator.title.slotInfo', { slots: effectiveDigitSlots.map(s => s + 1).join(',') })}`
      : '';

    const config = {
      mode: 'custom',
      pool,
      charsPerGroup: effectiveLength,
      maxDigitsPerGroup: presetMode === 'mixed' ? effectiveMaxDigits : null,
      digitSlots: presetMode === 'mixed' && effectiveDigitSlots.length > 0 ? effectiveDigitSlots : null,
      groupCount: effectiveGroupCount,
      allowAdjacentDuplicate: !noAdjacentDup,
      customProfile: true,
      title: `${typeDesc} (${effectiveLength} ${t('generator.title.chars')}${digitsInfo}${slotInfo} · ${effectiveGroupCount} ${t('generator.title.groups')}${suffix})`
    };

    onGenerate(config);
    handleClose();
  };

  // Step 1 -> Step 2: Generate the authoritative dataset in-memory (for multi-page export)
  const handleGenerateDataset = async () => {
    try {
      setIsGenerating(true);
      await new Promise(r => setTimeout(r, 30));

      let typeDesc = t('generator.title.mixed');
      if (presetMode === 'numbers') typeDesc = t('generator.title.numbers');
      else if (presetMode === 'letters') typeDesc = t('generator.title.letters');
      else if (presetMode === 'callsigns') typeDesc = t('generator.title.callsigns');

      const pages = [];
      for (let i = 0; i < exportPages; i++) {
        let sample = null;
        if (presetMode === 'callsigns') {
          sample = generateStructuredRandomContent({
            mode: 'callsigns',
            groupCount: effectiveGroupCount,
            includeCallsignSuffix
          });
        } else {
          sample = generateStructuredRandomContent({
            mode: 'custom',
            pool,
            charsPerGroup: effectiveLength,
            maxDigitsPerGroup: presetMode === 'mixed' ? effectiveMaxDigits : null,
            digitSlots: presetMode === 'mixed' && effectiveDigitSlots.length > 0 ? effectiveDigitSlots : null,
            groupCount: effectiveGroupCount,
            allowAdjacentDuplicate: !noAdjacentDup,
            customProfile: true
          });
        }
        pages.push(sample?.groups || []);
      }

      const totalGroups = pages.reduce((sum, p) => sum + p.length, 0);
      const totalChars = pages.reduce((sum, p) => sum + p.reduce((s, g) => s + g.length, 0), 0);

      // First 20 groups of Page 1 partitioned into 5 groups per row for telegram preview
      const page1Groups = pages[0] || [];
      const first20 = page1Groups.slice(0, 20).map(g => (Array.isArray(g) ? g.join('') : g));
      const previewRows = [];
      for (let i = 0; i < first20.length; i += 5) {
        previewRows.push(first20.slice(i, i + 5));
      }

      const suffixTag = includeCallsignSuffix ? ` ${t('generator.title.withSymbols')}` : '';
      const suffix = includeSymbols ? ` ${t('generator.title.withSymbols')}` : '';
      const digitsInfo = presetMode === 'mixed' ? ` · ${t('generator.title.maxDigits', { count: effectiveMaxDigits })}` : '';
      const slotInfo = (presetMode === 'mixed' && effectiveDigitSlots.length > 0)
        ? ` ${t('generator.title.slotInfo', { slots: effectiveDigitSlots.map(s => s + 1).join(',') })}`
        : '';
      const fullTitle = presetMode === 'callsigns'
        ? `${typeDesc} (${effectiveGroupCount} ${t('generator.title.groups')}${suffixTag})`
        : `${typeDesc} (${effectiveLength} ${t('generator.title.chars')}${digitsInfo}${slotInfo} · ${exportPages} ${t('reader.pages.unit', '页')}${suffix})`;

      setGeneratedDataset({
        pages,
        totalPages: exportPages,
        totalGroups,
        totalChars,
        previewRows,
        title: fullTitle
      });

      setPdfExported(false);
      setEpubExported(false);
    } catch (err) {
      console.error('Failed to generate dataset:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  // Step 2 Action: Export PDF using the identical generated dataset
  const handleExportPdf = async () => {
    if (!generatedDataset) return;
    try {
      setIsExportingPdf(true);
      setExportType('pdf');
      setExportStatus(null);
      setExportProgress({ current: 0, total: exportPages, percent: 5, text: t('generator.btn.exporting') });

      const success = await exportPdfPractice({
        exportPages: generatedDataset.totalPages,
        presetMode,
        effectiveLength,
        effectiveMaxDigits,
        effectiveGroupCount,
        includeCallsignSuffix,
        pool,
        noAdjacentDup,
        title: generatedDataset.title,
        t,
        onProgress: setExportProgress,
        generatedPages: generatedDataset.pages
      });

      if (success) {
        setExportProgress({ current: exportPages, total: exportPages, percent: 100, text: t('generator.pdfExport.successToast') });
        setExportStatus('success');
        setPdfExported(true);
        setTimeout(() => {
          setExportStatus(null);
          setExportProgress(null);
        }, 2500);
      } else {
        setExportStatus(null);
        setExportProgress(null);
      }
    } catch (e) {
      console.error('PDF export error:', e);
      setExportStatus('error');
      setExportProgress(null);
      setTimeout(() => setExportStatus(null), 3000);
    } finally {
      setIsExportingPdf(false);
    }
  };

  // Step 2 Action: Export EPUB using the identical generated dataset
  const handleExportEpub = async () => {
    if (!generatedDataset) return;
    try {
      setIsExportingEpub(true);
      setExportType('epub');
      setExportStatus(null);
      setExportProgress({ current: 0, total: exportPages, percent: 5, text: t('generator.btn.exporting') });

      const success = await exportEpubPractice({
        exportPages: generatedDataset.totalPages,
        presetMode,
        effectiveLength,
        effectiveMaxDigits,
        effectiveGroupCount,
        includeCallsignSuffix,
        pool,
        noAdjacentDup,
        title: generatedDataset.title,
        t,
        onProgress: setExportProgress,
        generatedPages: generatedDataset.pages
      });

      if (success) {
        setExportProgress({ current: exportPages, total: exportPages, percent: 100, text: t('generator.epubExport.successToast') });
        setExportStatus('success');
        setEpubExported(true);
        setTimeout(() => {
          setExportStatus(null);
          setExportProgress(null);
        }, 2500);
      } else {
        setExportStatus(null);
        setExportProgress(null);
      }
    } catch (e) {
      console.error('EPUB export error:', e);
      setExportStatus('error');
      setExportProgress(null);
      setTimeout(() => setExportStatus(null), 3000);
    } finally {
      setIsExportingEpub(false);
    }
  };

  const handleBackToConfig = () => {
    setGeneratedDataset(null);
  };

  return (
    <div className="fixed inset-0 bg-black/40 dark:bg-black/70 z-[100] flex items-center justify-center p-4 sm:p-6 backdrop-blur-xs select-none animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1e1e1e] border border-slate-300 dark:border-[#333333] rounded-2xl shadow-2xl w-[600px] max-w-[94vw] h-[660px] max-h-[calc(100vh-2rem)] overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="shrink-0 h-12 flex items-center justify-between px-5 bg-slate-50 dark:bg-[#252526] border-b border-slate-200 dark:border-[#333333]">
          <div className="flex items-center gap-2 font-bold text-[16px] text-slate-800 dark:text-[#dddddd]">
            {generatedDataset ? (
              <>
                <CheckCircle2 size={16} className="text-emerald-500" />
                <span>{t('generator.ready.modalTitle')}</span>
              </>
            ) : (
              <>
                <Sparkles size={16} className="text-orange-500" />
                <span>{t('generator.modal.title')}</span>
              </>
            )}
          </div>
          <button 
            onClick={handleClose} 
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-[#ffffff] hover:bg-slate-200/50 dark:hover:bg-[#333333] transition-colors cursor-pointer"
          >
            <X size={17} />
          </button>
        </div>

        {/* Modal Body: Two-step view */}
        {generatedDataset ? (
          <TelegramReadyView
            dataset={generatedDataset}
            isExportingPdf={isExportingPdf}
            isExportingEpub={isExportingEpub}
            pdfExported={pdfExported}
            epubExported={epubExported}
            onExportPdf={handleExportPdf}
            onExportEpub={handleExportEpub}
            onRegenerate={handleGenerateDataset}
            onBackToConfig={handleBackToConfig}
            onClose={handleClose}
            isGenerating={isGenerating}
          />
        ) : (
          <>
            <div className="flex-1 p-6 space-y-5 text-[15px] text-slate-700 dark:text-[#cccccc] overflow-y-auto custom-scrollbar">
              <ModeSelector presetMode={presetMode} onSelectMode={handleSelectPresetMode} />
              <GroupLengthSelector
                presetMode={presetMode}
                groupLength={groupLength}
                setGroupLength={setGroupLength}
                isCustomLength={isCustomLength}
                setIsCustomLength={setIsCustomLength}
                customLengthInput={customLengthInput}
                setCustomLengthInput={setCustomLengthInput}
                recommendedLength={recommendedLength}
                maxDigitsPerGroup={maxDigitsPerGroup}
                setMaxDigitsPerGroup={setMaxDigitsPerGroup}
                isCustomMaxDigits={isCustomMaxDigits}
                setIsCustomMaxDigits={setIsCustomMaxDigits}
                customMaxDigitsInput={customMaxDigitsInput}
                setCustomMaxDigitsInput={setCustomMaxDigitsInput}
                maxAllowedDigits={maxAllowedDigits}
                selectedDigitSlots={effectiveDigitSlots}
                setSelectedDigitSlots={setSelectedDigitSlots}
                digitSlotsInput={digitSlotsInput}
                setDigitSlotsInput={setDigitSlotsInput}
                effectiveLength={effectiveLength}
                effectiveMaxDigits={effectiveMaxDigits}
              />
              <GroupCountSelector
                groupCount={groupCount}
                setGroupCount={setGroupCount}
                isCustomCount={isCustomCount}
                setIsCustomCount={setIsCustomCount}
                customCountInput={customCountInput}
                setCustomCountInput={setCustomCountInput}
              />
              <AdvancedOptions
                presetMode={presetMode}
                includeSymbols={includeSymbols}
                setIncludeSymbols={setIncludeSymbols}
                includeCallsignSuffix={includeCallsignSuffix}
                setIncludeCallsignSuffix={setIncludeCallsignSuffix}
                noAdjacentDup={noAdjacentDup}
                setNoAdjacentDup={setNoAdjacentDup}
              />
              <ExportSettingsSection
                exportPages={exportPages}
                setExportPages={setExportPages}
              />
            </div>

            <ModalFooter
              isGenerating={isGenerating}
              onClose={handleClose}
              onGenerateBatch={handleGenerateDataset}
              onStartPractice={handleStartPracticeDirect}
            />
          </>
        )}

        <ExportProgressBanner exportProgress={exportProgress} exportType={exportType} />
      </div>
    </div>
  );
}

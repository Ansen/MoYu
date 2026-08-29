import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { generateStructuredRandomContent } from '../utils/morse/structuredRandom';
import { generateTelegramPdf } from '../utils/pdfHelper';

/**
 * Service to generate and export multi-page A4 Landscape Telegram Training PDF
 */
export async function exportPdfPractice({
  exportPages,
  presetMode,
  effectiveLength,
  effectiveMaxDigits,
  effectiveGroupCount,
  includeCallsignSuffix,
  pool,
  noAdjacentDup,
  title,
  t,
  onProgress
}) {
  const generatedPages = [];

  for (let i = 0; i < exportPages; i++) {
    const percent = Math.min(80, Math.round(5 + ((i + 1) / exportPages) * 75));
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: exportPages,
        percent,
        text: (t('generator.pdfExport.generating') || '正在生成第 {current} / {total} 页 PDF...')
          .replace('{current}', i + 1)
          .replace('{total}', exportPages)
      });
    }
    if (i % 2 === 0 || i === exportPages - 1) {
      await new Promise(r => setTimeout(r, 6));
    }

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
        groupCount: effectiveGroupCount,
        allowAdjacentDuplicate: !noAdjacentDup,
        customProfile: true
      });
    }
    generatedPages.push(sample?.groups || []);
  }

  if (onProgress) {
    onProgress({
      current: exportPages,
      total: exportPages,
      percent: 88,
      text: t('generator.pdfExport.saving') || '正在生成 PDF 矢量排版...'
    });
  }
  await new Promise(r => setTimeout(r, 15));

  const filePath = await save({
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    defaultPath: `${title}.pdf`
  });

  if (!filePath) return false;

  if (onProgress) {
    onProgress({
      current: exportPages,
      total: exportPages,
      percent: 95,
      text: t('generator.pdfExport.saving') || '正在写入 PDF 文件...'
    });
  }
  await new Promise(r => setTimeout(r, 10));

  const pdfBytes = generateTelegramPdf({
    pages: generatedPages,
    title,
    presetMode,
    groupLength: effectiveLength,
    groupCount: effectiveGroupCount,
    includePageNumber: true
  });

  await writeFile(filePath, pdfBytes);
  return true;
}

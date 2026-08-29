import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { invoke } from '@tauri-apps/api/core';
import { generateStructuredRandomContent } from '../utils/morse/structuredRandom';
import { formatEpubChapterHtml } from '../utils/epubHelper';

/**
 * Service to generate and export multi-chapter EPUB eBook
 */
export async function exportEpubPractice({
  exportPages,
  presetMode,
  effectiveLength,
  effectiveMaxDigits,
  effectiveGroupCount,
  includeCallsignSuffix,
  pool,
  noAdjacentDup,
  epubStartMarker,
  epubEndMarker,
  title,
  t,
  onProgress
}) {
  const chapters = [];

  for (let i = 0; i < exportPages; i++) {
    const percent = Math.min(80, Math.round(5 + ((i + 1) / exportPages) * 75));
    if (onProgress) {
      onProgress({
        current: i + 1,
        total: exportPages,
        percent,
        text: (t('generator.epubExport.generating') || '正在生成第 {current} / {total} 页...')
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

    const chapterHtml = formatEpubChapterHtml({
      groups: sample?.groups || [],
      startMarker: epubStartMarker,
      endMarker: epubEndMarker
    });

    chapters.push(chapterHtml);
  }

  if (onProgress) {
    onProgress({
      current: exportPages,
      total: exportPages,
      percent: 85,
      text: t('generator.epubExport.packaging') || '正在打包 EPUB 电子书...'
    });
  }
  await new Promise(r => setTimeout(r, 20));

  const filePath = await save({
    filters: [{ name: 'EPUB', extensions: ['epub'] }],
    defaultPath: `${title}.epub`
  });

  if (!filePath) return false;

  if (onProgress) {
    onProgress({
      current: exportPages,
      total: exportPages,
      percent: 92,
      text: t('generator.epubExport.saving') || '正在写入文件...'
    });
  }
  await new Promise(r => setTimeout(r, 10));

  const epubData = await invoke('generate_epub', { title, chapters });
  await writeFile(filePath, new Uint8Array(epubData));
  return true;
}

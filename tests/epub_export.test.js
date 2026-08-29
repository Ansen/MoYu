import { formatEpubChapterHtml } from '../src/utils/epubHelper.js';

export function testEpubExportFormatting() {
  console.log('--- Running EPUB Export Responsive Formatting Unit Tests ---');

  // 1. Test standard groups formatting with start/end markers
  const sampleGroups = Array.from({ length: 100 }, (_, i) => String(1000 + i).split(''));
  const chapterHtml = formatEpubChapterHtml({
    groups: sampleGroups,
    startMarker: '===',
    endMarker: 'iii +'
  });

  if (!chapterHtml.startsWith('<p') || !chapterHtml.includes('telegram-content')) {
    throw new Error('Expected clean paragraph structure with telegram-content class');
  }
  if (!chapterHtml.includes('===') || !chapterHtml.includes('iii +')) {
    throw new Error('Expected configured start & end markers to be included in EPUB text');
  }
  if (chapterHtml.includes('<table') || chapterHtml.includes('277mm')) {
    throw new Error('Obsolete print table styles should be completely removed from EPUB');
  }
  console.log('✓ Standard groups correctly formatted as clean, reflowable EPUB paragraph with start/end markers.');

  // 2. Test empty markers
  const cleanHtml = formatEpubChapterHtml({
    groups: ['AAAA', 'BBBB', 'CCCC'],
    startMarker: '',
    endMarker: ''
  });
  if (cleanHtml.includes('===') || cleanHtml.includes('iii')) {
    throw new Error('Empty markers should not inject default text');
  }
  if (!cleanHtml.includes('AAAA BBBB CCCC')) {
    throw new Error('Tokens should be joined cleanly with single space');
  }
  console.log('✓ Empty markers cleanly rendered raw space-separated tokens.');

  console.log('All EPUB Export Formatting tests passed successfully!\n');
}

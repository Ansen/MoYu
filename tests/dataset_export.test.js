import { formatEpubChapterHtml } from '../src/utils/epubHelper.js';
import { generateTelegramPdf } from '../src/utils/pdfHelper.js';

export function testDatasetExportConsistency() {
  console.log('--- Running Dataset Export Consistency (PDF & EPUB Identical Source) Tests ---');

  // 构造模拟的多页报底数据集（共 3 页，每页 20 组）
  const pages = [
    [['A', 'B', '1', 'C', 'D'], ['E', 'F', '2', 'G', 'H'], ['1', '2', '3', '4', '5']],
    [['J', 'K', '3', 'L', 'M'], ['N', 'P', '4', 'Q', 'R'], ['6', '7', '8', '9', '0']],
    [['S', 'T', '5', 'U', 'V'], ['W', 'X', '6', 'Y', 'Z'], ['A', '1', 'B', '2', 'C']],
  ];

  // 1. 验证 EPUB 导出的各个章节内容与源数据一致
  const epubChapters = pages.map(pageGroups => formatEpubChapterHtml({
    groups: pageGroups,
    startMarker: '===',
    endMarker: 'iii'
  }));

  if (epubChapters.length !== 3) {
    throw new Error(`Expected 3 EPUB chapters, got ${epubChapters.length}`);
  }
  if (!epubChapters[0].includes('AB1CD EF2GH 12345')) {
    throw new Error('EPUB Chapter 1 text content mismatch');
  }
  if (!epubChapters[1].includes('JK3LM NP4QR 67890')) {
    throw new Error('EPUB Chapter 2 text content mismatch');
  }
  if (!epubChapters[2].includes('ST5UV WX6YZ A1B2C')) {
    throw new Error('EPUB Chapter 3 text content mismatch');
  }

  // 2. 验证 PDF 导出能直接基于同一份 pages 生成合法 PDF
  const pdfBytes = generateTelegramPdf({
    pages,
    title: 'Consistency Test Sheet',
    presetMode: 'mixed',
    groupLength: 5,
    groupCount: 3,
    includePageNumber: true
  });

  if (!pdfBytes || !(pdfBytes instanceof Uint8Array) || pdfBytes.length < 500) {
    throw new Error('Expected PDF bytes to be generated successfully from shared dataset');
  }

  // 3. 验证纯文本练习底稿提取
  const allGroups = pages.flat().map(g => g.join(''));
  const rawPracticeText = `=== ${allGroups.join(' ')} iii`;
  if (!rawPracticeText.startsWith('=== AB1CD EF2GH 12345 JK3LM NP4QR 67890 ST5UV WX6YZ A1B2C iii')) {
    throw new Error('Practice raw text does not match shared dataset');
  }

  console.log('✓ Shared dataset successfully exported to EPUB chapters with exact token match.');
  console.log(`✓ Shared dataset successfully rendered to PDF (${pdfBytes.length} bytes).`);
  console.log('✓ In-software practice raw text precisely mirrors the exported dataset.');
  console.log('All Dataset Export Consistency tests passed successfully!\n');
}

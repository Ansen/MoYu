import { generateTelegramPdf } from '../src/utils/pdfHelper.js';

export function testPdfExport() {
  console.log('--- Running PDF Export Vector Generation Unit Tests ---');

  // Test 1: Single page 100 groups
  const sampleGroups = Array.from({ length: 100 }, (_, i) => `A${i}BC`.slice(0, 4));
  const pdfBytes = generateTelegramPdf({
    pages: [sampleGroups],
    title: 'Test Telegram Sheet'
  });

  if (!pdfBytes || !(pdfBytes instanceof Uint8Array) || pdfBytes.length < 100) {
    throw new Error('Expected PDF export to return a valid non-empty Uint8Array');
  }

  // Check PDF magic header %PDF-
  const header = String.fromCharCode(...pdfBytes.slice(0, 5));
  if (header !== '%PDF-') {
    throw new Error(`Expected PDF file to start with %PDF-, got ${header}`);
  }

  console.log(`✓ Generated valid single-page PDF (Size: ${pdfBytes.length} bytes)`);

  // Test 2: Multi-page (5 pages) with progress callback
  let progressCount = 0;
  const multiPages = Array.from({ length: 5 }, () => sampleGroups);
  const multiPdfBytes = generateTelegramPdf({
    pages: multiPages,
    title: 'Multi-page Sheet',
    onProgress: () => {
      progressCount++;
    }
  });

  if (progressCount !== 5) {
    throw new Error(`Expected 5 progress triggers, got ${progressCount}`);
  }

  if (!multiPdfBytes || multiPdfBytes.length <= pdfBytes.length) {
    throw new Error('Multi-page PDF should be larger than single-page PDF');
  }

  console.log(`✓ Generated valid 5-page PDF with progress callback (Size: ${multiPdfBytes.length} bytes)`);
  console.log('All PDF Export tests passed successfully!');
}

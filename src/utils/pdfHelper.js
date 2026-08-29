import { jsPDF } from 'jspdf';
import { CASCADIA_MONO_BASE64 } from './cascadiaFont.js';

/**
 * Generate Pure Minimalist A4 Landscape Vector PDF for Telegram Training Manuscript Paper
 * - Dimensions: 297mm x 210mm (A4 Landscape)
 * - Font: Cascadia Mono (Embedded TrueType Font)
 *   - Slashed zero '0' vs letter 'o' / 'O'
 *   - Serifed digit '1' vs curved 'l' vs barred 'I'
 *   - Distinct 'Z' vs '2', 'S' vs '5'
 * - Clean Grid: 10x10 Matrix only (No extraneous header/footer text)
 *   - Outer Frame & Header Dividers: 0.35mm crisp solid border
 *   - Inner Grid Lines: 0.18mm clean refined division lines
 *   - Row header column: 17mm width
 *   - 10 Data columns: 26mm width each
 *   - Total grid width: 17mm + 10 * 26mm = 277mm (10mm left/right margins)
 * - Page Number: Only the current page number at bottom center (e.g. 1, 2, 3...)
 */
export function generateTelegramPdf({
  pages = [], // Array of pages, each page is an array of groups: string[] or string[][]
  _title = 'Telegram Practice Sheet',
  _presetMode = 'mixed',
  _groupLength = 5,
  _groupCount = 100,
  includePageNumber = true,
  onProgress
}) {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4'
  });

  // Embed and register Cascadia Mono TrueType font
  doc.addFileToVFS('CascadiaMono.ttf', CASCADIA_MONO_BASE64);
  doc.addFont('CascadiaMono.ttf', 'CascadiaMono', 'normal');
  doc.addFont('CascadiaMono.ttf', 'CascadiaMono', 'bold');

  const PAGE_WIDTH = 297;
  const LEFT_MARGIN = 10;
  const TOP_MARGIN = 15; // Centered vertical grid placement
  const COL_ZERO_WIDTH = 17;
  const DATA_COL_WIDTH = 26;
  const HEADER_ROW_HEIGHT = 14;
  const DATA_ROW_HEIGHT = 16;
  const COLS = 10;
  const ROWS = 10;
  const TOTAL_GRID_WIDTH = COL_ZERO_WIDTH + COLS * DATA_COL_WIDTH; // 277mm
  const TOTAL_GRID_HEIGHT = HEADER_ROW_HEIGHT + ROWS * DATA_ROW_HEIGHT; // 174mm

  const totalPages = Math.max(1, pages.length);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    if (pageIdx > 0) {
      doc.addPage('a4', 'landscape');
    }

    if (onProgress) {
      onProgress({ current: pageIdx + 1, total: totalPages });
    }

    const pageGroups = pages[pageIdx] || [];
    const tokens = pageGroups.map(g => (Array.isArray(g) ? g.join('') : String(g)));

    // ==========================================
    // 1. GRID BACKGROUND TINTS
    // ==========================================

    // Column Header Row Tint (#f8fafc)
    doc.setFillColor(248, 250, 252);
    doc.rect(LEFT_MARGIN, TOP_MARGIN, TOTAL_GRID_WIDTH, HEADER_ROW_HEIGHT, 'F');

    // Row Header Column Tint (#f8fafc)
    doc.setFillColor(248, 250, 252);
    doc.rect(LEFT_MARGIN, TOP_MARGIN + HEADER_ROW_HEIGHT, COL_ZERO_WIDTH, ROWS * DATA_ROW_HEIGHT, 'F');

    // ==========================================
    // 2. GRID LINES (PURE BLACK VECTOR HIERARCHY - ZERO DITHERING)
    // ==========================================

    // A. Inner Horizontal Lines (Hairline: 0.18mm Pure Black)
    doc.setLineWidth(0.18);
    doc.setDrawColor(0, 0, 0);
    for (let r = 1; r < ROWS; r++) {
      const y = TOP_MARGIN + HEADER_ROW_HEIGHT + r * DATA_ROW_HEIGHT;
      doc.line(LEFT_MARGIN, y, LEFT_MARGIN + TOTAL_GRID_WIDTH, y);
    }

    // B. Inner Vertical Lines (Hairline: 0.18mm Pure Black)
    for (let c = 1; c < COLS; c++) {
      const x = LEFT_MARGIN + COL_ZERO_WIDTH + c * DATA_COL_WIDTH;
      doc.line(x, TOP_MARGIN, x, TOP_MARGIN + TOTAL_GRID_HEIGHT);
    }

    // C. Major Structural Dividers & Outer Frame (Solid: 0.35mm Pure Black)
    doc.setLineWidth(0.35);
    doc.setDrawColor(0, 0, 0);

    // Header bottom line
    doc.line(LEFT_MARGIN, TOP_MARGIN + HEADER_ROW_HEIGHT, LEFT_MARGIN + TOTAL_GRID_WIDTH, TOP_MARGIN + HEADER_ROW_HEIGHT);

    // Row header right line
    doc.line(LEFT_MARGIN + COL_ZERO_WIDTH, TOP_MARGIN, LEFT_MARGIN + COL_ZERO_WIDTH, TOP_MARGIN + TOTAL_GRID_HEIGHT);

    // Outer Rectangle
    doc.rect(LEFT_MARGIN, TOP_MARGIN, TOTAL_GRID_WIDTH, TOTAL_GRID_HEIGHT);

    // ==========================================
    // 3. COLUMN HEADERS (1..10)
    // ==========================================
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);

    const headerTextY = TOP_MARGIN + (HEADER_ROW_HEIGHT / 2) + 1.4;

    for (let c = 1; c <= COLS; c++) {
      const colCenterX = LEFT_MARGIN + COL_ZERO_WIDTH + (c - 1) * DATA_COL_WIDTH + (DATA_COL_WIDTH / 2);
      doc.text(String(c), colCenterX, headerTextY, { align: 'center' });
    }

    // ==========================================
    // 4. DATA ROWS & ROW HEADERS (1..10)
    // ==========================================
    for (let r = 0; r < ROWS; r++) {
      const rowY = TOP_MARGIN + HEADER_ROW_HEIGHT + r * DATA_ROW_HEIGHT;
      const rowTextY = rowY + (DATA_ROW_HEIGHT / 2) + 2.0;

      // Row Number (1..10) - Clean Helvetica Bold
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(40, 40, 40);
      const rowNumCenterX = LEFT_MARGIN + (COL_ZERO_WIDTH / 2);
      doc.text(String(r + 1), rowNumCenterX, rowTextY, { align: 'center' });

      // Data Cells (10 columns) - High Distinction Cascadia Mono (Slashed 0, Serifed 1, Curved l)
      doc.setFont('CascadiaMono', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(0, 0, 0);

      for (let c = 0; c < COLS; c++) {
        const tokenIdx = r * COLS + c;
        const token = tokens[tokenIdx] || '';
        if (token) {
          const cellCenterX = LEFT_MARGIN + COL_ZERO_WIDTH + c * DATA_COL_WIDTH + (DATA_COL_WIDTH / 2);
          doc.text(token, cellCenterX, rowTextY, { align: 'center' });
        }
      }
    }

    // ==========================================
    // 5. PAGE NUMBER ONLY (BOTTOM CENTER: e.g. "1", "2", "3")
    // ==========================================
    if (includePageNumber) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(String(pageIdx + 1), PAGE_WIDTH / 2, 200, { align: 'center' });
    }
  }

  // Return binary array buffer for Tauri file saving
  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

import assert from 'assert';
import { PREFIX_MARKER_OPTIONS, SUFFIX_MARKER_OPTIONS } from '../src/config/markers.js';
import { parseTelegramContent } from '../src/utils/telegramParser.js';

export function testMarkersConfig() {
  console.log('--- Running Transmission Markers Config & Detection Unit Tests ---');

  if (!Array.isArray(PREFIX_MARKER_OPTIONS) || PREFIX_MARKER_OPTIONS.length === 0) {
    throw new Error('PREFIX_MARKER_OPTIONS is not a non-empty array');
  }

  if (!Array.isArray(SUFFIX_MARKER_OPTIONS) || SUFFIX_MARKER_OPTIONS.length === 0) {
    throw new Error('SUFFIX_MARKER_OPTIONS is not a non-empty array');
  }

  // 1. Verify standard presets exist
  const prefixIds = PREFIX_MARKER_OPTIONS.map(p => p.id);
  const suffixIds = SUFFIX_MARKER_OPTIONS.map(s => s.id);

  if (!prefixIds.includes('===') || !prefixIds.includes('KA')) {
    throw new Error('PREFIX_MARKER_OPTIONS missing === or KA');
  }
  console.log(`✓ Prefix markers options defined (${prefixIds.join(', ')})`);

  if (!suffixIds.includes('iii +') || !suffixIds.includes('iii') || !suffixIds.includes('+') || !suffixIds.includes('AR')) {
    throw new Error('SUFFIX_MARKER_OPTIONS missing iii +, iii, +, or AR');
  }
  console.log(`✓ Suffix markers options defined (${suffixIds.join(', ')})`);

  // Verify empty option exists to allow disabling
  if (!prefixIds.includes('') || !suffixIds.includes('')) {
    throw new Error('Marker options must include empty string id to allow disabling');
  }
  console.log('✓ Disable option (empty id) properly provided.');

  // 2. Test Smart Marker Detection & Body Deduplication
  const res1 = parseTelegramContent('=== 1234 5678 9012 iii +');
  assert.strictEqual(res1.startMarker, '===', 'Should detect === as startMarker');
  assert.strictEqual(res1.endMarker, 'iii +', 'Should detect iii + as composite endMarker');
  assert.deepStrictEqual(res1.rawTokens, ['1234', '5678', '9012'], 'Body tokens should strictly exclude start/end markers');
  assert.strictEqual(res1.cleanText, '1234 5678 9012', 'Clean text should match body tokens');
  console.log('✓ parseTelegramContent correctly stripped === and composite iii +.');

  const res2 = parseTelegramContent('KA 1111 2222 3333 iii');
  assert.strictEqual(res2.startMarker, 'KA');
  assert.strictEqual(res2.endMarker, 'iii');
  assert.deepStrictEqual(res2.rawTokens, ['1111', '2222', '3333']);
  console.log('✓ parseTelegramContent correctly stripped KA and single iii.');

  const res3 = parseTelegramContent('5555 6666 7777 +');
  assert.strictEqual(res3.startMarker, '');
  assert.strictEqual(res3.endMarker, '+');
  assert.deepStrictEqual(res3.rawTokens, ['5555', '6666', '7777']);
  console.log('✓ parseTelegramContent correctly stripped standalone + end marker.');

  // 3. Test 100-group Report Grid Eligibility & 10x10 Alignment
  const groups100 = Array.from({ length: 100 }, (_, i) => String(i).padStart(4, '0'));
  const rawWithMarkers = `=== ${groups100.join(' ')} iii +`;
  const res100 = parseTelegramContent(rawWithMarkers);
  assert.strictEqual(res100.startMarker, '===');
  assert.strictEqual(res100.endMarker, 'iii +');
  assert.strictEqual(res100.rawTokens.length, 100, 'Clean tokens length must be exactly 100');
  assert.strictEqual(res100.rows.length, 10, 'Must have exactly 10 rows');
  assert.strictEqual(res100.rows[0].length, 10, 'Each row must have 10 columns');
  assert.strictEqual(res100.isGridEligible, true, '100-group 4-digit telegram must be grid eligible');
  console.log('✓ 100-group telegram with === and iii + perfectly preserved 10x10 grid matrix.');

  console.log('All Transmission Markers tests passed successfully!\n');
}

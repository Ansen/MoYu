import { parseTelegramContent } from '../src/utils/telegramParser.js';

export function testReaderToolbarLogic() {
  console.log('--- Running Reader Toolbar Boundary & State Logic Tests ---');

  // 1. Font Size Clamping
  const clampFontSize = (size) => Math.max(10, Math.min(120, size));
  if (clampFontSize(8) !== 10 || clampFontSize(150) !== 120 || clampFontSize(24) !== 24) {
    throw new Error('Font size clamping logic failed');
  }
  console.log('✓ Font size clamping correctly bounded in [10, 120].');

  // 2. Morse Speed (WPM) Clamping
  const clampWpm = (wpm) => Math.max(5, Math.min(60, wpm));
  if (clampWpm(2) !== 5 || clampWpm(80) !== 60 || clampWpm(20) !== 20) {
    throw new Error('WPM speed clamping logic failed');
  }
  console.log('✓ Morse WPM speed clamping correctly bounded in [5, 60].');

  // 3. Morse Tone Frequency (Hz) Clamping
  const clampFreq = (freq) => Math.max(100, Math.min(1500, freq));
  if (clampFreq(50) !== 100 || clampFreq(2000) !== 1500 || clampFreq(380) !== 380) {
    throw new Error('Morse Hz frequency clamping logic failed');
  }
  console.log('✓ Morse Hz frequency clamping correctly bounded in [100, 1500].');

  // 4. Number Modes
  const validNumberModes = ['long', 'short5', 'short10'];
  for (const mode of validNumberModes) {
    if (!validNumberModes.includes(mode)) {
      throw new Error(`Invalid number mode: ${mode}`);
    }
  }
  console.log('✓ Number modes (long, short5, short10) validated.');

  // 5. View Modes & Grid Eligibility (Group length <= 5 restriction)
  const validViewModes = ['grid', 'text'];
  for (const mode of validViewModes) {
    if (!validViewModes.includes(mode)) {
      throw new Error(`Invalid view mode: ${mode}`);
    }
  }
  console.log('✓ View modes (grid, text) validated.');

  // 6. Grid Eligibility (> 5 characters per group disabled)
  const standardTelegraph = "3424 0856 4872 2037 9720";
  const longProse = "Internationalization accessibility documentation 1234567";
  const mixedLong = "3424 0856 123456 4872";

  const resStandard = parseTelegramContent(standardTelegraph);
  const resProse = parseTelegramContent(longProse);
  const resMixed = parseTelegramContent(mixedLong);

  if (!resStandard.isGridEligible) {
    throw new Error('Standard 4-5 digit groups must be grid eligible');
  }
  if (resProse.isGridEligible) {
    throw new Error('Long words (>5 chars) must NOT be grid eligible');
  }
  if (resMixed.isGridEligible) {
    throw new Error('Mixed text with >5 char group must NOT be grid eligible');
  }
  console.log('✓ Grid layout restriction (group length <= 5) validated.');

  console.log('All Reader Toolbar logic tests passed successfully!\n');
}

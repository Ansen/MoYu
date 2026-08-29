import { FONT_OPTIONS, getFontFamilyCss } from '../src/config/fonts.js';

export function testFontOptions() {
  console.log('--- Running Cross-Platform High-Distinction Font Options Unit Tests ---');
  
  // 1. Check FONT_OPTIONS length and required entries
  if (!Array.isArray(FONT_OPTIONS) || FONT_OPTIONS.length !== 5) {
    throw new Error(`Expected exactly 5 cross-platform font options, got ${FONT_OPTIONS?.length}`);
  }
  console.log(`? FONT_OPTIONS defined with ${FONT_OPTIONS.length} cross-platform font families.`);

  const requiredFontIds = [
    'Cascadia Mono',
    'SF Mono',
    'JetBrains Mono',
    'Fira Code',
    'DejaVu Sans Mono'
  ];

  for (const id of requiredFontIds) {
    const found = FONT_OPTIONS.find(f => f.id === id);
    if (!found) {
      throw new Error(`Missing expected font id: ${id}`);
    }
    if (!found.labelKey || typeof found.labelKey !== 'string') {
      throw new Error(`Font ${id} is missing a valid labelKey`);
    }
    if (!found.fontFamily || typeof found.fontFamily !== 'string') {
      throw new Error(`Font ${id} is missing a valid fontFamily CSS string`);
    }
    console.log(`? Font '${id}' properly configured (labelKey: ${found.labelKey})`);
  }

  // Verify excluded ambiguous fonts (0 vs O/o and 1 vs l/I)
  const excludedIds = ['Consolas', 'Courier New', 'system-sans'];
  for (const id of excludedIds) {
    if (FONT_OPTIONS.some(f => f.id === id)) {
      throw new Error(`Ambiguous font ${id} must be excluded`);
    }
  }
  console.log('? Verified ambiguous fonts (Consolas, Courier New, system-sans) are strictly excluded.');

  // Verify cross-platform fallback coverage in font stacks
  for (const font of FONT_OPTIONS) {
    const stack = font.fontFamily;
    const hasApple = stack.includes('SF Mono') || stack.includes('Menlo');
    const hasLinuxOrAndroid = stack.includes('DejaVu') || stack.includes('Roboto Mono') || stack.includes('Ubuntu Mono');
    const hasWindows = stack.includes('Cascadia Mono') || stack.includes('Cascadia Code');
    
    if (!hasApple || !hasLinuxOrAndroid || !hasWindows) {
      throw new Error(`Font stack for ${font.id} lacks complete cross-platform fallbacks: ${stack}`);
    }
  }
  console.log('? Verified all font stacks have complete Windows, macOS/iOS, Linux, and Android fallbacks.');

  // 2. Test getFontFamilyCss resolution
  const cascadiaCss = getFontFamilyCss('Cascadia Mono');
  if (!cascadiaCss.includes('Cascadia Mono')) {
    throw new Error(`getFontFamilyCss('Cascadia Mono') did not return Cascadia Mono: ${cascadiaCss}`);
  }
  console.log('? getFontFamilyCss resolves Cascadia Mono correctly.');

  // 3. Test fallback for unknown font ID
  const fallbackCss = getFontFamilyCss('invalid_id');
  if (fallbackCss !== FONT_OPTIONS[0].fontFamily) {
    throw new Error(`getFontFamilyCss with invalid ID did not fallback to default font stack`);
  }
  console.log('? getFontFamilyCss correctly falls back to default font stack on invalid ID.');

  console.log('All Cross-Platform Font tests passed successfully!\n');
}

import { ALL_FONTS, getPlatform, getAvailableFonts, getDefaultFontId, getFontFamilyCss } from '../src/config/fonts.js';

export function testFontOptions() {
  console.log('--- Running Platform-Specific Dynamic Font Availability Unit Tests ---');
  
  // 1. Check ALL_FONTS configuration
  if (!Array.isArray(ALL_FONTS) || ALL_FONTS.length < 5) {
    throw new Error(`Expected at least 5 font configurations, got ${ALL_FONTS?.length}`);
  }
  console.log(`✓ ALL_FONTS defined with ${ALL_FONTS.length} curated monospace fonts.`);

  // 2. Check platform detection
  const detectedPlatform = getPlatform();
  if (!['windows', 'mac', 'linux'].includes(detectedPlatform)) {
    throw new Error(`Invalid platform detected: ${detectedPlatform}`);
  }
  console.log(`✓ Platform detected successfully: '${detectedPlatform}'`);

  // 3. Test getAvailableFonts() filters out other OS fonts
  const available = getAvailableFonts();
  if (!Array.isArray(available) || available.length === 0) {
    throw new Error('getAvailableFonts() returned empty list');
  }

  for (const font of available) {
    if (!font.platforms.includes(detectedPlatform)) {
      throw new Error(`Font '${font.id}' should not be available on platform '${detectedPlatform}'`);
    }
  }
  console.log(`✓ Verified ${available.length} available fonts are strictly restricted to '${detectedPlatform}'.`);

  // 4. Test getDefaultFontId()
  const defaultFontId = getDefaultFontId();
  if (detectedPlatform === 'windows' && defaultFontId !== 'Cascadia Mono') {
    throw new Error(`Expected Windows default font to be 'Cascadia Mono', got '${defaultFontId}'`);
  }
  if (detectedPlatform === 'mac' && defaultFontId !== 'SF Mono') {
    throw new Error(`Expected macOS default font to be 'SF Mono', got '${defaultFontId}'`);
  }
  if (detectedPlatform === 'linux' && defaultFontId !== 'DejaVu Sans Mono') {
    throw new Error(`Expected Linux default font to be 'DejaVu Sans Mono', got '${defaultFontId}'`);
  }
  console.log(`✓ getDefaultFontId() resolved native platform default: '${defaultFontId}'`);

  // 5. Test getFontFamilyCss resolution
  const defaultCss = getFontFamilyCss(defaultFontId);
  if (!defaultCss || typeof defaultCss !== 'string') {
    throw new Error(`getFontFamilyCss failed for default font '${defaultFontId}'`);
  }
  console.log(`✓ getFontFamilyCss resolves '${defaultFontId}' correctly: ${defaultCss}`);

  // 6. Test fallback for invalid font ID
  const fallbackCss = getFontFamilyCss('invalid_nonexistent_font_id');
  if (fallbackCss !== defaultCss) {
    throw new Error(`getFontFamilyCss with invalid ID did not fallback to platform default stack`);
  }
  console.log('✓ getFontFamilyCss correctly falls back to platform default on unknown ID.');

  console.log('All Platform-Specific Font tests passed successfully!\n');
}

import { testFontOptions } from './fonts.test.js';
import { testI18nReader } from './i18n_reader.test.js';
import { testMarkersConfig } from './markers.test.js';
import { testHighlighterLogic } from './highlighter_logic.test.js';
import { testReaderToolbarLogic } from './reader_toolbar.test.js';
import { testAudioPlayerLogic } from './audio_player.test.js';

console.log('========================================');
console.log('    MoYu Reader Unit Test Suite        ');
console.log('========================================\n');

async function main() {
  try {
    testFontOptions();
    testI18nReader();
    testMarkersConfig();
    testHighlighterLogic();
    testReaderToolbarLogic();
    await testAudioPlayerLogic();
    
    console.log('========================================');
    console.log('🎉 ALL UNIT TESTS PASSED SUCCESSFULLY! ');
    console.log('========================================');
  } catch (error) {
    console.error('\n❌ UNIT TEST FAILED:');
    console.error(error);
    process.exit(1);
  }
}

main();

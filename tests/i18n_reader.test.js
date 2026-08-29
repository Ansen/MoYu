import { translations } from '../src/i18n/locales.js';

export function testI18nReader() {
  console.log('--- Running i18n Reader & Toolbar Unit Tests ---');
  
  if (!translations || !translations.zh || !translations.en) {
    throw new Error('Translations object missing zh or en translations');
  }

  const requiredKeys = [
    'reader.more',
    'reader.more.layout',
    'reader.more.font',
    'reader.view.grid',
    'reader.view.gridDesc',
    'reader.view.gridDisabled',
    'reader.view.text',
    'reader.view.textDesc',
    'reader.number.mode',
    'reader.number.long',
    'reader.number.short5',
    'reader.number.short10',
    'reader.font.cascadia',
    'reader.font.sfmono',
    'reader.font.jetbrains',
    'reader.font.fira',
    'reader.font.dejavu',
    'reader.more.autofit',
    'reader.more.autofitDesc',
    'reader.markers.title',
    'reader.markers.enable',
    'reader.markers.prefix',
    'reader.markers.suffix',
    'reader.markers.customPrefix',
    'reader.markers.customSuffix',
    'reader.markers.clear',
    'reader.markers.none',
    'reader.pages.unit',
    'reader.chapter.info',
    'reader.file.info',
    'reader.stats.totalChars',
    'reader.marker.prefixSending',
    'reader.marker.suffixSending',
    'common.copy',
    'common.copied',
    'common.fontSize.decrease',
    'common.fontSize.increase',
    'generator.epubPages',
    'generator.epubExport.generating',
    'generator.epubExport.packaging',
    'generator.epubExport.saving'
  ];

  for (const lang of ['zh', 'en']) {
    const dict = translations[lang];
    for (const key of requiredKeys) {
      if (!dict[key] || typeof dict[key] !== 'string') {
        throw new Error(`Missing or empty translation for key '${key}' in locale '${lang}'`);
      }
    }
    console.log(`✓ All ${requiredKeys.length} reader toolbar & typography keys exist in locale '${lang}'.`);
  }

  console.log('All i18n reader tests passed successfully!\n');
}

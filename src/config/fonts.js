export const FONT_OPTIONS = [
  {
    id: 'Cascadia Mono',
    labelKey: 'reader.font.cascadia',
    shortName: 'Cascadia Mono',
    fontFamily: '"Cascadia Mono", "Cascadia Code", "SF Mono", Menlo, "DejaVu Sans Mono", "Ubuntu Mono", "Roboto Mono", ui-monospace, monospace',
  },
  {
    id: 'SF Mono',
    labelKey: 'reader.font.sfmono',
    shortName: 'SF Mono',
    fontFamily: '"SF Mono", Menlo, Monaco, "Cascadia Mono", "DejaVu Sans Mono", "Roboto Mono", ui-monospace, monospace',
  },
  {
    id: 'JetBrains Mono',
    labelKey: 'reader.font.jetbrains',
    shortName: 'JetBrains Mono',
    fontFamily: '"JetBrains Mono", "Cascadia Mono", "SF Mono", Menlo, "DejaVu Sans Mono", "Roboto Mono", ui-monospace, monospace',
  },
  {
    id: 'Fira Code',
    labelKey: 'reader.font.fira',
    shortName: 'Fira Code',
    fontFamily: '"Fira Code", "Cascadia Mono", "SF Mono", Menlo, "DejaVu Sans Mono", "Roboto Mono", ui-monospace, monospace',
  },
  {
    id: 'DejaVu Sans Mono',
    labelKey: 'reader.font.dejavu',
    shortName: 'DejaVu Mono',
    fontFamily: '"DejaVu Sans Mono", "Ubuntu Mono", "Liberation Mono", "Roboto Mono", "Cascadia Mono", "SF Mono", monospace',
  },
];

export function getFontFamilyCss(fontId) {
  const found = FONT_OPTIONS.find(f => f.id === fontId);
  return found ? found.fontFamily : FONT_OPTIONS[0].fontFamily;
}

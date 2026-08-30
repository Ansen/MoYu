/**
 * 跨平台高辨识度等宽字体配置与可用性智能探测
 * 1. 仅向用户展示当前操作系统（Windows / macOS / Linux）切实可用的原生等宽字体
 * 2. 动态探测用户是否额外安装了热门编程等宽字体（JetBrains Mono、Fira Code）
 * 3. 杜绝在 Windows 上显示无法生效的 SF Mono，或在 Mac 上显示 Cascadia Mono 等无意义选项
 */

export function getPlatform() {
  if (typeof navigator === 'undefined') return 'windows';
  const ua = (navigator.userAgent || '').toLowerCase();
  const platform = (navigator.platform || '').toLowerCase();
  if (platform.includes('mac') || ua.includes('macintosh') || ua.includes('mac os')) return 'mac';
  if (platform.includes('linux') || ua.includes('android')) return 'linux';
  return 'windows';
}

export function isFontInstalled(fontName) {
  if (typeof document === 'undefined') return true;
  if (document.fonts && typeof document.fonts.check === 'function') {
    try {
      if (document.fonts.check(`16px "${fontName}"`)) return true;
    } catch {}
  }
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const testString = 'mmmmmmmmmmlli10099';
    ctx.font = '72px monospace';
    const baseW = ctx.measureText(testString).width;
    ctx.font = `72px "${fontName}", monospace`;
    const testW = ctx.measureText(testString).width;
    return Math.abs(testW - baseW) > 0.5;
  } catch {
    return true;
  }
}

export const ALL_FONTS = [
  // Windows Native Monospace
  {
    id: 'Cascadia Mono',
    shortName: 'Cascadia Mono',
    fontFamily: '"Cascadia Mono", "Cascadia Code", ui-monospace, monospace',
    platforms: ['windows'],
    isBuiltIn: true
  },
  // Apple macOS / iOS Native Monospace
  {
    id: 'SF Mono',
    shortName: 'SF Mono',
    fontFamily: '"SF Mono", Menlo, Monaco, ui-monospace, monospace',
    platforms: ['mac'],
    isBuiltIn: true
  },
  {
    id: 'Menlo',
    shortName: 'Menlo',
    fontFamily: 'Menlo, Monaco, "SF Mono", ui-monospace, monospace',
    platforms: ['mac'],
    isBuiltIn: true
  },
  // Linux Native Monospace
  {
    id: 'DejaVu Sans Mono',
    shortName: 'DejaVu Sans Mono',
    fontFamily: '"DejaVu Sans Mono", "Ubuntu Mono", "Liberation Mono", monospace',
    platforms: ['linux'],
    isBuiltIn: true
  },
  {
    id: 'Ubuntu Mono',
    shortName: 'Ubuntu Mono',
    fontFamily: '"Ubuntu Mono", "DejaVu Sans Mono", monospace',
    platforms: ['linux'],
    isBuiltIn: true
  },
  // Popular High-Legibility Coding Fonts (Shown dynamically if installed)
  {
    id: 'JetBrains Mono',
    shortName: 'JetBrains Mono',
    fontFamily: '"JetBrains Mono", monospace',
    platforms: ['windows', 'mac', 'linux'],
    isBuiltIn: false
  },
  {
    id: 'Fira Code',
    shortName: 'Fira Code',
    fontFamily: '"Fira Code", monospace',
    platforms: ['windows', 'mac', 'linux'],
    isBuiltIn: false
  }
];

export function getAvailableFonts() {
  const currentPlatform = getPlatform();
  return ALL_FONTS.filter(font => {
    if (!font.platforms.includes(currentPlatform)) return false;
    if (font.isBuiltIn) return true;
    return isFontInstalled(font.id);
  });
}

export function getDefaultFontId() {
  const platform = getPlatform();
  if (platform === 'mac') return 'SF Mono';
  if (platform === 'linux') return 'DejaVu Sans Mono';
  return 'Cascadia Mono';
}

export function getFontFamilyCss(fontId) {
  const found = ALL_FONTS.find(f => f.id === fontId);
  if (found) return found.fontFamily;
  const defaultId = getDefaultFontId();
  const def = ALL_FONTS.find(f => f.id === defaultId);
  return def ? def.fontFamily : 'ui-monospace, monospace';
}

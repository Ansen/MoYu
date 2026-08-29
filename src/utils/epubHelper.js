/**
 * EPUB 章节电子书排版助手
 * 专注于轻量流式排版、自适应屏幕阅读与摩尔斯报文起止符规范
 */

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatEpubChapterHtml({ groups = [], startMarker = '', endMarker = '' }) {
  const rawTokens = groups.map(g => (Array.isArray(g) ? g.join('') : String(g))).join(' ');
  let fullPageText = rawTokens;
  if (startMarker && startMarker.trim()) fullPageText = `${startMarker.trim()} ${fullPageText}`;
  if (endMarker && endMarker.trim()) fullPageText = `${fullPageText} ${endMarker.trim()}`;

  return `<p class="telegram-content" style="white-space: pre-wrap; word-break: break-all; line-height: 1.8; font-size: 1.1em; font-family: 'Cascadia Mono', 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, monospace; margin: 1em 0; color: #111111;">${escapeHtml(fullPageText)}</p>`;
}

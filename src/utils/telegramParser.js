/**
 * 电报电文智能分词与起止符分离解析器
 * 1. 自动检测并剔除报头起始符（===、KA、BT、HR等）
 * 2. 自动检测并剔除报尾复合结束符（iii +、iii、+、AR、SK等）
 * 3. 严格保障正文字组排版 100% 纯净，对齐 10 列网格
 */

const START_MARKER_REGEX = /^(=+|KA|HR|BT|CT|CQ|DE|AS)$/i;
const END_MARKER_REGEX = /^(iii|[iI]{1,5}|AR|SK|K|\+|\.|\/|=+|BT)$/i;

export function parseTelegramContent(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { startMarker: '', rows: [], endMarker: '', rawTokens: [], cleanText: '', isGridEligible: false };
  }

  let tokens = rawText.trim().split(/\s+/).filter(Boolean);
  let startMarker = '';
  let endMarker = '';

  // 1. 识别并剥离首组 1~2 组报头起始符（支持多词空格组合，如 ['===', '==='] 或 ['KA', 'BT'] 或 ['===']）
  if (tokens.length > 2 && START_MARKER_REGEX.test(tokens[0]) && START_MARKER_REGEX.test(tokens[1])) {
    startMarker = `${tokens[0]} ${tokens[1]}`;
    tokens = tokens.slice(2);
  } else if (tokens.length > 1 && START_MARKER_REGEX.test(tokens[0])) {
    startMarker = tokens[0];
    tokens = tokens.slice(1);
  }

  // 2. 识别并剥离末尾 1~2 组报尾结束符（支持多词空格组合，如 ['iii', '+'] 或 ['AR', 'SK'] 或 ['iii'] 或 ['+']）
  if (tokens.length > 2) {
    const last1 = tokens[tokens.length - 1];
    const last2 = tokens[tokens.length - 2];
    if (END_MARKER_REGEX.test(last2) && END_MARKER_REGEX.test(last1)) {
      endMarker = `${last2} ${last1}`;
      tokens = tokens.slice(0, -2);
    } else if (END_MARKER_REGEX.test(last1)) {
      endMarker = last1;
      tokens = tokens.slice(0, -1);
    }
  } else if (tokens.length > 1) {
    const last1 = tokens[tokens.length - 1];
    if (END_MARKER_REGEX.test(last1)) {
      endMarker = last1;
      tokens = tokens.slice(0, -1);
    }
  }

  // 3. 处理连续长数据串（如未分词的连续数字或字母串）
  const dataTokens = [];
  let hasLongToken = false;

  for (const t of tokens) {
    if (/^\d{8,}$/.test(t)) {
      const chunkLen = (t.length % 5 === 0 && t.length % 4 !== 0) ? 5 : 4;
      for (let i = 0; i < t.length; i += chunkLen) {
        dataTokens.push(t.slice(i, i + chunkLen));
      }
    } else if (/^[a-zA-Z]{10,}$/.test(t) && t.length % 5 === 0) {
      for (let i = 0; i < t.length; i += 5) {
        dataTokens.push(t.slice(i, i + 5));
      }
    } else {
      if (t.length > 5) {
        hasLongToken = true;
      }
      dataTokens.push(t);
    }
  }

  // 10 列网格排版资格判定：字组长度 <= 5 字符
  const isGridEligible = dataTokens.length > 0 && !hasLongToken && dataTokens.every(t => t.length <= 5);

  // 4. 按 10 列一行组织网格行数据
  const rows = [];
  const COLS = 10;
  for (let i = 0; i < dataTokens.length; i += COLS) {
    rows.push(dataTokens.slice(i, i + COLS));
  }

  const cleanText = dataTokens.join(' ');

  return {
    startMarker,
    endMarker,
    rows,
    rawTokens: dataTokens,
    cleanText,
    isGridEligible
  };
}

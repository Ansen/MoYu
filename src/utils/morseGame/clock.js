import { MORSE_DICT, getCharMorseCode } from '../morseCode.js';
import { generateStructuredRandomContent, GENERATOR_MODE } from '../morse/structuredRandom.js';

/**
 * 摩尔斯时钟与谱面生成引擎 (严格基于 PARIS 国际标准与专业分组报)
 */

// 物理固定基准：1个点 (1T) 映射的固定像素宽度 (保证点划几何比例绝对恒定)
export const DOT_BASE_PIXELS = 24;

/**
 * 获取指定 WPM 下单个基元 (T) 的毫秒数
 * T = 1200 / WPM (ms)
 */
export function getUnitElementMs(wpm) {
  const safeWpm = Math.max(5, Math.min(60, Number(wpm) || 12));
  return Math.round(1200 / safeWpm);
}

/**
 * 获取由 WPM 物理时钟唯一决定的渲染滚动流速 (px/ms)
 * CW 中空间即时间，速度完全且唯一由 WPM 决定！
 */
export function getPixelsPerMs(wpm) {
  const T = getUnitElementMs(wpm);
  return DOT_BASE_PIXELS / T;
}

/**
 * 专业分组报类型定义
 */
export const TELEGRAM_GROUP_MODES = [
  { id: GENERATOR_MODE.NUMBERS, name: '纯数字分组报 (4位/组)', groupLen: 4 },
  { id: GENERATOR_MODE.LETTERS, name: '纯字母分组报 (5位/组)', groupLen: 5 },
  { id: GENERATOR_MODE.MIXED,   name: '字母数字混合报 (5位/组)', groupLen: 5 }
];

/**
 * 随机生成一组标准分组报报文
 * @param {string} mode - 'numbers' | 'letters' | 'mixed'
 * @param {number} groupCount - 组数 (默认每次生成 4 组，适合一局跟发)
 * @returns {string} 报文字符串 (如 "9402 7183 2561 0394")
 */
export function generateRandomTelegramText(mode = GENERATOR_MODE.NUMBERS, groupCount = 4) {
  try {
    const res = generateStructuredRandomContent({
      mode,
      groupCount
    });
    if (res && res.groups && res.groups.length > 0) {
      return res.groups.map(g => g.join('')).join(' ');
    }
  } catch (err) {
    console.warn('generateStructuredRandomContent fallback:', err);
  }

  // 备用兜底
  if (mode === GENERATOR_MODE.NUMBERS) {
    return '5819 0274 3612 8490';
  } else if (mode === GENERATOR_MODE.LETTERS) {
    return 'KMXQZ BLTDA PWKVN HRJSY';
  }
  return '7KD9A 3M4PX 8NQ2Z W5L1Y';
}

/**
 * 将文本转换为带绝对时间戳的音符谱面
 */
export function generateMorseChart(text, wpm = 12, leadInMs = 2800, numberMode = 'long') {
  const T = getUnitElementMs(wpm);
  const cleanText = (text || '').trim().toUpperCase();
  const notes = [];
  let currentTime = leadInMs;
  let noteId = 0;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];

    if (char === ' ') {
      // 组与组之间间隔: 充足的 10T 留白，供报务员从容换组
      currentTime += 6 * T;
      continue;
    }

    const code = getCharMorseCode(char, numberMode);
    if (!code) continue;

    for (let cIdx = 0; cIdx < code.length; cIdx++) {
      const symbol = code[cIdx];
      const isDah = symbol === '-';
      const duration = isDah ? 3 * T : 1 * T;

      notes.push({
        id: `note_${++noteId}`,
        char,
        charIndex: i,
        symbolIndex: cIdx,
        isLastSymbolOfChar: cIdx === code.length - 1,
        type: isDah ? 'DAH' : 'DIT',
        symbol,
        hitTime: currentTime,
        duration,
        endTime: currentTime + duration,
        isHit: false,
        hitResult: null,
        timeOffset: 0,
        actualDuration: 0
      });

      // 点划内部间隔 (1T)
      currentTime += duration + 1 * T;
    }

    // 字符间间隔 (采用 Farnsworth 训练标准: 充足的 6T 呼吸间隙，已有 1T，补充 5T)
    currentTime += 5 * T;
  }

  return {
    text: cleanText,
    wpm,
    unitTime: T,
    pixelsPerMs: getPixelsPerMs(wpm),
    leadInMs,
    totalDuration: currentTime + 1200,
    notes
  };
}

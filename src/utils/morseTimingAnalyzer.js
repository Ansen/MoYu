import { textToMorseTokens, getCharMorseCode } from './morseCode.js';

/**
 * 计算标准 WPM 下单个时间单元 (unit / dot) 的毫秒数
 * PARIS 标准: 1 WPM = 50 units / 分钟 => 1 unit = 60,000 / (50 * wpm) = 1200 / wpm ms
 */
export function calculateUnitDuration(wpm = 20) {
  const safeWpm = Math.max(5, Math.min(60, Number(wpm) || 20));
  return 1200 / safeWpm;
}

/**
 * 根据文本和配置生成标准目标时间轴
 * @param {string} text - 输入文本
 * @param {number} wpm - 速度
 * @param {string} numberMode - 'long' | 'short5' | 'short10'
 * @returns {object} { pulses: Array, gaps: Array, totalDuration: number, unitMs: number, tokens: Array }
 */
export function generateTargetTimeline(input, wpm = 20, numberMode = 'long', options = {}) {
  let text = '';
  let configWpm = wpm;
  let configNumberMode = numberMode;
  let enableMarkers = false;
  let prefixMarker = '';
  let suffixMarker = '';
  let startIndex = 0;

  // 兼容单配置对象传参与传统多参数传参
  if (input && typeof input === 'object' && ('text' in input || 'wpm' in input)) {
    text = input.text || '';
    if (input.wpm !== undefined) configWpm = input.wpm;
    if (input.numberMode !== undefined) configNumberMode = input.numberMode;
    if (input.enableMarkers !== undefined) enableMarkers = Boolean(input.enableMarkers);
    if (input.prefixMarker !== undefined) prefixMarker = String(input.prefixMarker || '');
    if (input.suffixMarker !== undefined) suffixMarker = String(input.suffixMarker || '');
    if (input.startIndex !== undefined) startIndex = Math.max(0, Number(input.startIndex) || 0);
  } else {
    text = typeof input === 'string' ? input : (input && typeof input.text === 'string' ? input.text : '');
    if (options && typeof options === 'object') {
      if (options.enableMarkers !== undefined) enableMarkers = Boolean(options.enableMarkers);
      if (options.prefixMarker !== undefined) prefixMarker = String(options.prefixMarker || '');
      if (options.suffixMarker !== undefined) suffixMarker = String(options.suffixMarker || '');
      if (options.startIndex !== undefined) startIndex = Math.max(0, Number(options.startIndex) || 0);
    }
  }

  const unitMs = calculateUnitDuration(configWpm);

  // 1. 构建全序列 Tokens (100% 严格对齐 audioPlayer._buildQueue 的排队顺序与索引)
  const allTokens = [];

  // 前置起止符 (仅在从头播放 startIndex === 0 时追加)
  let prefixStart = -1;
  let prefixEnd = -1;
  if (startIndex === 0 && enableMarkers && prefixMarker && prefixMarker.trim()) {
    const pTokens = textToMorseTokens(prefixMarker.trim(), configNumberMode);
    for (const tok of pTokens) {
      allTokens.push({ ...tok, tokenType: 'prefix', markerText: prefixMarker.trim() });
    }
    allTokens.push({ char: ' ', code: null, tokenType: 'prefix_gap' });
  }

  // 正文 Tokens (严格保留其在原始 text 中的 index，支持 startIndex 切割对齐)
  const bodyTokens = textToMorseTokens(text || '', configNumberMode);
  for (const tok of bodyTokens) {
    if (startIndex > 0 && tok.index < startIndex) continue;
    allTokens.push({ ...tok, tokenType: 'body', rawIndex: tok.index });
  }

  // 后置起止符
  if (enableMarkers && suffixMarker && suffixMarker.trim()) {
    allTokens.push({ char: ' ', code: null, tokenType: 'suffix_gap' });
    const sTokens = textToMorseTokens(suffixMarker.trim(), configNumberMode);
    for (const tok of sTokens) {
      allTokens.push({ ...tok, tokenType: 'suffix', markerText: suffixMarker.trim() });
    }
  }

  const pulses = [];
  const gaps = [];
  const tokenAnchorMap = {}; // rawIndex -> { start, end, char }
  let currentTime = 0;

  for (let tIdx = 0; tIdx < allTokens.length; tIdx++) {
    const token = allTokens[tIdx];
    const tokenStartTime = currentTime;

    if (token.code === null) {
      // 单词间隔: 4 units (前一个字符已留 3 units 字符间隙，3 + 4 = 7 units)
      const gapDuration = 4 * unitMs;
      gaps.push({
        start: currentTime,
        end: currentTime + gapDuration,
        duration: gapDuration,
        type: 'WORD_GAP',
        char: ' '
      });
      currentTime += gapDuration;
      continue;
    }

    // 字符内点划：动态匹配最新的 numberMode
    let code = token.code;
    if (/[0-9]/.test(token.char)) {
      const latestCode = getCharMorseCode(token.char, configNumberMode);
      if (latestCode) code = latestCode;
    }

    for (let cIdx = 0; cIdx < code.length; cIdx++) {
      const symbol = code[cIdx];
      const isDah = symbol === '-';
      const pulseDuration = isDah ? unitMs * 3 : unitMs;
      
      const pulse = {
        id: `p_${tIdx}_${cIdx}`,
        start: currentTime,
        end: currentTime + pulseDuration,
        duration: pulseDuration,
        type: isDah ? 'DASH' : 'DOT',
        char: token.char,
        tokenType: token.tokenType,
        tokenIndex: token.rawIndex !== undefined ? token.rawIndex : -1,
        symbolIndex: cIdx
      };

      if (token.tokenType === 'prefix') {
        if (prefixStart === -1) prefixStart = currentTime;
        prefixEnd = currentTime + pulseDuration;
      }

      pulses.push(pulse);
      currentTime += pulseDuration;

      // 字符内点划间隙 (Element Gap = 1 unit)
      if (cIdx < code.length - 1) {
        gaps.push({
          start: currentTime,
          end: currentTime + unitMs,
          duration: unitMs,
          type: 'ELEMENT_GAP',
          char: token.char
        });
        currentTime += unitMs;
      }
    }

    // 字符间间隔 (Char Gap = 3 units): 每一个字符发音完后无条件追加 3 units
    const charGapDuration = 3 * unitMs;
    gaps.push({
      start: currentTime,
      end: currentTime + charGapDuration,
      duration: charGapDuration,
      type: 'CHAR_GAP',
      char: token.char
    });
    currentTime += charGapDuration;

    // 记录正文 Token 权威时间锚点
    if (token.tokenType === 'body' && token.rawIndex !== undefined) {
      tokenAnchorMap[token.rawIndex] = {
        start: Math.round(tokenStartTime),
        end: Math.round(currentTime),
        duration: Math.round(currentTime - tokenStartTime),
        char: token.char
      };
    }
  }

  return {
    pulses,
    gaps,
    totalDuration: currentTime,
    unitMs,
    wpm: configWpm,
    tokens: allTokens,
    tokenAnchorMap,
    prefixStart: prefixStart >= 0 ? prefixStart : 0,
    prefixEnd: prefixEnd >= 0 ? prefixEnd : 0
  };
}

/**
 * 将用户原始按键事件 (Raw Key Events) 提取为脉冲序列与间隔序列
 * @param {Array<{ timestamp: number, state: 'DOWN'|'UP' }>} rawEvents
 * @param {number} sessionStartTime
 * @returns {{ pulses: Array, gaps: Array }}
 */
export function extractUserPulsesAndGaps(rawEvents = [], sessionStartTime = 0) {
  const pulses = [];
  const gaps = [];

  let currentDown = null;

  for (let i = 0; i < rawEvents.length; i++) {
    const ev = rawEvents[i];
    // 优先读取显式 relative time，次取 performance.now() 时间差
    const relTime = ev.time !== undefined 
      ? Number(ev.time) 
      : Math.max(0, (ev.timestamp || 0) - sessionStartTime);

    if (ev.state === 'DOWN') {
      if (currentDown === null) {
        // 如果此前已有脉冲结束，则生成一个 Gap
        if (pulses.length > 0) {
          const prevPulse = pulses[pulses.length - 1];
          const gapDuration = Math.max(0, relTime - prevPulse.end);
          gaps.push({
            start: prevPulse.end,
            end: relTime,
            duration: gapDuration
          });
        }
        currentDown = relTime;
      }
    } else if (ev.state === 'UP') {
      if (currentDown !== null) {
        // 优先采用高精度物理按键持续时长 (ev.duration)
        const pulseDuration = (ev.duration !== undefined && ev.duration > 0)
          ? Number(ev.duration)
          : Math.max(10, relTime - currentDown);
        
        pulses.push({
          start: currentDown,
          end: currentDown + pulseDuration,
          duration: pulseDuration
        });
        currentDown = null;
      }
    }
  }

  return { pulses, gaps };
}

/**
 * 核心分析算法：对比用户实际脉冲与目标时间轴
 * @param {object} params
 * @param {object} params.targetTimeline - generateTargetTimeline 产物
 * @param {Array} params.userEvents - 原始按键事件数组
 * @param {number} params.sessionStartTime - 会话起始时间戳
 * @returns {object} 完整分析报告
 */
export function analyzeSession(arg1, arg2 = [], arg3 = 0) {
  let targetTimeline = null;
  let userEvents = [];
  let sessionStartTime = 0;

  // 1. 兼容单对象参数传参 { targetTimeline, userEvents, sessionStartTime }
  if (arg1 && typeof arg1 === 'object' && ('targetTimeline' in arg1 || 'userEvents' in arg1)) {
    targetTimeline = arg1.targetTimeline || null;
    userEvents = Array.isArray(arg1.userEvents) ? arg1.userEvents : [];
    sessionStartTime = Number(arg1.sessionStartTime) || 0;
  } 
  // 2. 兼容三位置参数传参 (targetTimeline, userEvents, sessionStartTime)
  else {
    targetTimeline = arg1 || null;
    userEvents = Array.isArray(arg2) ? arg2 : [];
    sessionStartTime = Number(arg3) || 0;
  }

  const safeTimeline = targetTimeline || { unitMs: 60, pulses: [], gaps: [], totalDuration: 0 };
  const unitMs = Number(safeTimeline.unitMs) || 60;
  const targetPulses = Array.isArray(safeTimeline.pulses) ? safeTimeline.pulses : [];
  const _targetGaps = Array.isArray(safeTimeline.gaps) ? safeTimeline.gaps : [];
  const { pulses: userPulses, gaps: userGaps } = extractUserPulsesAndGaps(userEvents, sessionStartTime);

  // 如果用户完全没有按键或目标为空
  if (userPulses.length === 0 || targetPulses.length === 0) {
    return {
      totalTargetPulses: targetPulses.length,
      totalUserPulses: userPulses.length,
      completionRate: 0,
      unitMs,
      avgDot: 0,
      avgDash: 0,
      dotDashRatio: 0,
      dotDeviation: 0,
      dashDeviation: 0,
      elementGapDeviation: 0,
      charGapDeviation: 0,
      timingConsistency: 0,
      overallScore: 0,
      grade: 'D',
      matchedPulses: []
    };
  }

  // 1. 动态自适应基准目标视窗：以用户实际打键起止范围为基准，兼顾局部跟发与全篇练习
  const minUserTime = userPulses.reduce((min, p) => Math.min(min, p.start), Infinity);
  const maxUserTime = userPulses.reduce((max, p) => Math.max(max, p.end), 0);
  
  // 容差视窗：扩展约一个字符的人机反应容差窗口 (unitMs * 4)，确保精准收敛跟发区间且杜绝多计入前后未敲击的冗余脉冲
  const windowMargin = Math.max(300, Math.round(unitMs * 4));
  const inRangeTargets = targetPulses.filter(
    (tp) => tp.start >= Math.max(0, minUserTime - windowMargin) && tp.start <= maxUserTime + windowMargin
  );
  const baselineTargets = inRangeTargets.length >= 2 ? inRangeTargets : targetPulses;

  // 2. 点与划客观分类 (PARIS 标准：以 2 个 unitMs 为界，小于为点，大于等于为划，不猜意图)
  const dotDashThreshold = unitMs * 2;
  const userDots = [];
  const userDashes = [];

  userPulses.forEach((p) => {
    if (p.duration < dotDashThreshold) {
      userDots.push(p.duration);
    } else {
      userDashes.push(p.duration);
    }
  });

  const avgDot = userDots.length > 0 
    ? userDots.reduce((a, b) => a + b, 0) / userDots.length 
    : unitMs;

  const avgDash = userDashes.length > 0 
    ? userDashes.reduce((a, b) => a + b, 0) / userDashes.length 
    : unitMs * 3;

  const dotDashRatio = avgDot > 0 ? Number((avgDash / avgDot).toFixed(2)) : 0;

  // 3. 偏差计算 (百分比)
  const dotDeviation = Number((((avgDot - unitMs) / unitMs) * 100).toFixed(1));
  const dashDeviation = Number((((avgDash - unitMs * 3) / (unitMs * 3)) * 100).toFixed(1));

  // 4. 间隔分析
  const userElemGaps = [];
  const userCharGaps = [];

  userGaps.forEach((g) => {
    if (g.duration < unitMs * 2) {
      userElemGaps.push(g.duration);
    } else if (g.duration < unitMs * 5) {
      userCharGaps.push(g.duration);
    }
  });

  const avgElemGap = userElemGaps.length > 0 
    ? userElemGaps.reduce((a, b) => a + b, 0) / userElemGaps.length 
    : unitMs;
  const elementGapDeviation = Number((((avgElemGap - unitMs) / unitMs) * 100).toFixed(1));

  const avgCharGap = userCharGaps.length > 0 
    ? userCharGaps.reduce((a, b) => a + b, 0) / userCharGaps.length 
    : unitMs * 3;
  const charGapDeviation = Number((((avgCharGap - unitMs * 3) / (unitMs * 3)) * 100).toFixed(1));

  // 5. 节奏稳定性 (Timing Consistency)
  let consistency = 100;
  if (userDots.length >= 2) {
    const variance = userDots.reduce((sum, d) => sum + Math.pow(d - avgDot, 2), 0) / userDots.length;
    const stdDev = Math.sqrt(variance);
    const cv = stdDev / avgDot;
    consistency = Math.max(30, Math.min(100, Math.round(100 - cv * 80)));
  }

  // 6. 逐脉冲点划客观识别与时间容差匹配 (不猜意图，纯靠按键时长判定点划)
  let matchedCount = 0;
  const matchedTargetIndices = new Set();
  const timeToleranceMs = Math.max(300, unitMs * 3.5); // 允许合理的人机按键延迟

  for (let i = 0; i < userPulses.length; i++) {
    const up = userPulses[i];
    // 简简单单通过按下时间判定是点还是划：小于 2 个单元为点，大于等于为划
    const userSymbol = up.duration < dotDashThreshold ? 'DOT' : 'DASH';

    // 在时间窗口内寻找最近且符号一致的目标脉冲
    let bestMatchIdx = -1;
    let minTimeDiff = Infinity;

    for (let j = 0; j < baselineTargets.length; j++) {
      if (matchedTargetIndices.has(j)) continue;
      const tp = baselineTargets[j];
      const diff = Math.abs(up.start - tp.start);
      if (diff <= timeToleranceMs && diff < minTimeDiff) {
        // 客观比对：用户按出的符号类型与目标符号完全一致
        if (tp.type === userSymbol) {
          minTimeDiff = diff;
          bestMatchIdx = j;
        }
      }
    }

    if (bestMatchIdx !== -1) {
      matchedCount++;
      matchedTargetIndices.add(bestMatchIdx);
    }
  }

  // 识别准确率 (基于实际敲键数量与有效目标脉冲)
  const compareBase = Math.max(1, Math.min(userPulses.length, baselineTargets.length));
  const accuracyRate = Math.min(100, Math.round((matchedCount / compareBase) * 100));

  // 7. 点划比得分 (标准 3.0，允许 2.2 ~ 3.8 宽容区间)
  const ratioDiff = Math.abs(dotDashRatio - 3.0);
  const ratioScore = Math.max(0, Math.min(100, Math.round(100 - ratioDiff * 25)));

  // 8. 数量匹配得分 (对比用户按键与对应区间的目标脉冲数)
  const countDiffRatio = Math.abs(userPulses.length - baselineTargets.length) / Math.max(1, baselineTargets.length);
  const countScore = Math.max(0, Math.min(100, Math.round((1 - Math.min(1, countDiffRatio)) * 100)));

  // 9. 综合得分 (以点划识别准确率为核心驱动)
  const overallScore = Math.round(
    accuracyRate * 0.40 +
    countScore * 0.20 +
    ratioScore * 0.20 +
    consistency * 0.20
  );

  let grade = 'D';
  if (overallScore >= 88) grade = 'S';
  else if (overallScore >= 78) grade = 'A';
  else if (overallScore >= 68) grade = 'B';
  else if (overallScore >= 55) grade = 'C';

  return {
    totalTargetPulses: baselineTargets.length,
    totalUserPulses: userPulses.length,
    matchedCount,
    accuracyRate,
    completionRate: Math.min(100, Math.round((userPulses.length / baselineTargets.length) * 100)),
    unitMs: Math.round(unitMs),
    avgDot: Math.round(avgDot),
    avgDash: Math.round(avgDash),
    dotDashRatio,
    dotDeviation,
    dashDeviation,
    elementGapDeviation,
    charGapDeviation,
    timingConsistency: consistency,
    overallScore,
    grade,
    userPulses,
    userGaps
  };
}

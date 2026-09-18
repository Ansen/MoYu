/**
 * 莫尔斯音游动态容差判定与报务诊断引擎
 */

/**
 * 判定单次击打质量
 * @param {Object} note - 目标音符对象
 * @param {number} timeOffsetMs - 按键与音符标准的时差 (ms, 负数抢拍, 正数慢拍)
 * @param {number} unitTimeT - 当前 WPM 的基元时长 (ms)
 * @param {number|null} holdDurationMs - 用户按键持续时间 (若是手键长按模式则传入)
 * @returns {Object} 判定结果 { grade: 'PERFECT'|'GREAT'|'GOOD'|'MISS', score, deltaMs }
 */
export function evaluateHit(note, timeOffsetMs, unitTimeT, holdDurationMs = null) {
  const absOffset = Math.abs(timeOffsetMs);
  
  // 动态容差窗口 (基元占比与绝对生理极限取兼顾值)
  const perfectWindow = Math.max(25, Math.round(unitTimeT * 0.28));
  const greatWindow = Math.max(50, Math.round(unitTimeT * 0.55));
  const goodWindow = Math.max(80, Math.round(unitTimeT * 0.85));

  let grade = 'MISS';
  let score = 0;

  if (absOffset <= perfectWindow) {
    grade = 'PERFECT';
    score = 1000;
  } else if (absOffset <= greatWindow) {
    grade = 'GREAT';
    score = 650;
  } else if (absOffset <= goodWindow) {
    grade = 'GOOD';
    score = 350;
  } else {
    grade = 'MISS';
    score = 0;
  }

  // 若提供了持续时长 (手键长短按模式)，检验长按是否按满
  if (holdDurationMs !== null && grade !== 'MISS') {
    const durationRatio = holdDurationMs / note.duration;
    // 标准比值应该接近 1.0
    if (durationRatio < 0.6) {
      // 划按太短，降级
      grade = grade === 'PERFECT' ? 'GREAT' : 'GOOD';
      score = Math.round(score * 0.7);
    }
  }

  return {
    grade,
    score,
    timeOffsetMs: Math.round(timeOffsetMs),
    holdDurationMs: holdDurationMs ? Math.round(holdDurationMs) : null
  };
}

/**
 * 结算并生成专业报务能力诊断报告
 * @param {Array} notes - 谱面所有音符列表 (包含 hitResult, timeOffset 等)
 * @param {number} totalScore - 累计得分
 * @param {number} maxCombo - 最大连击数
 * @param {number} targetWpm - 当前谱面设定字速
 * @returns {Object} 报务诊断综合报告
 */
export function generateDiagnosticReport(notes, totalScore, maxCombo, targetWpm) {
  const totalNotes = notes.length;
  let perfectCount = 0;
  let greatCount = 0;
  let goodCount = 0;
  let missCount = 0;

  const hitOffsets = [];
  const ditDurations = [];
  const dahDurations = [];

  notes.forEach(note => {
    if (note.hitResult === 'PERFECT') perfectCount++;
    else if (note.hitResult === 'GREAT') greatCount++;
    else if (note.hitResult === 'GOOD') goodCount++;
    else missCount++;

    if (note.isHit) {
      hitOffsets.push(note.timeOffset);
      if (note.actualDuration) {
        if (note.type === 'DIT') ditDurations.push(note.actualDuration);
        else dahDurations.push(note.actualDuration);
      }
    }
  });

  // 准确率计算 (PERFECT 100%, GREAT 70%, GOOD 40%, MISS 0%)
  const weightedScore = (perfectCount * 1.0 + greatCount * 0.7 + goodCount * 0.4) / (totalNotes || 1);
  const accuracyPercent = Math.round(weightedScore * 100);

  // 平均起键相位偏移
  const avgPhaseShift = hitOffsets.length > 0
    ? Math.round((hitOffsets.reduce((a, b) => a + b, 0) / hitOffsets.length) * 10) / 10
    : 0;

  // 实测点划比 (Dit : Dah)
  const avgDit = ditDurations.length > 0 ? (ditDurations.reduce((a, b) => a + b, 0) / ditDurations.length) : null;
  const avgDah = dahDurations.length > 0 ? (dahDurations.reduce((a, b) => a + b, 0) / dahDurations.length) : null;
  let actualRatio = null;
  if (avgDit && avgDah) {
    actualRatio = Math.round((avgDah / avgDit) * 100) / 100;
  }

  // 综合评级
  let rank = 'C';
  if (accuracyPercent >= 98 && missCount === 0) rank = 'SSS';
  else if (accuracyPercent >= 93) rank = 'S';
  else if (accuracyPercent >= 85) rank = 'A';
  else if (accuracyPercent >= 75) rank = 'B';

  // 诊断处方与手癖矫正建议
  const prescriptions = [];
  if (avgPhaseShift < -15) {
    prescriptions.push(`起键存在明显习惯性抢拍 (平均提前 ${Math.abs(avgPhaseShift)}ms)，建议听清起振瞬间再稳重下键。`);
  } else if (avgPhaseShift > 20) {
    prescriptions.push(`按键响应存在滞后 (平均滞后 ${avgPhaseShift}ms)，建议多借助视觉轨道提前量提前预备。`);
  } else {
    prescriptions.push('起振节奏感极佳，时钟同步精度达到专业报务员水准！');
  }

  if (actualRatio !== null) {
    if (actualRatio < 2.6) {
      prescriptions.push(`长划偏短 (实测点划比 1 : ${actualRatio}，标准为 1 : 3.0)，长按请更有耐性按满时长。`);
    } else if (actualRatio > 3.4) {
      prescriptions.push(`长划偏拖沓 (实测点划比 1 : ${actualRatio})，长按尾部松手建议更干脆。`);
    } else {
      prescriptions.push(`点划长度比例标准 (1 : ${actualRatio})，波形规整。`);
    }
  }

  if (missCount > totalNotes * 0.2) {
    prescriptions.push('脱靶率偏高，建议先将 WPM 降低 2~3 个档位练习肌肉记忆。');
  }

  return {
    totalScore,
    maxCombo,
    accuracyPercent,
    rank,
    targetWpm,
    stats: {
      total: totalNotes,
      perfect: perfectCount,
      great: greatCount,
      good: goodCount,
      miss: missCount
    },
    timing: {
      avgPhaseShiftMs: avgPhaseShift,
      ditDahRatio: actualRatio || '自动键锁定',
    },
    prescriptions
  };
}

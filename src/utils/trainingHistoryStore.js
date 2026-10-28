/**
 * 摩尔斯跟发训练历史记录与易错字符聚合统计服务 (TrainingHistoryStore)
 * 1. 结构化持久化历次会话成绩 (WPM, 准确率, 点划比, 综合评分, 字符级错题)
 * 2. 统计聚合：长期进阶趋势、评级分布、易错字符热力图 (Weakness Heatmap)
 * 3. 响应式事件广播：跨组件即时感知历史数据更新
 */

const STORAGE_KEY = 'moyu_cw_training_history_v1';
const MAX_HISTORY_RECORDS = 150;
const EVENT_NAME = 'moyu-training-history-change';

/**
 * 获取全部历史练习记录 (按时间倒序)
 * @returns {Array<object>}
 */
export function getTrainingHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/**
 * 保存一次跟发训练会话成绩
 * @param {object} session
 * @returns {object|null}
 */
export function saveTrainingSession(session) {
  if (!session || typeof session !== 'object') return null;

  try {
    const history = getTrainingHistory();
    const record = {
      id: session.id || `th_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Number(session.timestamp) || Date.now(),
      wpm: Number(session.wpm) || 20,
      overallScore: Math.round(Number(session.overallScore) || 0),
      grade: session.grade || 'D',
      accuracyRate: Math.round(Number(session.accuracyRate) || 0),
      timingConsistency: Math.round(Number(session.timingConsistency) || 0),
      dotDashRatio: Number(session.dotDashRatio) || 0,
      completionRate: Math.round(Number(session.completionRate) || 0),
      totalTargetPulses: Number(session.totalTargetPulses) || 0,
      totalUserPulses: Number(session.totalUserPulses) || 0,
      matchedCount: Number(session.matchedCount) || 0,
      charStats: (session.charStats && typeof session.charStats === 'object') ? session.charStats : {},
      weakestChars: Array.isArray(session.weakestChars) ? session.weakestChars : [],
      mode: session.mode || 'live',
      inputDevice: session.inputDevice || 'keyboard',
      chapterTitle: session.chapterTitle || ''
    };

    const nextHistory = [record, ...history].slice(0, MAX_HISTORY_RECORDS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextHistory));
    notifyChange();
    return record;
  } catch (err) {
    console.error('Failed to save training session:', err);
    return null;
  }
}

/**
 * 删除单条历史记录
 * @param {string} id
 */
export function deleteTrainingSession(id) {
  try {
    const history = getTrainingHistory();
    const filtered = history.filter((item) => item.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    notifyChange();
  } catch {}
}

/**
 * 清空所有历史记录
 */
export function clearTrainingHistory() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    notifyChange();
  } catch {}
}

/**
 * 聚合统计分析：总体能力指标、趋势数据与易错字符热力图
 * @returns {object}
 */
export function getAggregatedTrainingStats() {
  const history = getTrainingHistory();
  if (history.length === 0) {
    return {
      totalSessions: 0,
      avgScore: 0,
      avgWpm: 0,
      gradeDistribution: { S: 0, A: 0, B: 0, C: 0, D: 0 },
      recentTrend: [],
      charHeatmap: {},
      weakestCharsRanked: []
    };
  }

  const totalSessions = history.length;
  let totalScoreSum = 0;
  let totalWpmSum = 0;
  const gradeDist = { S: 0, A: 0, B: 0, C: 0, D: 0 };
  const charAggregate = {}; // char -> { char, total, errors, correct, errorRate }

  for (let i = 0; i < history.length; i++) {
    const item = history[i];
    totalScoreSum += item.overallScore || 0;
    totalWpmSum += item.wpm || 0;

    const g = item.grade || 'D';
    if (gradeDist[g] !== undefined) {
      gradeDist[g]++;
    }

    // 累加字符级统计
    if (item.charStats && typeof item.charStats === 'object') {
      for (const ch in item.charStats) {
        const cs = item.charStats[ch];
        if (!charAggregate[ch]) {
          charAggregate[ch] = { char: ch, total: 0, errors: 0, correct: 0 };
        }
        charAggregate[ch].total += cs.total || 0;
        charAggregate[ch].errors += cs.errors || 0;
        charAggregate[ch].correct += cs.correct || 0;
      }
    }
  }

  // 计算每个字符的综合错误率
  const charHeatmap = {};
  for (const ch in charAggregate) {
    const item = charAggregate[ch];
    const errorRate = item.total > 0 ? Number((item.errors / item.total).toFixed(2)) : 0;
    charHeatmap[ch] = {
      ...item,
      errorRate
    };
  }

  // 排序得出易错字符榜单 (优先错误率，次优先绝对错误数，再次优先总测试数)
  const weakestCharsRanked = Object.values(charHeatmap)
    .filter((item) => item.errors > 0)
    .sort((a, b) => b.errorRate - a.errorRate || b.errors - a.errors || b.total - a.total);

  // 近期走势 (取最近 15 次，按时间从旧到新排列供图表绘制)
  const recentTrend = history
    .slice(0, 15)
    .reverse()
    .map((item) => ({
      id: item.id,
      timestamp: item.timestamp,
      date: new Date(item.timestamp).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }),
      time: new Date(item.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
      score: item.overallScore,
      wpm: item.wpm,
      grade: item.grade
    }));

  return {
    totalSessions,
    avgScore: Math.round(totalScoreSum / totalSessions),
    avgWpm: Math.round(totalWpmSum / totalSessions),
    gradeDistribution: gradeDist,
    recentTrend,
    charHeatmap,
    weakestCharsRanked
  };
}

/**
 * 广播数据更新通知
 */
function notifyChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENT_NAME));
  }
}

/**
 * 订阅训练历史变化
 * @param {Function} callback
 * @returns {Function} 取消订阅函数
 */
export function subscribeTrainingHistory(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => {
    try {
      callback(getAggregatedTrainingStats());
    } catch {}
  };
  window.addEventListener(EVENT_NAME, handler);
  window.addEventListener('storage', handler);
  return () => {
    window.removeEventListener(EVENT_NAME, handler);
    window.removeEventListener('storage', handler);
  };
}


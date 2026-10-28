import React, { useState, useEffect, useMemo } from 'react';
import { 
  Award, 
  TrendingUp, 
  BarChart2, 
  Flame, 
  Trash2, 
  X, 
  Zap, 
  RotateCcw, 
  Calendar, 
  Clock, 
  AlertTriangle, 
  CheckCircle2,
  Sparkles
} from 'lucide-react';
import { useI18n } from '../../i18n';
import { 
  getTrainingHistory, 
  getAggregatedTrainingStats, 
  deleteTrainingSession, 
  clearTrainingHistory,
  subscribeTrainingHistory
} from '../../utils/trainingHistoryStore';

const STANDARD_KEYBOARD_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.split('');

export default function TrainingHistoryModal({
  isOpen,
  onClose,
  onStartWeakPractice // (weakChars: string[]) => void
}) {
  const { t, lang } = useI18n();
  const isEn = lang === 'en';

  const [activeTab, setActiveTab] = useState('heatmap'); // 'heatmap' | 'history' | 'trend'
  const [stats, setStats] = useState(() => getAggregatedTrainingStats());
  const [historyList, setHistoryList] = useState(() => getTrainingHistory());

  // 响应式监听存储变化
  useEffect(() => {
    if (!isOpen) return;
    setStats(getAggregatedTrainingStats());
    setHistoryList(getTrainingHistory());

    const unsubscribe = subscribeTrainingHistory(() => {
      setStats(getAggregatedTrainingStats());
      setHistoryList(getTrainingHistory());
    });
    return () => unsubscribe();
  }, [isOpen]);

  // 全键盘全景热力图矩阵计算 (A-Z, 0-9 加上任何测试过的特殊符号)
  const fullHeatmapList = useMemo(() => {
    const map = stats.charHeatmap || {};
    const extraChars = Object.keys(map).filter(c => !STANDARD_KEYBOARD_CHARS.includes(c));
    const allChars = [...STANDARD_KEYBOARD_CHARS, ...extraChars.sort()];

    return allChars.map(char => {
      const recorded = map[char];
      if (recorded && recorded.total > 0) {
        return {
          char,
          total: recorded.total,
          errors: recorded.errors,
          correct: recorded.correct,
          errorRate: recorded.errorRate,
          tested: true
        };
      }
      return {
        char,
        total: 0,
        errors: 0,
        correct: 0,
        errorRate: 0,
        tested: false
      };
    });
  }, [stats.charHeatmap]);

  if (!isOpen) return null;

  const {
    totalSessions,
    avgScore,
    avgWpm,
    gradeDistribution,
    recentTrend,
    weakestCharsRanked
  } = stats;

  const topWeakChars = weakestCharsRanked.slice(0, 8);
  const topWeakCharList = topWeakChars.map((item) => item.char);

  const gradeColors = {
    S: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    A: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    B: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    C: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    D: 'text-rose-500 bg-rose-500/10 border-rose-500/30'
  };

  const handleClearAll = () => {
    if (window.confirm(t('training.history.clearConfirm', '确定要清空全部训练历史记录吗？此操作不可恢复。'))) {
      clearTrainingHistory();
      setStats(getAggregatedTrainingStats());
      setHistoryList([]);
    }
  };

  const handleDeleteItem = (id, e) => {
    e.stopPropagation();
    deleteTrainingSession(id);
    setStats(getAggregatedTrainingStats());
    setHistoryList(getTrainingHistory());
  };

  const handleLaunchWeakPractice = () => {
    if (topWeakCharList.length > 0 && onStartWeakPractice) {
      onClose();
      onStartWeakPractice(topWeakCharList);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#181818] border border-slate-200 dark:border-[#2d2d2d] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#282828] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/40">
              <BarChart2 size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">
                {t('training.history.title', '跟发训练档案与易错分析')}
              </h2>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {t('training.history.subtitle', '沉淀发报成长曲线 · 精准定位肌肉记忆薄弱点')}
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#252525] transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Summary Metrics Bar */}
        <div className="px-6 py-3.5 bg-slate-50/80 dark:bg-[#1f1f1f]/80 border-b border-slate-200/80 dark:border-[#282828] grid grid-cols-4 gap-3 text-center shrink-0">
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{t('training.history.totalSessions', '累计练习')}</span>
            <span className="text-lg font-bold text-slate-800 dark:text-slate-100">{totalSessions} <span className="text-xs font-normal text-slate-400">{t('training.history.runsUnit', '次')}</span></span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{t('training.history.avgScore', '平均评分')}</span>
            <span className={`text-lg font-bold ${avgScore >= 80 ? 'text-emerald-500' : avgScore >= 60 ? 'text-indigo-500' : 'text-amber-500'}`}>
              {avgScore} <span className="text-xs font-normal text-slate-400">{t('training.history.ptsUnit', '分')}</span>
            </span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{t('training.history.avgWpm', '平均速度')}</span>
            <span className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{avgWpm} <span className="text-xs font-normal text-slate-400">WPM</span></span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-[11px] text-slate-400 dark:text-slate-500">{t('training.history.masteryRate', '卓越率 (S/A)')}</span>
            <span className="text-lg font-bold text-sky-500">
              {totalSessions > 0 ? Math.round(((gradeDistribution.S + gradeDistribution.A) / totalSessions) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-200 dark:border-[#282828] flex items-center justify-between shrink-0">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('heatmap')}
              className={`py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'heatmap'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Flame size={14} />
              {t('training.history.tabHeatmap', '易错字符热力图')}
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'history'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <Calendar size={14} />
              {t('training.history.tabHistory', '历史练习明细')}
              <span className="ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-100 dark:bg-[#252525] text-slate-500">
                {historyList.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('trend')}
              className={`py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'trend'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
            >
              <TrendingUp size={14} />
              {t('training.history.tabTrend', '成长轨迹')}
            </button>
          </div>

          {historyList.length > 0 && activeTab === 'history' && (
            <button
              onClick={handleClearAll}
              className="text-xs text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 flex items-center gap-1 hover:underline cursor-pointer"
            >
              <Trash2 size={12} />
              {t('training.history.clearAll', '清空记录')}
            </button>
          )}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* TAB 1: 易错字符热力图 */}
          {activeTab === 'heatmap' && (
            <div className="space-y-6">
              
              {/* Top Weakness Action Banner */}
              {topWeakChars.length > 0 ? (
                <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-200">
                        {t('training.history.topWeakTitle', '检测到高频失误薄弱字符')}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {topWeakChars.map((item) => (
                        <span 
                          key={item.char}
                          className="px-2 py-0.5 rounded-md font-mono text-xs font-bold bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700/60"
                        >
                          {item.char} <span className="font-normal text-[10px] opacity-80">{Math.round(item.errorRate * 100)}% {t('training.history.errorSuffix', '错')}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {onStartWeakPractice && (
                    <button
                      onClick={handleLaunchWeakPractice}
                      className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                    >
                      <Sparkles size={14} />
                      {t('training.result.practiceWeak', '一键专项加练')}
                    </button>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <p className="text-xs text-emerald-800 dark:text-emerald-200">
                    {totalSessions > 0
                      ? t('training.history.noWeakness', '表现卓越！近期练习中未发现持续性易错字符，手感极佳。')
                      : t('training.history.noData', '暂无数据。完成一次跟发训练后即可自动生成专属易错图谱。')}
                  </p>
                </div>
              )}

              {/* All Characters Master Grid (全景全键盘熟练度矩阵) */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold">{t('training.history.heatmapTitle', '全字符熟练度热力矩阵')}</span>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500"></span>{t('training.history.mastered', '纯熟')}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-500"></span>{t('training.history.minorErrors', '偶尔偏离')}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-rose-500"></span>{t('training.history.highErrors', '易错')}</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-slate-200 dark:bg-[#333333]"></span>{t('training.history.untested', '未练')}</span>
                  </div>
                </div>

                <div className="grid grid-cols-6 sm:grid-cols-9 md:grid-cols-12 gap-2 font-mono">
                  {fullHeatmapList.map((item) => {
                    const { char, tested, errorRate, total, errors } = item;
                    let badgeBg = 'bg-slate-100/70 text-slate-400 dark:bg-[#202020] dark:text-[#555555] border-slate-200/80 dark:border-[#2a2a2a]';
                    let label = '--';

                    if (tested) {
                      label = `${Math.round((1 - errorRate) * 100)}%`;
                      if (errorRate >= 0.35) {
                        badgeBg = 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800/60 font-bold';
                      } else if (errorRate > 0.1) {
                        badgeBg = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50';
                      } else {
                        badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40';
                      }
                    }

                    const tooltip = tested
                      ? `${char}: ${total} ${t('training.history.runsUnit', '次')}, ${errors} ${t('training.history.errorSuffix', '错')} (${Math.round(errorRate * 100)}%)`
                      : `${char}: ${t('training.history.untestedTip', '未测试')}`;

                    return (
                      <div
                        key={char}
                        className={`p-2 rounded-lg border text-center transition-all ${badgeBg}`}
                        title={tooltip}
                      >
                        <div className="text-sm font-bold">{char}</div>
                        <div className="text-[10px] opacity-75">{label}</div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: 历史练习明细清单 */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              {historyList.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                  {t('training.history.noHistory', '暂无历史跟发练习记录。在阅读器中开启跟发并敲击电键即可自动归档。')}
                </div>
              ) : (
                historyList.map((item) => {
                  const dateStr = new Date(item.timestamp).toLocaleString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });
                  return (
                    <div 
                      key={item.id}
                      className="p-3.5 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50/60 dark:bg-[#202020]/60 hover:bg-slate-100/80 dark:hover:bg-[#252525] transition-all flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3">
                        <span className={`w-8 h-8 rounded-lg font-bold flex items-center justify-center text-sm border ${gradeColors[item.grade] || gradeColors.B}`}>
                          {item.grade}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {item.chapterTitle || (isEn ? 'Follow Training' : '跟发训练')}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                              {item.wpm} WPM
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              {item.inputDevice === 'ch552g' ? 'CH552G' : 'KEYBOARD'}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                            <span>{dateStr}</span>
                            <span>•</span>
                            <span>{isEn ? 'Score' : '得分'}: <strong className="text-slate-700 dark:text-slate-200">{item.overallScore}</strong></span>
                            <span>•</span>
                            <span>{isEn ? 'Accuracy' : '识别率'}: <strong className="text-slate-700 dark:text-slate-200">{item.accuracyRate}%</strong></span>
                            <span>•</span>
                            <span>{isEn ? 'Ratio' : '点划比'}: <strong className="text-slate-700 dark:text-slate-200">{item.dotDashRatio}</strong></span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {item.weakestChars && item.weakestChars.length > 0 && (
                          <div className="hidden sm:flex items-center gap-1">
                            {item.weakestChars.slice(0, 3).map((ch) => (
                              <span key={ch} className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/40">
                                {ch}
                              </span>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={(e) => handleDeleteItem(item.id, e)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200 dark:hover:bg-[#2b2b2b] transition-colors cursor-pointer"
                          title={t('training.history.deleteRecord', '删除该条记录')}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* TAB 3: 成长轨迹折线走势 */}
          {activeTab === 'trend' && (
            <div className="space-y-4">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                {t('training.history.trendTitle', '近 15 次练习综合得分与发报速度趋势')}
              </div>

              {recentTrend.length >= 2 ? (
                <div className="p-4 rounded-xl border border-slate-200 dark:border-[#2d2d2d] bg-slate-50/50 dark:bg-[#202020]/50 space-y-4">
                  <div className="h-44 flex items-end gap-2 pt-6 pb-2 px-2 border-b border-slate-200 dark:border-[#333333]">
                    {recentTrend.map((pt, idx) => {
                      const scoreHeight = Math.max(10, Math.min(100, pt.score));
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                          {/* Tooltip */}
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-8 px-2 py-1 rounded bg-slate-800 text-white text-[10px] whitespace-nowrap z-10 pointer-events-none">
                            {pt.date} · {pt.score}{t('training.history.ptsUnit', '分')} · {pt.wpm}WPM
                          </div>
                          <div 
                            style={{ height: `${scoreHeight}%` }}
                            className={`w-full rounded-t-md transition-all ${
                              pt.score >= 80 ? 'bg-emerald-500' : pt.score >= 68 ? 'bg-indigo-500' : 'bg-amber-500'
                            }`}
                          ></div>
                          <span className="text-[10px] font-mono text-slate-400 truncate max-w-full">
                            {pt.score}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>{recentTrend[0]?.date}</span>
                    <span className="font-semibold text-slate-600 dark:text-slate-300">{t('training.history.timelineArrow', '时间序列推进 →')}</span>
                    <span>{recentTrend[recentTrend.length - 1]?.date}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500 text-xs">
                  {t('training.history.needMoreTrend', '需要至少 2 次训练记录方可生成连续成长走势图。')}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-200 dark:border-[#282828] flex items-center justify-between bg-slate-50 dark:bg-[#1a1a1a] shrink-0">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {t('training.history.storageTip', '数据安全持久化存储于本机。')}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg border border-slate-300 dark:border-[#383838] bg-white dark:bg-[#252525] text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#2f2f2f] transition-colors cursor-pointer"
          >
            {isEn ? 'Close' : '关闭'}
          </button>
        </div>

      </div>
    </div>
  );
}

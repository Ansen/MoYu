import React from 'react';
import { Award, CheckCircle2, RotateCcw, X, Activity, Zap, BarChart2, Lightbulb } from 'lucide-react';
import { useI18n } from '../../i18n';

export default function TrainingResultModal({ isOpen, onClose, onRetry, result, wpm }) {
  const { t } = useI18n();

  if (!isOpen || !result) return null;

  const {
    overallScore = 0,
    grade = 'B',
    completionRate = 0,
    unitMs = 60,
    avgDot = 60,
    avgDash = 180,
    avgElementGap = null,
    avgCharGap = null,
    dotDashRatio = 3.0,
    dotDeviation = 0,
    dashDeviation = 0,
    elementGapDeviation = 0,
    charGapDeviation = 0,
    timingConsistency = 90,
    totalTargetPulses = 0,
    totalUserPulses = 0
  } = result;

  // 教练诊断建议生成逻辑
  const diagnosticTips = [];
  if (dotDeviation < -25) {
    diagnosticTips.push(t('training.result.adviceDotShort', '点 (DOT) 明显偏短（实际仅为标准的一半），打键稍显发飘，建议下压时手腕下沉按实，送足单基准时长。'));
  } else if (dotDeviation > 25) {
    diagnosticTips.push(t('training.result.adviceDotLong', '点 (DOT) 持续偏长，提手略有粘连，可加快断开节奏。'));
  }

  if (dotDashRatio > 3.8) {
    diagnosticTips.push(t('training.result.adviceRatioHigh', '点划比例偏大（划较长或点过短），注意保持 1:3 黄金比例。'));
  } else if (dotDashRatio < 2.2 && dotDashRatio > 0) {
    diagnosticTips.push(t('training.result.adviceRatioLow', '划 (DASH) 长度偏短，容易被误听为点，长划请按足 3 个单基准时间。'));
  }

  if (timingConsistency < 60) {
    diagnosticTips.push(t('training.result.adviceConsistency', '点划识别率良好，节奏略有起伏，建议跟随系统节拍保持均匀呼吸与敲击惯性。'));
  }

  if (diagnosticTips.length === 0) {
    diagnosticTips.push(t('training.result.adviceGood', '节奏稳健、点划比例标准，发挥出色，继续保持！'));
  }

  // 评级颜色体系
  const gradeColors = {
    S: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/30',
    A: 'text-sky-500 bg-sky-500/10 border-sky-500/30',
    B: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/30',
    C: 'text-amber-500 bg-amber-500/10 border-amber-500/30',
    D: 'text-rose-500 bg-rose-500/10 border-rose-500/30'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1c1c1c] border border-slate-200 dark:border-[#333333] w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#2a2a2a] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="text-indigo-500" size={22} />
            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
              {t('training.result.title', '跟发训练成绩复盘报告')}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#282828] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar space-y-6">
          
          {/* Top Score Banner */}
          <div className="flex items-center justify-between p-5 rounded-xl bg-slate-50 dark:bg-[#141414] border border-slate-200/80 dark:border-[#262626]">
            <div>
              <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">{t('training.result.overallScore', '综合发报评分')}</span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-4xl font-extrabold text-slate-900 dark:text-white font-mono">{overallScore}</span>
                <span className="text-sm text-slate-400">{t('training.result.scoreUnit', '/ 100 分')}</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">{t('training.result.speedInfo', { wpm, unitMs }, `速度: ${wpm} WPM · 标准单基准: ${unitMs}ms`)}</p>
            </div>
            <div className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center font-black text-3xl font-mono shadow-inner ${gradeColors[grade] || gradeColors.B}`}>
              {grade}
            </div>
          </div>

          {/* Three Core Indicator Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#282828] text-center">
              <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1">
                <Activity size={12} className="text-indigo-500" /> {t('training.result.dotDashRatio', '点划比例')}
              </span>
              <div className="mt-1.5 font-mono text-xl font-bold text-slate-800 dark:text-slate-200">
                1 : {dotDashRatio}
              </div>
              <span className="text-[11px] text-slate-400">{t('training.result.standardRatio', '标准 1:3.0')}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#282828] text-center">
              <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1">
                <Zap size={12} className="text-amber-500" /> {t('training.result.timingConsistency', '节奏稳定性')}
              </span>
              <div className="mt-1.5 font-mono text-xl font-bold text-slate-800 dark:text-slate-200">
                {timingConsistency}%
              </div>
              <span className="text-[11px] text-slate-400">{t('training.result.timingConsistencyDesc', '离散度评估')}</span>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#181818] border border-slate-200 dark:border-[#282828] text-center">
              <span className="text-xs text-slate-400 font-medium flex items-center justify-center gap-1">
                <BarChart2 size={12} className="text-emerald-500" /> {t('training.result.accuracyRate', '点划识别率')}
              </span>
              <div className="mt-1.5 font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                {result?.accuracyRate !== undefined ? `${result.accuracyRate}%` : `${completionRate}%`}
              </div>
              <span className="text-[11px] text-slate-400">{t('training.result.pulsesMatched', { matched: result?.matchedCount !== undefined ? result.matchedCount : totalUserPulses, total: totalTargetPulses }, `命中 ${result?.matchedCount !== undefined ? result.matchedCount : totalUserPulses} / ${totalTargetPulses} 脉冲`)}</span>
            </div>
          </div>

          {/* Detailed Timing Table */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('training.result.breakdown', '分项时序偏差详细分析')}</h4>
            <div className="rounded-xl border border-slate-200 dark:border-[#282828] overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 dark:bg-[#202020] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-[#282828]">
                    <th className="p-2.5 font-medium">{t('training.result.metric', '测量指标')}</th>
                    <th className="p-2.5 font-medium">{t('training.result.standardLength', '标准长度')}</th>
                    <th className="p-2.5 font-medium">{t('training.result.actualAverage', '实际平均')}</th>
                    <th className="p-2.5 font-medium text-right">{t('training.result.deviation', '偏差')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#282828] font-mono text-slate-700 dark:text-slate-300">
                  <tr>
                    <td className="p-2.5 font-sans">{t('training.result.dot', '点 (DOT)')}</td>
                    <td className="p-2.5">{unitMs} ms</td>
                    <td className="p-2.5">{avgDot} ms</td>
                    <td className={`p-2.5 text-right font-bold ${Math.abs(dotDeviation) <= 15 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {dotDeviation >= 0 ? `+${dotDeviation}%` : `${dotDeviation}%`}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans">{t('training.result.dash', '划 (DASH)')}</td>
                    <td className="p-2.5">{unitMs * 3} ms</td>
                    <td className="p-2.5">{avgDash} ms</td>
                    <td className={`p-2.5 text-right font-bold ${Math.abs(dashDeviation) <= 15 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {dashDeviation >= 0 ? `+${dashDeviation}%` : `${dashDeviation}%`}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans">{t('training.result.elementGap', '字符内间隔 (Element Gap)')}</td>
                    <td className="p-2.5">{unitMs} ms</td>
                    <td className="p-2.5">{avgElementGap !== null ? `${avgElementGap} ms` : '-'}</td>
                    <td className={`p-2.5 text-right font-bold ${Math.abs(elementGapDeviation) <= 20 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {elementGapDeviation >= 0 ? `+${elementGapDeviation}%` : `${elementGapDeviation}%`}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-sans">{t('training.result.charGap', '字符间间隔 (Char Gap)')}</td>
                    <td className="p-2.5">{unitMs * 3} ms</td>
                    <td className="p-2.5">{avgCharGap !== null ? `${avgCharGap} ms` : '-'}</td>
                    <td className={`p-2.5 text-right font-bold ${Math.abs(charGapDeviation) <= 20 ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {charGapDeviation >= 0 ? `+${charGapDeviation}%` : `${charGapDeviation}%`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Coaching Diagnostics Box */}
          <div className="p-3.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs space-y-1.5">
            <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
              <Lightbulb size={14} className="text-amber-500" />
              <span>{t('training.result.diagnostics', '教练诊断建议：')}</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-600 dark:text-slate-300 leading-relaxed pl-0.5">
              {diagnosticTips.map((tip, idx) => (
                <li key={idx} className="marker:text-indigo-400">{tip}</li>
              ))}
            </ul>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-[#2a2a2a] bg-slate-50 dark:bg-[#161616] flex items-center justify-end gap-3">
          <button
            onClick={onRetry}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-[#262626] hover:bg-slate-300 dark:hover:bg-[#303030] text-slate-700 dark:text-slate-200 transition-colors flex items-center gap-1.5 active:scale-95 cursor-pointer"
          >
            <RotateCcw size={14} /> {t('training.result.retry', '再练一次')}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors flex items-center gap-1.5 shadow-md shadow-indigo-600/20 active:scale-95 cursor-pointer"
          >
            <CheckCircle2 size={14} /> {t('training.result.finish', '完成')}
          </button>
        </div>

      </div>
    </div>
  );
}

import React from 'react';
import { Award, Target, Activity, Clock, RotateCcw, X } from 'lucide-react';

/**
 * 战后报务体检诊断弹窗
 */
export default function DiagnosticModal({ report, onRestart, onClose }) {
  if (!report) return null;

  const {
    totalScore,
    maxCombo,
    accuracyPercent,
    rank,
    targetWpm,
    stats,
    timing,
    prescriptions = []
  } = report;

  const rankColors = {
    'SSS': 'from-amber-400 to-yellow-500 text-amber-950',
    'S': 'from-yellow-400 to-amber-500 text-amber-950',
    'A': 'from-cyan-400 to-blue-500 text-blue-950',
    'B': 'from-emerald-400 to-teal-500 text-teal-950',
    'C': 'from-slate-400 to-zinc-500 text-zinc-950'
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* 顶部标题栏 */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2">
            <Award className="text-amber-400" size={22} />
            <h2 className="text-lg font-bold tracking-wide">报务能力诊断体检报告</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[80vh]">
          
          {/* 评级徽章与核心分数 */}
          <div className="flex items-center justify-between bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${rankColors[rank] || rankColors.C} flex items-center justify-center font-black text-3xl shadow-lg`}>
                {rank}
              </div>
              <div>
                <div className="text-xs text-slate-400 uppercase tracking-widest font-semibold">综合评级</div>
                <div className="text-2xl font-black text-amber-400 tracking-tight">{totalScore.toLocaleString()} 分</div>
              </div>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">准确率 / 最大连击</div>
              <div className="text-lg font-bold text-slate-200">
                <span className="text-emerald-400">{accuracyPercent}%</span> / <span className="text-cyan-400">{maxCombo} 连击</span>
              </div>
            </div>
          </div>

          {/* 判定统计条 */}
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="bg-slate-800/40 p-2.5 rounded-lg border border-amber-500/20">
              <div className="text-amber-400 font-bold">良 (PERFECT)</div>
              <div className="text-base font-black mt-0.5 text-slate-200">{stats.perfect}</div>
            </div>
            <div className="bg-slate-800/40 p-2.5 rounded-lg border border-cyan-500/20">
              <div className="text-cyan-400 font-bold">可 (GREAT)</div>
              <div className="text-base font-black mt-0.5 text-slate-200">{stats.great}</div>
            </div>
            <div className="bg-slate-800/40 p-2.5 rounded-lg border border-yellow-500/20">
              <div className="text-yellow-400 font-bold">次 (GOOD)</div>
              <div className="text-base font-black mt-0.5 text-slate-200">{stats.good}</div>
            </div>
            <div className="bg-slate-800/40 p-2.5 rounded-lg border border-rose-500/20">
              <div className="text-rose-400 font-bold">不可 (MISS)</div>
              <div className="text-base font-black mt-0.5 text-slate-200">{stats.miss}</div>
            </div>
          </div>

          {/* 专业报务微观时序诊断 */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Activity size={15} className="text-cyan-400" />
              微观时序与点划诊断 (基准: {targetWpm} WPM)
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">实测点划比 (Dit:Dah)</div>
                  <div className="text-sm font-bold text-slate-200 mt-0.5">
                    {typeof timing.ditDahRatio === 'number' ? `1 : ${timing.ditDahRatio}` : timing.ditDahRatio}
                  </div>
                </div>
                <div className="text-[10px] text-slate-500">国际标准 1:3.0</div>
              </div>

              <div className="bg-slate-800/50 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-400">平均起键时差 (Phase)</div>
                  <div className={`text-sm font-bold mt-0.5 ${timing.avgPhaseShiftMs < 0 ? 'text-amber-400' : 'text-blue-400'}`}>
                    {timing.avgPhaseShiftMs > 0 ? `+${timing.avgPhaseShiftMs}` : timing.avgPhaseShiftMs} ms
                  </div>
                </div>
                <div className="text-[10px] text-slate-500">
                  {timing.avgPhaseShiftMs < 0 ? '习惯抢拍' : '习惯慢拍'}
                </div>
              </div>
            </div>
          </div>

          {/* 算法手癖处方与建议 */}
          {prescriptions.length > 0 && (
            <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3.5 space-y-1.5">
              <div className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                <Target size={14} className="text-indigo-400" />
                报务员手癖处方与矫正建议
              </div>
              <ul className="text-xs text-indigo-200/90 space-y-1 pl-4 list-disc">
                {prescriptions.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </div>
          )}

        </div>

        {/* 底部操作按钮 */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            返回大厅
          </button>
          <button
            onClick={onRestart}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-2 shadow-lg shadow-amber-500/20 transition active:scale-95"
          >
            <RotateCcw size={16} />
            再来一局
          </button>
        </div>

      </div>
    </div>
  );
}

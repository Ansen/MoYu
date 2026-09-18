import React, { useState } from 'react';
import { Radio, ShieldAlert, Waves, KeyRound, ArrowRight, Rocket, Activity, Disc, Cpu, Zap, Signal, Compass } from 'lucide-react';
import TaikoGameView from './game/TaikoGameView.jsx';
import ZTypeGameView from './game/ZTypeGameView.jsx';

export default function GameLobby() {
  // 当前处于大厅(null)或具体特训作战
  const [activeGame, setActiveGame] = useState('ztype');

  if (activeGame === 'ztype') {
    return <ZTypeGameView onBackToLobby={() => setActiveGame(null)} />;
  }

  if (activeGame === 'taiko') {
    return <TaikoGameView onBackToLobby={() => setActiveGame(null)} />;
  }

  const trainingMissions = [
    {
      id: 'ztype',
      code: 'MISSION 01 // 拦截截击',
      title: '深空信标拦截战 (Morse Interceptor)',
      badge: '实战就绪',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      desc: '外星舰队搭载高频加密分组报（纯数字/纯字母/混合报）扑向防线！手键拍发点划凝聚「实体字符飞弹」对撞轰击，亦可切换即时高能激光！',
      icon: <Rocket className="text-amber-400" size={26} />,
      status: 'playable',
      specs: [
        { label: '火力模式', val: '字符飞弹 / 即时激光' },
        { label: '题库协议', val: '4位数字 / 5位字母' },
        { label: '时钟标准', val: 'PARIS 国际 WPM' },
        { label: '支持硬件', val: 'CH552G 电键 / 键盘鼠标' }
      ],
      tags: ['字符飞弹对撞', 'ZType深空', '手键长短按', '巨舰解体']
    },
    {
      id: 'taiko',
      code: 'MISSION 02 // 节拍校准',
      title: '声纳谐波跟发台 (Sonar Echo Taiko)',
      badge: '专业跟发',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      desc: '单轨雷达示波器模型！380Hz 标准连续波音频注入，严格 Farnsworth 呼吸留白。长划长按金色蓄力，毫秒级战后电离层体检报告。',
      icon: <Activity className="text-cyan-400" size={26} />,
      status: 'playable',
      specs: [
        { label: '载波频率', val: '380Hz 标准连续波' },
        { label: '评级模型', val: '同进同出 4 级容差' },
        { label: '时钟留白', val: 'Farnsworth 5T~6T' },
        { label: '体检诊断', val: '点划比 / 大小间隔' }
      ],
      tags: ['单轨示波器', '金色长划蓄力', '肌肉记忆', '时序体检']
    },
    {
      id: 'blind_copy',
      code: 'MISSION 03 // 盲听抄报',
      title: '电离层盲听抄收 (Blind Copy Master)',
      badge: '战备筹备中',
      badgeColor: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
      desc: '隐去所有视觉雷达与字符提示，仅凭高阻抗耳机在电离层衰落 (QSB)、天电噪波与邻频干扰中盲听抄收密电。',
      icon: <Radio className="text-emerald-400" size={26} />,
      status: 'coming_soon',
      specs: [
        { label: '训练模式', val: '纯音频听辨' },
        { label: '环境模拟', val: 'QSB衰落 / 噪波' },
        { label: '评估重点', val: '抄报极速与准确率' }
      ],
      tags: ['盲听抄报', '短波杂音', '极速反应']
    },
    {
      id: 'deflector',
      code: 'MISSION 04 // 弹幕招架',
      title: '电码超导防线 (Radio Deflector)',
      badge: '战备筹备中',
      badgeColor: 'bg-slate-700/40 text-slate-400 border-slate-600/30',
      desc: '面对密集加密报文流，短按点划弹反招架，长按护盾吸收电荷，满载释放超导电磁脉冲贯穿全屏。',
      icon: <ShieldAlert className="text-rose-400" size={26} />,
      status: 'coming_soon',
      specs: [
        { label: '操作机制', val: '招架 & 充能' },
        { label: '终极技能', val: '超导 EMP 脉冲' },
        { label: '挑战对象', val: '重型电报母舰' }
      ],
      tags: ['充能爆发', '对冲抵消', 'Boss防线']
    }
  ];

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[#05080e] text-slate-100 p-6 lg:p-8 flex flex-col items-center select-none font-sans">
      <div className="max-w-5xl w-full space-y-6">
        
        {/* 1. 顶部专业短波电台 HUD 状态仪表盘 */}
        <div className="bg-[#090f1b]/95 border border-cyan-500/20 rounded-2xl p-4 shadow-xl shadow-cyan-950/20 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800/80">
            
            {/* 电台呼号与代号 */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-cyan-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Radio size={22} className="animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black font-mono tracking-widest text-amber-400 uppercase">CW HQ-OPS // 7.023MHz</span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span>
                </div>
                <h1 className="text-lg font-black text-slate-100 tracking-tight">
                  CW 无线电报务实战与战备特训总局
                </h1>
              </div>
            </div>

            {/* 仪器指标参数 */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
                <Signal size={14} className="text-cyan-400" />
                <span className="text-slate-400">电离层:</span>
                <span className="text-cyan-300 font-bold">F2 REFLECT (GOOD)</span>
              </div>
              <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
                <Zap size={14} className="text-amber-400" />
                <span className="text-slate-400">天线驻波比:</span>
                <span className="text-amber-300 font-bold">SWR 1.15</span>
              </div>
              <div className="bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-2">
                <Cpu size={14} className="text-emerald-400" />
                <span className="text-slate-400">电键接口:</span>
                <span className="text-emerald-300 font-bold">CH552G HID / SPACE</span>
              </div>
            </div>

          </div>

          {/* 状态语 */}
          <div className="pt-3 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold font-mono">STANDBY:</span>
              <span>所有训练模块均遵循 PARIS 国际电报时钟体系，无论手键短按轻击还是长划蓄力，全速响应。</span>
            </div>
            <span className="text-[11px] font-mono text-slate-500 hidden md:inline-block">
              MODE: STRAIGHT KEY / 380Hz AUDIO
            </span>
          </div>
        </div>

        {/* 2. 特训任务卡片网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {trainingMissions.map(m => {
            const isPlayable = m.status === 'playable';
            return (
              <div
                key={m.id}
                onClick={() => isPlayable && setActiveGame(m.id)}
                className={`group relative p-6 rounded-2xl border transition-all duration-200 flex flex-col justify-between overflow-hidden ${
                  isPlayable
                    ? 'bg-[#090f1b]/90 border-slate-700/80 hover:border-amber-500/80 hover:shadow-2xl hover:shadow-amber-500/10 cursor-pointer'
                    : 'bg-[#090f1b]/40 border-slate-800/80 opacity-60 cursor-not-allowed'
                }`}
              >
                {/* 顶部背景微弱光晕 */}
                {isPlayable && (
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/10 transition"></div>
                )}

                <div>
                  {/* 代号与徽标 */}
                  <div className="flex items-start justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 group-hover:scale-105 group-hover:border-amber-500/50 transition">
                        {m.icon}
                      </div>
                      <div>
                        <div className="text-[10px] font-mono font-bold tracking-wider text-slate-400 uppercase">
                          {m.code}
                        </div>
                        <h3 className="text-base font-black text-slate-100 group-hover:text-amber-400 transition-colors">
                          {m.title}
                        </h3>
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${m.badgeColor}`}>
                      {m.badge}
                    </span>
                  </div>

                  {/* 简报描述 */}
                  <p className="text-xs text-slate-300 leading-relaxed mt-2 mb-4">
                    {m.desc}
                  </p>

                  {/* 核心规格参数指标表 */}
                  <div className="grid grid-cols-2 gap-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 text-[11px] font-mono mb-4">
                    {m.specs.map(s => (
                      <div key={s.label} className="flex flex-col">
                        <span className="text-[10px] text-slate-500">{s.label}</span>
                        <span className="text-slate-200 font-bold">{s.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 底部操作区 */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                  <div className="flex flex-wrap gap-1.5">
                    {m.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                        {tag}
                      </span>
                    ))}
                  </div>

                  {isPlayable ? (
                    <span className="flex items-center gap-1.5 text-xs font-black text-amber-400 group-hover:translate-x-1 transition-transform">
                      接入特训 <ArrowRight size={14} />
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-500 font-medium">战备筹备中</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}


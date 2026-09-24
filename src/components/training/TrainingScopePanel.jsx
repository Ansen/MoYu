import React from 'react';
import { 
  Eye, 
  EyeOff, 
  VolumeX, 
  Volume2,
  ChevronDown, 
  ChevronUp, 
  BarChart2, 
  Cpu, 
  Keyboard,
  Clock
} from 'lucide-react';
import MorseTimelineCanvas from './MorseTimelineCanvas';
import { useI18n } from '../../i18n';

export default function TrainingScopePanel({
  isCollapsed = false,
  onToggleCollapse,
  trainingMode = 'live',
  setTrainingMode,
  inputDevice = 'keyboard',
  setInputDevice,
  keyType = 'straight',
  setKeyType,
  paddleReverse = false,
  setPaddleReverse,
  playheadPosition = 'right',
  setPlayheadPosition,
  timeWindowSec = 8,
  setTimeWindowSec,
  onConnectSerial,
  isSerialConnected = false,
  isKeyDown = false,
  pressDuration = 0,
  targetTimeline = [],
  userEvents = [],
  currentTime = 0,
  isPlaying = false,
  isFinished = false,
  onOpenResult,
  hasResult = false,
  height = 30,
  sidetoneOffset = 80,
  setSidetoneOffset,
  effectiveSidetoneFreq = 480,
  morseFreq = 400,
  onManualDown,
  onManualUp
}) {
  const { t } = useI18n();
  return (
    <div className="border-t border-slate-200 dark:border-[#282828] bg-slate-50/95 dark:bg-[#161616]/95 backdrop-blur-md shrink-0 transition-all select-none">
      
      {/* 示波器顶栏轻量控制条: 严控单行不折行，极简专业排版 */}
      <div className="h-8 px-3 sm:px-4 flex items-center justify-between text-xs border-b border-slate-200/50 dark:border-[#222222] whitespace-nowrap overflow-x-auto overflow-y-hidden custom-scrollbar select-none gap-2">
        
        {/* 左侧：电键指示灯(支持触控打键)、硬件/键盘图标切换、纯图标模式胶囊、侧音频率微调 */}
        <div className="flex items-center gap-2 shrink-0">
          {/* 电键状态指示灯 (支持鼠标点击/屏幕长按触摸发报) */}
          <div 
            onMouseDown={(e) => {
              e.preventDefault();
              onManualDown?.();
            }}
            onMouseUp={(e) => {
              e.preventDefault();
              onManualUp?.();
            }}
            onMouseLeave={() => {
              if (isKeyDown) onManualUp?.();
            }}
            onTouchStart={(e) => {
              e.preventDefault();
              onManualDown?.();
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              onManualUp?.();
            }}
            className={`h-6 px-1.5 rounded-md font-mono text-[11px] font-semibold flex items-center gap-1.5 transition-all shadow-2xs whitespace-nowrap shrink-0 cursor-pointer select-none active:scale-95 ${
              isKeyDown 
                ? 'bg-emerald-500 text-white shadow-emerald-500/30' 
                : 'bg-slate-200/80 dark:bg-[#252525] text-slate-600 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-[#303030]'
            }`}
            title={isKeyDown ? t('training.scope.keyDown', '电键按下 (支持长按发报)') : t('training.scope.keyUp', '电键待命 (点击或长按可虚拟发报)')}
          >
            <span className={`w-2 h-2 rounded-full ${isKeyDown ? 'bg-white animate-ping' : 'bg-slate-400 dark:bg-slate-500'}`} />
            {pressDuration > 0 && (
              <span className="font-mono text-[10.5px]">{pressDuration}ms</span>
            )}
          </div>

          {/* 输入源切换图标: 键盘 (默认) ↔ CH552G 硬件芯片 */}
          <button
            type="button"
            onClick={() => {
              if (inputDevice === 'keyboard') {
                setInputDevice?.('ch552g');
                if (!isSerialConnected && onConnectSerial) {
                  onConnectSerial();
                }
              } else if (!isSerialConnected) {
                if (onConnectSerial) onConnectSerial();
              } else {
                setInputDevice?.('keyboard');
              }
            }}
            className={`h-6 px-1.5 rounded-md flex items-center gap-1 text-[11px] font-medium border transition-all cursor-pointer whitespace-nowrap shrink-0 ${
              inputDevice === 'ch552g'
                ? isSerialConnected
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 shadow-2xs'
                  : 'bg-amber-50 text-amber-600 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800 shadow-2xs'
                : 'bg-slate-200/80 dark:bg-[#252525] border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
            title={
              inputDevice === 'ch552g'
                ? isSerialConnected
                  ? t('training.scope.ch552gConnected', 'CH552G 实体电键已连接 (点击切回键盘)')
                  : t('training.scope.ch552gConnect', 'CH552G 实体电键未连接 (点击连接或切回键盘)')
                : t('training.scope.deviceKeyboard', '当前为键盘 Space 发报 (点击切换为 CH552G 实体电键)')
            }
          >
            {inputDevice === 'ch552g' ? <Cpu size={13} /> : <Keyboard size={13} />}
            {inputDevice === 'ch552g' && (
              <span className="text-[10px] font-mono font-bold">{isSerialConnected ? 'USB' : 'OFF'}</span>
            )}
          </button>

          {/* 电键模式切换胶囊: 手键 (直键) ↔ 自动键 (双桨) */}
          <div className="flex items-center bg-slate-200/80 dark:bg-[#222222] p-0.5 rounded-lg border border-slate-300/60 dark:border-[#333333] shrink-0 h-6 text-[10.5px]">
            <button
              type="button"
              onClick={() => setKeyType?.('straight')}
              className={`h-full px-1.5 rounded-md flex items-center justify-center font-medium transition-colors cursor-pointer select-none ${
                keyType === 'straight'
                  ? 'bg-white dark:bg-[#181818] text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={t('training.scope.keyTypeStraightTooltip', '手键模式（直键/大二芯）：单触点发报，忽略 P15 引脚防短路误触')}
            >
              <span>{t('training.scope.keyTypeStraight', '手键')}</span>
            </button>
            <button
              type="button"
              onClick={() => setKeyType?.('paddle')}
              className={`h-full px-1.5 rounded-md flex items-center justify-center font-medium transition-colors cursor-pointer select-none ${
                keyType === 'paddle'
                  ? 'bg-white dark:bg-[#181818] text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={t('training.scope.keyTypePaddleTooltip', '自动键模式（双桨/大三芯）：支持点划双触点独立采集')}
            >
              <span>{t('training.scope.keyTypePaddle', '自动键')}</span>
            </button>

            {keyType === 'paddle' && (
              <button
                type="button"
                onClick={() => setPaddleReverse?.((prev) => !prev)}
                className="h-full px-1.5 border-l border-slate-300/80 dark:border-[#333333] ml-0.5 flex items-center justify-center font-mono text-[9.5px] font-semibold text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors cursor-pointer select-none"
                title={paddleReverse 
                  ? t('training.scope.paddleReverseTooltip', '自动键极性反转：P14=点(Dit) / P15=划(Dah) [点击切换为标准]') 
                  : t('training.scope.paddleNormalTooltip', '自动键标准极性：P14=划(Dah) / P15=点(Dit) [点击切换为反转]')}
              >
                <span>{paddleReverse ? '点/划' : '划/点'}</span>
              </button>
            )}
          </div>

          {/* 模式选择胶囊 (纯图标切换: 实时 / 盲跟 / 静音) */}
          <div className="flex items-center bg-slate-200/80 dark:bg-[#222222] p-0.5 rounded-lg border border-slate-300/60 dark:border-[#333333] shrink-0 h-6">
            <button
              onClick={() => setTrainingMode('live')}
              className={`h-full px-2 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                trainingMode === 'live'
                  ? 'bg-white dark:bg-[#181818] text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={t('training.scope.modeLive', '实时模式：听发同步，完整展示系统电码波形')}
            >
              <Eye size={13} />
            </button>
            <button
              onClick={() => setTrainingMode('blind')}
              className={`h-full px-2 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                trainingMode === 'blind'
                  ? 'bg-white dark:bg-[#181818] text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={t('training.scope.modeBlind', '盲跟模式：隐藏系统电码波形，盲听跟发')}
            >
              <EyeOff size={13} />
            </button>
            <button
              onClick={() => setTrainingMode(trainingMode === 'silent' ? 'live' : 'silent')}
              className={`h-full px-2 rounded-md flex items-center justify-center transition-colors cursor-pointer ${
                trainingMode === 'silent'
                  ? 'bg-white dark:bg-[#181818] text-indigo-600 dark:text-indigo-400 shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={trainingMode === 'silent' ? t('training.scope.modeSilentRestore', '伴听已静音：点击恢复播放') : t('training.scope.modeSilent', '静音模式：仅保留自身侧音，静音系统伴听')}
            >
              <VolumeX size={13} />
            </button>
          </div>

          {/* 示波器走纸视角模式: 走纸 (右侧 85%) ↔ 前瞻 (左侧 20%) */}
          <div className="flex items-center bg-slate-200/80 dark:bg-[#222222] p-0.5 rounded-lg border border-slate-300/60 dark:border-[#333333] shrink-0 h-6 text-[10.5px]">
            <button
              type="button"
              onClick={() => setPlayheadPosition?.('right')}
              className={`h-full px-1.5 rounded-md flex items-center justify-center font-medium transition-colors cursor-pointer select-none ${
                playheadPosition === 'right'
                  ? 'bg-white dark:bg-[#181818] text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={t('training.scope.playheadRightTooltip', '走纸记录仪模式：当前时刻线位于右侧(85%)，点划在右端实时产生并向左沉淀流淌')}
            >
              <span>{t('training.scope.playheadRight', '走纸')}</span>
            </button>
            <button
              type="button"
              onClick={() => setPlayheadPosition?.('left')}
              className={`h-full px-1.5 rounded-md flex items-center justify-center font-medium transition-colors cursor-pointer select-none ${
                playheadPosition === 'left'
                  ? 'bg-white dark:bg-[#181818] text-indigo-600 dark:text-indigo-400 font-semibold shadow-2xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={t('training.scope.playheadLeftTooltip', '前瞻领跑模式：当前时刻线位于左侧(20%)，留出宽幅前瞻视野提前看谱')}
            >
              <span>{t('training.scope.playheadLeft', '前瞻')}</span>
            </button>
          </div>

          {/* 示波器时基窗口微调: 控制流淌速度 (4s-16s，默认8s，大幅降低20~30 WPM视觉流速) */}
          <div 
            className="flex items-center bg-slate-200/80 dark:bg-[#222222] px-2 py-0.5 rounded-lg border border-slate-300/60 dark:border-[#333333] text-[11px] font-mono shrink-0 gap-1.5 h-6"
            title={t('training.scope.timeWindowTooltip', { sec: timeWindowSec }, `示波器时基窗口: ${timeWindowSec}秒 (数值越大波形流速越慢，20~30 WPM更清晰)`)}
          >
            <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
              <Clock size={12} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span>{timeWindowSec}s</span>
            </span>
            {setTimeWindowSec && (
              <div className="flex items-center border-l border-slate-300/80 dark:border-[#333333] pl-1 gap-0.5">
                <button
                  type="button"
                  onClick={() => setTimeWindowSec((prev) => Math.max(4, prev - 2))}
                  disabled={timeWindowSec <= 4}
                  className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white dark:hover:bg-[#333] text-slate-600 dark:text-slate-300 font-bold transition-colors cursor-pointer text-[10px] disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t('training.scope.timeWindowDec', '缩短时基 (-2秒，拉长波形/加快流速)')}
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() => setTimeWindowSec((prev) => Math.min(16, prev + 2))}
                  disabled={timeWindowSec >= 16}
                  className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white dark:hover:bg-[#333] text-slate-600 dark:text-slate-300 font-bold transition-colors cursor-pointer text-[10px] disabled:opacity-30 disabled:cursor-not-allowed"
                  title={t('training.scope.timeWindowInc', '放宽时基 (+2秒，放缓流速/更易看清高WPM)')}
                >
                  +
                </button>
              </div>
            )}
          </div>

          {/* 侧音频率微调 (纯图标+Hz数值) */}
          <div 
            className="flex items-center bg-slate-200/80 dark:bg-[#222222] px-2 py-0.5 rounded-lg border border-slate-300/60 dark:border-[#333333] text-[11px] font-mono shrink-0 gap-1.5 h-6"
            title={t('training.scope.sidetoneTooltip', { freq: effectiveSidetoneFreq, offset: `${sidetoneOffset >= 0 ? '+' : ''}${sidetoneOffset}`, base: morseFreq }, `拍发侧音频率: ${effectiveSidetoneFreq}Hz (偏置 ${sidetoneOffset >= 0 ? '+' : ''}${sidetoneOffset}Hz) | 播放频率: ${morseFreq}Hz`)}
          >
            <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300 font-semibold">
              <Volume2 size={13} className="text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span>{effectiveSidetoneFreq}Hz</span>
            </span>
            {setSidetoneOffset && (
              <div className="flex items-center border-l border-slate-300/80 dark:border-[#333333] pl-1 gap-0.5">
                <button
                  onClick={() => setSidetoneOffset((prev) => prev - 10)}
                  className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white dark:hover:bg-[#333] text-slate-600 dark:text-slate-300 font-bold transition-colors cursor-pointer text-[10px]"
                  title={t('training.scope.sidetoneDec', '降低侧音 (-10Hz)')}
                >
                  -
                </button>
                <button
                  onClick={() => setSidetoneOffset((prev) => prev + 10)}
                  className="w-3.5 h-3.5 flex items-center justify-center rounded hover:bg-white dark:hover:bg-[#333] text-slate-600 dark:text-slate-300 font-bold transition-colors cursor-pointer text-[10px]"
                  title={t('training.scope.sidetoneInc', '提高侧音 (+10Hz)')}
                >
                  +
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 右侧：精简图例(系统/用户)、分析按钮与折叠切换 */}
        <div className="flex items-center gap-2.5 shrink-0">
          
          {/* 精简图例 (系统/用户) */}
          {!isCollapsed && (
            <div className="hidden sm:flex items-center gap-2.5 text-[10.5px] text-slate-500 dark:text-slate-400 shrink-0 whitespace-nowrap select-none">
              <span className="flex items-center gap-1" title={t('training.scope.legendSystemTooltip', '系统标准电码波形')}>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 dark:bg-cyan-400" />
                <span>{t('training.scope.legendSystem', '系统')}</span>
              </span>
              <span className="flex items-center gap-1" title={t('training.scope.legendUserTooltip', '用户实际打键脉冲')}>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{t('training.scope.legendUser', '用户')}</span>
              </span>
            </div>
          )}

          {/* 分析按钮 (精简文案) */}
          {hasResult && (
            <button
              onClick={onOpenResult}
              className="flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors cursor-pointer shadow-2xs whitespace-nowrap shrink-0"
              title={t('training.scope.analysisTooltip', '查看本次跟发节奏与准确度分析')}
            >
              <BarChart2 size={12} />
              <span>{t('training.scope.analysis', '分析')}</span>
            </button>
          )}

          {/* 折叠/展开示波器 */}
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#252525] transition-colors cursor-pointer shrink-0"
            title={isCollapsed ? t('training.scope.expand', '展开示波器') : t('training.scope.collapse', '收起示波器')}
          >
            {isCollapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

      </div>

      {/* 示波器主体 Canvas 渲染区 */}
      {!isCollapsed && (
        <div className="px-3 py-1">
          <MorseTimelineCanvas
            targetTimeline={targetTimeline}
            userEvents={userEvents}
            currentTime={currentTime}
            isPlaying={isPlaying}
            mode={trainingMode}
            playheadPosition={playheadPosition}
            height={height}
            windowDurationMs={(timeWindowSec || 8) * 1000}
            isFinished={isFinished}
          />
        </div>
      )}

    </div>
  );
}

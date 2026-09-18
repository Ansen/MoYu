import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, RotateCcw, Volume2, Sliders, RefreshCw, Key, Gamepad2, Radio, CheckCircle2 } from 'lucide-react';
import MorseWaterfallCanvas from './game/MorseWaterfallCanvas.jsx';
import AnalogRadioMeter from './game/AnalogRadioMeter.jsx';
import GameLobby from './GameLobby.jsx';
import { buildStandardTimeline, WaterfallAudioScheduler, alignAndEvaluateNotes } from '../utils/morseGame/waterfallEngine.js';
import { MorseInputEngine } from '../utils/morseGame/inputEngine.js';
import { generateRandomTelegramText } from '../utils/morseGame/clock.js';
import { GENERATOR_MODE } from '../utils/morse/structuredRandom.js';

// 常见预设报底
const PRESET_TELEGRAMS = [
  {
    id: 'nums_4',
    name: '【标准分组报】4位纯数字 (4组)',
    getText: () => generateRandomTelegramText(GENERATOR_MODE.NUMBERS, 4)
  },
  {
    id: 'nums_8',
    name: '【标准分组报】4位纯数字 (8组)',
    getText: () => generateRandomTelegramText(GENERATOR_MODE.NUMBERS, 8)
  },
  {
    id: 'letters_4',
    name: '【标准分组报】5位纯字母 (4组)',
    getText: () => generateRandomTelegramText(GENERATOR_MODE.LETTERS, 4)
  },
  {
    id: 'mixed_4',
    name: '【标准分组报】5位混合报 (4组)',
    getText: () => generateRandomTelegramText(GENERATOR_MODE.MIXED, 4)
  },
  {
    id: 'q_codes',
    name: '【通联Q简语】常用Q简语代号',
    getText: () => 'QRL QRM QRN QTH QSO 73'
  },
  {
    id: 'custom',
    name: '【自定义电文】自由输入',
    getText: () => '7392 4810 5923 0641'
  }
];

export default function MorseFollowView({ onBackToLobby }) {
  // 可选切换至娱乐大厅
  const [showLobby, setShowLobby] = useState(false);

  // 核心报务设置
  const [wpm, setWpm] = useState(12);
  const [selectedPreset, setSelectedPreset] = useState('nums_4');
  const [rawText, setRawText] = useState('7392 4810 5923 0641');
  const [isEditingCustom, setIsEditingCustom] = useState(false);
  const [customInputText, setCustomInputText] = useState('7392 4810 5923 0641');

  // 跟发生理听觉反应时间延迟补偿 (Sync Offset Calibration，默认 180ms)
  const [syncOffsetMs, setSyncOffsetMs] = useState(180);

  // 音频与调度
  const [standardFreq, setStandardFreq] = useState(650);
  const [playerFreq, setPlayerFreq] = useState(780);
  const [isLooping, setIsLooping] = useState(false);

  // 播放状态与时间线
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentPositionMs, setCurrentPositionMs] = useState(0);

  // 用户实时拍发采集
  const [userNotes, setUserNotes] = useState([]);
  const [currentPressingNote, setCurrentPressingNote] = useState(null);
  const [inputActive, setInputActive] = useState(false);

  // 实时报务体检指标
  const [telemetry, setTelemetry] = useState({
    avgDitMs: 100,
    avgDahMs: 300,
    dahDitRatio: 3.0,
    avgOffsetMs: 0,
    accuracy: 100,
    perfectCount: 0,
    warnCount: 0,
    badCount: 0,
    totalInputs: 0
  });

  // 引用
  const schedulerRef = useRef(null);
  const inputEngineRef = useRef(null);
  const reqAnimRef = useRef(null);
  const userNotesRef = useRef([]);
  const pressingRecordRef = useRef(null);
  const timelineDataRef = useRef({ notes: [], charsData: [], totalDurationMs: 0, unitT: 100 });

  // 自由练习走纸时钟基准
  const freeRunStartWallTimeRef = useRef(null);

  // 初始化或刷新报底时间线
  const initTimeline = useCallback((textToUse, currentWpm) => {
    const data = buildStandardTimeline(textToUse, currentWpm);
    timelineDataRef.current = data;
    return data;
  }, []);

  useEffect(() => {
    initTimeline(rawText, wpm);
  }, [rawText, wpm, initTimeline]);

  // 切换预设
  const handleSelectPreset = (presetId) => {
    setSelectedPreset(presetId);
    const p = PRESET_TELEGRAMS.find(item => item.id === presetId);
    if (p) {
      if (presetId === 'custom') {
        setIsEditingCustom(true);
      } else {
        setIsEditingCustom(false);
        const generated = p.getText();
        setRawText(generated);
        setCustomInputText(generated);
        handleReset();
      }
    }
  };

  const handleApplyCustomText = () => {
    if (customInputText.trim()) {
      setRawText(customInputText.trim());
      setIsEditingCustom(false);
      handleReset();
    }
  };

  useEffect(() => {
    const scheduler = new WaterfallAudioScheduler();
    scheduler.setFrequency(standardFreq);
    scheduler.setPlayerFrequency(playerFreq);
    schedulerRef.current = scheduler;

    return () => {
      scheduler.destroy();
      if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);
    };
  }, []);

  useEffect(() => {
    if (schedulerRef.current) {
      schedulerRef.current.setFrequency(standardFreq);
      schedulerRef.current.setPlayerFrequency(playerFreq);
    }
  }, [standardFreq, playerFreq]);

  const handlePlay = () => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;

    if (isPaused) {
      scheduler.resumePlayback(timelineDataRef.current.notes, handlePlaybackEnded);
      setIsPaused(false);
      setIsPlaying(true);
    } else {
      scheduler.startTimelinePlayback(timelineDataRef.current.notes, 0, null, handlePlaybackEnded);
      setIsPlaying(true);
      setIsPaused(false);
    }
  };

  const handlePause = () => {
    const scheduler = schedulerRef.current;
    if (!scheduler) return;
    scheduler.pausePlayback();
    setIsPaused(true);
  };

  const handlePlaybackEnded = useCallback(() => {
    if (isLooping) {
      setTimeout(() => {
        if (schedulerRef.current) {
          schedulerRef.current.startTimelinePlayback(timelineDataRef.current.notes, 0, null, handlePlaybackEnded);
        }
      }, 500);
    } else {
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, [isLooping]);

  const handleReset = () => {
    if (schedulerRef.current) {
      schedulerRef.current.stopPlayback();
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCurrentPositionMs(0);
    setUserNotes([]);
    userNotesRef.current = [];
    setCurrentPressingNote(null);
    pressingRecordRef.current = null;
    freeRunStartWallTimeRef.current = null;
    setTelemetry({
      avgDitMs: timelineDataRef.current.unitT,
      avgDahMs: timelineDataRef.current.unitT * 3,
      dahDitRatio: 3.0,
      avgOffsetMs: 0,
      accuracy: 100,
      perfectCount: 0,
      warnCount: 0,
      badCount: 0,
      totalInputs: 0
    });
  };

  const handleSeekPosition = (targetMs) => {
    setCurrentPositionMs(targetMs);
    if (schedulerRef.current) {
      if (isPlaying && !isPaused) {
        schedulerRef.current.startTimelinePlayback(timelineDataRef.current.notes, targetMs, null, handlePlaybackEnded);
      } else {
        schedulerRef.current.pausedAtMs = targetMs;
      }
    }
  };

  const handleCharClick = (charObj) => {
    const jumpMs = Math.max(0, charObj.startMs - 200);
    handleSeekPosition(jumpMs);
  };

  // 60fps 刷新播放头
  useEffect(() => {
    const tick = () => {
      if (schedulerRef.current && (isPlaying || isPaused)) {
        const ms = schedulerRef.current.getCurrentPositionMs();
        setCurrentPositionMs(ms);
      } else if (!isPlaying && freeRunStartWallTimeRef.current) {
        // 自由练报时的平滑走纸时钟
        const ms = performance.now() - freeRunStartWallTimeRef.current;
        setCurrentPositionMs(ms);
      }
      reqAnimRef.current = requestAnimationFrame(tick);
    };
    reqAnimRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(reqAnimRef.current);
  }, [isPlaying, isPaused]);

  // 手键按下
  const handleInputDown = useCallback(() => {
    setInputActive(true);
    if (schedulerRef.current) {
      schedulerRef.current.startPlayerTone();
    }

    let currentMs = 0;
    if (isPlaying || isPaused) {
      currentMs = schedulerRef.current ? schedulerRef.current.getCurrentPositionMs() : 0;
    } else {
      // 自由练报模式：如果尚未开始走纸，初始化当前时刻
      if (!freeRunStartWallTimeRef.current) {
        freeRunStartWallTimeRef.current = performance.now();
      }
      currentMs = performance.now() - freeRunStartWallTimeRef.current;
    }

    const pressRecord = {
      id: `user_${Date.now()}_${Math.random()}`,
      startMs: currentMs
    };
    pressingRecordRef.current = pressRecord;
    setCurrentPressingNote(pressRecord);
  }, [isPlaying, isPaused]);

  // 手键松开
  const handleInputUp = useCallback(() => {
    setInputActive(false);
    if (schedulerRef.current) {
      schedulerRef.current.stopPlayerTone();
    }
    const pressRecord = pressingRecordRef.current;
    if (!pressRecord) return;

    let currentMs = 0;
    if (isPlaying || isPaused) {
      currentMs = schedulerRef.current ? schedulerRef.current.getCurrentPositionMs() : 0;
    } else {
      currentMs = performance.now() - (freeRunStartWallTimeRef.current || performance.now());
    }

    const duration = Math.max(15, currentMs - pressRecord.startMs);

    const completedUserNote = {
      ...pressRecord,
      endMs: currentMs,
      duration: duration
    };

    pressingRecordRef.current = null;
    setCurrentPressingNote(null);

    const updatedUserNotes = [...userNotesRef.current, completedUserNote];
    userNotesRef.current = updatedUserNotes;

    const result = alignAndEvaluateNotes(
      timelineDataRef.current.notes,
      updatedUserNotes,
      timelineDataRef.current.unitT
    );

    setUserNotes(result.evaluatedUserNotes);
    setTelemetry(result.telemetry);
  }, [isPlaying, isPaused]);

  useEffect(() => {
    const engine = new MorseInputEngine({
      mode: 'STRAIGHT',
      onEvent: (event) => {
        const { type } = event;
        if (type === 'STRAIGHT_DOWN' || type === 'DIT_DOWN') {
          handleInputDown();
        } else if (type === 'STRAIGHT_UP' || type === 'DIT_UP') {
          handleInputUp();
        }
      }
    });

    engine.attach();
    inputEngineRef.current = engine;

    return () => {
      engine.detach();
    };
  }, [handleInputDown, handleInputUp]);

  if (showLobby) {
    return <GameLobby onBackToLobby={() => setShowLobby(false)} />;
  }

  const { notes: standardNotes, charsData, unitT } = timelineDataRef.current;
  const activeChar = charsData.find(c => currentPositionMs >= c.startMs && currentPositionMs <= c.endMs);
  const isRxSounding = standardNotes.some(n => currentPositionMs >= n.startMs && currentPositionMs <= n.endMs);

  return (
    <div className="flex-1 h-full flex flex-col bg-[#05080e] text-slate-100 select-none overflow-hidden font-sans">
      
      {/* 1. 顶部紧凑型专业控制条 (高度收敛至 48px，留出全屏空间) */}
      <header className="h-12 px-5 bg-[#090e17] border-b border-slate-800 flex items-center justify-between gap-4 shrink-0 shadow-md">
        
        {/* 左侧：频显与报底快捷选择 */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-2.5 py-1 bg-slate-950/80 rounded-lg border border-slate-800 text-xs font-mono font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#06b6d4]"></span>
            <span className="text-cyan-300">07.023.00 MHz</span>
            <span className="text-slate-500 text-[10px]">CW-N</span>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700/80 text-xs">
            <span className="text-slate-400 font-bold">报底:</span>
            <select
              value={selectedPreset}
              onChange={(e) => handleSelectPreset(e.target.value)}
              disabled={isPlaying && !isPaused}
              className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer text-xs"
            >
              {PRESET_TELEGRAMS.map(p => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-slate-100 font-medium">
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 中间：WPM 速度与跟发听觉延迟补偿调节 (Sync Offset) */}
        <div className="flex items-center gap-4 text-xs font-mono">
          
          {/* WPM */}
          <div className="flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700/80">
            <span className="text-slate-400 font-bold">字速:</span>
            <span className="text-amber-400 font-bold w-5 text-right">{wpm}</span>
            <input
              type="range"
              min="8"
              max="32"
              step="1"
              value={wpm}
              disabled={isPlaying && !isPaused}
              onChange={(e) => setWpm(Number(e.target.value))}
              className="w-16 accent-amber-500 cursor-pointer h-1.5"
            />
            <span className="text-[10px] text-slate-500">({unitT}ms)</span>
          </div>

          {/* 延迟补偿 */}
          <div className="flex items-center gap-2 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700/80" title="补偿生理听觉反应时间，使下轨波形与上轨精准垂直对齐">
            <span className="text-slate-400 font-bold">对齐补偿:</span>
            <span className="text-cyan-300 font-bold w-10 text-right">{syncOffsetMs}ms</span>
            <input
              type="range"
              min="0"
              max="300"
              step="10"
              value={syncOffsetMs}
              onChange={(e) => setSyncOffsetMs(Number(e.target.value))}
              className="w-16 accent-cyan-500 cursor-pointer h-1.5"
            />
            <button
              onClick={() => setSyncOffsetMs(180)}
              className="text-[10px] text-slate-400 hover:text-slate-200"
              title="重置为标准 180ms"
            >
              [默认]
            </button>
          </div>

        </div>

        {/* 右侧：播放/暂停控制与趣味大厅入口 */}
        <div className="flex items-center gap-2.5">
          
          <button
            onClick={() => setIsLooping(!isLooping)}
            className={`px-2 py-1 rounded-lg border text-xs font-bold transition flex items-center gap-1 ${
              isLooping ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50' : 'bg-slate-900 text-slate-500 border-slate-800'
            }`}
            title="单组循环反复对比"
          >
            <RefreshCw size={11} className={isLooping ? 'animate-spin' : ''} />
            <span className="text-[11px]">循环</span>
          </button>

          {!isPlaying || isPaused ? (
            <button
              onClick={handlePlay}
              className="px-3.5 py-1 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 active:scale-95 transition whitespace-nowrap"
            >
              <Play size={13} />
              <span>{isPaused ? '继续播放' : '开始播放'}</span>
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="px-3.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs flex items-center gap-1.5 active:scale-95 transition shadow-md shadow-amber-500/20 whitespace-nowrap"
            >
              <Pause size={13} />
              <span>暂停</span>
            </button>
          )}

          <button
            onClick={handleReset}
            className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700 transition"
            title="复位重设"
          >
            <RotateCcw size={13} />
          </button>

          <button
            onClick={() => setShowLobby(true)}
            className="ml-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-300 border border-slate-800 text-xs font-bold flex items-center gap-1 transition"
            title="切换至趣味战备特训"
          >
            <Gamepad2 size={12} className="text-amber-400" />
            <span className="text-[11px]">游戏大厅</span>
          </button>
        </div>

      </header>

      {/* 2. 报底文本快速查看与跳转条 (紧凑高度 28px) */}
      <div className="h-7 px-5 bg-[#060a12] border-b border-slate-800/80 flex items-center justify-between gap-3 shrink-0 overflow-x-auto text-xs font-mono">
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-slate-500 text-[10px] font-bold uppercase whitespace-nowrap">报底字符:</span>
          {charsData.map(c => {
            const isCurrent = activeChar && activeChar.charIndex === c.charIndex;
            const isPassed = currentPositionMs > c.endMs;

            return (
              <button
                key={c.charIndex}
                onClick={() => handleCharClick(c)}
                className={`px-2 py-0.2 rounded font-bold transition text-[11px] ${
                  isCurrent
                    ? 'bg-amber-400 text-slate-950 scale-105 shadow-sm ring-1 ring-amber-200'
                    : isPassed
                      ? 'bg-slate-900/60 text-slate-500'
                      : 'bg-slate-900 text-slate-300 hover:border-slate-600'
                } border border-slate-800`}
                title={`点击跳转至 '${c.char}' 处发声播放`}
              >
                {c.char}
              </button>
            );
          })}
        </div>

        <div className="text-[10px] text-slate-500 whitespace-nowrap hidden sm:inline-block">
          TIME: <span className="text-cyan-400 font-bold">{(currentPositionMs / 1000).toFixed(1)}s</span> / {(timelineDataRef.current.totalDurationMs / 1000).toFixed(1)}s
        </div>
      </div>

      {/* 3. 核心：大视界横向双通道点划示波器 (占据全屏 88% 空间) */}
      <main className="flex-1 w-full p-2 bg-[#04060a] flex flex-col min-h-0 relative">
        <MorseWaterfallCanvas
          standardNotes={standardNotes}
          userNotes={userNotes}
          currentPositionMs={currentPositionMs}
          currentPressingNote={currentPressingNote}
          unitT={unitT}
          isPlaying={isPlaying}
          isPaused={isPaused}
          syncOffsetMs={syncOffsetMs}
          onSeekPosition={handleSeekPosition}
        />
      </main>

      {/* 4. 底部紧凑型实时报务体检与接口遥测条 (高度仅 38px) */}
      <footer className="h-10 px-5 bg-[#090e17] border-t border-slate-800 flex items-center justify-between text-xs font-mono shrink-0">
        
        {/* 左侧：发信导通指示灯 */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              isRxSounding ? 'bg-cyan-400 shadow-[0_0_8px_#06b6d4]' : 'bg-slate-800'
            }`}></span>
            <span className={`text-[11px] font-bold ${isRxSounding ? 'text-cyan-300' : 'text-slate-500'}`}>
              RX (抄收)
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${
              inputActive ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e] animate-ping' : 'bg-slate-800'
            }`}></span>
            <span className={`text-[11px] font-bold ${inputActive ? 'text-rose-400' : 'text-slate-500'}`}>
              TX (拍发)
            </span>
          </div>
        </div>

        {/* 中间：核心手癖指标 (点划比 / 点长 / 划长) */}
        <div className="flex items-center gap-6 text-[11px]">
          <div>
            <span className="text-slate-500 text-[10px]">点划比 (标准 3.00): </span>
            <span className={`font-black ${
              Math.abs(telemetry.dahDitRatio - 3.0) <= 0.35 ? 'text-emerald-400' : 'text-amber-400'
            }`}>
              {telemetry.dahDitRatio.toFixed(2)} : 1
            </span>
          </div>

          <div className="hidden sm:inline-block">
            <span className="text-slate-500 text-[10px]">实测点长: </span>
            <span className="text-cyan-300 font-bold">{telemetry.avgDitMs}ms</span>
            <span className="text-slate-600 text-[9px]"> / {unitT}ms</span>
          </div>

          <div className="hidden sm:inline-block">
            <span className="text-slate-500 text-[10px]">实测划长: </span>
            <span className="text-amber-300 font-bold">{telemetry.avgDahMs}ms</span>
            <span className="text-slate-600 text-[9px]"> / {unitT * 3}ms</span>
          </div>

          <div>
            <span className="text-slate-500 text-[10px]">综合吻合率: </span>
            <span className="text-emerald-400 font-black">{telemetry.accuracy}%</span>
          </div>
        </div>

        {/* 右侧：按键与物理电键指南 */}
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="text-amber-300 text-[10px] font-bold">CH552G 电键直连</span>
          <span className="text-slate-600">|</span>
          <kbd className="px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded text-slate-300 text-[10px]">Space</kbd>
          <kbd className="px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded text-slate-300 text-[10px]">J</kbd>
          <kbd className="px-1.5 py-0.2 bg-slate-900 border border-slate-800 rounded text-slate-300 text-[10px]">鼠标</kbd>
        </div>

      </footer>

    </div>
  );
}

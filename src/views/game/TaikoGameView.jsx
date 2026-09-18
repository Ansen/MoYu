import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, RotateCcw, Volume2, VolumeX, ArrowLeft, Sparkles, RefreshCw } from 'lucide-react';
import MorseTaikoCanvas from './MorseTaikoCanvas.jsx';
import DiagnosticModal from './DiagnosticModal.jsx';
import {
  generateMorseChart,
  TELEGRAM_GROUP_MODES,
  generateRandomTelegramText
} from '../../utils/morseGame/clock.js';
import { morseAudio } from '../../utils/morseGame/audioEngine.js';
import { evaluateHit, generateDiagnosticReport } from '../../utils/morseGame/judgeEngine.js';
import { MorseInputEngine } from '../../utils/morseGame/inputEngine.js';
import { GENERATOR_MODE } from '../../utils/morse/structuredRandom.js';

export default function TaikoGameView({ onBackToLobby }) {
  // 1. 报务专业配置：三大分组报 + 唯一速度 WPM (去除无意义的流速)
  const [wpm, setWpm] = useState(12); // CW 唯一速度指标 (WPM)
  const [groupMode, setGroupMode] = useState(GENERATOR_MODE.NUMBERS); // 默认纯数字分组报
  const [currentText, setCurrentText] = useState(() => generateRandomTelegramText(GENERATOR_MODE.NUMBERS, 4));
  const [demoSoundEnabled, setDemoSoundEnabled] = useState(true);

  // 2. 运行与计分状态
  const [isPlaying, setIsPlaying] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [feverGauge, setFeverGauge] = useState(0); // 0 ~ 100
  const [isFever, setIsFever] = useState(false);
  const [currentCharDisplay, setCurrentCharDisplay] = useState('');
  const [currentMorseDisplay, setCurrentMorseDisplay] = useState('');
  const [activeCharIndex, setActiveCharIndex] = useState(-1);
  const [diagnosticReport, setDiagnosticReport] = useState(null);

  // 3. 手键单键通断物理状态
  const [inputActiveState, setInputActiveState] = useState({
    straightDown: false
  });

  // 4. Canvas 驱动状态
  const [canvasGameState, setCanvasGameState] = useState({
    chart: null,
    currentTime: 0,
    notes: [],
    lastHitEvent: null
  });

  const chartRef = useRef(null);
  const notesRef = useRef([]);
  const gameStartTimeRef = useRef(0);
  const reqAnimRef = useRef(null);
  const inputEngineRef = useRef(null);
  
  // 手键长短按状态机
  const straightPressRecordRef = useRef({
    pressTimestamp: 0,
    targetNote: null,
    edgeOffsetMs: 0
  });

  // 换一组新的随机分组报
  const refreshTelegramText = useCallback((mode = groupMode) => {
    const newText = generateRandomTelegramText(mode, 4);
    setCurrentText(newText);
    return newText;
  }, [groupMode]);

  // 切换分组报模式
  const handleGroupModeChange = (newMode) => {
    setGroupMode(newMode);
    refreshTelegramText(newMode);
  };

  // 结算游戏
  const finishGame = useCallback(() => {
    setIsPlaying(false);
    morseAudio.stopDemoTone();
    morseAudio.stopPlayerTone();
    if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);

    const report = generateDiagnosticReport(
      notesRef.current,
      score,
      maxCombo,
      wpm
    );
    setDiagnosticReport(report);
  }, [score, maxCombo, wpm]);

  // 开始新游戏
  const startGame = useCallback(() => {
    // 采用严格 PARIS 时钟生成谱面
    const newChart = generateMorseChart(currentText, wpm, 2600);
    chartRef.current = newChart;
    notesRef.current = JSON.parse(JSON.stringify(newChart.notes));

    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setFeverGauge(0);
    setIsFever(false);
    setDiagnosticReport(null);
    setCurrentCharDisplay('');
    setCurrentMorseDisplay('');
    setActiveCharIndex(-1);
    straightPressRecordRef.current = { pressTimestamp: 0, targetNote: null, edgeOffsetMs: 0 };

    morseAudio.initContext();
    gameStartTimeRef.current = performance.now();
    setIsPlaying(true);
  }, [currentText, wpm]);

  // 应用击打判定结果
  const applyHitResult = useCallback((targetNote, evalRes, actualDuration = null) => {
    targetNote.isHit = true;
    targetNote.hitResult = evalRes.grade;
    targetNote.timeOffset = evalRes.timeOffsetMs;
    if (actualDuration) targetNote.actualDuration = actualDuration;

    if (evalRes.grade === 'PERFECT') {
      morseAudio.playPerfectHitEffect();
      setScore(prev => prev + evalRes.score * (isFever ? 2 : 1));
      setCombo(prev => {
        const next = prev + 1;
        setMaxCombo(m => Math.max(m, next));
        return next;
      });
      setFeverGauge(prev => {
        const next = Math.min(100, prev + 8);
        if (next >= 100) setIsFever(true);
        return next;
      });
    } else if (evalRes.grade === 'GREAT' || evalRes.grade === 'GOOD') {
      setScore(prev => prev + evalRes.score);
      setCombo(prev => {
        const next = prev + 1;
        setMaxCombo(m => Math.max(m, next));
        return next;
      });
      setFeverGauge(prev => Math.min(100, prev + 3));
    } else {
      morseAudio.playMissEffect();
      setCombo(0);
      setFeverGauge(prev => Math.max(0, prev - 15));
      setIsFever(false);
    }

    setCanvasGameState(prev => ({
      ...prev,
      lastHitEvent: {
        grade: evalRes.grade,
        offset: evalRes.timeOffsetMs,
        time: performance.now()
      }
    }));
  }, [isFever]);

  // 【手键单键逻辑】：按下时记录起振时间与锁住目标音符
  const handleStraightPressDown = useCallback((timestamp) => {
    if (!chartRef.current || !notesRef.current.length || !isPlaying) return;
    
    const gameCurrentTime = timestamp - gameStartTimeRef.current;
    const unitT = chartRef.current.unitTime;
    const toleranceEarly = Math.max(120, Math.round(unitT * 1.2));
    const toleranceLate = Math.max(120, Math.round(unitT * 1.2));

    // 优先寻找距离当前时间最近的且未击中的音符 (无论点还是划)
    const targetNote = notesRef.current.find(n => {
      if (n.isHit) return false;
      const diff = gameCurrentTime - n.hitTime;
      return diff >= -toleranceEarly && diff <= toleranceLate;
    });

    if (targetNote) {
      targetNote.isHolding = true; // 锁定为按住状态，绝不判漏按！
    }

    straightPressRecordRef.current = {
      pressTimestamp: timestamp,
      targetNote: targetNote || null,
      edgeOffsetMs: targetNote ? (gameCurrentTime - targetNote.hitTime) : 0
    };
  }, [isPlaying]);

  const handleStraightPressUp = useCallback((timestamp) => {
    if (!chartRef.current || !isPlaying) return;
    
    const { pressTimestamp, targetNote, edgeOffsetMs } = straightPressRecordRef.current;
    if (!pressTimestamp) return;

    const holdDuration = timestamp - pressTimestamp;
    const unitT = chartRef.current.unitTime;

    if (targetNote && !targetNote.isHit) {
      targetNote.isHolding = false;
      
      // 根据手键物理长短：小于 1.9T 为点，大于等于 1.9T 为划
      const userType = holdDuration >= 1.9 * unitT ? 'DAH' : 'DIT';

      if (userType !== targetNote.type) {
        // 类型不匹配 (比如长划按得太短未满 2T，或短点拖沓成了长划)
        applyHitResult(targetNote, { grade: 'MISS', score: 0, timeOffsetMs: edgeOffsetMs }, holdDuration);
      } else {
        const evalRes = evaluateHit(targetNote, edgeOffsetMs, unitT, holdDuration);
        applyHitResult(targetNote, evalRes, holdDuration);
      }
    }

    straightPressRecordRef.current = { pressTimestamp: 0, targetNote: null, edgeOffsetMs: 0 };
  }, [isPlaying, applyHitResult]);

  // 输入事件监听 (手键单键模式)
  useEffect(() => {
    const engine = new MorseInputEngine({
      mode: 'STRAIGHT',
      onEvent: (event) => {
        const { type, timestamp } = event;
        if (type === 'STRAIGHT_DOWN' || type === 'DIT_DOWN') {
          setInputActiveState({ straightDown: true });
          morseAudio.startPlayerTone();
          handleStraightPressDown(timestamp);
        } else if (type === 'STRAIGHT_UP' || type === 'DIT_UP') {
          setInputActiveState({ straightDown: false });
          morseAudio.stopPlayerTone();
          handleStraightPressUp(timestamp);
        }
      }
    });

    engine.attach();
    inputEngineRef.current = engine;

    return () => {
      engine.detach();
      morseAudio.destroy();
    };
  }, [handleStraightPressDown, handleStraightPressUp]);

  // 游戏主渲染与时序循环
  useEffect(() => {
    if (!isPlaying) return;

    const loop = () => {
      const now = performance.now();
      const currentElapsed = now - gameStartTimeRef.current;
      const chart = chartRef.current;
      const notes = notesRef.current;

      if (!chart || !notes.length) return;

      // 1. 电脑示范发声 (380Hz)
      if (demoSoundEnabled) {
        const activeNote = notes.find(n => currentElapsed >= n.hitTime && currentElapsed <= n.endTime);
        if (activeNote) {
          morseAudio.startDemoTone();
          setCurrentCharDisplay(activeNote.char);
          setCurrentMorseDisplay(activeNote.symbol === '-' ? '—' : '•');
          setActiveCharIndex(activeNote.charIndex);
        } else {
          morseAudio.stopDemoTone();
        }
      }

      // 2. 漏按检测 (严密保护：长按 Holding 期间绝不判漏按！)
      const unitT = chart.unitTime;
      const missThreshold = Math.max(110, Math.round(unitT * 1.1));
      notes.forEach(note => {
        if (note.isHit) return;

        // 核心保护：如果玩家正处于按住长按中，严禁判漏！
        if (note.isHolding) return;

        // 起手漏按判定：仅当当前时间已经彻底越过允许起键的最大时限才判 MISS
        if (currentElapsed > note.hitTime + missThreshold) {
          note.isHit = true;
          note.hitResult = 'MISS';
          note.timeOffset = missThreshold;
          morseAudio.playMissEffect();
          setCombo(0);
          setFeverGauge(prev => Math.max(0, prev - 15));
          setIsFever(false);

          setCanvasGameState(prev => ({
            ...prev,
            lastHitEvent: { grade: 'MISS', offset: missThreshold, time: now }
          }));
        }
      });

      // 3. 驱动 Canvas
      setCanvasGameState({
        chart,
        currentTime: currentElapsed,
        notes,
        lastHitEvent: null
      });

      if (currentElapsed > chart.totalDuration) {
        finishGame();
        return;
      }

      reqAnimRef.current = requestAnimationFrame(loop);
    };

    reqAnimRef.current = requestAnimationFrame(loop);
    return () => {
      if (reqAnimRef.current) cancelAnimationFrame(reqAnimRef.current);
    };
  }, [isPlaying, demoSoundEnabled, finishGame]);

  return (
    <div className="flex-1 h-full flex flex-col bg-[#060a12] text-slate-100 select-none overflow-hidden">
      
      {/* 1. 顶部专业控制栏 (绝不折行、控件整齐、按钮完全可见) */}
      <header className="h-14 px-6 border-b border-slate-800/80 bg-[#090e1a]/95 backdrop-blur-md flex items-center justify-between gap-4 shrink-0">
        
        {/* 左侧：返回与标题 (强制 shrink-0 绝不折行) */}
        <div className="flex items-center gap-3 shrink-0">
          {onBackToLobby && (
            <button
              onClick={onBackToLobby}
              className="p-1.5 rounded-lg bg-slate-800/70 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
              title="返回大厅"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#f59e0b]"></span>
            <span className="text-sm font-black tracking-wider text-slate-100 whitespace-nowrap">太鼓电码跟发</span>
          </div>
        </div>

        {/* 右侧：专业分组报 + 唯一 WPM 速度 + 动作按钮 */}
        <div className="flex items-center gap-3 shrink-0">
          
          {/* 三大分组报模式切换 */}
          <div className="flex items-center gap-1.5 bg-slate-800/70 px-2.5 py-1.5 rounded-lg border border-slate-700/60 text-xs">
            <span className="text-slate-400 whitespace-nowrap">分组报:</span>
            <select
              value={groupMode}
              onChange={(e) => handleGroupModeChange(e.target.value)}
              disabled={isPlaying}
              className="bg-transparent text-amber-300 font-bold focus:outline-none cursor-pointer text-xs"
            >
              {TELEGRAM_GROUP_MODES.map(m => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-slate-100 font-medium">
                  {m.name}
                </option>
              ))}
            </select>

            {/* 换一组报文按钮 */}
            <button
              onClick={() => refreshTelegramText()}
              disabled={isPlaying}
              className="p-1 text-slate-400 hover:text-amber-300 transition"
              title="换一组随机报文"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* 纯正 CW 速度指标：WPM */}
          <div className="flex items-center gap-2 bg-slate-800/70 px-3 py-1.5 rounded-lg border border-slate-700/60 text-xs">
            <span className="text-slate-400 whitespace-nowrap">字速:</span>
            <span className="text-amber-400 font-mono font-bold w-6 text-right">{wpm}</span>
            <input
              type="range"
              min="8"
              max="25"
              step="1"
              value={wpm}
              disabled={isPlaying}
              onChange={(e) => setWpm(Number(e.target.value))}
              className="w-20 accent-amber-500 cursor-pointer h-1.5"
            />
            <span className="text-[10px] text-slate-500 font-mono">WPM</span>
          </div>

          {/* 电脑示范声音 开关 */}
          <button
            onClick={() => setDemoSoundEnabled(!demoSoundEnabled)}
            className={`p-2 rounded-lg border transition ${
              demoSoundEnabled ? 'bg-slate-800 text-amber-400 border-amber-500/30' : 'bg-slate-800/40 text-slate-500 border-slate-700/40'
            }`}
            title={demoSoundEnabled ? '电脑示范音 (380Hz) 已开启' : '电脑示范音已静音'}
          >
            {demoSoundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>

          {/* 开始发报主按钮 (醒目清晰，永不溢出) */}
          <button
            onClick={startGame}
            className="px-4 py-1.5 rounded-lg bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition whitespace-nowrap"
          >
            {isPlaying ? <RotateCcw size={14} /> : <Play size={14} />}
            {isPlaying ? '重来' : '开始发报'}
          </button>
        </div>
      </header>

      {/* 2. 核心主游戏舞台 (80% 视野拉满) */}
      <main className="flex-1 p-6 flex flex-col justify-between max-w-6xl w-full mx-auto min-h-0">
        
        {/* 顶部专业 HUD：整段分组报展示 + 正在拍发 + 连击与分数 */}
        <div className="px-6 py-3 bg-slate-900/50 border border-slate-800/80 rounded-2xl backdrop-blur-md flex items-center justify-between gap-4 shrink-0 shadow-lg">
          
          {/* 左侧：当前整段分组报文 (当前字符加粗高亮) */}
          <div className="flex-1 min-w-0 pr-4">
            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">
              TELEGRAM CONTENT / 本局报文
            </div>
            <div className="font-mono text-base font-bold tracking-widest text-slate-300 truncate">
              {currentText.split('').map((ch, idx) => {
                const isActive = idx === activeCharIndex;
                return (
                  <span
                    key={idx}
                    className={`transition-colors ${
                      isActive
                        ? 'text-amber-400 bg-amber-500/20 px-0.5 rounded underline decoration-amber-400 decoration-2'
                        : (ch === ' ' ? 'text-slate-600 px-1' : 'text-slate-300')
                    }`}
                  >
                    {ch}
                  </span>
                );
              })}
            </div>
          </div>

          {/* 中间：正在拍发的大字符与电码 */}
          <div className="flex items-center gap-3 px-5 border-x border-slate-800 shrink-0">
            <div className="text-right">
              <div className="text-[10px] text-slate-500 font-bold">CURRENT</div>
              <div className="text-2xl font-black font-mono text-amber-400 min-w-[24px]">
                {currentCharDisplay || '—'}
              </div>
            </div>
            <div className="text-xl font-mono text-cyan-400 font-bold min-w-[36px]">
              {currentMorseDisplay}
            </div>
          </div>

          {/* 右侧：COMBO / FEVER / SCORE */}
          <div className="flex items-center gap-6 shrink-0">
            {/* 连击数 */}
            <div className="text-center min-w-[50px]">
              <div className="text-[10px] text-slate-500 font-bold">COMBO</div>
              <div className={`text-2xl font-black font-mono transition-transform duration-75 ${
                combo > 0 ? 'text-cyan-400 scale-110' : 'text-slate-600'
              }`}>
                {combo}
              </div>
            </div>

            {/* FEVER 槽 */}
            <div className="w-24 space-y-1">
              <div className="flex justify-between text-[10px] font-bold">
                <span className={isFever ? 'text-amber-400 animate-pulse flex items-center gap-1' : 'text-slate-500'}>
                  {isFever && <Sparkles size={10} />} FEVER
                </span>
                <span className="text-slate-400 font-mono">{feverGauge}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/60">
                <div
                  className={`h-full transition-all duration-150 rounded-full ${
                    isFever ? 'bg-gradient-to-r from-amber-400 to-rose-500' : 'bg-cyan-400'
                  }`}
                  style={{ width: `${feverGauge}%` }}
                />
              </div>
            </div>

            {/* 总分 */}
            <div className="text-right min-w-[70px]">
              <div className="text-[10px] text-slate-500 font-bold">SCORE</div>
              <div className="text-xl font-black text-slate-100 font-mono">
                {score.toLocaleString()}
              </div>
            </div>
          </div>

        </div>

        {/* 中央主横道：Canvas 绝对正圆拉满展示 */}
        <div className="my-auto w-full flex-1 flex flex-col justify-center min-h-[260px]">
          <MorseTaikoCanvas
            gameState={canvasGameState}
            inputActiveState={inputActiveState}
          />
        </div>

        {/* 3. 底部手键单键状态响应条 (极度简练清晰) */}
        <footer className="h-11 px-5 bg-slate-900/50 border border-slate-800/70 rounded-xl flex items-center justify-between text-xs text-slate-300 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-lg border transition-all ${
              inputActiveState.straightDown
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-slate-800/50 border-slate-700/50 text-slate-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                inputActiveState.straightDown ? 'bg-amber-400 animate-ping' : 'bg-slate-500'
              }`}></span>
              <span className="font-bold text-xs">手键通断:</span>
              <span className="font-mono text-[11px] text-amber-300">
                {inputActiveState.straightDown ? '按下通导 (ON)' : '断开 (OFF)'}
              </span>
            </div>
            <span className="text-[11px] text-slate-400">
              单手长短按：短点松手即 •，按满 3T 松手即 —
            </span>
          </div>

          <div className="flex items-center gap-2 text-slate-400 text-[11px]">
            <span>支持按键:</span>
            <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono font-bold">空格 Space</kbd>
            <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono font-bold">J 键</kbd>
            <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono font-bold">鼠标左键</kbd>
            <kbd className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-slate-200 font-mono font-bold">CH552G 物理电键</kbd>
          </div>
        </footer>

      </main>

      {/* 战后报务能力诊断报告弹窗 */}
      <DiagnosticModal
        report={diagnosticReport}
        onRestart={startGame}
        onClose={() => setDiagnosticReport(null)}
      />

    </div>
  );
}

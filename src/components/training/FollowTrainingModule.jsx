import React, { useState, useEffect, useRef, useCallback } from 'react';
import TrainingScopePanel from './TrainingScopePanel';
import TrainingResultModal from './TrainingResultModal';
import { useKeyInput } from '../../hooks/useKeyInput';
import { generateTargetTimeline, analyzeSession } from '../../utils/morseTimingAnalyzer';
import audioPlayer from '../../utils/audioPlayer';

/**
 * 独立的 CW 跟发与节奏训练自闭环模块 (FollowTrainingModule)
 * 1. 最小侵入性：内聚所有按键采集、即时侧音、时间轴生成、动态比对打分与复盘弹窗
 * 2. 60FPS 声卡硬件时钟解耦：高频帧循环内聚在 Canvas，父组件保持零脏渲染
 * 3. 选词/跳转播放时序无缝对齐
 * 4. 非侵入式复盘：主动停止仅点亮【分析】按钮，不强弹弹窗打扰阅读
 */
export default function FollowTrainingModule({
  isPlaying = false,
  isPaused = false,
  bookData,
  chapterText = '',
  morseSpeed = 20,
  morseFreq = 400,
  numberMode = 'long',
  enableMarkers = false,
  prefixMarker = '',
  suffixMarker = '',
  activeToken: _activeToken = null,
  onStopRequest: _onStopRequest
}) {
  // 核心模式与输入设备状态
  const [trainingMode, setTrainingMode] = useState('live'); // 'live' | 'blind' | 'silent'
  const [inputDevice, setInputDevice] = useState(() => {
    try {
      return localStorage.getItem('moyu_cw_input_device') || 'keyboard';
    } catch {
      return 'keyboard';
    }
  }); // 'keyboard' | 'ch552g'

  const handleSetInputDevice = useCallback((dev) => {
    setInputDevice(dev);
    try {
      localStorage.setItem('moyu_cw_input_device', dev);
    } catch {}
  }, []);
  const [keyType, setKeyType] = useState(() => {
    try {
      return localStorage.getItem('moyu_cw_key_type') || 'straight';
    } catch {
      return 'straight';
    }
  }); // 'straight' (手键) | 'paddle' (自动键)
  const [paddleReverse, setPaddleReverse] = useState(() => {
    try {
      return localStorage.getItem('moyu_cw_paddle_reverse') === 'true';
    } catch {
      return false;
    }
  });
  const [playheadPosition, setPlayheadPosition] = useState(() => {
    try {
      return localStorage.getItem('moyu_cw_playhead_pos') || 'right';
    } catch {
      return 'right';
    }
  }); // 'right' (85% 实时走纸记录仪模式) | 'left' (20% 前瞻领跑模式)
  const [isScopeCollapsed, setIsScopeCollapsed] = useState(false);

  const handleSetPlayheadPosition = useCallback((pos) => {
    setPlayheadPosition(pos);
    try {
      localStorage.setItem('moyu_cw_playhead_pos', pos);
    } catch {}
  }, []);

  const handleSetKeyType = useCallback((type) => {
    setKeyType(type);
    try {
      localStorage.setItem('moyu_cw_key_type', type);
    } catch {}
  }, []);

  const handleSetPaddleReverse = useCallback((updaterOrVal) => {
    setPaddleReverse((prev) => {
      const next = typeof updaterOrVal === 'function' ? updaterOrVal(prev) : updaterOrVal;
      try {
        localStorage.setItem('moyu_cw_paddle_reverse', String(next));
      } catch {}
      return next;
    });
  }, []);

  // 记录静音前播放器原始音量，确保切换或退出时精准还原
  const prevPlayerVolRef = useRef(audioPlayer.volume > 0 ? audioPlayer.volume : 100);

  // 模式切换联动：静音模式关掉播放器的声音，切回时恢复播放器声音
  useEffect(() => {
    if (trainingMode === 'silent') {
      if (audioPlayer.volume > 0) {
        prevPlayerVolRef.current = audioPlayer.volume;
      }
      audioPlayer.setOutputVolume(0);
    } else {
      const restoreVol = prevPlayerVolRef.current > 0 ? prevPlayerVolRef.current : 100;
      audioPlayer.setOutputVolume(restoreVol);
    }
  }, [trainingMode]);

  // 组件卸载时恢复播放器原始音量
  useEffect(() => {
    return () => {
      const restoreVol = prevPlayerVolRef.current > 0 ? prevPlayerVolRef.current : 100;
      audioPlayer.setOutputVolume(restoreVol);
    };
  }, []);

  // 侧音偏置状态：默认 +80Hz，支持本地存储偏好
  const [sidetoneOffset, setSidetoneOffset] = useState(() => {
    try {
      const saved = localStorage.getItem('moyu_sidetone_offset');
      if (saved !== null) {
        const val = parseInt(saved, 10);
        if (!isNaN(val)) return val;
      }
    } catch {}
    return 80; // 默认 +80Hz 偏置
  });

  const handleSetSidetoneOffset = useCallback((offsetOrUpdater) => {
    setSidetoneOffset((prev) => {
      const nextVal = typeof offsetOrUpdater === 'function' ? offsetOrUpdater(prev) : offsetOrUpdater;
      const clamped = Math.max(-400, Math.min(600, nextVal));
      try {
        localStorage.setItem('moyu_sidetone_offset', String(clamped));
      } catch {}
      return clamped;
    });
  }, []);

  const effectiveSidetoneFreq = Math.max(100, Math.min(2000, Number(morseFreq || 400) + sidetoneOffset));

  // 示波器时基窗口状态（秒）：默认 8 秒 (8000ms)，大幅降低高速 WPM 下的视觉流速，使 20~30 WPM 能够从容看清
  const [timeWindowSec, setTimeWindowSec] = useState(() => {
    try {
      const saved = localStorage.getItem('moyu_cw_time_window');
      if (saved !== null) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 4 && val <= 16) return val;
      }
    } catch {}
    return 8;
  });

  const handleSetTimeWindowSec = useCallback((updaterOrVal) => {
    setTimeWindowSec((prev) => {
      const next = typeof updaterOrVal === 'function' ? updaterOrVal(prev) : updaterOrVal;
      const clamped = Math.max(4, Math.min(16, next));
      try {
        localStorage.setItem('moyu_cw_time_window', String(clamped));
      } catch {}
      return clamped;
    });
  }, []);

  // 当前真实章节正文（优先取当前章节 text，次取 audioPlayer.session.text，次取 bookData.data）
  const activeChapterContent = chapterText || audioPlayer.session?.text || bookData?.data || '';

  // 1. 目标时间轴结构化生成 (完全对齐 audioPlayer 队列与 Token 索引)
  const buildTimeline = useCallback(() => {
    if (!activeChapterContent) return null;
    const sessionStartIndex = audioPlayer.session?.startIndex || 0;
    return generateTargetTimeline({
      text: activeChapterContent,
      wpm: morseSpeed,
      numberMode: numberMode,
      enableMarkers: enableMarkers,
      prefixMarker: prefixMarker,
      suffixMarker: suffixMarker,
      startIndex: sessionStartIndex
    });
  }, [activeChapterContent, morseSpeed, numberMode, enableMarkers, prefixMarker, suffixMarker]);

  // 时序与事件数据
  const [userEvents, setUserEvents] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [targetTimeline, setTargetTimeline] = useState(() => buildTimeline());
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isResultOpen, setIsResultOpen] = useState(false);

  const userEventsRef = useRef([]);
  const lastAnalyzedRef = useRef(false);
  const wasPlayingRef = useRef(false);

  // 监听正文与配置变化更新时间轴
  useEffect(() => {
    try {
      const tl = buildTimeline();
      if (tl) setTargetTimeline(tl);
    } catch (e) {
      console.warn('[FollowTrainingModule] Failed to generate target timeline:', e);
    }
  }, [buildTimeline]);

  const isPlayingRef = useRef(isPlaying);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    isPausedRef.current = isPaused;
  }, [isPlaying, isPaused]);

  // 2. 按键事件回调：精确锚定声卡当前物理硬件时间
  const handleRawKeyEvent = useCallback((ev) => {
    if (!isPlayingRef.current || isPausedRef.current) {
      return;
    }
    const prog = audioPlayer.getPlaybackProgress();
    const timeOffset = prog.timeMs || 0;
    setUserEvents((prev) => {
      const next = [...prev, { ...ev, time: timeOffset }];
      userEventsRef.current = next;
      return next;
    });
  }, []);

  // 3. 规范调用即时侧音与按键采集 Hook
  const {
    isKeyDown,
    pressDuration,
    connectSerial,
    serialConnected,
    manualDown,
    manualUp
  } = useKeyInput({
    enabled: true,
    device: inputDevice,
    keyType: keyType,
    paddleReverse: paddleReverse,
    wpm: morseSpeed,
    frequency: effectiveSidetoneFreq,
    volume: 0.8,
    onKeyEvent: handleRawKeyEvent
  });

  // 4. 低频状态机联动：播放开始时清空事件；停止时后台计算分析
  useEffect(() => {
    if (isPlaying && !isPaused) {
      if (!wasPlayingRef.current) {
        setUserEvents([]);
        userEventsRef.current = [];
        wasPlayingRef.current = true;
        lastAnalyzedRef.current = false;
        // 重新同步一次时间轴（以防从不同单词切入播放）
        const tl = buildTimeline();
        if (tl) setTargetTimeline(tl);
      }
    } else if (isPlaying && isPaused) {
      // 暂停时记录静态时间刻度
      const prog = audioPlayer.getPlaybackProgress();
      setCurrentTime(prog.timeMs || 0);
    } else if (!isPlaying) {
      // 停止播放或自然结束：在后台计算复盘分析
      if (wasPlayingRef.current && !lastAnalyzedRef.current && userEventsRef.current.length >= 2) {
        lastAnalyzedRef.current = true;
        try {
          const res = analyzeSession({
            targetTimeline,
            userEvents: userEventsRef.current,
            sessionStartTime: 0
          });
          if (res) {
            setAnalysisResult(res);
            // 主动停止时不强弹弹窗，仅点亮【分析】按钮；若用户需要可随时点击查看
          }
        } catch (err) {
          console.error('[FollowTrainingModule] Failed to analyze session:', err);
        }
      }

      wasPlayingRef.current = false;
      setCurrentTime(0);
    }
  }, [isPlaying, isPaused, targetTimeline, buildTimeline]);

  return (
    <>
      {/* 嵌入正文底部的细长示波器面板 */}
      <TrainingScopePanel
        isCollapsed={isScopeCollapsed}
        onToggleCollapse={() => setIsScopeCollapsed(!isScopeCollapsed)}
        trainingMode={trainingMode}
        setTrainingMode={setTrainingMode}
        inputDevice={inputDevice}
        setInputDevice={handleSetInputDevice}
        keyType={keyType}
        setKeyType={handleSetKeyType}
        paddleReverse={paddleReverse}
        setPaddleReverse={handleSetPaddleReverse}
        playheadPosition={playheadPosition}
        setPlayheadPosition={handleSetPlayheadPosition}
        onConnectSerial={connectSerial}
        isSerialConnected={serialConnected}
        isKeyDown={isKeyDown}
        pressDuration={pressDuration}
        targetTimeline={targetTimeline}
        userEvents={userEvents}
        currentTime={currentTime}
        isPlaying={isPlaying}
        isPaused={isPaused}
        isFinished={!isPlaying && !!analysisResult}
        onOpenResult={() => setIsResultOpen(true)}
        hasResult={!!analysisResult}
        timeWindowSec={timeWindowSec}
        setTimeWindowSec={handleSetTimeWindowSec}
        height={30}
        sidetoneOffset={sidetoneOffset}
        setSidetoneOffset={handleSetSidetoneOffset}
        effectiveSidetoneFreq={effectiveSidetoneFreq}
        morseFreq={morseFreq}
        onManualDown={manualDown}
        onManualUp={manualUp}
      />

      {/* 复盘评测弹窗 */}
      <TrainingResultModal
        isOpen={isResultOpen}
        onClose={() => setIsResultOpen(false)}
        onRetry={() => {
          setIsResultOpen(false);
          setUserEvents([]);
          userEventsRef.current = [];
        }}
        result={analysisResult}
        wpm={morseSpeed}
      />
    </>
  );
}

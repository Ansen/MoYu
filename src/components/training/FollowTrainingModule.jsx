import React, { useState, useEffect, useRef, useCallback } from 'react';
import TrainingScopePanel from './TrainingScopePanel';
import TrainingResultModal from './TrainingResultModal';
import TrainingHistoryModal from './TrainingHistoryModal';
import { saveTrainingSession } from '../../utils/trainingHistoryStore';
import { useKeyInput } from '../../hooks/useKeyInput';
import { generateTargetTimeline, analyzeSession } from '../../utils/morseTimingAnalyzer';
import audioPlayer from '../../utils/audioPlayer';
import { useI18n } from '../../i18n';

/**
 * 独立的 CW 跟发与节奏训练自闭环模块 (FollowTrainingModule)
 * 1. 最小侵入性：内聚所有按键采集、即时侧音、时间轴生成、动态比对打分与复盘弹窗
 * 2. 60FPS 声卡硬件时钟解耦：高频帧循环内聚在 Canvas，父组件保持零脏渲染
 * 3. 选词/跳转播放时序无缝对齐
 * 4. 非侵入式复盘：主动停止仅点亮【分析】按钮，不强弹弹窗打扰阅读
 * 5. CH552G 硬件热插拔自动识别、自动切换与友好模式通知
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
  onStopRequest: _onStopRequest,
  onStartWeakPractice = null
}) {
  const { lang } = useI18n();
  const isEn = lang === 'en';

  // 核心模式与输入设备状态（默认键盘，检测到 CH552G 接入时自动切换为 ch552g）
  const [trainingMode, setTrainingMode] = useState('live'); // 'live' | 'blind' | 'silent'
  const [inputDevice, setInputDevice] = useState(() => {
    try {
      return localStorage.getItem('moyu_cw_input_device') || 'keyboard';
    } catch {
      return 'keyboard';
    }
  }); // 'keyboard' | 'ch552g'
  const inputDeviceRef = useRef(inputDevice);
  inputDeviceRef.current = inputDevice;

  // 友好模式变更通知 (Toast Banner)
  const [modeNotice, setModeNotice] = useState(null); // { tone: 'success' | 'warning' | 'info', message: string }
  const noticeTimerRef = useRef(null);

  const showModeNotice = useCallback((tone, message, durationMs = 3800) => {
    if (noticeTimerRef.current) {
      clearTimeout(noticeTimerRef.current);
    }
    setModeNotice({ tone, message, id: Date.now() });
    noticeTimerRef.current = setTimeout(() => {
      setModeNotice(null);
      noticeTimerRef.current = null;
    }, durationMs);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) {
        clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const [keyType, setKeyType] = useState(() => {
    try {
      return localStorage.getItem('moyu_cw_key_type') || 'straight';
    } catch {
      return 'straight';
    }
  }); // 'straight' (手键) | 'paddle' (自动键)
  const keyTypeRef = useRef(keyType);
  keyTypeRef.current = keyType;

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

  // 示波器时基窗口状态（秒）：默认 8 秒 (8000ms)
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

  // 当前真实章节正文
  const activeChapterContent = chapterText || audioPlayer.session?.text || bookData?.data || '';

  // 1. 目标时间轴结构化生成 (完全对齐 audioPlayer 队列与 Token 索引)
  const buildTimeline = useCallback(() => {
    if (!activeChapterContent) return null;
    const sessionStartIndex = audioPlayer.session?.startIndex || 0;
    const isPlayingSession = audioPlayer.playbackState.isPlaying && Array.isArray(audioPlayer.queue) && audioPlayer.queue.length > 0;

    // 若播放过程中动态调整了发报速度 (WPM) 或数码模式，优先触发播放器无缝热重调度
    if (isPlayingSession && (Number(audioPlayer.playbackConfig.wpm) !== Number(morseSpeed) || audioPlayer.playbackConfig.numberMode !== numberMode)) {
      audioPlayer.updateConfig({ wpm: morseSpeed, numberMode });
    }

    return generateTargetTimeline({
      text: activeChapterContent,
      wpm: morseSpeed,
      numberMode: numberMode,
      enableMarkers: enableMarkers,
      prefixMarker: prefixMarker,
      suffixMarker: suffixMarker,
      startIndex: sessionStartIndex,
      queue: isPlayingSession ? audioPlayer.queue : null
    });
  }, [activeChapterContent, morseSpeed, numberMode, enableMarkers, prefixMarker, suffixMarker]);

  // 时序与事件数据
  const [userEvents, setUserEvents] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [targetTimeline, setTargetTimeline] = useState(() => buildTimeline());
  const [analysisResult, setAnalysisResult] = useState(null);
  const [isResultOpen, setIsResultOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

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

  // 监听底层音频中枢热重调度与队列跃迁，毫秒级同步目标波形
  useEffect(() => {
    const unsubscribe = audioPlayer.subscribe(() => {
      if (audioPlayer.playbackState.isPlaying && Array.isArray(audioPlayer.queue) && audioPlayer.queue.length > 0) {
        try {
          const tl = buildTimeline();
          if (tl) setTargetTimeline(tl);
        } catch {}
      }
    });
    return () => unsubscribe();
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

  // 当用户在键盘模式下直接按下已连接的 CH552G 实体电键时，自动切换回 CH552G 硬件模式并提示
  const handleHardwareActivity = useCallback(() => {
    if (inputDeviceRef.current !== 'ch552g') {
      setInputDevice('ch552g');
      try {
        localStorage.setItem('moyu_cw_input_device', 'ch552g');
      } catch {}
      const keyLabel = keyTypeRef.current === 'paddle'
        ? (isEn ? 'Paddle' : '自动键')
        : (isEn ? 'Straight Key' : '手键');
      showModeNotice(
        'success',
        isEn
          ? `CH552G keying detected · Switched to [CH552G Hardware Mode · ${keyLabel}]`
          : `检测到 CH552G 电键输入 · 已自动切换为【CH552G 硬件模式 · ${keyLabel}】`
      );
    }
  }, [isEn, showModeNotice]);

  // 3. 规范调用即时侧音与按键采集 Hook
  const {
    isKeyDown,
    pressDuration,
    connectSerial,
    serialConnected,
    serialPortName,
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
    onKeyEvent: handleRawKeyEvent,
    onHardwareActivity: handleHardwareActivity
  });

  // 手动切换输入设备并给出友好模式提示
  const handleSetInputDevice = useCallback((dev) => {
    setInputDevice(dev);
    try {
      localStorage.setItem('moyu_cw_input_device', dev);
    } catch {}
    const keyLabel = keyTypeRef.current === 'paddle'
      ? (isEn ? 'Paddle' : '自动键')
      : (isEn ? 'Straight Key' : '手键');

    if (dev === 'ch552g') {
      if (serialConnected) {
        const portSuffix = serialPortName ? ` (${serialPortName})` : '';
        showModeNotice(
          'success',
          isEn
            ? `Current Mode: [CH552G Hardware Mode · ${keyLabel}]${portSuffix}`
            : `当前模式：【CH552G 硬件模式 · ${keyLabel}】${portSuffix}`
        );
      } else {
        showModeNotice(
          'warning',
          isEn
            ? 'Waiting for CH552G USB Keyer · Plug in device to auto-connect'
            : '当前为【CH552G 硬件模式】· 请插入 CH552G 电键，系统将自动识别连接'
        );
      }
    } else {
      const kbHint = keyTypeRef.current === 'paddle'
        ? (isEn ? 'Z / X or Left / Right Arrow' : 'Z / X 键或左右方向键')
        : (isEn ? 'Spacebar' : 'Space 空格键');
      showModeNotice(
        'info',
        isEn
          ? `Switched to [Keyboard Mode · ${keyLabel}] (Press ${kbHint})`
          : `已切换为【键盘发报模式 · ${keyLabel}】（使用 ${kbHint} 发报）`
      );
    }
  }, [isEn, serialConnected, serialPortName, showModeNotice]);

  // 手动切换手键/自动键并给出友好模式提示
  const handleSetKeyType = useCallback((type) => {
    setKeyType(type);
    try {
      localStorage.setItem('moyu_cw_key_type', type);
    } catch {}
    const devLabel = inputDeviceRef.current === 'ch552g'
      ? (isEn ? 'CH552G Hardware' : 'CH552G 硬件')
      : (isEn ? 'Keyboard' : '键盘');
    const typeDesc = type === 'paddle'
      ? (isEn ? 'Paddle (Auto Dit/Dah)' : '自动键模式（双桨点划电子键控）')
      : (isEn ? 'Straight Key (Manual)' : '手键模式（直键手动发报）');
    showModeNotice(
      'info',
      isEn
        ? `Current Mode: [${devLabel} · ${typeDesc}]`
        : `当前模式：【${devLabel} · ${typeDesc}】`
    );
  }, [isEn, showModeNotice]);

  // 自动识别硬件插入与拔出：自动切换模式并友好告知用户当前模式
  const prevSerialConnectedRef = useRef(null);
  const initialNoticeShownRef = useRef(false);
  useEffect(() => {
    const prev = prevSerialConnectedRef.current;
    prevSerialConnectedRef.current = serialConnected;

    const keyLabel = keyTypeRef.current === 'paddle'
      ? (isEn ? 'Paddle' : '自动键')
      : (isEn ? 'Straight Key' : '手键');

    if (serialConnected && prev !== true) {
      initialNoticeShownRef.current = true;
      // 硬件已插入（或进入跟发模式时检测到硬件在线）：自动切换为 CH552G 硬件模式
      setInputDevice('ch552g');
      try {
        localStorage.setItem('moyu_cw_input_device', 'ch552g');
      } catch {}
      const portSuffix = serialPortName ? ` (${serialPortName})` : '';
      showModeNotice(
        'success',
        isEn
          ? `CH552G Keyer connected${portSuffix} · Auto-switched to [CH552G Hardware Mode · ${keyLabel}]`
          : `已自动识别并连接 CH552G 电键${portSuffix} · 当前为【CH552G 硬件模式 · ${keyLabel}】`
      );
    } else if (!serialConnected && prev === true) {
      initialNoticeShownRef.current = true;
      // 硬件被物理拔出：自动回退至键盘模式并友好提示
      setInputDevice('keyboard');
      try {
        localStorage.setItem('moyu_cw_input_device', 'keyboard');
      } catch {}
      showModeNotice(
        'warning',
        isEn
          ? `CH552G Keyer unplugged · Auto-switched to [Keyboard Mode · ${keyLabel}]`
          : `CH552G 电键已断开 · 已自动切换为【键盘发报模式 · ${keyLabel}】`
      );
    } else if (!serialConnected && prev === null && !initialNoticeShownRef.current) {
      // 首次打开跟发模式且暂未检测到硬件时，延迟 180ms 等待底层状态同步完成后友好提示当前模式
      const timer = setTimeout(() => {
        if (!initialNoticeShownRef.current && !prevSerialConnectedRef.current) {
          initialNoticeShownRef.current = true;
          const curKeyLabel = keyTypeRef.current === 'paddle'
            ? (isEn ? 'Paddle (Z/X Keys)' : '自动键 (Z/X 键)')
            : (isEn ? 'Straight Key (Spacebar)' : '手键 (Space 空格键)');
          showModeNotice(
            'info',
            isEn
              ? `Current Mode: [Keyboard Mode · ${curKeyLabel}] · Plug in CH552G to auto-switch`
              : `当前为【键盘发报模式 · ${curKeyLabel}】· 插入 CH552G 电键可自动识别切换`
          );
        }
      }, 180);
      return () => clearTimeout(timer);
    }
  }, [serialConnected, serialPortName, isEn, showModeNotice]);

  // 4. 低频状态机联动：播放开始时清空事件；停止时后台计算分析
  useEffect(() => {
    if (isPlaying && !isPaused) {
      if (!wasPlayingRef.current) {
        setUserEvents([]);
        userEventsRef.current = [];
        wasPlayingRef.current = true;
        lastAnalyzedRef.current = false;
        const tl = buildTimeline();
        if (tl) setTargetTimeline(tl);
      }
    } else if (isPlaying && isPaused) {
      const prog = audioPlayer.getPlaybackProgress();
      setCurrentTime(prog.timeMs || 0);
    } else if (!isPlaying) {
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
            try {
              saveTrainingSession({
                ...res,
                wpm: morseSpeed,
                mode: trainingMode,
                inputDevice,
                chapterTitle: bookData?.name || ''
              });
            } catch (saveErr) {
              console.warn('[FollowTrainingModule] Failed to save session:', saveErr);
            }
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
        serialPortName={serialPortName}
        modeNotice={modeNotice}
        onDismissNotice={() => setModeNotice(null)}
        isKeyDown={isKeyDown}
        pressDuration={pressDuration}
        targetTimeline={targetTimeline}
        userEvents={userEvents}
        currentTime={currentTime}
        isPlaying={isPlaying}
        isPaused={isPaused}
        isFinished={!isPlaying && !!analysisResult}
        onOpenResult={() => setIsResultOpen(true)}
        onOpenHistory={() => setIsHistoryOpen(true)}
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
        onOpenHistory={() => setIsHistoryOpen(true)}
        onStartWeakPractice={onStartWeakPractice}
        result={analysisResult}
        wpm={morseSpeed}
      />

      {/* 练习历史档案与易错字符热力图弹窗 */}
      <TrainingHistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onStartWeakPractice={onStartWeakPractice}
      />
    </>
  );
}

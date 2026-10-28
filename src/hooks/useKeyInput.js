import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// ============================================================================
// 全局硬件串口单例连接管理器 (Tauri Rust Native Serial + WebSerial Fallback)
// 1. 桌面端 (Tauri): 由底层 Rust 线程按 USB VID 自动探测热插拔并直接读取，零权限弹窗、即插即用
// 2. 网页端 (Browser): 自动回退至 WebSerial API，保持跨环境兼容
// ============================================================================
let globalPort = null;
let globalReader = null;
let globalIsReading = false;
let globalConnected = false;
let globalPortName = null;
let tauriSerialInitialized = false;
const globalListeners = new Set();

function isTauriEnv() {
  return typeof window !== 'undefined' && Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
}

function notifyGlobalListeners(byte) {
  for (const listener of globalListeners) {
    try {
      listener.onByte(byte);
    } catch (e) {
      console.error('[SerialSingleton] Listener error:', e);
    }
  }
}

function notifyGlobalConnection(connected, portName = null) {
  globalConnected = connected;
  if (portName !== undefined) {
    globalPortName = portName;
  }
  for (const listener of globalListeners) {
    try {
      listener.onConnectionChange(connected, globalPortName);
    } catch (e) {
      console.error('[SerialSingleton] Connection callback error:', e);
    }
  }
}

function initTauriSerialSingleton() {
  if (tauriSerialInitialized || !isTauriEnv()) return;
  tauriSerialInitialized = true;

  // 1. 监听来自 Rust 原生串口线程的实时按键单字节流
  listen('ch552g-byte', (event) => {
    const byte = Number(event.payload);
    if (!Number.isNaN(byte)) {
      if (!globalConnected) {
        notifyGlobalConnection(true, globalPortName);
      }
      notifyGlobalListeners(byte);
    }
  }).catch((err) => {
    console.warn('[SerialSingleton] Failed to attach ch552g-byte listener:', err);
  });

  // 2. 监听来自 Rust 原生串口线程的热插拔连接状态变更
  listen('ch552g-status', (event) => {
    const payload = event.payload || {};
    notifyGlobalConnection(Boolean(payload.connected), payload.port || null);
  }).catch((err) => {
    console.warn('[SerialSingleton] Failed to attach ch552g-status listener:', err);
  });

  // 3. 挂载时立即同步当前 Rust 端串口连接状态
  invoke('get_serial_status')
    .then((status) => {
      if (status && typeof status.connected === 'boolean') {
        notifyGlobalConnection(status.connected, status.port || null);
      }
    })
    .catch(() => {});
}

function startGlobalReadLoop(port) {
  if (globalIsReading) return;
  if (!port || !port.readable) return;

  globalIsReading = true;
  (async () => {
    try {
      while (globalPort && globalPort.readable) {
        try {
          globalReader = globalPort.readable.getReader();
        } catch (e) {
          console.warn('[SerialSingleton] getReader error:', e);
          break;
        }

        try {
          console.log('[SerialSingleton] Global serial reader attached and reading...');
          while (true) {
            const { value, done } = await globalReader.read();
            if (done) break;
            if (value && value.length > 0) {
              for (let i = 0; i < value.length; i++) {
                notifyGlobalListeners(value[i]);
              }
            }
          }
        } catch (readErr) {
          console.warn('[SerialSingleton] read stream interrupted:', readErr);
          break;
        } finally {
          try {
            globalReader.releaseLock();
          } catch {}
          globalReader = null;
        }
      }
    } catch (err) {
      console.error('[SerialSingleton] Read loop fatal error:', err);
    } finally {
      globalIsReading = false;
      if (!globalPort || !globalPort.readable) {
        notifyGlobalConnection(false, null);
      }
    }
  })();
}

let connectingPromise = null;

async function connectGlobalSerialPort() {
  // Tauri 桌面环境下直接使用 Rust 原生串口通道，免去 WebView 授权弹窗
  if (isTauriEnv()) {
    initTauriSerialSingleton();
    try {
      const status = await invoke('connect_serial_port');
      if (status && typeof status.connected === 'boolean') {
        notifyGlobalConnection(status.connected, status.port || null);
      }
      return status;
    } catch (err) {
      console.warn('[SerialSingleton] Rust connect_serial_port warning:', err);
      return null;
    }
  }

  if (connectingPromise) {
    return connectingPromise;
  }
  connectingPromise = (async () => {
    try {
      return await doConnectGlobalSerialPort();
    } finally {
      connectingPromise = null;
    }
  })();
  return connectingPromise;
}

async function doConnectGlobalSerialPort() {
  if (!('serial' in navigator)) {
    throw new Error('WebSerial not supported');
  }

  // 1. 如果全局已有且处于打开状态并正在读取，直接复用！
  if (globalPort && globalPort.readable && globalIsReading) {
    globalConnected = true;
    notifyGlobalConnection(true, 'USB');
    return globalPort;
  }

  let port = globalPort;

  // 2. 尝试从已授权配对端口列表中查找
  if (!port && 'getPorts' in navigator.serial) {
    try {
      const paired = await navigator.serial.getPorts();
      if (paired && paired.length > 0) {
        port = paired[0];
      }
    } catch {}
  }

  // 3. 如果找到端口，确保以有效 readable 状态打开
  if (port) {
    if (port.readable && !port.readable.locked) {
      globalPort = port;
      globalConnected = true;
      notifyGlobalConnection(true, 'USB');
      startGlobalReadLoop(globalPort);
      return globalPort;
    }

    try {
      if (globalReader) {
        try { await globalReader.cancel(); } catch {}
        try { globalReader.releaseLock(); } catch {}
        globalReader = null;
      }
      try { await port.close(); } catch {}
      await port.open({ baudRate: 115200 });
      globalPort = port;
      globalConnected = true;
      notifyGlobalConnection(true, 'USB');
      startGlobalReadLoop(globalPort);
      return globalPort;
    } catch (openErr) {
      console.warn('[SerialSingleton] First open attempt failed, retrying clean open:', openErr);
      try { await port.close(); } catch {}
      try {
        await port.open({ baudRate: 115200 });
        globalPort = port;
        globalConnected = true;
        notifyGlobalConnection(true, 'USB');
        startGlobalReadLoop(globalPort);
        return globalPort;
      } catch (retryErr) {
        console.warn('[SerialSingleton] Paired port open failed:', retryErr);
        port = null;
      }
    }
  }

  // 4. 若无已配对端口或打开失败，调起系统选择器 (仅纯网页端)
  if (!port) {
    try {
      port = await navigator.serial.requestPort({
        filters: [
          { usbVendorId: 0x16C0 }, // MoYu CH552 CDC VID
          { usbVendorId: 0x1209 }, // Open-source USB VID
          { usbVendorId: 0x1A86 }  // WCH (沁恒)
        ]
      });
    } catch {
      port = await navigator.serial.requestPort();
    }

    try { await port.close(); } catch {}
    await port.open({ baudRate: 115200 });
  }

  if (!port || !port.readable) {
    throw new Error('SerialPort readable stream is unavailable');
  }

  globalPort = port;
  globalConnected = true;
  notifyGlobalConnection(true, 'USB');
  startGlobalReadLoop(globalPort);
  return globalPort;
}

async function disconnectGlobalSerialPort() {
  if (isTauriEnv()) {
    try {
      await invoke('disconnect_serial_port');
    } catch {}
    notifyGlobalConnection(false, null);
    return;
  }

  notifyGlobalConnection(false, null);
  const reader = globalReader;
  globalReader = null;
  if (reader) {
    try {
      await reader.cancel();
    } catch {}
    try {
      reader.releaseLock();
    } catch {}
  }
  const port = globalPort;
  globalPort = null;
  if (port) {
    try {
      await port.close();
    } catch {}
  }
  globalIsReading = false;
}

// 监听硬件物理热插拔拔出事件 (纯网页端 WebSerial)
if (typeof window !== 'undefined' && !isTauriEnv() && 'serial' in navigator) {
  navigator.serial.addEventListener('disconnect', (event) => {
    if (event.port === globalPort) {
      console.log('[SerialSingleton] Physical USB disconnected');
      disconnectGlobalSerialPort();
    }
  });
}

/**
 * 统一多源按键采集与即时侧音 Hook
 * 1. 支持硬件电键 (Tauri Rust 原生串口直读 / WebSerial 网页后备) 与键盘空格键
 * 2. 硬件电键按下时通过 Web Audio 零延迟触发侧音 (SideTone)
 * 3. 记录高精度时间戳 (performance.now()) 事件流
 */
export function useKeyInput({
  enabled = true,
  device: _device = 'keyboard', // 'keyboard' | 'serial' | 'ch552g'
  keyType = 'straight', // 'straight' | 'paddle'
  paddleReverse = false, // false: P14=Dah, P15=Dit; true: P14=Dit, P15=Dah
  wpm = 20,
  frequency = 400,
  volume = 0.8,
  onKeyEvent = null,
  onHardwareActivity = null
}) {
  const [isKeyDown, setIsKeyDown] = useState(false);
  const [pressDuration, setPressDuration] = useState(0);
  const [serialConnected, setSerialConnected] = useState(() =>
    isTauriEnv() ? globalConnected : (globalConnected && globalPort !== null && !!globalPort.readable)
  );
  const [serialPortName, setSerialPortName] = useState(() => globalPortName);

  const isKeyDownRef = useRef(false);
  const keyDownTimeRef = useRef(0);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const gainRef = useRef(null);
  const keepAliveOscRef = useRef(null);
  const onKeyEventRef = useRef(onKeyEvent);
  onKeyEventRef.current = onKeyEvent;
  const onHardwareActivityRef = useRef(onHardwareActivity);
  onHardwareActivityRef.current = onHardwareActivity;

  const keyTypeRef = useRef(keyType);
  keyTypeRef.current = keyType;
  const paddleReverseRef = useRef(paddleReverse);
  paddleReverseRef.current = paddleReverse;

  const wpmRef = useRef(wpm);
  wpmRef.current = wpm;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const frequencyRef = useRef(frequency);
  frequencyRef.current = frequency;

  // 自动双桨 (Iambic Keyer) 内部状态机
  const ditPaddleRef = useRef(false);
  const dahPaddleRef = useRef(false);
  const keyerRunningRef = useRef(false);
  const latchRef = useRef(null); // 'dit' | 'dah' | null
  const lastElementRef = useRef('dit');
  const keyerTimerRef = useRef(null);

  // 1. 初始化即时侧音合成器 (SideTone Audio Synthesizer) 并主动唤醒硬件声卡
  const initAudio = useCallback(() => {
    if (audioCtxRef.current) {
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().catch(() => {});
      }
      return audioCtxRef.current;
    }
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequencyRef.current, ctx.currentTime);
      gain.gain.setValueAtTime(0, ctx.currentTime);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();

      audioCtxRef.current = ctx;
      oscRef.current = osc;
      gainRef.current = gain;

      // 预先建立音频驱动加电稳态，消除首次按键 80~150ms 的 DAC 冷启动延迟
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      try {
        const buf = ctx.createBuffer(1, 128, ctx.sampleRate || 44100);
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.connect(gain);
        src.start(0);
      } catch {}

      // 亚音频常驻防休眠载波 (Anti-Sleep Keep-Alive DAC Stream)
      // 采用 20Hz 亚音频、振幅 0.0001 (-80dB) 的常驻正弦波直通声卡
      // 物理上完全低于人耳听觉阈值与扬声器起振幅值，完全静音
      // 但持续激活操作系统 (WASAPI) 音频硬件流水线，彻底防止闲置数秒/数分钟后声卡 DAC 芯片休眠导致的再次按键冷启动延迟
      try {
        const keepAliveOsc = ctx.createOscillator();
        const keepAliveGain = ctx.createGain();
        keepAliveOsc.type = 'sine';
        keepAliveOsc.frequency.setValueAtTime(20, ctx.currentTime);
        keepAliveGain.gain.setValueAtTime(0.0001, ctx.currentTime);
        keepAliveOsc.connect(keepAliveGain);
        keepAliveGain.connect(ctx.destination);
        keepAliveOsc.start();
        keepAliveOscRef.current = keepAliveOsc;
      } catch {}

      return ctx;
    } catch (e) {
      console.warn('[useKeyInput] AudioContext init warning:', e);
      return null;
    }
  }, []);

  // 挂载时以及在任意全局交互手势时预先初始化与唤醒声卡通道，消除首键延迟
  useEffect(() => {
    initAudio();

    const warmUpHandler = () => {
      const ctx = initAudio();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
    };

    window.addEventListener('pointerdown', warmUpHandler, { once: true, passive: true });
    window.addEventListener('keydown', warmUpHandler, { once: true, passive: true });

    return () => {
      window.removeEventListener('pointerdown', warmUpHandler);
      window.removeEventListener('keydown', warmUpHandler);
    };
  }, [initAudio]);

  // 动态更新侧音频率
  useEffect(() => {
    if (oscRef.current && audioCtxRef.current) {
      try {
        oscRef.current.frequency.setTargetAtTime(frequency, audioCtxRef.current.currentTime, 0.01);
      } catch {}
    }
  }, [frequency]);

  // 动态更新侧音音量 (静音切换即时响应)
  useEffect(() => {
    if (gainRef.current && audioCtxRef.current && isKeyDownRef.current) {
      try {
        const now = audioCtxRef.current.currentTime;
        gainRef.current.gain.cancelScheduledValues(now);
        gainRef.current.gain.setTargetAtTime(volume, now, 0.003);
      } catch {}
    }
  }, [volume]);

  // 侧音开/关
  const setTone = useCallback((active) => {
    if (!gainRef.current || !audioCtxRef.current) return;
    try {
      const now = audioCtxRef.current.currentTime;
      if (active) {
        if (audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        gainRef.current.gain.cancelScheduledValues(now);
        gainRef.current.gain.setTargetAtTime(volumeRef.current, now, 0.003); // 3ms 软起动防爆音
      } else {
        gainRef.current.gain.cancelScheduledValues(now);
        gainRef.current.gain.setTargetAtTime(0, now, 0.003); // 3ms 软切音
      }
    } catch {}
  }, []);

  // 手键模式：统一按键触发处理
  const handleDown = useCallback((source = 'keyboard') => {
    if (isKeyDownRef.current) return; // 防重复
    isKeyDownRef.current = true;
    const now = performance.now();
    keyDownTimeRef.current = now;
    setIsKeyDown(true);

    initAudio();
    setTone(true);

    const ev = { timestamp: now, state: 'DOWN', source };
    if (onKeyEventRef.current) {
      onKeyEventRef.current(ev);
    }
  }, [initAudio, setTone]);

  const handleUp = useCallback((source = 'keyboard') => {
    if (!isKeyDownRef.current) return;
    isKeyDownRef.current = false;
    const now = performance.now();
    const duration = Math.max(10, Math.round(now - keyDownTimeRef.current));
    setPressDuration(duration);
    setIsKeyDown(false);

    setTone(false);

    const ev = { timestamp: now, state: 'UP', duration, source };
    if (onKeyEventRef.current) {
      onKeyEventRef.current(ev);
    }
  }, [setTone]);

  // 自动键模式：Iambic Mode B 电子键控发生器 (Electronic Keyer Engine)
  const triggerKeyer = useCallback(() => {
    if (keyerRunningRef.current) return;
    keyerRunningRef.current = true;

    const playNext = () => {
      let nextElement = null;
      if (latchRef.current) {
        nextElement = latchRef.current;
        latchRef.current = null;
      } else if (ditPaddleRef.current && dahPaddleRef.current) {
        // 双桨挤压（Squeeze）：交替发报
        nextElement = lastElementRef.current === 'dit' ? 'dah' : 'dit';
      } else if (ditPaddleRef.current) {
        nextElement = 'dit';
      } else if (dahPaddleRef.current) {
        nextElement = 'dah';
      }

      if (!nextElement) {
        keyerRunningRef.current = false;
        return;
      }

      lastElementRef.current = nextElement;
      const currentWpm = Math.max(5, Math.min(60, Number(wpmRef.current || 20)));
      const unitMs = Math.round(1200 / currentWpm);
      const toneDuration = nextElement === 'dit' ? unitMs : 3 * unitMs;

      // 1. 发声 (DOWN)
      const now = performance.now();
      keyDownTimeRef.current = now;
      isKeyDownRef.current = true;
      setIsKeyDown(true);
      initAudio();
      setTone(true);
      if (onKeyEventRef.current) {
        onKeyEventRef.current({ timestamp: now, state: 'DOWN', source: 'paddle' });
      }

      // 2. 发音持续时间定时器
      keyerTimerRef.current = setTimeout(() => {
        const upTime = performance.now();
        const duration = toneDuration;
        isKeyDownRef.current = false;
        setPressDuration(duration);
        setIsKeyDown(false);
        setTone(false);
        if (onKeyEventRef.current) {
          onKeyEventRef.current({ timestamp: upTime, state: 'UP', duration, source: 'paddle' });
        }

        // 3. 单元间 1 unit 标准静音间隔 (Intra-element space)
        keyerTimerRef.current = setTimeout(() => {
          playNext();
        }, unitMs);

      }, toneDuration);
    };

    playNext();
  }, [initAudio, setTone]);

  // 双桨触点事件处理（点/划独立触发 + Mode B 锁存记忆）
  const onPaddleDit = useCallback((isDown) => {
    initAudio();
    ditPaddleRef.current = isDown;
    if (isDown) {
      if (keyerRunningRef.current) {
        if (lastElementRef.current === 'dah') {
          latchRef.current = 'dit';
        }
      } else {
        triggerKeyer();
      }
    }
  }, [initAudio, triggerKeyer]);

  const onPaddleDah = useCallback((isDown) => {
    initAudio();
    dahPaddleRef.current = isDown;
    if (isDown) {
      if (keyerRunningRef.current) {
        if (lastElementRef.current === 'dit') {
          latchRef.current = 'dah';
        }
      } else {
        triggerKeyer();
      }
    }
  }, [initAudio, triggerKeyer]);

  // 模式切换时重置所有状态
  useEffect(() => {
    if (keyerTimerRef.current) {
      clearTimeout(keyerTimerRef.current);
      keyerTimerRef.current = null;
    }
    ditPaddleRef.current = false;
    dahPaddleRef.current = false;
    latchRef.current = null;
    keyerRunningRef.current = false;
    isKeyDownRef.current = false;
    setTone(false);
    setIsKeyDown(false);
  }, [keyType, setTone]);

  // 2. 键盘监听：
  //    手键模式: Space 发报 (按下发声，松开切断)
  //    自动键模式: Space/Left/BracketLeft 发点，Right/BracketRight/X 发划
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      if (keyTypeRef.current === 'paddle') {
        if (e.code === 'BracketLeft' || e.code === 'KeyZ' || e.code === 'ArrowLeft') {
          if (!e.repeat) {
            e.preventDefault();
            onPaddleDit(true);
          }
        } else if (e.code === 'BracketRight' || e.code === 'KeyX' || e.code === 'ArrowRight') {
          if (!e.repeat) {
            e.preventDefault();
            onPaddleDah(true);
          }
        } else if (e.code === 'Space' && !e.repeat) {
          e.preventDefault();
          onPaddleDit(true);
        }
      } else {
        if (e.code === 'Space' && !e.repeat) {
          e.preventDefault();
          handleDown('keyboard');
        }
      }
    };

    const onKeyUp = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      if (keyTypeRef.current === 'paddle') {
        if (e.code === 'BracketLeft' || e.code === 'KeyZ' || e.code === 'ArrowLeft') {
          e.preventDefault();
          onPaddleDit(false);
        } else if (e.code === 'BracketRight' || e.code === 'KeyX' || e.code === 'ArrowRight') {
          e.preventDefault();
          onPaddleDah(false);
        } else if (e.code === 'Space') {
          e.preventDefault();
          onPaddleDit(false);
        }
      } else {
        if (e.code === 'Space') {
          e.preventDefault();
          handleUp('keyboard');
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      setTone(false);
      isKeyDownRef.current = false;
    };
  }, [enabled, handleDown, handleUp, onPaddleDit, onPaddleDah, setTone]);

  // 3. 硬件串口支持 (Tauri Rust 原生直读 + WebSerial 后备，切换书本/章节无缝复用)
  useEffect(() => {
    const listener = {
      onByte: (byte) => {
        const isP14Dit = paddleReverseRef.current;
        // MoYu CH552 硬件协议:
        // 0x01: P1.4 按下 (手键 / 自动键默认划 Dah)
        // 0x00: P1.4 松开
        // 0x02: P1.5 按下 (自动键默认点 Dit)
        // 0x03: P1.5 松开
        if (byte === 1) {
          if (onHardwareActivityRef.current) onHardwareActivityRef.current();
          if (keyTypeRef.current === 'straight') {
            handleDown('serial');
          } else {
            if (isP14Dit) onPaddleDit(true);
            else onPaddleDah(true);
          }
        } else if (byte === 0) {
          if (keyTypeRef.current === 'straight') {
            handleUp('serial');
          } else {
            if (isP14Dit) onPaddleDit(false);
            else onPaddleDah(false);
          }
        } else if (byte === 2) {
          // 仅自动键响应 P1.5（手键模式完全屏蔽，防止大二芯单声道插头接地误触）
          if (keyTypeRef.current === 'paddle') {
            if (onHardwareActivityRef.current) onHardwareActivityRef.current();
            if (isP14Dit) onPaddleDah(true);
            else onPaddleDit(true);
          }
        } else if (byte === 3) {
          if (keyTypeRef.current === 'paddle') {
            if (isP14Dit) onPaddleDah(false);
            else onPaddleDit(false);
          }
        } else if (byte === 0x44 /* 'D' */) {
          if (onHardwareActivityRef.current) onHardwareActivityRef.current();
          handleDown('serial');
        } else if (byte === 0x55 /* 'U' */) {
          handleUp('serial');
        }
      },
      onConnectionChange: (connected, portName) => {
        setSerialConnected(connected);
        setSerialPortName(portName || null);
        // 安全保护：若在按下电键发声中途拔出 USB，立即切断侧音并复位状态机，防止长鸣卡死
        if (!connected) {
          if (keyerTimerRef.current) {
            clearTimeout(keyerTimerRef.current);
            keyerTimerRef.current = null;
          }
          ditPaddleRef.current = false;
          dahPaddleRef.current = false;
          latchRef.current = null;
          keyerRunningRef.current = false;
          if (isKeyDownRef.current) {
            handleUp('serial');
          } else {
            setTone(false);
            setIsKeyDown(false);
          }
        }
      }
    };

    // 先注册 listener，再初始化并查询 Tauri 后端状态，确保回调 100% 不丢失
    globalListeners.add(listener);

    if (isTauriEnv()) {
      initTauriSerialSingleton();
      setSerialConnected(globalConnected);
      setSerialPortName(globalPortName);
      invoke('get_serial_status')
        .then((status) => {
          if (status && typeof status.connected === 'boolean') {
            notifyGlobalConnection(status.connected, status.port || null);
          }
        })
        .catch(() => {});
    } else if (globalConnected && globalPort && globalPort.readable) {
      setSerialConnected(true);
    }

    return () => {
      globalListeners.delete(listener);
    };
  }, [handleDown, handleUp, onPaddleDit, onPaddleDah, setTone]);

  // 当设备为 ch552g 或在 Tauri 环境下挂载时，自动激活静默直连
  useEffect(() => {
    if (isTauriEnv()) {
      initTauriSerialSingleton();
      connectGlobalSerialPort().catch(() => {});
      return;
    }

    if ((_device === 'ch552g' || _device === 'serial') && !globalConnected) {
      if (typeof navigator !== 'undefined' && 'serial' in navigator && 'getPorts' in navigator.serial) {
        navigator.serial.getPorts().then((ports) => {
          if (ports && ports.length > 0) {
            connectGlobalSerialPort().catch(() => {});
          }
        }).catch(() => {});
      }
    }
  }, [_device]);

  const connectSerial = useCallback(async () => {
    initAudio();
    if (isTauriEnv()) {
      await connectGlobalSerialPort();
      return;
    }
    if (!('serial' in navigator)) {
      alert('当前运行环境不支持 WebSerial 接口，请使用桌面客户端或键盘模式');
      return;
    }
    try {
      await connectGlobalSerialPort();
    } catch (err) {
      console.warn('[useKeyInput] Connect serial cancelled or failed:', err);
    }
  }, [initAudio]);

  const disconnectSerial = useCallback(async () => {
    await disconnectGlobalSerialPort();
  }, []);

  // 清理音频与定时器
  useEffect(() => {
    return () => {
      if (keyerTimerRef.current) {
        clearTimeout(keyerTimerRef.current);
      }
      if (oscRef.current) {
        try { oscRef.current.stop(); } catch {}
      }
      if (keepAliveOscRef.current) {
        try { keepAliveOscRef.current.stop(); } catch {}
      }
      if (audioCtxRef.current) {
        try { audioCtxRef.current.close(); } catch {}
      }
    };
  }, []);

  return {
    isKeyDown,
    pressDuration,
    serialConnected,
    serialPortName,
    connectSerial,
    disconnectSerial,
    manualDown: () => {
      if (keyTypeRef.current === 'paddle') {
        onPaddleDit(true);
      } else {
        handleDown('touch');
      }
    },
    manualUp: () => {
      if (keyTypeRef.current === 'paddle') {
        onPaddleDit(false);
      } else {
        handleUp('touch');
      }
    }
  };
}

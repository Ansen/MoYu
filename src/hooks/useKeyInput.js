import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 统一多源按键采集与即时侧音 Hook
 * 1. 支持硬件电键 (CH552G USB / WebSerial) 与键盘空格键 (临时测试)
 * 2. 硬件电键按下时通过 Web Audio 零延迟触发侧音 (SideTone)
 * 3. 记录高精度时间戳 (performance.now()) 事件流
 */
export function useKeyInput({
  enabled = true,
  device: _device = 'keyboard', // 'keyboard' | 'serial'
  frequency = 400,
  volume = 0.8,
  onKeyEvent = null
}) {
  const [isKeyDown, setIsKeyDown] = useState(false);
  const [pressDuration, setPressDuration] = useState(0);
  const [serialConnected, setSerialConnected] = useState(false);
  const [serialPort, setSerialPort] = useState(null);

  const isKeyDownRef = useRef(false);
  const keyDownTimeRef = useRef(0);
  const audioCtxRef = useRef(null);
  const oscRef = useRef(null);
  const gainRef = useRef(null);
  const onKeyEventRef = useRef(onKeyEvent);
  onKeyEventRef.current = onKeyEvent;

  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  const frequencyRef = useRef(frequency);
  frequencyRef.current = frequency;

  // 1. 初始化即时侧音合成器 (SideTone Audio Synthesizer)
  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
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
    } catch (e) {
      console.warn('[useKeyInput] AudioContext init warning:', e);
    }
  }, []);

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

  // 统一按键触发处理
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

  // 2. 键盘空格键监听 (仅在启用时生效)
  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e) => {
      // 当焦点在输入框/textarea时，不拦截按键
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        handleDown('keyboard');
      }
    };

    const onKeyUp = (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
        return;
      }
      if (e.code === 'Space') {
        e.preventDefault();
        handleUp('keyboard');
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
  }, [enabled, handleDown, handleUp, setTone]);

  // 3. WebSerial 硬件串口支持 (针对 CH552G USB 虚拟串口模式)
  const connectSerial = useCallback(async () => {
    if (!('serial' in navigator)) {
      alert('当前运行环境不支持 WebSerial 接口，请使用键盘或标准 HID 模式');
      return;
    }
    try {
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      setSerialPort(port);
      setSerialConnected(true);

      const reader = port.readable.getReader();
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value && value.length > 0) {
              const byte = value[0];
              // 约定 0x01: DOWN, 0x00: UP
              if (byte === 1 || byte === 0x44 /* 'D' */) {
                handleDown('serial');
              } else if (byte === 0 || byte === 0x55 /* 'U' */) {
                handleUp('serial');
              }
            }
          }
        } catch (err) {
          console.error('[useKeyInput] Serial read error:', err);
        } finally {
          reader.releaseLock();
          setSerialConnected(false);
        }
      })();
    } catch (err) {
      console.warn('[useKeyInput] Connect serial cancelled or failed:', err);
    }
  }, [handleDown, handleUp]);

  const disconnectSerial = useCallback(async () => {
    if (serialPort) {
      try {
        await serialPort.close();
      } catch {}
      setSerialPort(null);
      setSerialConnected(false);
    }
  }, [serialPort]);

  // 清理音频
  useEffect(() => {
    return () => {
      if (oscRef.current) {
        try { oscRef.current.stop(); } catch {}
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
    connectSerial,
    disconnectSerial,
    manualDown: () => handleDown('touch'),
    manualUp: () => handleUp('touch')
  };
}

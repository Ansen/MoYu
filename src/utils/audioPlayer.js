import { MORSE_AUDIO_CONFIG } from '../config/morseAudio.js';
import { textToMorseTokens } from './morseCode.js';

const TONE_VOLUME = MORSE_AUDIO_CONFIG.OUTPUT.TONE_VOLUME;
const TONE_FADE_SECONDS = 0.002;
const STOP_FADE_SECONDS = 0.012;
const PRE_ROLL_LEAD_IN_SECONDS = 0.1; // 100ms 安全预滚缓冲，避免系统声卡唤醒抖动与首音吞音

/**
 * 桌面端原生 Web Audio 播放器引擎
 * 基于 OscillatorNode 高精度实时波形合成与微秒级包络线防护
 */
class DesktopAudioPlayer {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.volume = MORSE_AUDIO_CONFIG.VOLUME.DEFAULT;
    this.currentNodes = [];
    this.cleanupTimers = new Set();
    this.idleTimer = null;
    this.isWarmedUp = false;
    this.playbackConfig = null;
    this.customWave = null;
    this._activeSessionId = null;
    this.playbackState = {
      isPlaying: false,
      isPaused: false,
      stopRequested: false,
    };
  }

  resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
  }

  scheduleIdleSuspend() {
    this.resetIdleTimer();
    this.idleTimer = setTimeout(() => {
      if (!this.playbackState.isPlaying && this.audioContext && this.audioContext.state === 'running') {
        this.audioContext.suspend().catch(() => {});
      }
    }, 30000); // 空闲 30s 后挂起音频上下文以节能
  }

  /**
   * 初始化 AudioContext 及主增益节点
   */
  async init() {
    this.resetIdleTimer();
    if (!this.audioContext) {
      const AudioCtxClass = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (AudioCtxClass) {
        this.audioContext = new AudioCtxClass();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.setOutputVolume(this.volume, true);
      }
    }
    return this.audioContext;
  }

  /**
   * 强保证音频上下文处于 running 状态并完成声卡硬件链路预热
   */
  async ensureReady() {
    this.resetIdleTimer();
    if (!this.audioContext) {
      await this.init();
    }

    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch (e) {
          console.warn('AudioContext resume error:', e);
        }
      }

      // 预热硬件声卡驱动输出（WASAPI / DirectSound / CoreAudio），打通静默通路
      if (!this.isWarmedUp && this.audioContext.state === 'running') {
        try {
          const osc = this.audioContext.createOscillator();
          const silentGain = this.audioContext.createGain();
          silentGain.gain.setValueAtTime(0, this.audioContext.currentTime);
          osc.connect(silentGain);
          silentGain.connect(this.masterGain || this.audioContext.destination);
          osc.start(0);
          osc.stop(this.audioContext.currentTime + 0.02);
          this.isWarmedUp = true;
        } catch (e) {
          console.warn('Audio pre-warm error:', e);
        }
      }
    }

    return !!(this.audioContext && this.audioContext.state === 'running');
  }

  isReady() {
    return !!(this.audioContext && this.audioContext.state === 'running');
  }

  setOutputVolume(volumePercent, immediate = false) {
    this.volume = volumePercent;
    if (!this.masterGain || !this.audioContext) return;

    const gain = Math.min((volumePercent / 100), 1);
    const now = this.audioContext.currentTime;
    if (immediate) {
      this.masterGain.gain.setValueAtTime(gain, now);
    } else {
      this.masterGain.gain.setTargetAtTime(gain, now, 0.01);
    }
  }

  async playTone(frequency, durationMs, startTime) {
    if (!this.audioContext) {
      await this.ensureReady();
    }
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    const start = startTime !== undefined ? startTime : this.audioContext.currentTime;
    const durationSec = durationMs / 1000;

    // 谐波拟合处理
    if (this.playbackConfig && this.playbackConfig.useHarmonics) {
      if (!this.customWave) {
        const real = new Float32Array([0, 1, 0.1, 0.05, 0]);
        const imag = new Float32Array([0, 0, 0, 0, 0]);
        this.customWave = this.audioContext.createPeriodicWave(real, imag);
      }
      oscillator.setPeriodicWave(this.customWave);
    } else {
      oscillator.type = 'sine';
    }

    oscillator.frequency.value = frequency;
    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    // 极短淡入淡出包络，杜绝声卡突变爆音 (Clicking noise)
    const fadeTime = Math.min(TONE_FADE_SECONDS, durationSec * 0.2);
    gainNode.gain.setValueAtTime(0, start)
    gainNode.gain.linearRampToValueAtTime(TONE_VOLUME, start + fadeTime);
    gainNode.gain.setValueAtTime(TONE_VOLUME, start + durationSec - fadeTime);
    gainNode.gain.linearRampToValueAtTime(0, start + durationSec);

    oscillator.start(start);
    oscillator.stop(start + durationSec);

    const endTime = start + durationSec;
    this.currentNodes.push({ oscillator, gainNode, startTime: start, endTime });

    // 节点生命周期自动清理
    const timerId = setTimeout(() => {
      try {
        oscillator.disconnect();
        gainNode.disconnect();
      } catch {}
      this.currentNodes = this.currentNodes.filter(n => n.oscillator !== oscillator);
      this.cleanupTimers.delete(timerId);
    }, Math.max(0, (start - this.audioContext.currentTime) * 1000) + durationMs + 100);

    this.cleanupTimers.add(timerId);
  }

  updateConfig(config) {
    if (!this.playbackConfig) {
      this.playbackConfig = { ...config };
    } else {
      this.playbackConfig = { ...this.playbackConfig, ...config };
    }
  }

  /**
   * 播放摩尔斯文本流
   * @param {string} text
   * @param {Object} options
   */
  async playMorseText(text, {
    wpm = 20,
    freq = 700,
    numberMode = 'long',
    useHarmonics = false,
    startIndex = 0,
    prefixMarker = '',
    suffixMarker = '',
    enableMarkers = false,
    onCharPlay,
    onMarkerPlay,
    onComplete
  } = {}) {
    this.resetIdleTimer();
    this.stopScheduledNodes();

    // 兜底校验：确保 AudioContext 硬件时钟就绪
    await this.ensureReady();

    const sessionId = Date.now() + Math.random();
    this._activeSessionId = sessionId;

    this.playbackState.isPlaying = true;
    this.playbackState.isPaused = false;
    this.playbackState.stopRequested = false;

    this.playbackConfig = { wpm, freq, numberMode, useHarmonics };

    let tokens = textToMorseTokens(text, this.playbackConfig.numberMode);
    let dotSec = (1200 / this.playbackConfig.wpm) / 1000;

    // 引入 100ms 发声前置安全缓冲，给硬件声卡与线程对齐充足时间
    let currentTime = (this.audioContext ? this.audioContext.currentTime : 0) + PRE_ROLL_LEAD_IN_SECONDS;

    // 1. 播放报头起始符 (如 '===', 'KA')
    if (startIndex === 0 && enableMarkers && prefixMarker && prefixMarker.trim()) {
      const prefixStartAudioTime = currentTime;
      const prefixTokens = textToMorseTokens(prefixMarker.trim(), this.playbackConfig.numberMode);
      for (let p = 0; p < prefixTokens.length; p++) {
        if (this.playbackState.stopRequested || this._activeSessionId !== sessionId) break;

        while (this.playbackState.isPaused && !this.playbackState.stopRequested && this._activeSessionId === sessionId) {
          await new Promise(r => setTimeout(r, 60));
          if (this.audioContext) {
            currentTime = this.audioContext.currentTime + PRE_ROLL_LEAD_IN_SECONDS;
          }
        }
        if (this.playbackState.stopRequested || this._activeSessionId !== sessionId) break;

        const pTok = prefixTokens[p];
        if (pTok.code === null) {
          currentTime += 4 * dotSec;
        } else {
          const symbols = pTok.code.split('');
          for (let j = 0; j < symbols.length; j++) {
            const sym = symbols[j];
            const durSec = sym === '-' ? 3 * dotSec : 1 * dotSec;
            this.playTone(freq, durSec * 1000, currentTime);
            currentTime += durSec;
            if (j < symbols.length - 1) currentTime += 1 * dotSec;
          }
          currentTime += 3 * dotSec;
        }
      }
      currentTime += 4 * dotSec;
      const prefixEndAudioTime = currentTime;

      // 实时音频时间同步触发 UI 报头状态
      if (onMarkerPlay && this.audioContext) {
        const startWaitMs = Math.max(0, (prefixStartAudioTime - this.audioContext.currentTime) * 1000);
        const endWaitMs = Math.max(0, (prefixEndAudioTime - this.audioContext.currentTime) * 1000);

        if (startWaitMs <= 4) {
          onMarkerPlay({ type: 'prefix', text: prefixMarker.trim() });
        } else {
          const startTimer = setTimeout(() => {
            if (!this.playbackState.stopRequested && this._activeSessionId === sessionId) {
              onMarkerPlay({ type: 'prefix', text: prefixMarker.trim() });
            }
            this.cleanupTimers.delete(startTimer);
          }, startWaitMs);
          this.cleanupTimers.add(startTimer);
        }

        const endTimer = setTimeout(() => {
          if (!this.playbackState.stopRequested && this._activeSessionId === sessionId) {
            onMarkerPlay(null);
          }
          this.cleanupTimers.delete(endTimer);
        }, endWaitMs);
        this.cleanupTimers.add(endTimer);
      }
    }

    // 2. 播放正文 Tokens
    for (let i = 0; i < tokens.length; i++) {
      if (this.playbackState.stopRequested || this._activeSessionId !== sessionId) break;

      if (this.playbackConfig) {
        dotSec = (1200 / this.playbackConfig.wpm) / 1000;
        freq = this.playbackConfig.freq;
        if (this.playbackConfig.numberMode !== numberMode) {
          numberMode = this.playbackConfig.numberMode;
          tokens = textToMorseTokens(text, numberMode);
        }
      }

      const token = tokens[i];
      if (token.index < startIndex) continue;

      // 暂停等待循环
      while (this.playbackState.isPaused && !this.playbackState.stopRequested && this._activeSessionId === sessionId) {
        await new Promise(r => setTimeout(r, 60));
        if (this.audioContext) {
          currentTime = this.audioContext.currentTime + PRE_ROLL_LEAD_IN_SECONDS;
        }
      }
      if (this.playbackState.stopRequested || this._activeSessionId !== sessionId) break;

      // 高亮回调严格对齐发声时刻
      if (onCharPlay && this.audioContext) {
        const waitMs = Math.max(0, (currentTime - this.audioContext.currentTime) * 1000);
        if (waitMs <= 4) {
          onCharPlay(token, i);
        } else {
          const timerId = setTimeout(() => {
            if (!this.playbackState.stopRequested && this._activeSessionId === sessionId) {
              onCharPlay(token, i);
            }
            this.cleanupTimers.delete(timerId);
          }, waitMs);
          this.cleanupTimers.add(timerId);
        }
      }

      if (token.code === null) {
        currentTime += 4 * dotSec;
      } else {
        const symbols = token.code.split('');
        for (let j = 0; j < symbols.length; j++) {
          const sym = symbols[j];
          const durSec = sym === '-' ? 3 * dotSec : 1 * dotSec;

          this.playTone(freq, durSec * 1000, currentTime);
          currentTime += durSec;

          if (j < symbols.length - 1) {
            currentTime += 1 * dotSec;
          }
        }
        currentTime += 3 * dotSec;
      }

      // 动态控制调度前瞻窗口 (保持约 200ms 前瞻，防止定时器阻塞导致断流)
      let interruptedDuringSound = false;
      while (this.audioContext && currentTime - this.audioContext.currentTime > 0.2) {
        await new Promise(r => setTimeout(r, 40));
        if (this.playbackState.isPaused || this.playbackState.stopRequested || this._activeSessionId !== sessionId) {
          const soundEndTime = token.code ? (currentTime - 3 * dotSec) : currentTime;
          if (this.audioContext && this.audioContext.currentTime < soundEndTime) {
            interruptedDuringSound = true;
          }
          break;
        }
      }

      if (interruptedDuringSound && this.playbackState.isPaused) {
        i--;
        continue;
      }
    }

    // 3. 播放报尾结束符 (如 'iii', 'iii +', 'AR', 'SK', '+')
    if (!this.playbackState.stopRequested && this._activeSessionId === sessionId && enableMarkers && suffixMarker && suffixMarker.trim()) {
      currentTime += 4 * dotSec;
      const suffixStartAudioTime = currentTime;

      const suffixTokens = textToMorseTokens(suffixMarker.trim(), this.playbackConfig.numberMode);
      for (let s = 0; s < suffixTokens.length; s++) {
        if (this.playbackState.stopRequested || this._activeSessionId !== sessionId) break;

        while (this.playbackState.isPaused && !this.playbackState.stopRequested && this._activeSessionId === sessionId) {
          await new Promise(r => setTimeout(r, 60));
          if (this.audioContext) {
            currentTime = this.audioContext.currentTime + PRE_ROLL_LEAD_IN_SECONDS;
          }
        }
        if (this.playbackState.stopRequested || this._activeSessionId !== sessionId) break;

        const sTok = suffixTokens[s];
        if (sTok.code === null) {
          currentTime += 4 * dotSec;
        } else {
          const symbols = sTok.code.split('');
          for (let j = 0; j < symbols.length; j++) {
            const sym = symbols[j];
            const durSec = sym === '-' ? 3 * dotSec : 1 * dotSec;
            this.playTone(freq, durSec * 1000, currentTime);
            currentTime += durSec;
            if (j < symbols.length - 1) currentTime += 1 * dotSec;
          }
          currentTime += 3 * dotSec;
        }
      }
      const suffixEndAudioTime = currentTime;

      // 实时音频时间同步触发 UI 报尾状态
      if (onMarkerPlay && this.audioContext) {
        const startWaitMs = Math.max(0, (suffixStartAudioTime - this.audioContext.currentTime) * 1000);
        const endWaitMs = Math.max(0, (suffixEndAudioTime - this.audioContext.currentTime) * 1000);

        if (startWaitMs <= 4) {
          onMarkerPlay({ type: 'suffix', text: suffixMarker.trim() });
        } else {
          const startTimer = setTimeout(() => {
            if (!this.playbackState.stopRequested && this._activeSessionId === sessionId) {
              onMarkerPlay({ type: 'suffix', text: suffixMarker.trim() });
            }
            this.cleanupTimers.delete(startTimer);
          }, startWaitMs);
          this.cleanupTimers.add(startTimer);
        }

        const endTimer = setTimeout(() => {
          if (!this.playbackState.stopRequested && this._activeSessionId === sessionId) {
            onMarkerPlay(null);
          }
          this.cleanupTimers.delete(endTimer);
        }, endWaitMs);
        this.cleanupTimers.add(endTimer);
      }

      if (this.audioContext) {
        const remainingWait = Math.max(0, (currentTime - this.audioContext.currentTime) * 1000);
        if (remainingWait > 0) {
          await new Promise(r => setTimeout(r, remainingWait));
        }
      }
    }

    if (this._activeSessionId === sessionId) {
      this.playbackState.isPlaying = false;
      this.scheduleIdleSuspend();
      if (onMarkerPlay) onMarkerPlay(null);
      if (onComplete && !this.playbackState.stopRequested) {
        onComplete();
      }
    }
  }

  pause() {
    this.playbackState.isPaused = true;
    this.stopScheduledNodes();
  }

  async resume() {
    this.resetIdleTimer();
    await this.ensureReady();
    this.playbackState.isPaused = false;
  }

  stopScheduledNodes() {
    this.cleanupTimers.forEach(clearTimeout);
    this.cleanupTimers.clear();

    const now = this.audioContext ? this.audioContext.currentTime : 0;
    let lastEndTime = now;

    this.currentNodes.forEach(({ oscillator, gainNode, startTime, endTime }) => {
      try {
        if (startTime > now) {
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(0, now);
          oscillator.stop(now + 0.001);
        } else if (endTime > now) {
          gainNode.gain.cancelScheduledValues(now);
          gainNode.gain.setValueAtTime(gainNode.gain.value, now);
          gainNode.gain.linearRampToValueAtTime(0, now + STOP_FADE_SECONDS);
          oscillator.stop(now + STOP_FADE_SECONDS + 0.001);
          lastEndTime = Math.max(lastEndTime, now + STOP_FADE_SECONDS);
        }
      } catch (e) {
        console.error('Stop error:', e);
      }
    });

    this.currentNodes = [];
    return Math.max(50, (lastEndTime - now) * 1000 + 50);
  }

  stop() {
    this._activeSessionId = null;
    this.playbackState.stopRequested = true;
    this.playbackState.isPlaying = false;
    this.playbackState.isPaused = false;
    this.scheduleIdleSuspend();
    return this.stopScheduledNodes();
  }

  get currentTime() {
    return this.audioContext ? this.audioContext.currentTime : 0;
  }

  destroy() {
    const closeDelay = this.stop();
    if (this.audioContext) {
      const ctx = this.audioContext;
      this.audioContext = null;
      setTimeout(() => {
        try {
          ctx.close();
        } catch {}
      }, closeDelay + 40);
    }
  }
}

export default new DesktopAudioPlayer();

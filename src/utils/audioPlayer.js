import { MORSE_AUDIO_CONFIG } from '../config/morseAudio.js';
import { textToMorseTokens } from './morseCode.js';

const TONE_VOLUME = MORSE_AUDIO_CONFIG.OUTPUT.TONE_VOLUME;
const TONE_FADE_SECONDS = 0.002;
const LOOKAHEAD_INTERVAL_MS = 25; // 25ms 调度器轮询间隔
const SCHEDULE_AHEAD_TIME_SEC = 0.1; // 100ms 前瞻调度窗口 (W3C A Tale of Two Clocks 标准)

/**
 * 桌面端高精度 Web Audio 摩尔斯码发音引擎
 * 采用 W3C 标准 Lookahead Scheduler (双时钟前瞻调度) 架构：
 * 1. 硬件时钟 (AudioContext.currentTime)：毫秒/微秒级精准控制声音发声与淡入淡出包络
 * 2. 调度器时钟 (setInterval 25ms)：前瞻 100ms 批量向硬件管道提交音符，免疫主线程卡顿
 * 3. 彻底移除冗余复杂的虚拟静音预热、30s 休眠定时器及嵌套 while 循环
 */
class DesktopAudioPlayer {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.volume = MORSE_AUDIO_CONFIG.VOLUME.DEFAULT;
    this.activeNodes = [];
    this.customWave = null;
    this.timerId = null;

    this.playbackConfig = {
      wpm: 20,
      freq: 700,
      numberMode: 'long',
      useHarmonics: false
    };

    this.playbackState = {
      isPlaying: false,
      isPaused: false,
      stopRequested: false
    };

    // 调度队列与游标
    this.queue = [];
    this.queueIndex = 0;
    this.nextNoteTime = 0;
    this.callbacks = {};
  }

  /**
   * 初始化 AudioContext (按需单例懒加载)
   */
  async ensureContext() {
    if (!this.audioContext) {
      const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.setOutputVolume(this.volume);
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      try {
        await this.audioContext.resume();
      } catch {
        // Ignored
      }
    }
    return this.audioContext;
  }

  async ensureReady() {
    return this.ensureContext();
  }

  setOutputVolume(volumePercent) {
    this.volume = volumePercent;
    if (!this.masterGain || !this.audioContext) return;
    const gain = Math.min(Math.max(volumePercent / 100, 0), 1);
    this.masterGain.gain.setValueAtTime(gain, this.audioContext.currentTime);
  }

  updateConfig(config) {
    this.playbackConfig = { ...this.playbackConfig, ...config };
  }

  /**
   * 物理发音：向音频管道注入一个正弦波音符
   */
  scheduleTone(frequency, durationSec, startTime, itemIndex) {
    if (!this.audioContext) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    if (this.playbackConfig.useHarmonics) {
      if (!this.customWave) {
        const real = new Float32Array([0, 1, 0.1, 0.05, 0]);
        const imag = new Float32Array([0, 0, 0, 0, 0]);
        this.customWave = this.audioContext.createPeriodicWave(real, imag);
      }
      osc.setPeriodicWave(this.customWave);
    } else {
      osc.type = 'sine';
    }

    osc.frequency.setValueAtTime(frequency, startTime);
    osc.connect(gain);
    gain.connect(this.masterGain);

    // 2ms 微秒级淡入淡出包络，杜绝发声爆音 (Clicking noise)
    const fade = Math.min(TONE_FADE_SECONDS, durationSec * 0.2);
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(TONE_VOLUME, startTime + fade);
    gain.gain.setValueAtTime(TONE_VOLUME, startTime + durationSec - fade);
    gain.gain.linearRampToValueAtTime(0, startTime + durationSec);

    osc.start(startTime);
    osc.stop(startTime + durationSec);

    const nodeItem = {
      osc,
      gain,
      startTime,
      endTime: startTime + durationSec,
      itemIndex
    };
    this.activeNodes.push(nodeItem);

    osc.onended = () => {
      try {
        osc.disconnect();
        gain.disconnect();
      } catch {}
      const idx = this.activeNodes.indexOf(nodeItem);
      if (idx !== -1) this.activeNodes.splice(idx, 1);
    };
  }

  /**
   * 停止当前所有正在发音的节点 (8ms 毫秒级防爆音平滑渐变)
   */
  stopActiveNodes() {
    const now = this.audioContext ? this.audioContext.currentTime : 0;
    const DECLICK_FADE_SEC = 0.008; // 8ms 工业标准 De-click 平滑淡出

    for (const { osc, gain, startTime, endTime } of this.activeNodes) {
      try {
        if (startTime > now) {
          // 尚未发声的未来前瞻音符：直接静音并取消
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(0, now);
          osc.stop(now + 0.001);
        } else if (endTime > now) {
          // 当前正在振荡发声的音符：平滑 8ms 渐降至 0，杜绝突变波形截断导致的爆音/破音尾音
          gain.gain.cancelScheduledValues(now);
          gain.gain.setValueAtTime(gain.gain.value || TONE_VOLUME, now);
          gain.gain.linearRampToValueAtTime(0, now + DECLICK_FADE_SEC);
          osc.stop(now + DECLICK_FADE_SEC + 0.002);
        }
      } catch {}
    }
    this.activeNodes = [];
  }

  /**
   * 调度器主轮询 (W3C Lookahead Loop)
   */
  scheduler() {
    if (!this.audioContext || !this.playbackState.isPlaying || this.playbackState.isPaused) return;

    const dotSec = (1200 / this.playbackConfig.wpm) / 1000;
    const freq = this.playbackConfig.freq;

    // 前瞻 100ms 批量填充硬件管道
    while (this.queueIndex < this.queue.length && this.nextNoteTime < this.audioContext.currentTime + SCHEDULE_AHEAD_TIME_SEC) {
      const item = this.queue[this.queueIndex];
      const curIndex = this.queueIndex;
      const itemStartTime = this.nextNoteTime;
      item.startTime = itemStartTime;

      if (item.type === 'prefix' || item.type === 'suffix') {
        // 起止符标记发声
        if (this.callbacks.onMarkerPlay) {
          const delayMs = Math.max(0, (itemStartTime - this.audioContext.currentTime) * 1000);
          setTimeout(() => {
            if (this.playbackState.isPlaying && !this.playbackState.isPaused && !this.playbackState.stopRequested) {
              this.callbacks.onMarkerPlay({ type: item.type, text: item.markerText });
            }
          }, delayMs);
        }
      } else if (item.type === 'body') {
        // 正文 Token 高亮通知
        if (this.callbacks.onCharPlay) {
          const delayMs = Math.max(0, (itemStartTime - this.audioContext.currentTime) * 1000);
          setTimeout(() => {
            if (this.playbackState.isPlaying && !this.playbackState.isPaused && !this.playbackState.stopRequested) {
              this.callbacks.onCharPlay(item.rawToken);
            }
          }, delayMs);
        }
      }

      if (item.code === null) {
        // 空格/间隔
        this.nextNoteTime += 4 * dotSec;
      } else {
        // 点划发射
        const symbols = item.code.split('');
        for (let s = 0; s < symbols.length; s++) {
          const sym = symbols[s];
          const durSec = sym === '-' ? 3 * dotSec : 1 * dotSec;
          this.scheduleTone(freq, durSec, this.nextNoteTime, curIndex);
          this.nextNoteTime += durSec;
          if (s < symbols.length - 1) {
            this.nextNoteTime += 1 * dotSec; // 字符内点划间隙 1 dot
          }
        }
        this.nextNoteTime += 3 * dotSec; // 字符间间隙 3 dots
      }

      item.endTime = this.nextNoteTime;
      this.queueIndex++;
    }

    // 播放完毕检测
    if (this.queueIndex >= this.queue.length) {
      if (this.audioContext.currentTime >= this.nextNoteTime) {
        this.stop();
        if (this.callbacks.onComplete) {
          this.callbacks.onComplete();
        }
      }
    }
  }

  /**
   * 启动播放
   */
  async playMorseText(text, options = {}) {
    this.stop();

    const {
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
    } = options;

    this.playbackConfig = { wpm, freq, numberMode, useHarmonics };
    this.callbacks = { onCharPlay, onMarkerPlay, onComplete };

    await this.ensureContext();

    // 构建扁平化的待播放队列
    const queue = [];

    // 1. 报头起止符
    if (startIndex === 0 && enableMarkers && prefixMarker && prefixMarker.trim()) {
      const pTokens = textToMorseTokens(prefixMarker.trim(), numberMode);
      for (const tok of pTokens) {
        queue.push({ ...tok, type: 'prefix', markerText: prefixMarker.trim() });
      }
    }

    // 2. 正文 Tokens
    const bodyTokens = textToMorseTokens(text, numberMode);
    for (const tok of bodyTokens) {
      if (tok.index >= startIndex) {
        queue.push({ ...tok, type: 'body', rawToken: tok });
      }
    }

    // 3. 报尾起止符
    if (enableMarkers && suffixMarker && suffixMarker.trim()) {
      const sTokens = textToMorseTokens(suffixMarker.trim(), numberMode);
      for (const tok of sTokens) {
        queue.push({ ...tok, type: 'suffix', markerText: suffixMarker.trim() });
      }
    }

    if (queue.length === 0) return;

    this.queue = queue;
    this.queueIndex = 0;
    this.playbackState.isPlaying = true;
    this.playbackState.isPaused = false;
    this.playbackState.stopRequested = false;

    // 预滚 50ms 启动硬件
    this.nextNoteTime = (this.audioContext ? this.audioContext.currentTime : 0) + 0.05;

    // 启动 25ms 轮询调度器
    this.timerId = setInterval(() => this.scheduler(), LOOKAHEAD_INTERVAL_MS);
  }

  pause() {
    if (!this.playbackState.isPlaying || this.playbackState.isPaused) return;
    this.playbackState.isPaused = true;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    const now = this.audioContext ? this.audioContext.currentTime : 0;
    this.stopActiveNodes();

    // 状态精确回退：将游标回退至实际正在发声或尚未发声的项目（消除前瞻缓冲区的时间超前）
    for (let i = 0; i < this.queue.length; i++) {
      const it = this.queue[i];
      if (it.startTime !== undefined && (it.endTime > now || it.startTime > now)) {
        this.queueIndex = i;
        break;
      }
    }
  }

  async resume() {
    if (!this.playbackState.isPlaying || !this.playbackState.isPaused) return;
    await this.ensureContext();
    this.playbackState.isPaused = false;
    this.nextNoteTime = (this.audioContext ? this.audioContext.currentTime : 0) + 0.05;
    this.timerId = setInterval(() => this.scheduler(), LOOKAHEAD_INTERVAL_MS);
  }

  stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.stopActiveNodes();
    this.queue = [];
    this.queueIndex = 0;
    this.playbackState.isPlaying = false;
    this.playbackState.isPaused = false;
    this.playbackState.stopRequested = true;
    if (this.callbacks.onMarkerPlay) this.callbacks.onMarkerPlay(null);
  }

  get currentTime() {
    return this.audioContext ? this.audioContext.currentTime : 0;
  }

  destroy() {
    this.stop();
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }
}

export default new DesktopAudioPlayer();

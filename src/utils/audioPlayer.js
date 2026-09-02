import { MORSE_AUDIO_CONFIG } from '../config/morseAudio.js';
import { textToMorseTokens } from './morseCode.js';

const TONE_VOLUME = MORSE_AUDIO_CONFIG.OUTPUT.TONE_VOLUME;
const TONE_FADE_SECONDS = 0.002;
const LOOKAHEAD_INTERVAL_MS = 25; // 25ms 调度器轮询间隔
const SCHEDULE_AHEAD_TIME_SEC = 0.5; // 500ms 充裕前瞻调度窗口 (覆盖 350ms 前置真实空白音频流)

/**
 * 统一标准状态枚举 (SSOT)
 */
export const AUDIO_STATE = {
  IDLE: 'idle',           // 空闲就绪
  WARMING: 'warming',     // 硬件唤醒/上下文初始化中
  PLAYING: 'playing',     // 正在发声调度
  PAUSED: 'paused',       // 暂停中（保留游标与上下文）
  STOPPED: 'stopped',     // 主动停止或自然播完
  ERROR: 'error'          // 异常
};

/**
 * 桌面端企业级高精度摩尔斯发音中枢 (MorseAudioCore)
 * 采用与小程序完全对齐的工业级标准架构：
 * 1. 单振荡器常开 + 门控 Gain 包络 (VCA Architecture)：
 *    - 全局常驻单例振荡器 (Persistent Oscillator)，无需反复创建销毁，从物理层面杜绝拓扑重组与首划被吞
 *    - 纯门控增益调制 (Gain Envelope Switching)，0 内存分配，0 垃圾回收卡顿
 * 2. W3C 双时钟前瞻调度 (Lookahead Scheduler)：
 *    - 硬件时钟 (AudioContext.currentTime)：微秒级高精度控制发声时间点与淡入淡出包络
 *    - 调度器时钟 (setInterval 25ms)：前瞻 100ms 批量向硬件管道提交音符，免疫主线程卡顿
 * 3. 统一音频生命周期停音管理 (_stopPlaybackEngine)：3ms setTargetAtTime 指数软淡出消爆音
 * 4. 串行互斥锁 (_runCommand)：杜绝并发连击导致的异步时序踩踏
 * 5. 单一真实状态源 (SSOT) 与事件总线：通过 subscribe 广播状态，解耦 UI
 */
class DesktopAudioPlayer {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.osc = null;
    this.oscGain = null;
    this.customWave = null;

    this.volume = MORSE_AUDIO_CONFIG.VOLUME.DEFAULT;
    this.timerId = null;
    this.isReady = false;
    this._readyPromise = null;

    this.state = AUDIO_STATE.IDLE;

    this.playbackConfig = {
      wpm: 20,
      freq: 700,
      numberMode: 'long',
      useHarmonics: false
    };

    // 维持向下兼容的状态结构，供外部和已有测试访问
    this.playbackState = {
      state: AUDIO_STATE.IDLE,
      isPlaying: false,
      isPaused: false,
      stopRequested: false,
      activeMarker: null
    };

    // 当前播放会话持久化上下文 (Session Context)
    this.session = {
      text: '',
      options: {},
      startIndex: 0
    };

    // 调度队列与游标
    this.queue = [];
    this.queueIndex = 0;
    this.nextNoteTime = 0;
    this.callbacks = {};

    // 状态订阅者集合
    this.listeners = new Set();

    // 串行命令互斥锁队列
    this._commandQueue = Promise.resolve();
  }

  /**
   * 串行命令执行器 (Mutex)
   * 保证 play/pause/resume/seek/stop 严格排队，防止并发连击竞争
   */
  _runCommand(cmdFn) {
    const run = async () => {
      try {
        return await cmdFn();
      } catch (err) {
        console.error('[MorseAudioCore] Command error:', err);
        this._transitionTo(AUDIO_STATE.ERROR, { error: err });
        throw err;
      }
    };
    const next = this._commandQueue.then(run);
    this._commandQueue = next.catch(() => {});
    return next;
  }

  /**
   * 统一状态机跃迁与事件广播 (SSOT)
   */
  _transitionTo(nextState, extra = {}) {
    this.state = nextState;
    this.playbackState.state = nextState;
    this.playbackState.isPlaying = (nextState === AUDIO_STATE.PLAYING || nextState === AUDIO_STATE.WARMING || nextState === AUDIO_STATE.PAUSED);
    this.playbackState.isPaused = (nextState === AUDIO_STATE.PAUSED);

    if (nextState === AUDIO_STATE.STOPPED || nextState === AUDIO_STATE.IDLE) {
      this.playbackState.isPlaying = false;
      this.playbackState.isPaused = false;
      this.playbackState.stopRequested = true;
      this.playbackState.activeMarker = null;
    } else if (nextState === AUDIO_STATE.PLAYING || nextState === AUDIO_STATE.WARMING) {
      this.playbackState.stopRequested = false;
    }

    if (extra.activeMarker !== undefined) {
      this.playbackState.activeMarker = extra.activeMarker;
    }

    this._emitStateChange(extra);
  }

  /**
   * 订阅状态变更 (供 React Hook 或外部组件单向绑定)
   */
  subscribe(listener) {
    if (typeof listener !== 'function') return () => {};
    this.listeners.add(listener);
    try {
      listener(this.getSnapshot());
    } catch (e) {
      console.error('[MorseAudioCore] Initial subscriber notification error:', e);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot() {
    return {
      state: this.state,
      isPlaying: this.playbackState.isPlaying,
      isPaused: this.playbackState.isPaused,
      activeMarker: this.playbackState.activeMarker,
      volume: this.volume,
      config: { ...this.playbackConfig },
      session: { ...this.session }
    };
  }

  _emitStateChange(extra = {}) {
    const snapshot = { ...this.getSnapshot(), ...extra };
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('[MorseAudioCore] Error in listener:', err);
      }
    }
  }

  /**
   * 初始化常驻单振荡器与音频管道图 (Persistent Oscillator & VCA Gate)
   */
  async ensureContext() {
    if (!this.audioContext) {
      const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();

        // 1. 主音量节点
        this.masterGain = this.audioContext.createGain();
        this.masterGain.connect(this.audioContext.destination);
        this.setOutputVolume(this.volume);

        // 2. 单例常开振荡器与门控节点 (与小程序完全一致的 VCA 架构)
        this.osc = this.audioContext.createOscillator();
        this.oscGain = this.audioContext.createGain();

        this._applyWaveformAndFrequency();

        // 初始门控完全静音
        this.oscGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.osc.connect(this.oscGain);
        this.oscGain.connect(this.masterGain);

        // 振荡器常驻常开运行，杜绝反复起停导致的物理切波与丢划
        if (typeof this.osc.start === 'function') {
          this.osc.start(0);
        }

        // 硬件状态监听与自愈
        this.audioContext.onstatechange = () => {
          if (this.audioContext.state === 'suspended') {
            this.isReady = false;
            if (this.state === AUDIO_STATE.PLAYING) {
              this.pause();
            }
          }
        };
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

  _applyWaveformAndFrequency() {
    if (!this.osc || !this.audioContext) return;
    const now = this.audioContext.currentTime;

    if (this.playbackConfig.useHarmonics) {
      if (!this.customWave) {
        const real = new Float32Array([0, 1, 0.1, 0.05, 0]);
        const imag = new Float32Array([0, 0, 0, 0, 0]);
        this.customWave = this.audioContext.createPeriodicWave(real, imag);
      }
      this.osc.setPeriodicWave(this.customWave);
    } else {
      this.osc.type = 'sine';
    }

    try {
      this.osc.frequency.setValueAtTime(this.playbackConfig.freq, now);
    } catch {}
  }

  /**
   * 确保音频上下文与系统音频硬件物理链路就绪稳态 (防吞首划核心)
   */
  async ensureReady() {
    if (this.isReady && this.audioContext && this.audioContext.state === 'running') {
      return;
    }
    if (this._readyPromise) return this._readyPromise;

    this._readyPromise = (async () => {
      try {
        await this.ensureContext();
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }

        // 播放微小 Buffer 促使操作系统 (WASAPI) 完成音频环形缓冲区建立与驱动握手
        if (this.audioContext) {
          try {
            const buf = this.audioContext.createBuffer(1, 256, this.audioContext.sampleRate || 44100);
            const src = this.audioContext.createBufferSource();
            src.buffer = buf;
            src.connect(this.masterGain || this.audioContext.destination);
            src.start(0);
            // 关键物理时间：等待声卡硬件握手加电稳定 (150ms)
            await new Promise(r => setTimeout(r, 150));
          } catch {}
        }
        this.isReady = true;
      } finally {
        this._readyPromise = null;
      }
    })();

    return this._readyPromise;
  }

  async warmUp() {
    return this.ensureReady();
  }

  setOutputVolume(volumePercent) {
    this.volume = volumePercent;
    if (!this.masterGain || !this.audioContext) return;
    const gain = Math.min(Math.max(volumePercent / 100, 0), 1);
    try {
      this.masterGain.gain.setValueAtTime(gain, this.audioContext.currentTime);
    } catch {
      this.masterGain.gain.value = gain;
    }
  }

  updateConfig(config) {
    this.playbackConfig = { ...this.playbackConfig, ...config };
    this._applyWaveformAndFrequency();
    this._emitStateChange();
  }

  /**
   * 硬件管道发音：通过门控 GainNode 包络开关正弦波发声 (与小程序完全一致)
   * 物理级 0 延迟、0 丢划、0 拓扑重排
   */
  scheduleTone(durationSec, startTime) {
    if (!this.audioContext || !this.oscGain) return;
    const gain = this.oscGain.gain;
    const now = this.audioContext.currentTime;
    const actualStart = Math.max(startTime, now);
    const fade = Math.min(TONE_FADE_SECONDS, durationSec * 0.25);

    try {
      gain.setValueAtTime(0, actualStart);
      gain.linearRampToValueAtTime(TONE_VOLUME, actualStart + fade);
      gain.setValueAtTime(TONE_VOLUME, actualStart + durationSec - fade);
      gain.linearRampToValueAtTime(0, actualStart + durationSec);
    } catch (e) {
      try {
        gain.setValueAtTime(TONE_VOLUME, actualStart);
        gain.setValueAtTime(0, actualStart + durationSec);
      } catch {}
    }
  }

  /**
   * 停止当前所有正在发音的节点 (3ms 指数软淡出，无爆音)
   */
  stopActiveNodes(soft = true) {
    if (!this.audioContext || !this.oscGain) return;
    const now = this.audioContext.currentTime;
    const gain = this.oscGain.gain;

    try {
      if (soft) {
        if (typeof gain.cancelAndHoldAtTime === 'function') {
          gain.cancelAndHoldAtTime(now);
        } else {
          gain.cancelScheduledValues(now);
        }
        gain.setTargetAtTime(0, now, 0.003);
      } else {
        gain.cancelScheduledValues(now);
        gain.setValueAtTime(0, now);
      }
    } catch (e) {
      try {
        gain.cancelScheduledValues(now);
        gain.value = 0;
      } catch {}
    }
  }

  /**
   * 统一停音与调度器关闭（收敛所有播放重新开始、暂停、停止、seek跳转操作）
   */
  _stopPlaybackEngine({ soft = true, clearQueue = false, stopRequested = false } = {}) {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.stopActiveNodes(soft);
    if (clearQueue) {
      this.queue = [];
      this.queueIndex = 0;
    }
    if (stopRequested) {
      this._transitionTo(AUDIO_STATE.STOPPED, { activeMarker: null });
    }
    if (this.callbacks.onMarkerPlay) {
      this.callbacks.onMarkerPlay(null);
    }
  }

  async _startPlaybackEngine({ leadTimeSec = null } = {}) {
    await this.ensureReady();

    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }

    this._transitionTo(AUDIO_STATE.PLAYING);

    // 在真正的报底/=== 前强行播放 350ms 空白音频流（热恢复 150ms）
    const leadIn = leadTimeSec !== null ? leadTimeSec : 0.35;
    const now = this.audioContext ? this.audioContext.currentTime : 0;

    // 方案实施：强行向声卡输出 350ms 人耳听不到的硬件激活波形 (25Hz 亚音频, 幅度 0.002)
    // 突破声卡驱动静音门限 (Noise Gate) 与低功耗休眠，强制 DAC 芯片瞬间全速加电稳态，彻底摆脱预热
    if (this.audioContext) {
      try {
        const sampleRate = this.audioContext.sampleRate || 44100;
        const frameCount = Math.max(1, Math.floor(sampleRate * leadIn));
        const wakeBuffer = this.audioContext.createBuffer(1, frameCount, sampleRate);
        const channelData = wakeBuffer.getChannelData(0);
        const freq = 25; // 25Hz 次音频
        const amplitude = 0.002; // -54dB 远低于人耳听觉下限与环境底噪，完全听不到但对硬件是真实信号
        for (let i = 0; i < frameCount; i++) {
          channelData[i] = amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate);
        }
        const wakeSource = this.audioContext.createBufferSource();
        wakeSource.buffer = wakeBuffer;
        wakeSource.connect(this.masterGain || this.audioContext.destination);
        wakeSource.start(now);
      } catch (e) {
        console.warn('Inaudible wake stream error:', e);
      }
    }
    
    // 清理历史调度残留，杜绝 setTargetAtTime 渐近线污染首个音符的 linearRamp 包络
    if (this.oscGain) {
      try {
        this.oscGain.gain.cancelScheduledValues(now);
        this.oscGain.gain.setValueAtTime(0, now);
      } catch {}
    }

    this.nextNoteTime = now + leadIn;

    // 启动 25ms Lookahead 调度心跳
    if (typeof window !== 'undefined' || typeof setInterval !== 'undefined') {
      this.timerId = setInterval(() => this.scheduler(), LOOKAHEAD_INTERVAL_MS);
    }

    // 关键优化：启动时立即执行一次调度填充，绝不等待第一个 25ms 延迟
    this.scheduler();
  }

  /**
   * 构建待播放的 Token 队列
   */
  _buildQueue(text, options = {}) {
    const {
      numberMode = this.playbackConfig.numberMode,
      startIndex = 0,
      prefixMarker = '',
      suffixMarker = '',
      enableMarkers = false
    } = options;

    const queue = [];

    // 1. 报头起止符
    if (startIndex === 0 && enableMarkers && prefixMarker && prefixMarker.trim()) {
      const pTokens = textToMorseTokens(prefixMarker.trim(), numberMode);
      for (const tok of pTokens) {
        queue.push({ ...tok, type: 'prefix', markerText: prefixMarker.trim() });
      }
      queue.push({ char: ' ', code: null });
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
      queue.push({ char: ' ', code: null });
      const sTokens = textToMorseTokens(suffixMarker.trim(), numberMode);
      for (const tok of sTokens) {
        queue.push({ ...tok, type: 'suffix', markerText: suffixMarker.trim() });
      }
    }

    this.queue = queue;
    this.queueIndex = 0;
    return queue;
  }

  /**
   * 调度器主轮询 (W3C Lookahead Loop)
   */
  scheduler() {
    if (!this.audioContext || !this.playbackState.isPlaying || this.playbackState.isPaused) return;

    const dotSec = (1200 / this.playbackConfig.wpm) / 1000;

    // 前瞻 100ms 批量填充硬件管道
    while (this.queueIndex < this.queue.length && this.nextNoteTime < this.audioContext.currentTime + SCHEDULE_AHEAD_TIME_SEC) {
      const item = this.queue[this.queueIndex];
      const curStartTime = this.nextNoteTime;
      item.startTime = curStartTime;

      if (item.type === 'prefix' || item.type === 'suffix') {
        if (item.code !== null) {
          const delayMs = Math.max(0, (curStartTime - this.audioContext.currentTime) * 1000);
          setTimeout(() => {
            if (this.playbackState.isPlaying && !this.playbackState.isPaused && !this.playbackState.stopRequested) {
              const markerPayload = { type: item.type, text: item.markerText };
              this.playbackState.activeMarker = markerPayload;
              this._emitStateChange({ activeMarker: markerPayload });
              if (this.callbacks.onMarkerPlay) {
                this.callbacks.onMarkerPlay(markerPayload);
              }
            }
          }, delayMs);
        }
      } else if (item.type === 'body') {
        if (item.code !== null) {
          const delayMs = Math.max(0, (curStartTime - this.audioContext.currentTime) * 1000);
          setTimeout(() => {
            if (this.playbackState.isPlaying && !this.playbackState.isPaused && !this.playbackState.stopRequested) {
              if (this.playbackState.activeMarker !== null) {
                this.playbackState.activeMarker = null;
                this._emitStateChange({ activeMarker: null });
              }
              if (this.callbacks.onCharPlay) {
                this.callbacks.onCharPlay(item.rawToken);
              }
            }
          }, delayMs);
        }
      }

      if (item.code === null) {
        // 空格/间隔: 标准 4 dots 词间间隔 (加前置字符尾部 3 dots = 标准 7 dots)
        this.nextNoteTime += 4 * dotSec;
      } else {
        // 点划发射：直接调制常开单例振荡器的 oscGain
        const symbols = item.code.split('');
        for (let s = 0; s < symbols.length; s++) {
          const sym = symbols[s];
          const durSec = sym === '-' ? 3 * dotSec : 1 * dotSec;
          this.scheduleTone(durSec, this.nextNoteTime);
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

  // ==========================================
  // 统一对外高级播放控制 API (Facade)
  // ==========================================

  /**
   * 统一播放/重播入口 (原子互斥)
   */
  async play(text, options = {}) {
    return this._runCommand(() => this._playInternal(text, options));
  }

  async _playInternal(text, options = {}) {
    // 软停上一段调度并保留资源
    this._stopPlaybackEngine({ soft: true, clearQueue: false, stopRequested: false });

    const targetText = text !== undefined && text !== null ? text : this.session.text;
    const mergedOptions = { ...this.session.options, ...options };

    const {
      wpm = this.playbackConfig.wpm,
      freq = this.playbackConfig.freq,
      numberMode = this.playbackConfig.numberMode,
      useHarmonics = this.playbackConfig.useHarmonics,
      startIndex = 0,
      prefixMarker = '',
      suffixMarker = '',
      enableMarkers = false,
      onCharPlay,
      onMarkerPlay,
      onComplete
    } = mergedOptions;

    this.playbackConfig = { wpm, freq, numberMode, useHarmonics };
    this._applyWaveformAndFrequency();

    this.callbacks = {
      onCharPlay: onCharPlay || this.callbacks.onCharPlay,
      onMarkerPlay: onMarkerPlay || this.callbacks.onMarkerPlay,
      onComplete: onComplete || this.callbacks.onComplete
    };

    // 持久化当前会话
    this.session = {
      text: targetText,
      options: mergedOptions,
      startIndex
    };

    const queue = this._buildQueue(targetText, {
      numberMode,
      startIndex,
      prefixMarker,
      suffixMarker,
      enableMarkers
    });

    if (queue.length === 0) {
      this._transitionTo(AUDIO_STATE.IDLE);
      return;
    }

    await this._startPlaybackEngine();
  }

  /**
   * 历史兼容别名：playMorseText
   */
  async playMorseText(text, options = {}) {
    return this.play(text, options);
  }

  /**
   * 统一播放/暂停一键切换 (最高频的极简外部入口)
   * 支持传文本，或传入异步文本提供函数 textProvider
   */
  async toggle(textProvider, options = {}) {
    return this._runCommand(async () => {
      if (this.playbackState.isPlaying && !this.playbackState.isPaused) {
        this.pause();
        return { action: 'paused' };
      }

      if (this.playbackState.isPlaying && this.playbackState.isPaused) {
        await this.resume();
        return { action: 'resumed' };
      }

      let text = '';
      let dynamicOpts = { ...options };

      if (typeof textProvider === 'function') {
        const res = await textProvider();
        if (typeof res === 'string') {
          text = res.trim() ? res : (this.session.text || '');
        } else if (res && typeof res === 'object') {
          text = (res.text && res.text.trim()) ? res.text : (this.session.text || '');
          if (res.startIndex !== undefined) dynamicOpts.startIndex = res.startIndex;
        }
      } else if (typeof textProvider === 'string' && textProvider.trim()) {
        text = textProvider;
      } else if (this.session.text) {
        text = this.session.text;
      }

      if (!text || !text.trim()) {
        return { action: 'empty' };
      }

      await this._playInternal(text, dynamicOpts);
      return { action: 'started' };
    });
  }

  /**
   * 暂停播放 (软淡出停音并保留游标位置)
   */
  pause() {
    if (!this.playbackState.isPlaying || this.playbackState.isPaused) return;

    const now = this.audioContext ? this.audioContext.currentTime : 0;

    // 状态精确回退：将游标回退至实际正在发声或尚未发声的项目（消除前瞻缓冲区的时间超前）
    for (let i = 0; i < this.queue.length; i++) {
      const it = this.queue[i];
      if (it.startTime !== undefined && (it.endTime > now || it.startTime > now)) {
        this.queueIndex = i;
        break;
      }
    }

    this._stopPlaybackEngine({ soft: true, clearQueue: false, stopRequested: false });
    this._transitionTo(AUDIO_STATE.PAUSED);
  }

  /**
   * 恢复播放
   */
  async resume() {
    if (!this.playbackState.isPlaying || !this.playbackState.isPaused) return;
    this.playbackState.isPaused = false;
    this.playbackState.stopRequested = false;
    return this._runCommand(async () => {
      await this._startPlaybackEngine({ leadTimeSec: 0.15 });
    });
  }

  /**
   * 彻底停止播放
   */
  stop() {
    this._stopPlaybackEngine({ soft: true, clearQueue: true, stopRequested: true });
  }

  /**
   * 重新定位播放位置 (支持播放中无缝平滑切播与非播放状态断点对齐)
   * 若外部未传 text，则自动取用当前 session.text
   */
  async seek(startIndex, text, options = {}) {
    return this._runCommand(async () => {
      const targetIdx = Math.max(0, Math.floor(startIndex || 0));
      const targetText = (text !== undefined && text !== null) ? text : this.session.text;
      const targetOpts = { ...this.session.options, ...options, startIndex: targetIdx };

      const wasPlaying = this.playbackState.isPlaying && !this.playbackState.isPaused;
      const wasPaused = this.playbackState.isPlaying && this.playbackState.isPaused;

      if (wasPlaying) {
        return this._playInternal(targetText, targetOpts);
      }

      // 非播放态：重建队列并对准游标，保留暂停或停止状态
      this._stopPlaybackEngine({ soft: true, clearQueue: false, stopRequested: false });
      this.session = {
        text: targetText,
        options: targetOpts,
        startIndex: targetIdx
      };
      this._buildQueue(targetText, targetOpts);

      if (wasPaused) {
        this._transitionTo(AUDIO_STATE.PAUSED);
      } else {
        this._transitionTo(AUDIO_STATE.STOPPED);
      }
    });
  }

  get currentTime() {
    return this.audioContext ? this.audioContext.currentTime : 0;
  }

  destroy() {
    this.stop();
    this.isWarmedUp = false;
    this.listeners.clear();
    if (this.osc) {
      try {
        this.osc.stop();
        this.osc.disconnect();
      } catch {}
      this.osc = null;
    }
    if (this.audioContext) {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
  }
}

export default new DesktopAudioPlayer();

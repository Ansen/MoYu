import audioPlayer from './audioPlayer.js';
import { getCharMorseCode } from './morseCode.js';

/**
 * 真实短波电台（HF/CW）高拟真通联干扰仿真引擎 (RadioInterferenceEngine)
 * 
 * 纯算法程序化合成（Procedural Audio Synthesis），零外部音频文件依赖，0 侵入原有 audioPlayer。
 * 
 * 声学与训练维度（对齐 CW Player / Morse Runner 竞赛级训练体系）：
 * 1. 底噪 (QRN 窄带电离层底噪)：真实声学能量补偿（高动态余量，最高可与主信号达到 1:1 甚至负信噪比）；
 * 2. 衰落 (QSB 强效多频衰落)：信号在电离层波谷时深度下潜至 4%~8%（伴随 1.4Hz 电离层快颤 flutter）；
 * 3. 频漂 (QRH 强力走频与变调)：模拟老式发报机真空管温漂失谐，音调在 1.8 秒周期内发生 ±140Hz 剧烈游走；
 * 4. 邻台 (QRM 连续真实副台抢台)：模拟邻频电台（±70~160Hz）以 22WPM 连续发送实际通联报文（CQ/5NN/TEST/QRZ）；
 * 5. 天电脉冲 (Static Crashes)：随机强放电脉冲，带来逼真雷暴天气干扰。
 */

class RadioInterferenceEngine {
  constructor() {
    this.audioContext = null;
    this.masterGain = null;
    this.bandpassFilter = null;
    this.lowpassFilter = null;
    this.preGain = null; // 前级补偿增益，弥补带通滤波后的能量跌落
    this.noiseSource = null;
    this.noiseBuffer = null;

    // 天电脉冲节点 (Static Crashes)
    this.crashGain = null;
    this.crashTimer = null;

    // QRM 邻频弱信号节点 (连续电码发报流)
    this.qrmOsc = null;
    this.qrmGain = null;
    this.qrmTimer = null;

    // 调制心跳计时器 (驱动 QSB 深度衰落与 QRH 频漂)
    this.modulationTimer = null;
    this.startTime = 0;

    // 状态
    this.level = 0; // 0 ~ 100
    this.isPlaying = false;
    this.centerFreq = 600; // 默认中频 600Hz
    this.isInitialized = false;
    this._initPromise = null; // 并发初始化互斥锁
    this.currentText = ''; // 当前练习正文内容 (供 QRM 提取上下文片段)

    // 干扰模式开关 (默认全部启用)
    this.modes = {
      noise: true, // QRN 底噪
      qsb: true,   // QSB 信号衰落
      qrh: true,   // QRH 频率漂移
      qrm: true    // QRM 邻台干扰
    };
  }

  /**
   * 初始化音频拓扑图（用户交互手势或首次播放时唤醒）
   */
  async ensureContext() {
    if (this.isInitialized && this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        try {
          await this.audioContext.resume();
        } catch {
          // Ignored
        }
      }
      return this.audioContext;
    }

    if (this._initPromise) return this._initPromise;

    const AudioCtx = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : null;
    if (!AudioCtx) return null;

    this._initPromise = (async () => {
      try {
        this.audioContext = new AudioCtx();

      // 1. 底噪总输出增益节点
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.masterGain.connect(this.audioContext.destination);

      // 2. 生成 3 秒全幅值粉红噪声缓冲 (Pink Noise - 1/f 能量分布，质感醇厚)
      const sampleRate = this.audioContext.sampleRate;
      const bufferLength = sampleRate * 3;
      this.noiseBuffer = this.audioContext.createBuffer(1, bufferLength, sampleRate);
      const data = this.noiseBuffer.getChannelData(0);

      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferLength; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        b6 = white * 0.115926;
        data[i] = Math.max(-0.95, Math.min(0.95, pink * 0.7));
      }

      // 3. 循环噪声源
      this.noiseSource = this.audioContext.createBufferSource();
      this.noiseSource.buffer = this.noiseBuffer;
      this.noiseSource.loop = true;

      // 4. 双二阶带通滤波器 (模拟接收机 CW 窄带中频滤波，聚焦在通联频点)
      this.bandpassFilter = this.audioContext.createBiquadFilter();
      this.bandpassFilter.type = 'bandpass';
      this.bandpassFilter.frequency.setValueAtTime(this.centerFreq, this.audioContext.currentTime);
      this.bandpassFilter.Q.setValueAtTime(1.3, this.audioContext.currentTime);

      // 5. 前级补偿增益 (大幅补偿窄带滤波后丢失的带外声学能量)
      this.preGain = this.audioContext.createGain();
      this.preGain.gain.setValueAtTime(2.5, this.audioContext.currentTime);

      // 6. 低通滤波 (保留短波空气感)
      this.lowpassFilter = this.audioContext.createBiquadFilter();
      this.lowpassFilter.type = 'lowpass';
      this.lowpassFilter.frequency.setValueAtTime(1800, this.audioContext.currentTime);

      // 连接噪声主链路
      this.noiseSource.connect(this.bandpassFilter);
      this.bandpassFilter.connect(this.preGain);
      this.preGain.connect(this.lowpassFilter);
      this.lowpassFilter.connect(this.masterGain);

      try {
        this.noiseSource.start(0);
      } catch {
        // Ignored
      }

      // 7. 天电脉冲支路 (Static Crashes)
      this.crashGain = this.audioContext.createGain();
      this.crashGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      const crashFilter = this.audioContext.createBiquadFilter();
      crashFilter.type = 'bandpass';
      crashFilter.frequency.setValueAtTime(850, this.audioContext.currentTime);
      crashFilter.Q.setValueAtTime(0.8, this.audioContext.currentTime);

      this.noiseSource.connect(crashFilter);
      crashFilter.connect(this.crashGain);
      this.crashGain.connect(this.masterGain);

      // 8. QRM 邻频弱台信号发生器
      this.qrmOsc = this.audioContext.createOscillator();
      this.qrmGain = this.audioContext.createGain();
      this.qrmOsc.type = 'sine';
      this.qrmOsc.frequency.setValueAtTime(this.centerFreq + 120, this.audioContext.currentTime);
      this.qrmGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.qrmOsc.connect(this.qrmGain);
      this.qrmGain.connect(this.audioContext.destination);
      try {
        this.qrmOsc.start();
      } catch {
        // Ignored
      }

        this.isInitialized = true;
        this.startTime = Date.now();
        this._updateSchedulersState();
        this._applyGain();
      } catch (e) {
        console.warn('[RadioInterference] Context init error:', e);
      } finally {
        this._initPromise = null;
      }

      return this.audioContext;
    })();

    return this._initPromise;
  }

  /**
   * 按需动态管理调度器生命周期 (0 开销策略)
   * 仅在 isPlaying && level > 0 时激活定时器；暂停、停止或干扰为 0 时彻底停用并休眠，保持 0 CPU 消耗
   */
  _updateSchedulersState() {
    const shouldRun = this.isInitialized && this.isPlaying && this.level > 0;
    if (shouldRun) {
      if (!this.modulationTimer) {
        this._startSchedulers();
      }
    } else {
      if (this.modulationTimer || this.crashTimer || this.qrmTimer) {
        this._stopSchedulers();
        this._restoreAudioPlayerBaselines();
      }
    }
  }

  /**
   * 启动天电脉冲、QRM 连续副台发报以及 QSB/QRH 调制调度器
   */
  _startSchedulers() {
    this._stopSchedulers();
    this.startTime = Date.now();

    // 1. 随机天电放电 (Static Crashes)
    const scheduleNextCrash = () => {
      if (!this.isInitialized || !this.isPlaying || this.level <= 0) return;
      const delay = Math.max(350, 2200 - this.level * 20) + Math.random() * 800;
      this.crashTimer = setTimeout(() => {
        this._triggerStaticCrash();
        if (this.isInitialized && this.isPlaying && this.level > 0) {
          scheduleNextCrash();
        }
      }, delay);
    };
    scheduleNextCrash();

    // 2. QRM 邻频真实连续莫尔斯电码流 (模拟邻台在旁边频点连续发报通联)
    const runQrmLoop = () => {
      if (!this.isInitialized || !this.isPlaying || this.level <= 0) return;

      if (this.level < 10 || !this.modes.qrm) {
        this.qrmTimer = setTimeout(runQrmLoop, 400);
        return;
      }

      const durationMs = this._triggerQrmSequence();
      // 字间间隔 (较短的150~300ms，使得副台几乎在耳边连续不断地嘀嘀嗒嗒发报)
      const interWordPause = Math.max(120, 380 - this.level * 2.5) + Math.random() * 150;
      this.qrmTimer = setTimeout(runQrmLoop, durationMs + interWordPause);
    };
    runQrmLoop();

    // 3. 高精度连续调制心跳 (25ms 快速刷新 QSB 深度衰落与 QRH 快速走频)
    this.modulationTimer = setInterval(() => {
      this._updateModulations();
    }, 25);
  }

  _stopSchedulers() {
    if (this.crashTimer) {
      clearTimeout(this.crashTimer);
      this.crashTimer = null;
    }
    if (this.qrmTimer) {
      clearTimeout(this.qrmTimer);
      this.qrmTimer = null;
    }
    if (this.modulationTimer) {
      clearInterval(this.modulationTimer);
      this.modulationTimer = null;
    }
  }

  /**
   * 触发一次天电放电强力劈啪脉冲 (Static Crash)
   */
  _triggerStaticCrash() {
    if (!this.crashGain || !this.audioContext || !this.isPlaying || this.level < 10 || !this.modes.noise) return;
    const now = this.audioContext.currentTime;

    // 强力天电：峰值最高可达 0.95 振幅
    const peakAmp = (this.level / 100) * 0.95 * (0.75 + Math.random() * 0.5);
    const duration = 0.025 + Math.random() * 0.055; // 25ms ~ 80ms 瞬态

    try {
      this.crashGain.gain.cancelScheduledValues(now);
      this.crashGain.gain.setValueAtTime(0, now);
      this.crashGain.gain.linearRampToValueAtTime(peakAmp, now + 0.003); // 3ms 陡峭放电起峰
      this.crashGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      this.crashGain.gain.setValueAtTime(0, now + duration + 0.005);
    } catch {
      // Ignored
    }
  }

  /**
   * 提取 QRM 发报字符片段：
   * 优先从当前文章正文中随机截取 2~4 个字符，使邻台干扰和主练习文本具有相同的字符分布与认知混淆度；
   * 若无有效正文则回退无线电通联高频缩语。
   */
  _getQrmTextSnippet() {
    const rawText = (this.currentText || audioPlayer.session?.text || '').trim();
    // 过滤提取有效莫尔斯字母与数字
    const validChars = [];
    for (let i = 0; i < rawText.length; i++) {
      const ch = rawText[i].toUpperCase();
      if (/[A-Z0-9]/.test(ch)) {
        validChars.push(ch);
      }
    }

    if (validChars.length >= 2) {
      const snippetLen = Math.min(validChars.length, 2 + Math.floor(Math.random() * 3)); // 2 ~ 4 字符
      const maxStart = validChars.length - snippetLen;
      const startIdx = Math.floor(Math.random() * (maxStart + 1));
      return validChars.slice(startIdx, startIdx + snippetLen).join('');
    }

    // 回退无线电典型缩语与呼叫
    const FALLBACK_WORDS = ['CQ', 'TEST', '5NN', '73', 'QRZ', 'DE', 'UR', 'RST', 'TU', 'BK'];
    return FALLBACK_WORDS[Math.floor(Math.random() * FALLBACK_WORDS.length)];
  }

  /**
   * 触发一段邻频连续发报点划 (QRM CW Sequence)
   * 速度以当前主速度为基准动态浮动 (±3 WPM)，内容来自正文随机切片或通联用语
   */
  _triggerQrmSequence() {
    if (!this.qrmGain || !this.qrmOsc || !this.audioContext || !this.isPlaying || this.level < 10 || !this.modes.qrm) {
      return 300;
    }
    const now = this.audioContext.currentTime;

    // 1. 随机频偏 (邻频失谐 ±70Hz ~ ±160Hz)
    const offset = (Math.random() > 0.5 ? 1 : -1) * (70 + Math.random() * 90);
    this.qrmOsc.frequency.setValueAtTime(Math.max(120, this.centerFreq + offset), now);

    // 2. QRM 音量：高等级下可达 0.75 振幅
    const qrmAmp = Math.pow(this.level / 100, 0.9) * 0.75 * (0.85 + Math.random() * 0.3);

    // 3. 速度以当前播放速度为基准动态浮动 (基准 WPM ± 3，限制在 8 ~ 60 WPM)
    const baseWpm = audioPlayer.playbackConfig?.wpm || 20;
    const speedJitter = (Math.random() - 0.5) * 6; // ±3 WPM 抖动
    const qrmWpm = Math.max(8, Math.min(60, Math.round(baseWpm + speedJitter)));

    // PARIS 标准点划时间计算 (秒)
    const ditUnit = 1.2 / qrmWpm;
    const dahUnit = ditUnit * 3;
    const numberMode = audioPlayer.playbackConfig?.numberMode || 'long';

    // 4. 获取发报文本片段 (正文随机切片或典型词汇)
    const snippet = this._getQrmTextSnippet();

    let cursor = now;

    try {
      this.qrmGain.gain.cancelScheduledValues(now);
      this.qrmGain.gain.setValueAtTime(0, now);

      for (let i = 0; i < snippet.length; i++) {
        const char = snippet[i];
        const morseCode = getCharMorseCode(char, numberMode);
        if (!morseCode) continue;

        for (let j = 0; j < morseCode.length; j++) {
          const sym = morseCode[j];
          const dur = sym === '-' ? dahUnit : ditUnit;

          this.qrmGain.gain.linearRampToValueAtTime(qrmAmp, cursor + 0.004);
          cursor += dur;
          this.qrmGain.gain.setValueAtTime(qrmAmp, cursor);
          this.qrmGain.gain.linearRampToValueAtTime(0, cursor + 0.004);
          cursor += ditUnit; // 划内间隔
        }

        cursor += ditUnit * 2; // 字符间附加间隔 (加上前面的点长共 3 * ditUnit)
      }
    } catch {
      // Ignored
    }

    return Math.max(200, (cursor - now) * 1000);
  }

  /**
   * 动态调制心跳：施加深渊级快速 QSB (信号深度衰落) 与显著 QRH (宽幅频率晃动)
   */
  _updateModulations() {
    if (!this.isPlaying || this.level <= 0) {
      this._restoreAudioPlayerBaselines();
      return;
    }

    const t = (Date.now() - this.startTime) / 1000;

    // 1. 主音强度随干扰度显著压低 (信噪比动态衰减：100% 干扰时主音基准仅剩 ~10%，极其微弱)
    if (audioPlayer.masterGain && audioPlayer.audioContext) {
      const baseGain = Math.min(Math.max((audioPlayer.volume !== undefined ? audioPlayer.volume : 100) / 100, 0), 1);
      
      // 主音基准衰减：0% 干扰 -> 100% 主音；50% 干扰 -> 55% 主音；100% 干扰 -> 10% 主音 (极其微弱)
      const signalAttenuation = Math.max(0.08, 1 - (this.level / 100) * 0.90);

      // QSB 强效增强：电离层起伏 (2.4秒短周期慢浪 + 8.5 rad/s 快颤 flutter)
      let qsbFactor = 1.0;
      if (this.modes.qsb) {
        const slowWave = 0.5 + 0.5 * Math.sin(t * 2.6); // 约 2.4 秒一个显著大起伏
        const flutter = 0.86 + 0.14 * Math.sin(t * 9.0); // 1.4Hz 电离层快颤
        // 衰落深度：随 level 提高，波谷下潜达 90%
        const fadeDepth = 0.35 + (this.level / 100) * 0.60;
        qsbFactor = Math.max(0.05, 1 - fadeDepth * slowWave) * flutter;
      }

      const finalSignalGain = Math.max(0.02, baseGain * signalAttenuation * qsbFactor);
      const now = audioPlayer.audioContext.currentTime;
      audioPlayer.masterGain.gain.setTargetAtTime(finalSignalGain, now, 0.035);
    }

    // 2. QRH 大跨度频率漂移与变调 (幅度扩大至 300~500Hz，实现 380Hz 漂至 800Hz、700Hz 漂至 200多Hz 的宽幅走频)
    if (this.modes.qrh && audioPlayer.osc && audioPlayer.audioContext) {
      const baseFreq = audioPlayer.playbackConfig?.freq || this.centerFreq;
      // 频漂幅度：100% 强度下最高达到 ±450Hz 宽幅大漂移！
      const maxDrift = (this.level / 100) * 450;
      // 复合老式真空管走频波形 (2.5s 主漂移周期 + 1.1s 副摇摆)
      const wobble = 0.72 * Math.sin(t * 2.5) + 0.28 * Math.sin(t * 1.1);
      const driftHz = maxDrift * wobble;
      // 安全限制在 100Hz ~ 1300Hz 的正常电码发音频谱内，杜绝超低频哑音或超高频破音
      const targetFreq = Math.max(100, Math.min(1300, baseFreq + driftHz));

      const now = audioPlayer.audioContext.currentTime;
      audioPlayer.osc.frequency.setTargetAtTime(targetFreq, now, 0.035);
    } else if (audioPlayer.osc && audioPlayer.audioContext) {
      const baseFreq = audioPlayer.playbackConfig?.freq || this.centerFreq;
      const now = audioPlayer.audioContext.currentTime;
      audioPlayer.osc.frequency.setTargetAtTime(baseFreq, now, 0.035);
    }
  }

  /**
   * 恢复主播放器的基线值 (音量与频率)
   */
  _restoreAudioPlayerBaselines() {
    if (audioPlayer.masterGain && audioPlayer.audioContext) {
      const baseGain = Math.min(Math.max((audioPlayer.volume !== undefined ? audioPlayer.volume : 100) / 100, 0), 1);
      const now = audioPlayer.audioContext.currentTime;
      try {
        audioPlayer.masterGain.gain.cancelScheduledValues(now);
        audioPlayer.masterGain.gain.setTargetAtTime(baseGain, now, 0.03);
      } catch {
        // Ignored
      }
    }
    if (audioPlayer.osc && audioPlayer.audioContext) {
      const baseFreq = audioPlayer.playbackConfig?.freq || this.centerFreq;
      const now = audioPlayer.audioContext.currentTime;
      try {
        audioPlayer.osc.frequency.cancelScheduledValues(now);
        audioPlayer.osc.frequency.setTargetAtTime(baseFreq, now, 0.03);
      } catch {
        // Ignored
      }
    }
  }

  /**
   * 设置干扰总强度 (0 ~ 100)
   */
  setLevel(level) {
    const clamped = Math.max(0, Math.min(100, Number(level) || 0));
    if (this.level === clamped) return;
    this.level = clamped;

    if (this.level > 0 && !this.isInitialized) {
      this.ensureContext().catch(() => {});
    }

    this._applyGain();
    this._updateSchedulersState();
  }

  /**
   * 配置各干扰子项开关 (底噪, QSB, QRH, QRM)
   */
  setModes(newModes) {
    this.modes = { ...this.modes, ...newModes };
    this._applyGain();
    this._updateSchedulersState();
  }

  /**
   * 同步当前练习正文内容 (供 QRM 提取上下文片段生成同质认知干扰)
   */
  setCurrentText(text) {
    if (typeof text === 'string') {
      this.currentText = text;
    }
  }

  /**
   * 同步当前主电码的侧音中心频率
   */
  setFrequency(freq) {
    const f = Math.max(100, Math.min(2000, Number(freq) || 600));
    this.centerFreq = f;
    if (this.bandpassFilter && this.audioContext) {
      const now = this.audioContext.currentTime;
      this.bandpassFilter.frequency.setTargetAtTime(f, now, 0.05);
    }
  }

  /**
   * 同步主播放器的播放状态
   */
  syncPlaybackState(isPlaying) {
    const nextState = Boolean(isPlaying);
    if (this.isPlaying === nextState) return;
    this.isPlaying = nextState;

    if (this.isPlaying && this.level > 0 && !this.isInitialized) {
      this.ensureContext().catch(() => {});
    }

    this._applyGain();
    this._updateSchedulersState();
  }

  /**
   * 平滑刷新底噪主增益包络 (高动态充沛能量输出)
   */
  _applyGain() {
    if (!this.masterGain || !this.audioContext) return;
    const now = this.audioContext.currentTime;

    if (!this.isPlaying || this.level <= 0 || !this.modes.noise) {
      // 静音淡出
      this.masterGain.gain.setTargetAtTime(0, now, 0.035);
    } else {
      const normalized = this.level / 100;
      const targetGain = Math.pow(normalized, 0.85) * 1.8;
      this.masterGain.gain.setTargetAtTime(targetGain, now, 0.04);
    }
  }

  /**
   * 销毁释放资源
   */
  destroy() {
    this._stopSchedulers();
    this._restoreAudioPlayerBaselines();
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // Ignored
      }
    }
    this.audioContext = null;
    this.isInitialized = false;
  }
}

// 全局单例
export const radioInterference = new RadioInterferenceEngine();
export default radioInterference;

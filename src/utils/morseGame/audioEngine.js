/**
 * 莫尔斯音游双轨和声音频引擎 (Web Audio API)
 * - 电脑标准音: 380Hz (偏左声道)
 * - 玩家拍发音: 475Hz (大三度, 偏右声道)
 * - 击中爆裂和声与泛音
 */

class MorseGameAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    
    // 电脑示范发生器节点引用
    this.demoOsc = null;
    this.demoGain = null;
    this.demoPanner = null;
    
    // 玩家拍发发生器节点引用
    this.playerOsc = null;
    this.playerGain = null;
    this.playerPanner = null;
    
    // 状态
    this.isDemoPlaying = false;
    this.isPlayerPlaying = false;

    // 参数
    this.demoFreq = 380;   // 黄金低频 380Hz
    this.playerFreq = 475; // 大三度和声 475Hz (380 * 1.25)
    this.volume = 0.5;
  }

  /**
   * 初始化 AudioContext (必须在用户手势后触发)
   */
  initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.volume, this.ctx.currentTime);
    }
  }

  setFrequencies(demoF = 380, playerF = 475) {
    this.demoFreq = demoF;
    this.playerFreq = playerF;
  }

  /**
   * 开始播放电脑示范信号 (380Hz, 偏左声道)
   */
  startDemoTone() {
    this.initContext();
    if (this.isDemoPlaying) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.demoFreq, this.ctx.currentTime);

      // 4ms 防爆音淡入 (Envelope Attack)
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.4, now + 0.004);

      // 声场偏左
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(-0.35, now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        osc.connect(gain);
        gain.connect(this.masterGain);
      }

      osc.start(now);
      this.demoOsc = osc;
      this.demoGain = gain;
      this.isDemoPlaying = true;
    } catch (err) {
      console.warn('Start demo tone error:', err);
    }
  }

  /**
   * 停止电脑示范信号
   */
  stopDemoTone() {
    if (!this.isDemoPlaying || !this.demoGain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      // 5ms 防爆音淡出 (Envelope Release)
      this.demoGain.gain.setValueAtTime(this.demoGain.gain.value, now);
      this.demoGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.005);
      
      const currentOsc = this.demoOsc;
      setTimeout(() => {
        try { currentOsc?.stop(); currentOsc?.disconnect(); } catch (_) {}
      }, 10);

      this.demoOsc = null;
      this.demoGain = null;
      this.isDemoPlaying = false;
    } catch (err) {
      console.warn('Stop demo tone error:', err);
    }
  }

  /**
   * 开始播放玩家拍发侧音 (475Hz, 偏右声道)
   */
  startPlayerTone() {
    this.initContext();
    if (this.isPlayerPlaying) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.playerFreq, this.ctx.currentTime);

      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.5, now + 0.003);

      // 声场偏右
      if (this.ctx.createStereoPanner) {
        const panner = this.ctx.createStereoPanner();
        panner.pan.setValueAtTime(0.35, now);
        osc.connect(gain);
        gain.connect(panner);
        panner.connect(this.masterGain);
      } else {
        osc.connect(gain);
        gain.connect(this.masterGain);
      }

      osc.start(now);
      this.playerOsc = osc;
      this.playerGain = gain;
      this.isPlayerPlaying = true;
    } catch (err) {
      console.warn('Start player tone error:', err);
    }
  }

  /**
   * 停止玩家拍发侧音
   */
  stopPlayerTone() {
    if (!this.isPlayerPlaying || !this.playerGain || !this.ctx) return;
    try {
      const now = this.ctx.currentTime;
      this.playerGain.gain.setValueAtTime(this.playerGain.gain.value, now);
      this.playerGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.004);

      const currentOsc = this.playerOsc;
      setTimeout(() => {
        try { currentOsc?.stop(); currentOsc?.disconnect(); } catch (_) {}
      }, 10);

      this.playerOsc = null;
      this.playerGain = null;
      this.isPlayerPlaying = false;
    } catch (err) {
      console.warn('Stop player tone error:', err);
    }
  }

  /**
   * 播放 PERFECT 击中泛音爆破特效音 (类似清脆鼓点 + 金色和声)
   */
  playPerfectHitEffect() {
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      // 泛音振荡器 (950Hz 高八度泛音)
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(this.playerFreq * 2, now);
      osc.frequency.exponentialRampToValueAtTime(this.playerFreq, now + 0.08);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (_) {}
  }

  /**
   * 播放 MISS 失误沉闷杂音
   */
  playMissEffect() {
    this.initContext();
    if (!this.ctx) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.12);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (_) {}
  }

  destroy() {
    this.stopDemoTone();
    this.stopPlayerTone();
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export const morseAudio = new MorseGameAudioEngine();

import { getUnitElementMs } from './clock.js';
import { getCharMorseCode } from '../morseCode.js';

/**
 * 将报底文本解析为高精度的绝对时间轴标准音符列表
 * 基于 PARIS 国际电报时钟体系：
 * - 点 (DIT): 1T
 * - 划 (DAH): 3T
 * - 笔画间隙 (Intra-char gap): 1T
 * - 字符间隔 (Inter-char gap): 3T
 * - 词/组间隔 (Word/Group gap): 7T
 */
export function buildStandardTimeline(text, wpm) {
  const unitT = getUnitElementMs(wpm);
  const notes = [];
  const charsData = [];
  let currentMs = 0;

  // 预留前导空闲时间 (例如 600ms)，给用户留出准备反应区
  const LEAD_IN_MS = 600;
  currentMs += LEAD_IN_MS;

  const words = text.trim().split(/\s+/);

  words.forEach((word, wordIdx) => {
    const chars = word.split('');
    chars.forEach((ch, chIdx) => {
      const code = getCharMorseCode(ch);
      const charObj = {
        char: ch,
        wordIndex: wordIdx,
        charIndex: charsData.length,
        code: code || '',
        startMs: currentMs,
        endMs: currentMs,
        notes: []
      };

      if (code) {
        const symbols = code.split('');
        symbols.forEach((sym, symIdx) => {
          const isDah = sym === '-';
          const duration = isDah ? 3 * unitT : 1 * unitT;
          const noteStart = currentMs;
          const noteEnd = noteStart + duration;

          const note = {
            id: `std_${wordIdx}_${chIdx}_${symIdx}`,
            char: ch,
            wordIndex: wordIdx,
            charIndex: charObj.charIndex,
            symbolIndex: symIdx,
            symbol: isDah ? '—' : '•',
            type: isDah ? 'DAH' : 'DIT',
            startMs: noteStart,
            endMs: noteEnd,
            duration: duration,
            standardT: isDah ? 3 : 1
          };

          notes.push(note);
          charObj.notes.push(note);

          currentMs = noteEnd;

          // 笔画内间隔 (1T)
          if (symIdx < symbols.length - 1) {
            currentMs += 1 * unitT;
          }
        });

        charObj.endMs = currentMs;

        // 字符间停顿：3T
        if (chIdx < chars.length - 1) {
          currentMs += 3 * unitT;
        }
      }

      charsData.push(charObj);
    });

    // 组/词间停顿：7T
    if (wordIdx < words.length - 1) {
      currentMs += 7 * unitT;
    }
  });

  const totalDurationMs = currentMs + 600; // 结尾预留 600ms
  return {
    notes,
    charsData,
    totalDurationMs,
    unitT
  };
}

/**
 * 双轨音频与时间轴调度引擎
 */
export class WaterfallAudioScheduler {
  constructor() {
    this.audioCtx = null;
    this.oscillator = null;
    this.gainNode = null;
    this.playerOsc = null;
    this.playerGain = null;
    this.frequency = 650; // 标准音频率
    this.playerFrequency = 780; // 用户跟发音频率
    this.isPlaying = false;
    this.isPaused = false;
    this.playbackStartWallTime = 0;
    this.pausedAtMs = 0;
    this.scheduledTimers = [];
  }

  initContext() {
    if (!this.audioCtx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  setFrequency(freq) {
    this.frequency = freq;
  }

  setPlayerFrequency(freq) {
    this.playerFrequency = freq;
  }

  /**
   * 获取当前播放头在时间轴上的精确毫秒数
   */
  getCurrentPositionMs() {
    if (!this.isPlaying) return this.pausedAtMs;
    if (this.isPaused) return this.pausedAtMs;
    const now = performance.now();
    return Math.max(0, now - this.playbackStartWallTime);
  }

  /**
   * 启动时间线精准音频播放调度
   */
  startTimelinePlayback(notes, startOffsetMs = 0, onPlayheadUpdate = null, onEnded = null) {
    this.initContext();
    this.stopPlayback();

    this.isPlaying = true;
    this.isPaused = false;
    this.playbackStartWallTime = performance.now() - startOffsetMs;
    this.pausedAtMs = startOffsetMs;

    const ctx = this.audioCtx;
    const ctxStartTime = ctx.currentTime;

    // 创建常驻单例振荡器与平滑包络增益
    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(0, ctxStartTime);
    this.gainNode.connect(ctx.destination);

    this.oscillator = ctx.createOscillator();
    this.oscillator.type = 'sine';
    this.oscillator.frequency.setValueAtTime(this.frequency, ctxStartTime);
    this.oscillator.connect(this.gainNode);
    this.oscillator.start(ctxStartTime);

    // 将未播放的标准点划音符提交至 Web Audio 硬件时间线
    const remainingNotes = notes.filter(n => n.endMs > startOffsetMs);

    remainingNotes.forEach(n => {
      const relStartSec = (n.startMs - startOffsetMs) / 1000;
      const relEndSec = (n.endMs - startOffsetMs) / 1000;

      if (relStartSec >= 0) {
        const audioNoteStart = ctxStartTime + relStartSec;
        const audioNoteEnd = ctxStartTime + relEndSec;
        const fadeSec = 0.003; // 3ms 快速淡入淡出防爆音

        this.gainNode.gain.setValueAtTime(0, audioNoteStart);
        this.gainNode.gain.linearRampToValueAtTime(0.18, audioNoteStart + fadeSec);
        this.gainNode.gain.setValueAtTime(0.18, audioNoteEnd - fadeSec);
        this.gainNode.gain.linearRampToValueAtTime(0, audioNoteEnd);
      }
    });

    // 播放结束定时器
    if (remainingNotes.length > 0) {
      const lastNote = remainingNotes[remainingNotes.length - 1];
      const msUntilEnd = lastNote.endMs - startOffsetMs + 300;
      const endTimer = setTimeout(() => {
        if (this.isPlaying && !this.isPaused) {
          if (onEnded) onEnded();
        }
      }, msUntilEnd);
      this.scheduledTimers.push(endTimer);
    }
  }

  pausePlayback() {
    if (!this.isPlaying || this.isPaused) return;
    this.pausedAtMs = this.getCurrentPositionMs();
    this.isPaused = true;
    this._silenceStandardOscillator();
    this._clearTimers();
  }

  resumePlayback(notes, onEnded = null) {
    if (!this.isPlaying || !this.isPaused) return;
    this.startTimelinePlayback(notes, this.pausedAtMs, null, onEnded);
  }

  stopPlayback() {
    this.isPlaying = false;
    this.isPaused = false;
    this.pausedAtMs = 0;
    this._silenceStandardOscillator();
    this._clearTimers();
  }

  _silenceStandardOscillator() {
    if (this.gainNode && this.audioCtx) {
      try {
        this.gainNode.gain.cancelScheduledValues(this.audioCtx.currentTime);
        this.gainNode.gain.setValueAtTime(0, this.audioCtx.currentTime);
      } catch (e) {}
    }
    if (this.oscillator) {
      try {
        this.oscillator.stop();
        this.oscillator.disconnect();
      } catch (e) {}
      this.oscillator = null;
    }
  }

  _clearTimers() {
    this.scheduledTimers.forEach(t => clearTimeout(t));
    this.scheduledTimers = [];
  }

  /**
   * 玩家发报实时起音
   */
  startPlayerTone() {
    this.initContext();
    if (!this.playerGain) {
      const ctx = this.audioCtx;
      this.playerGain = ctx.createGain();
      this.playerGain.gain.setValueAtTime(0, ctx.currentTime);
      this.playerGain.connect(ctx.destination);

      this.playerOsc = ctx.createOscillator();
      this.playerOsc.type = 'sine';
      this.playerOsc.frequency.setValueAtTime(this.playerFrequency, ctx.currentTime);
      this.playerOsc.connect(this.playerGain);
      this.playerOsc.start(ctx.currentTime);
    }

    const ctx = this.audioCtx;
    this.playerGain.gain.cancelScheduledValues(ctx.currentTime);
    this.playerGain.gain.setValueAtTime(0, ctx.currentTime);
    this.playerGain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.003);
  }

  /**
   * 玩家发报实时停音
   */
  stopPlayerTone() {
    if (this.playerGain && this.audioCtx) {
      const ctx = this.audioCtx;
      this.playerGain.gain.cancelScheduledValues(ctx.currentTime);
      this.playerGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.003);
    }
  }

  destroy() {
    this.stopPlayback();
    if (this.playerOsc) {
      try {
        this.playerOsc.stop();
        this.playerOsc.disconnect();
      } catch (e) {}
      this.playerOsc = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch (e) {}
      this.audioCtx = null;
    }
  }
}

/**
 * 实时双轨比对与报务体检算法
 * 遍历用户的拍发音符列表 userNotes，匹配上轨最贴近的标准音符 standardNotes
 */
export function alignAndEvaluateNotes(standardNotes, userNotes, unitT) {
  let matchedCount = 0;
  let perfectCount = 0;
  let warnCount = 0;
  let badCount = 0;

  let totalDitDuration = 0;
  let ditCount = 0;
  let totalDahDuration = 0;
  let dahCount = 0;
  let totalOffset = 0;

  const evaluatedUserNotes = userNotes.map(userNote => {
    // 寻找与当前用户音符最接近的标准音符 (中心时间距离最近)
    const userCenter = (userNote.startMs + userNote.endMs) / 2;
    let closestStd = null;
    let minDistance = Infinity;

    standardNotes.forEach(std => {
      const stdCenter = (std.startMs + std.endMs) / 2;
      const dist = Math.abs(userCenter - stdCenter);
      if (dist < minDistance && dist < 12 * unitT) {
        minDistance = dist;
        closestStd = std;
      }
    });

    const isDah = userNote.duration >= 1.9 * unitT;
    const userType = isDah ? 'DAH' : 'DIT';
    const standardDuration = userType === 'DAH' ? 3 * unitT : 1 * unitT;
    const lengthRatio = userNote.duration / standardDuration;

    if (userType === 'DIT') {
      totalDitDuration += userNote.duration;
      ditCount++;
    } else {
      totalDahDuration += userNote.duration;
      dahCount++;
    }

    let status = 'PERFECT';
    let offsetMs = 0;

    if (closestStd) {
      offsetMs = userNote.startMs - closestStd.startMs;
      totalOffset += offsetMs;
      matchedCount++;

      if (userType !== closestStd.type) {
        status = 'BAD'; // 类型判反
        badCount++;
      } else if (lengthRatio < 0.72 || lengthRatio > 1.38) {
        status = 'WARN'; // 偏长或偏短
        warnCount++;
      } else {
        status = 'PERFECT'; // 吻合优秀
        perfectCount++;
      }
    } else {
      status = 'WARN';
    }

    return {
      ...userNote,
      userType,
      matchedStd: closestStd,
      lengthRatio,
      offsetMs,
      status
    };
  });

  // 统计结果
  const avgDitMs = ditCount > 0 ? Math.round(totalDitDuration / ditCount) : unitT;
  const avgDahMs = dahCount > 0 ? Math.round(totalDahDuration / dahCount) : unitT * 3;
  const dahDitRatio = avgDitMs > 0 ? (avgDahMs / avgDitMs) : 3.0;
  const avgOffsetMs = matchedCount > 0 ? Math.round(totalOffset / matchedCount) : 0;
  const accuracy = userNotes.length > 0
    ? Math.round((perfectCount + warnCount * 0.5) / Math.max(userNotes.length, standardNotes.length) * 100)
    : 100;

  return {
    evaluatedUserNotes,
    telemetry: {
      avgDitMs,
      avgDahMs,
      dahDitRatio: Number(dahDitRatio.toFixed(2)),
      avgOffsetMs,
      accuracy,
      perfectCount,
      warnCount,
      badCount,
      totalInputs: userNotes.length
    }
  };
}

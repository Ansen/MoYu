import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { textToMorseTokens, normalizeMorseTokenGaps, getCharMorseCode } from '../utils/morseCode.js';

/**
 * 将 AudioBuffer 编码为标准的 16-bit PCM 无损 WAV 二进制数据 (Uint8Array)
 * @param {AudioBuffer} audioBuffer
 * @returns {Uint8Array}
 */
export function encodeAudioBufferToWav(audioBuffer) {
  const numOfChan = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const samplesCount = audioBuffer.length;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numOfChan * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samplesCount * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  let pos = 0;
  function writeString(str) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(pos++, str.charCodeAt(i));
    }
  }

  // RIFF chunk
  writeString('RIFF');
  view.setUint32(pos, bufferSize - 8, true);
  pos += 4;
  writeString('WAVE');

  // fmt subchunk
  writeString('fmt ');
  view.setUint32(pos, 16, true); // Subchunk1Size (16 for PCM)
  pos += 4;
  view.setUint16(pos, 1, true); // AudioFormat (1 for PCM)
  pos += 2;
  view.setUint16(pos, numOfChan, true);
  pos += 2;
  view.setUint32(pos, sampleRate, true);
  pos += 4;
  view.setUint32(pos, byteRate, true);
  pos += 4;
  view.setUint16(pos, blockAlign, true);
  pos += 2;
  view.setUint16(pos, 16, true); // BitsPerSample
  pos += 2;

  // data subchunk
  writeString('data');
  view.setUint32(pos, dataSize, true);
  pos += 4;

  // 写入 16-bit PCM 采样
  const channels = [];
  for (let c = 0; c < numOfChan; c++) {
    channels.push(audioBuffer.getChannelData(c));
  }

  for (let i = 0; i < samplesCount; i++) {
    for (let c = 0; c < numOfChan; c++) {
      let sample = Math.max(-1, Math.min(1, channels[c][i]));
      // 放大至 16-bit 整数范围并做抗溢出防破音截断
      const intSample = sample < 0 ? Math.floor(sample * 32768) : Math.floor(sample * 32767);
      view.setInt16(pos, intSample, true);
      pos += 2;
    }
  }

  return new Uint8Array(arrayBuffer);
}

/**
 * 根据 Token 队列与时间轴生成同名同步歌词 (.lrc) 文本
 * @param {Array<object>} queue 带 timelineStartMs 的 Token 队列
 * @param {string} title 标题
 * @returns {string} LRC 歌词字符串
 */
export function generateMorseLrc(queue = [], title = 'MoYu CW Practice') {
  const lines = [
    `[ti:${title}]`,
    '[ar:MoYu CW Player]',
    '[al:Morse Code Audio Practice]',
    '[by:MoYu]',
    ''
  ];

  let currentLineText = '';
  let lineStartMs = -1;
  let wordCountInLine = 0;

  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    if (item.code === null) {
      // 单词间隔 / 空格
      if (currentLineText.trim().length > 0) {
        wordCountInLine++;
        // 每 5 组或遇到换行/显著停顿时换行
        if (wordCountInLine >= 5 || item.isParagraphBreak) {
          lines.push(formatLrcLine(Math.max(0, lineStartMs), currentLineText.trim()));
          currentLineText = '';
          wordCountInLine = 0;
          lineStartMs = -1;
        } else {
          currentLineText += ' ';
        }
      }
    } else {
      if (lineStartMs === -1) {
        lineStartMs = item.timelineStartMs !== undefined ? item.timelineStartMs : 0;
      }
      currentLineText += (item.char || '');
    }
  }

  if (currentLineText.trim().length > 0) {
    lines.push(formatLrcLine(Math.max(0, lineStartMs), currentLineText.trim()));
  }

  return lines.join('\n');
}

/**
 * 格式化单行 LRC 时间戳 [mm:ss.xx]
 * @param {number} ms
 * @param {string} text
 * @returns {string}
 */
function formatLrcLine(ms, text) {
  const totalCentis = Math.floor(Math.max(0, ms) / 10);
  const cs = String(totalCentis % 100).padStart(2, '0');
  const totalSec = Math.floor(totalCentis / 100);
  const ss = String(totalSec % 60).padStart(2, '0');
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  return `[${mm}:${ss}.${cs}]${text}`;
}

/**
 * 离线高速渲染电报音频并导出为 WAV (及同名 LRC 歌词)
 * @param {object} params
 * @param {string} params.text - 导出正文
 * @param {number} params.wpm - 发报速度
 * @param {number} params.freq - 音调频率 (Hz)
 * @param {string} params.numberMode - 数码模式 ('long'|'short5'|'short10')
 * @param {boolean} params.enableMarkers - 是否启用起止符
 * @param {string} params.prefixMarker - 前缀符
 * @param {string} params.suffixMarker - 后缀符
 * @param {string} params.title - 默认文件名
 * @param {boolean} params.includeLrc - 是否同步生成 .lrc 歌词文件
 * @param {Function} params.onProgress - 进度回调 ({ percent, text })
 * @param {string} params.targetFilePath - 指定保存路径 (可选)
 * @returns {Promise<boolean>}
 */
export async function exportMorseAudio({
  text = '',
  wpm = 20,
  freq = 400,
  numberMode = 'long',
  enableMarkers = false,
  prefixMarker = '',
  suffixMarker = '',
  title = 'Telegram',
  includeLrc = true,
  onProgress = null,
  targetFilePath = null
}) {
  if (!text || !text.trim()) {
    throw new Error('No content to export');
  }

  // 1. 构建完整的莫尔斯 Token 队列
  const queue = [];
  if (enableMarkers && prefixMarker && prefixMarker.trim()) {
    const pTokens = textToMorseTokens(prefixMarker.trim(), numberMode);
    for (const tok of pTokens) {
      queue.push({ ...tok, type: 'prefix' });
    }
    queue.push({ char: ' ', code: null });
  }

  const bodyTokens = textToMorseTokens(text, numberMode);
  for (const tok of bodyTokens) {
    queue.push({ ...tok, type: 'body' });
  }

  if (enableMarkers && suffixMarker && suffixMarker.trim()) {
    queue.push({ char: ' ', code: null });
    const sTokens = textToMorseTokens(suffixMarker.trim(), numberMode);
    for (const tok of sTokens) {
      queue.push({ ...tok, type: 'suffix' });
    }
  }

  const normalizedQueue = normalizeMorseTokenGaps(queue);
  if (normalizedQueue.length === 0) {
    throw new Error('Parsed token queue is empty');
  }

  // 2. 预计算每个 Token 的时间轴起始与持续时间
  const safeWpm = Math.max(5, Math.min(60, Number(wpm) || 20));
  const dotMs = 1200 / safeWpm;
  let offsetMs = 0;

  for (let i = 0; i < normalizedQueue.length; i++) {
    const item = normalizedQueue[i];
    item.timelineStartMs = offsetMs;
    item.unitMs = dotMs;

    if (item.code === null) {
      const dur = 4 * dotMs;
      item.timelineDurationMs = dur;
      offsetMs += dur;
    } else {
      let code = item.code;
      if (/[0-9]/.test(item.char)) {
        const c = getCharMorseCode(item.char, numberMode);
        if (c) code = c;
      }
      item.code = code;
      let dur = 0;
      const symbols = code.split('');
      for (let s = 0; s < symbols.length; s++) {
        dur += symbols[s] === '-' ? 3 * dotMs : 1 * dotMs;
        if (s < symbols.length - 1) dur += 1 * dotMs;
      }
      dur += 3 * dotMs; // 字符后 3 dots 间距
      item.timelineDurationMs = dur;
      offsetMs += dur;
    }
    item.timelineEndMs = offsetMs;
  }

  // 3. 询问用户保存路径 (若未指定)
  let filePath = targetFilePath;
  if (!filePath) {
    const safeFilename = (title || 'Telegram').replace(/[/\\:*?"<>|]/g, '_');
    filePath = await save({
      filters: [{ name: 'WAV Audio', extensions: ['wav'] }],
      defaultPath: `${safeFilename}.wav`
    });
  }

  if (!filePath) return false;

  if (onProgress) {
    onProgress({ percent: 15, text: '正在初始化离线音频合成引擎...' });
  }

  // 4. 创建 Web Audio OfflineAudioContext 进行多核高速并发离线渲染
  const sampleRate = 44100;
  const totalDurationSec = (offsetMs / 1000) + 0.5; // 预留 0.5 秒尾部余音
  const totalSamples = Math.ceil(totalDurationSec * sampleRate);

  const AudioContextClass = typeof window !== 'undefined'
    ? (window.OfflineAudioContext || window.webkitOfflineAudioContext)
    : null;

  if (!AudioContextClass) {
    throw new Error('OfflineAudioContext is not supported on this platform');
  }

  const offlineCtx = new AudioContextClass(1, totalSamples, sampleRate);
  const osc = offlineCtx.createOscillator();
  const gain = offlineCtx.createGain();

  const safeFreq = Math.max(100, Math.min(1500, Number(freq) || 400));
  osc.type = 'sine';
  osc.frequency.setValueAtTime(safeFreq, 0);

  // 初始静音
  gain.gain.setValueAtTime(0, 0);

  // 5. 按照时间轴预排期各个点划声音包络 (包含 5ms 梯形平滑防破音边缘)
  const rampTimeSec = 0.005; // 5ms 上升沿与下降沿

  for (let i = 0; i < normalizedQueue.length; i++) {
    const item = normalizedQueue[i];
    if (!item.code) continue;

    let symTimeSec = item.timelineStartMs / 1000;
    const symbols = item.code.split('');

    for (let s = 0; s < symbols.length; s++) {
      const isDah = symbols[s] === '-';
      const pulseDurationSec = (isDah ? 3 * dotMs : 1 * dotMs) / 1000;
      const pulseEndSec = symTimeSec + pulseDurationSec;

      // 梯形增益包络 (自适应平滑斜率，杜绝非严格单调时间戳异常)
      const actualRamp = Math.min(rampTimeSec, pulseDurationSec / 2.5);
      const rampUpEnd = symTimeSec + actualRamp;
      const rampDownStart = pulseEndSec - actualRamp;

      gain.gain.setValueAtTime(0, symTimeSec);
      gain.gain.linearRampToValueAtTime(0.85, rampUpEnd);
      if (rampDownStart > rampUpEnd) {
        gain.gain.setValueAtTime(0.85, rampDownStart);
      }
      gain.gain.linearRampToValueAtTime(0, pulseEndSec);

      symTimeSec += pulseDurationSec + (dotMs / 1000); // 下一个点划起始
    }
  }

  osc.connect(gain);
  gain.connect(offlineCtx.destination);
  osc.start(0);
  osc.stop(totalDurationSec);

  if (onProgress) {
    onProgress({ percent: 40, text: '正在离线高速混音渲染 (Web Audio SIMD)...' });
  }

  // 开始离线高速渲染 (C++ 底层高并发)
  const renderedBuffer = await offlineCtx.startRendering();

  if (onProgress) {
    onProgress({ percent: 75, text: '正在编码 16-bit PCM WAV 二进制文件...' });
  }

  // 6. 将生成的音频数据编码为标准 PCM WAV
  const wavBytes = encodeAudioBufferToWav(renderedBuffer);

  // 7. 写入本地磁盘文件 (基于 Tauri plugin-fs 或浏览器下载回退)
  try {
    await writeFile(filePath, wavBytes);
  } catch (fsErr) {
    // 桌面环境若 writeFile 失败，尝试 Blob 下载备用方案
    if (typeof document !== 'undefined') {
      const blob = new Blob([wavBytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = String(filePath).split(/[/\\]/).pop() || 'telegram.wav';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      throw fsErr;
    }
  }

  // 8. 若勾选同步导出歌词，保存同名 .lrc 文件
  if (includeLrc) {
    try {
      const lrcContent = generateMorseLrc(normalizedQueue, title);
      const lrcPath = String(filePath).replace(/\.wav$/i, '') + '.lrc';
      const lrcBytes = new TextEncoder().encode(lrcContent);
      await writeFile(lrcPath, lrcBytes);
    } catch (lrcErr) {
      console.warn('Failed to export accompanying .lrc file:', lrcErr);
    }
  }

  if (onProgress) {
    onProgress({ percent: 100, text: '导出完成！' });
  }

  return true;
}

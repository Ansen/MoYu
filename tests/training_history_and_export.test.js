import assert from 'node:assert/strict';

// Mock localStorage for Node.js test environment if needed
if (typeof global.localStorage === 'undefined') {
  const memoryStorage = {};
  global.localStorage = {
    getItem: (key) => memoryStorage[key] || null,
    setItem: (key, val) => { memoryStorage[key] = String(val); },
    removeItem: (key) => { delete memoryStorage[key]; },
    clear: () => { Object.keys(memoryStorage).forEach(k => delete memoryStorage[k]); }
  };
}

import { 
  saveTrainingSession, 
  getTrainingHistory, 
  getAggregatedTrainingStats, 
  deleteTrainingSession, 
  clearTrainingHistory 
} from '../src/utils/trainingHistoryStore.js';

import { 
  encodeAudioBufferToWav, 
  generateMorseLrc 
} from '../src/services/audioExportService.js';

import { 
  generatePracticeText 
} from '../src/utils/morse/structuredRandom.js';

import { 
  generateTargetTimeline, 
  analyzeSession 
} from '../src/utils/morseTimingAnalyzer.js';

export function testTrainingHistoryAndExport() {
  console.log('--- Running Training History & Audio Export Unit Tests ---');
  clearTrainingHistory();
  assert.equal(getTrainingHistory().length, 0);

  // 1. 保存第一次练习：字符 C 和 Y 均有失误
  const session1 = saveTrainingSession({
    wpm: 20,
    overallScore: 72,
    grade: 'B',
    accuracyRate: 75,
    timingConsistency: 80,
    dotDashRatio: 3.2,
    completionRate: 100,
    charStats: {
      'C': { char: 'C', total: 4, correct: 1, errors: 3, errorRate: 0.75 },
      'A': { char: 'A', total: 5, correct: 5, errors: 0, errorRate: 0 },
      'Y': { char: 'Y', total: 3, correct: 1, errors: 2, errorRate: 0.67 }
    },
    weakestChars: ['C', 'Y'],
    mode: 'live',
    inputDevice: 'ch552g',
    chapterTitle: 'QSO Drill 1'
  });

  assert.ok(session1.id);
  assert.equal(getTrainingHistory().length, 1);
  console.log('✓ Training session saved and indexed successfully.');

  // 2. 保存第二次练习：字符 C 再次失误，A 保持全对
  saveTrainingSession({
    wpm: 22,
    overallScore: 85,
    grade: 'A',
    accuracyRate: 90,
    timingConsistency: 88,
    dotDashRatio: 3.0,
    completionRate: 100,
    charStats: {
      'C': { char: 'C', total: 4, correct: 2, errors: 2, errorRate: 0.5 },
      'A': { char: 'A', total: 6, correct: 6, errors: 0, errorRate: 0 },
      '6': { char: '6', total: 2, correct: 1, errors: 1, errorRate: 0.5 }
    },
    weakestChars: ['C', '6'],
    mode: 'live',
    inputDevice: 'ch552g'
  });

  assert.equal(getTrainingHistory().length, 2);

  // 3. 验证聚合统计
  const stats = getAggregatedTrainingStats();
  assert.equal(stats.totalSessions, 2);
  assert.equal(stats.avgScore, Math.round((72 + 85) / 2)); // 79
  assert.equal(stats.avgWpm, 21);
  assert.equal(stats.gradeDistribution.A, 1);
  assert.equal(stats.gradeDistribution.B, 1);
  console.log('✓ Aggregated training statistics calculated accurately.');

  // 4. 验证易错字符热力聚合与排行
  assert.ok(stats.charHeatmap['C']);
  assert.equal(stats.charHeatmap['C'].total, 8);
  assert.equal(stats.charHeatmap['C'].errors, 5); // 3 + 2 = 5
  assert.equal(stats.charHeatmap['A'].errors, 0); // 0 errors

  assert.ok(stats.weakestCharsRanked.length >= 2);
  const weakCharNames = stats.weakestCharsRanked.map(c => c.char);
  assert.ok(weakCharNames.includes('C'));
  assert.ok(weakCharNames.includes('Y'));
  assert.equal(stats.weakestCharsRanked[0].char, 'Y'); // Y errorRate = 66.7% vs C errorRate = 62.5%
  console.log('✓ Character weakness attribution & heatmap ranking validated.');

  // 5. 验证单条删除与清空
  deleteTrainingSession(session1.id);
  assert.equal(getTrainingHistory().length, 1);
  clearTrainingHistory();
  assert.equal(getTrainingHistory().length, 0);
  console.log('✓ Training session deletion and clear validated.');

  // 6. 验证摩尔斯分析器的字符级归因
  const timeline = generateTargetTimeline('CQ'); // C (-.-.) Q (--.-)
  assert.ok(timeline.pulses.length > 0);

  const userEvents = [
    { state: 'DOWN', time: timeline.pulses[0].start },
    { state: 'UP', time: timeline.pulses[0].end, duration: timeline.pulses[0].duration }
  ];

  const analysis = analyzeSession({
    targetTimeline: timeline,
    userEvents,
    sessionStartTime: 0
  });

  assert.ok(analysis.charStats);
  assert.ok(analysis.charStats['C']);
  assert.equal(analysis.charStats['C'].errors, 1);
  assert.ok(analysis.weakestChars.includes('C'));
  console.log('✓ Character-level error attribution in analyzer validated.');

  // 7. 验证 WAV 编码器
  const sampleRate = 44100;
  const channelData = new Float32Array(100);
  for (let i = 0; i < 100; i++) {
    channelData[i] = Math.sin((i / 100) * Math.PI * 2) * 0.8;
  }

  const mockAudioBuffer = {
    numberOfChannels: 1,
    sampleRate,
    length: 100,
    getChannelData: () => channelData
  };

  const wavBytes = encodeAudioBufferToWav(mockAudioBuffer);
  assert.ok(wavBytes instanceof Uint8Array);
  assert.equal(wavBytes.length, 44 + 100 * 2);

  const textHeader = String.fromCharCode(...wavBytes.slice(0, 4));
  assert.equal(textHeader, 'RIFF');
  const waveHeader = String.fromCharCode(...wavBytes.slice(8, 12));
  assert.equal(waveHeader, 'WAVE');
  console.log('✓ Standard 16-bit PCM WAV encoding validated.');

  // 8. 验证 LRC 歌词生成器
  const queue = [
    { char: 'C', code: '-.-.', timelineStartMs: 0 },
    { char: 'Q', code: '--.-', timelineStartMs: 400 },
    { char: ' ', code: null, timelineStartMs: 900 },
    { char: 'D', code: '-..', timelineStartMs: 1200 },
    { char: 'E', code: '.', timelineStartMs: 1500 },
    { char: ' ', code: null, timelineStartMs: 1700 }
  ];

  const lrc = generateMorseLrc(queue, 'Test QSO');
  assert.ok(lrc.includes('[ti:Test QSO]'));
  assert.ok(lrc.includes('[00:00.00]CQ DE'));
  console.log('✓ Synchronized LRC lyrics generation validated.');

  // 9. 验证针对性弱项练习生成器 (防御 string / array pool 与 1 个弱项字符边界)
  const weakPrac1 = generatePracticeText({ mode: 'custom', pool: ['c'], charsPerGroup: 3, groupCount: 5 });
  assert.ok(weakPrac1.includes('ccc'));
  const weakPrac2 = generatePracticeText({ mode: 'custom', pool: 'c', charsPerGroup: 3, groupCount: 5 });
  assert.ok(weakPrac2.includes('ccc'));
  console.log('✓ Single & multi-character weak practice generation validated without errors.');

  console.log('All Training History & Audio Export tests passed successfully!\n');
}


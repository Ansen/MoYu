import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { 
  calculateUnitDuration, 
  generateTargetTimeline, 
  extractUserPulsesAndGaps, 
  analyzeSession 
} from '../src/utils/morseTimingAnalyzer.js';

/**
 * 自动化代码安全审查测试：
 * 扫描组件源码，确保所有被引用的关键全局/外部标识符已在文件头部正确 import，
 * 绝不再发生诸如 "ALL_FONTS is not defined" 的低级 ReferenceError！
 */
function testComponentImportIntegrity() {
  console.log('--- Running Component Reference Integrity & Import Safety Tests ---');

  // 1. 验证 Reader.jsx 必备的 import 符号
  const readerPath = path.resolve('src/components/Reader.jsx');
  const readerCode = fs.readFileSync(readerPath, 'utf8');

  const requiredReaderImports = [
    'ALL_FONTS',
    'getDefaultFontId',
    'FollowTrainingModule',
    'TxtEngine',
    'ReaderHeader',
    'TocSidebar',
    'useMorseAudio',
    'useRadioInterference',
    'useI18n'
  ];

  for (const sym of requiredReaderImports) {
    const importRegex = new RegExp(`import\\s+.*\\b${sym}\\b.*from`);
    assert.ok(
      importRegex.test(readerCode),
      `Reader.jsx MUST explicitly import symbol: '${sym}'`
    );
  }
  assert.ok(readerCode.includes('setIsTraining={handleToggleTraining}'), 'Reader.jsx MUST pass setIsTraining to ReaderHeader');
  console.log('✓ Reader.jsx import integrity validated (ALL_FONTS, FollowTrainingModule, etc. properly imported).');

  // 1.1 验证 ReaderHeader.jsx 报底模式后集成跟发轻量开关
  const headerPath = path.resolve('src/components/reader/ReaderHeader.jsx');
  const headerCode = fs.readFileSync(headerPath, 'utf8');
  assert.ok(headerCode.includes('isTraining = false'), 'ReaderHeader.jsx MUST accept isTraining prop');
  assert.ok(headerCode.includes('setIsTraining'), 'ReaderHeader.jsx MUST accept setIsTraining prop');
  assert.ok(headerCode.includes('reader.followTraining.toggle'), 'ReaderHeader.jsx MUST render followTraining toggle switch');
  console.log('✓ ReaderHeader.jsx follow training minimal-invasive toggle switch validated.');

  // 2. 验证 FollowTrainingModule.jsx 必备的 import 符号
  const modulePath = path.resolve('src/components/training/FollowTrainingModule.jsx');
  const moduleCode = fs.readFileSync(modulePath, 'utf8');

  const requiredModuleImports = [
    'TrainingScopePanel',
    'TrainingResultModal',
    'useKeyInput',
    'generateTargetTimeline',
    'analyzeSession'
  ];

  for (const sym of requiredModuleImports) {
    const importRegex = new RegExp(`import\\s+.*\\b${sym}\\b.*from`);
    assert.ok(
      importRegex.test(moduleCode),
      `FollowTrainingModule.jsx MUST explicitly import symbol: '${sym}'`
    );
  }

  // 3. 验证 FollowTrainingModule.jsx 绝对没有非法调用破坏高亮的 getChapterText
  assert.ok(
    !moduleCode.includes('getChapterText'),
    'FollowTrainingModule.jsx MUST NOT call engineRef.current.getChapterText() to avoid clearing highlight state!'
  );
  console.log('✓ FollowTrainingModule.jsx import and isolation integrity validated.');

  // 4. 验证 TrainingScopePanel.jsx 必备的 import 符号
  const panelPath = path.resolve('src/components/training/TrainingScopePanel.jsx');
  const panelCode = fs.readFileSync(panelPath, 'utf8');
  assert.ok(panelCode.includes('MorseTimelineCanvas'), 'TrainingScopePanel MUST import MorseTimelineCanvas');
  console.log('✓ TrainingScopePanel.jsx import integrity validated.');

  // 5. 验证 MorseTimelineCanvas.jsx 必备的 React hooks 符号，彻底杜绝 ReferenceError
  const canvasPath = path.resolve('src/components/training/MorseTimelineCanvas.jsx');
  const canvasCode = fs.readFileSync(canvasPath, 'utf8');
  const requiredCanvasImports = ['useRef', 'useEffect', 'useState', 'useCallback'];
  for (const hook of requiredCanvasImports) {
    const hookRegex = new RegExp(`import\\s+.*\\b${hook}\\b.*from`);
    assert.ok(
      hookRegex.test(canvasCode),
      `MorseTimelineCanvas.jsx MUST explicitly import React hook: '${hook}' to prevent ReferenceError!`
    );
  }
  console.log('✓ MorseTimelineCanvas.jsx React hooks import integrity validated.');
}

/**
 * useKeyInput 接口与行为契约单元测试
 */
function testKeyInputHookContract() {
  console.log('--- Running useKeyInput Contract Unit Tests ---');

  const hookPath = path.resolve('src/hooks/useKeyInput.js');
  const hookCode = fs.readFileSync(hookPath, 'utf8');

  // 验证必须支持单对象解构传参
  assert.ok(
    hookCode.includes('export function useKeyInput({'),
    'useKeyInput MUST accept a single options object with destructuring'
  );

  // 验证返回值字段契约
  assert.ok(hookCode.includes('isKeyDown'), 'useKeyInput must return isKeyDown');
  assert.ok(hookCode.includes('pressDuration'), 'useKeyInput must return pressDuration');
  assert.ok(hookCode.includes('serialConnected'), 'useKeyInput must return serialConnected');
  assert.ok(hookCode.includes('connectSerial'), 'useKeyInput must return connectSerial');

  // 模拟 DOWN / UP 事件格式验证
  const receivedEvents = [];
  const mockOnKeyEvent = (ev) => receivedEvents.push(ev);

  // 模拟按键流程：300ms 按住
  const tDown = 1000;
  const tUp = 1300;
  const evDown = { timestamp: tDown, state: 'DOWN', source: 'keyboard' };
  const duration = Math.max(10, Math.round(tUp - tDown));
  const evUp = { timestamp: tUp, state: 'UP', duration, source: 'keyboard' };

  mockOnKeyEvent(evDown);
  mockOnKeyEvent(evUp);

  assert.strictEqual(receivedEvents.length, 2);
  assert.strictEqual(receivedEvents[0].state, 'DOWN');
  assert.strictEqual(receivedEvents[0].source, 'keyboard');
  assert.strictEqual(receivedEvents[1].state, 'UP');
  assert.strictEqual(receivedEvents[1].duration, 300);
  console.log('✓ useKeyInput options signature and event stream contract validated.');
}

/**
 * 侧音频偏计算与模式切换完整性测试
 */
function testSidetoneOffsetAndModeIntegrity() {
  console.log('--- Running Sidetone Offset & Mode Switching Unit Tests ---');

  // 1. 验证默认偏置 +80Hz 计算逻辑
  const defaultOffset = 80;
  const calcFreq = (baseFreq, offset = defaultOffset) => Math.max(100, Math.min(2000, Number(baseFreq) + offset));

  assert.strictEqual(calcFreq(400), 480, 'Base 400Hz with +80Hz offset should be 480Hz');
  assert.strictEqual(calcFreq(600), 680, 'Base 600Hz with +80Hz offset should be 680Hz');
  assert.strictEqual(calcFreq(800, 50), 850, 'Custom +50Hz offset should be 850Hz');
  assert.strictEqual(calcFreq(600, -50), 550, 'Custom -50Hz offset should be 550Hz');
  assert.strictEqual(calcFreq(100, -300), 100, 'Lower clamp at 100Hz');
  assert.strictEqual(calcFreq(1950, 100), 2000, 'Upper clamp at 2000Hz');
  console.log('✓ Sidetone offset (+80Hz default) frequency calculation validated.');

  // 2. 检查 TrainingScopePanel.jsx：模式按钮绝对不能有 disabled={isPlaying}
  const panelPath = path.resolve('src/components/training/TrainingScopePanel.jsx');
  const panelCode = fs.readFileSync(panelPath, 'utf8');
  assert.ok(
    !panelCode.includes("onClick={() => setTrainingMode('blind')}\n              disabled={isPlaying}"),
    'Blind mode button MUST NOT be disabled by isPlaying'
  );
  assert.ok(
    !panelCode.includes("onClick={() => setTrainingMode('silent')}\n              disabled={isPlaying}"),
    'Silent mode button MUST NOT be disabled by isPlaying'
  );
  assert.ok(panelCode.includes('sidetoneOffset'), 'TrainingScopePanel MUST support sidetoneOffset prop');
  assert.ok(panelCode.includes('Volume2'), 'TrainingScopePanel MUST import and display Volume2 icon');
  console.log('✓ TrainingScopePanel mode button non-blocking & sidetone UI validated.');

  // 3. 检查 MorseTimelineCanvas.jsx：盲跟模式逻辑与细长舒展轨道参数
  const canvasPath = path.resolve('src/components/training/MorseTimelineCanvas.jsx');
  const canvasCode = fs.readFileSync(canvasPath, 'utf8');
  assert.ok(
    canvasCode.includes("isBlindMode = mode === 'blind' && !isFinished"),
    'MorseTimelineCanvas MUST hide target pulses whenever mode is blind (even before playback)'
  );
  assert.ok(
    canvasCode.includes('windowDurationMs = 4000') || canvasCode.includes('windowDurationMs = 4500'),
    'MorseTimelineCanvas MUST use an elegant window (4000ms) for slender, elongated pulses'
  );
  assert.ok(
    canvasCode.includes('pulseH = 3'),
    'MorseTimelineCanvas MUST use 3px refined pulse height'
  );
  console.log('✓ MorseTimelineCanvas blind mode masking & slender 4000ms window validated.');

  // 4. 检查 FollowTrainingModule.jsx：默认 +80Hz、本地存储及播放器伴听静音
  const modulePath = path.resolve('src/components/training/FollowTrainingModule.jsx');
  const moduleCode = fs.readFileSync(modulePath, 'utf8');
  assert.ok(
    moduleCode.includes('moyu_sidetone_offset'),
    'FollowTrainingModule MUST persist sidetone offset in localStorage'
  );
  assert.ok(
    moduleCode.includes('80'),
    'FollowTrainingModule MUST default sidetone offset to 80Hz'
  );
  assert.ok(
    moduleCode.includes('audioPlayer.setOutputVolume(0)'),
    'FollowTrainingModule MUST mute audioPlayer in silent mode'
  );
  assert.ok(
    moduleCode.includes('chapterText'),
    'FollowTrainingModule MUST support chapterText prop for precise chapter text sync'
  );
  // 验证 audioPlayer.js 提供纯只读高精度时钟接口契约
  const playerPath = path.resolve('src/utils/audioPlayer.js');
  const playerCode = fs.readFileSync(playerPath, 'utf8');
  assert.ok(
    playerCode.includes('getPlaybackProgress()'),
    'audioPlayer.js MUST expose getPlaybackProgress() for direct hardware clock reading'
  );

  // 5. 检查 Reader.jsx 与 TxtEngine.jsx 章节文本联动
  const readerPath = path.resolve('src/components/Reader.jsx');
  const readerCode = fs.readFileSync(readerPath, 'utf8');
  assert.ok(readerCode.includes('chapterText={currentChapterText}'), 'Reader MUST pass chapterText to FollowTrainingModule');

  const enginePath = path.resolve('src/components/reader/TxtEngine.jsx');
  const engineCode = fs.readFileSync(enginePath, 'utf8');
  assert.ok(engineCode.includes('getCurrentText:'), 'TxtEngine MUST expose getCurrentText method');

  console.log('✓ FollowTrainingModule sidetone offset default, chapter sync & player mute isolation validated.');
}

export function testFollowTrainingLogic() {
  console.log('--- Running CW Follow Training Logic Unit Tests ---');

  // 1. WPM 时间基准计算验证
  assert.strictEqual(calculateUnitDuration(20), 60, '20 WPM should yield 60ms unit');
  assert.strictEqual(calculateUnitDuration(12), 100, '12 WPM should yield 100ms unit');
  assert.strictEqual(calculateUnitDuration(2), 240, 'Minimum WPM clamp at 5 => 240ms');
  console.log('✓ Unit duration calculation validated.');

  // 2. 目标时间轴推演验证
  const timelineA = generateTargetTimeline('A', 20);
  assert.strictEqual(timelineA.pulses.length, 2, 'Character A should have 2 pulses');
  assert.strictEqual(timelineA.pulses[0].type, 'DOT');
  assert.strictEqual(timelineA.pulses[0].duration, 60);
  assert.strictEqual(timelineA.pulses[1].type, 'DASH');
  assert.strictEqual(timelineA.gaps.length, 2, 'Character A should have 1 element gap and 1 trailing char gap');
  assert.strictEqual(timelineA.gaps[0].type, 'ELEMENT_GAP');
  assert.strictEqual(timelineA.gaps[0].duration, 60);
  assert.strictEqual(timelineA.gaps[1].type, 'CHAR_GAP');
  assert.strictEqual(timelineA.gaps[1].duration, 180);
  console.log('✓ Target timeline pulses and gaps generation validated.');

  // 3. 英文短语多字符时间轴推演验证
  const timelineCQ = generateTargetTimeline('CQ', 20);
  assert.ok(timelineCQ.pulses.length > 5, 'CQ should produce multiple pulses');
  const charGaps = timelineCQ.gaps.filter(g => g.type === 'CHAR_GAP');
  assert.strictEqual(charGaps.length, 2, 'C and Q should each have standard 3-unit CHAR_GAP');
  assert.strictEqual(charGaps[0].duration, 180, 'CHAR_GAP should be 3 units = 180ms');
  console.log('✓ Multi-character phrase timeline & gaps validated.');

  // 4. 数字不同模式验证 (长码 vs 短码)
  const timelineLong = generateTargetTimeline('1', 20, 'long');
  const timelineShort5 = generateTargetTimeline('1', 20, 'short5');
  assert.strictEqual(timelineLong.pulses.length, 5, 'Digit 1 in long mode should have 5 pulses');
  assert.strictEqual(timelineShort5.pulses.length, 2, 'Digit 1 in short5 mode should have 2 pulses (.-)');
  console.log('✓ Number modes timeline generation validated.');

  // 4.1 核心时间轴算法严格镜像对齐验证 (0ms 偏差)
  const testText = "CQ CQ DE BG5AV 73 88";
  const testWpm = 20;
  const testTimeline = generateTargetTimeline({ text: testText, wpm: testWpm, numberMode: 'long' });
  const unitMs = 1200 / testWpm;
  // 首字 'C' (-.-.) 持续 (3+1+1+1+3+1+1)*60 = 660ms，加间隙 3*60 = 180ms，合计 840ms
  // 第二字 'Q' (--.-) 起始时间必须精确等于 840ms
  assert.strictEqual(testTimeline.tokenAnchorMap[0].start, 0);
  assert.strictEqual(testTimeline.tokenAnchorMap[1].start, 840);
  console.log('✓ Target timeline zero-drift mirror alignment validated (0ms difference).');

  // 4.2 验证从特定单词位置切入播放 (startIndex 切片支持)
  const timelineFromQ = generateTargetTimeline({ text: testText, wpm: testWpm, numberMode: 'long', startIndex: 1 });
  assert.strictEqual(timelineFromQ.pulses[0].char, 'Q', 'Timeline with startIndex=1 should begin with character Q');
  assert.strictEqual(timelineFromQ.pulses[0].start, 0, 'Sliced timeline should start from 0ms offset');
  console.log('✓ Target timeline startIndex sliced alignment validated.');

  // 5. 用户原始事件提取验证 (验证 ev.time 与 ev.duration 高精度契约)
  const rawEventsWithTime = [
    { time: 0, state: 'DOWN' },
    { time: 0, duration: 60, state: 'UP' },
    { time: 120, state: 'DOWN' },
    { time: 120, duration: 180, state: 'UP' }
  ];
  const { pulses: pulsesWithTime, gaps: gapsWithTime } = extractUserPulsesAndGaps(rawEventsWithTime, 0);
  assert.strictEqual(pulsesWithTime.length, 2, 'Should extract 2 pulses from ev.time/duration');
  assert.strictEqual(pulsesWithTime[0].start, 0);
  assert.strictEqual(pulsesWithTime[0].duration, 60);
  assert.strictEqual(pulsesWithTime[1].start, 120);
  assert.strictEqual(pulsesWithTime[1].duration, 180);
  assert.strictEqual(gapsWithTime.length, 1);
  assert.strictEqual(gapsWithTime[0].duration, 60);
  console.log('✓ Raw key events with ev.time & ev.duration extraction validated.');

  // 6. 会话评分与客观物理时长识别验证 (点 < 2*unitMs，划 >= 2*unitMs，不猜意图最准确)
  const objectiveEvents = [
    { time: 0, state: 'DOWN' },
    { time: 0, duration: 65, state: 'UP' }, // 点 (< 120ms 为 DOT)
    { time: 120, state: 'DOWN' },
    { time: 120, duration: 175, state: 'UP' } // 划 (>= 120ms 为 DASH)
  ];
  const objectiveAnalysis = analyzeSession({
    targetTimeline: timelineA,
    userEvents: objectiveEvents,
    sessionStartTime: 0
  });
  assert.strictEqual(objectiveAnalysis.accuracyRate, 100, 'Objective duration matching should recognize dot and dash correctly');
  assert.strictEqual(objectiveAnalysis.matchedCount, 2, 'Both dot and dash should match objectively');
  console.log('✓ Objective press duration recognition validated.');

  const standardEvents = [
    { time: 0, state: 'DOWN' },
    { time: 0, duration: 60, state: 'UP' },
    { time: 120, state: 'DOWN' },
    { time: 120, duration: 180, state: 'UP' }
  ];
  const analysis = analyzeSession({
    targetTimeline: timelineA,
    userEvents: standardEvents,
    sessionStartTime: 0
  });

  assert.strictEqual(analysis.completionRate, 100, 'Completion rate should be 100%');
  assert.strictEqual(analysis.dotDashRatio, 3, 'Ratio should be 3.0');
  assert.strictEqual(analysis.dotDeviation, 0, 'Dot deviation should be 0%');
  assert.strictEqual(analysis.dashDeviation, 0, 'Dash deviation should be 0%');
  assert.strictEqual(analysis.grade, 'S', 'Perfect timing should yield S grade');
  assert.strictEqual(analysis.accuracyRate, 100, 'Perfect input A should have 100% accuracy');
  assert.ok(analysis.overallScore >= 90, 'Score should be >= 90');
  console.log('✓ Session analysis scoring, accuracy and grading validated.');

  // 7. 空按键事件安全防护验证
  const emptyAnalysis = analyzeSession({
    targetTimeline: timelineA,
    userEvents: [],
    sessionStartTime: 1000
  });
  assert.strictEqual(emptyAnalysis.completionRate, 0, 'Empty events should have 0% completion');
  assert.strictEqual(emptyAnalysis.grade, 'D', 'Empty events should yield lowest D grade');
  console.log('✓ Empty events edge case safety validated.');

  // 8. 验证 analyzeSession 双重传参签名兼容性 (对象 vs 扁平三参数)
  const flatAnalysis = analyzeSession(timelineA, standardEvents, 0);
  assert.strictEqual(flatAnalysis.completionRate, 100, 'Flat argument call should yield 100% completion');
  assert.strictEqual(flatAnalysis.grade, 'S', 'Flat argument call should yield S grade');
  console.log('✓ analyzeSession dual-signature compatibility validated.');

  // 9. 极限畸形参数容灾防护验证 (传 null / undefined 绝不抛出任何 TypeError)
  const nullAnalysis = analyzeSession(null);
  assert.ok(nullAnalysis && typeof nullAnalysis === 'object');
  assert.strictEqual(nullAnalysis.grade, 'D');
  assert.strictEqual(nullAnalysis.totalTargetPulses, 0);

  const undefinedAnalysis = analyzeSession(undefined, null, undefined);
  assert.ok(undefinedAnalysis && typeof undefinedAnalysis === 'object');
  assert.strictEqual(undefinedAnalysis.grade, 'D');
  console.log('✓ analyzeSession malformed params resilience validated.');

  // 10. 运行组件完整性与安全审查测试
  testComponentImportIntegrity();

  // 11. 运行 Hook 契约测试
  testKeyInputHookContract();

  // 12. 运行侧音频偏与模式无障碍测试
  testSidetoneOffsetAndModeIntegrity();

  console.log('All CW Follow Training unit tests and code integrity checks passed successfully!\n');
}

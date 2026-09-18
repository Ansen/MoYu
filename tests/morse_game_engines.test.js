import assert from 'assert';
import { getUnitElementMs, generateMorseChart } from '../src/utils/morseGame/clock.js';
import { evaluateHit, generateDiagnosticReport } from '../src/utils/morseGame/judgeEngine.js';

export async function testMorseGameEngines() {
  console.log('--- Running Morse Game Engines Unit Tests ---');

  // 1. Clock Engine WPM calculation check
  // 12 WPM => T = 1200 / 12 = 100ms
  assert.strictEqual(getUnitElementMs(12), 100, '12 WPM unit element should be 100ms');
  // 20 WPM => T = 1200 / 20 = 60ms
  assert.strictEqual(getUnitElementMs(20), 60, '20 WPM unit element should be 60ms');
  console.log('✓ WPM to PARIS unit element calculation validated.');

  // 2. Morse Chart Generation check
  const chart = generateMorseChart('A', 12, 1000);
  assert.strictEqual(chart.wpm, 12);
  assert.strictEqual(chart.unitTime, 100);
  assert.strictEqual(chart.notes.length, 2, "'A' should generate 2 notes (1 dit + 1 dah)");
  
  const [ditNote, dahNote] = chart.notes;
  assert.strictEqual(ditNote.type, 'DIT');
  assert.strictEqual(ditNote.duration, 100, 'Dit duration should be 1T (100ms)');
  assert.strictEqual(ditNote.hitTime, 1000, 'First note should start at leadInMs (1000ms)');
  
  // Dit is 100ms, followed by 1T (100ms) intra-char space => Dah should start at 1200ms
  assert.strictEqual(dahNote.type, 'DAH');
  assert.strictEqual(dahNote.duration, 300, 'Dah duration should be 3T (300ms)');
  assert.strictEqual(dahNote.hitTime, 1200, 'Second note should start at 1200ms');
  console.log('✓ Chart generation with PARIS timing validated.');

  // 3. Hit Evaluation & Tolerance check
  const unitT = 100;
  // Offset of 10ms should be PERFECT
  const resPerfect = evaluateHit(ditNote, 10, unitT);
  assert.strictEqual(resPerfect.grade, 'PERFECT');
  assert.strictEqual(resPerfect.score, 1000);

  // Offset of 40ms should be GREAT
  const resGreat = evaluateHit(ditNote, 40, unitT);
  assert.strictEqual(resGreat.grade, 'GREAT');

  // Offset of 70ms should be GOOD
  const resGood = evaluateHit(ditNote, 70, unitT);
  assert.strictEqual(resGood.grade, 'GOOD');

  // Offset of 120ms should be MISS
  const resMiss = evaluateHit(ditNote, 120, unitT);
  assert.strictEqual(resMiss.grade, 'MISS');
  assert.strictEqual(resMiss.score, 0);
  console.log('✓ Dynamic tolerance grading (PERFECT/GREAT/GOOD/MISS) validated.');

  // 4. Diagnostic Report Generation check
  const mockNotes = [
    { isHit: true, hitResult: 'PERFECT', timeOffset: -5, actualDuration: 100, type: 'DIT' },
    { isHit: true, hitResult: 'PERFECT', timeOffset: 5, actualDuration: 295, type: 'DAH' }
  ];
  const report = generateDiagnosticReport(mockNotes, 2000, 2, 12);
  assert.strictEqual(report.rank, 'SSS', 'Full PERFECT should give SSS rank');
  assert.strictEqual(report.stats.perfect, 2);
  assert.strictEqual(report.timing.ditDahRatio, 2.95, '295 / 100 = 2.95 ratio');
  console.log('✓ Diagnostic report & Dit/Dah ratio calculation validated.');

  // 5. Dual Waterfall Timeline & Alignment check
  const { buildStandardTimeline, alignAndEvaluateNotes } = await import('../src/utils/morseGame/waterfallEngine.js');
  const timeline = buildStandardTimeline('CQ 73', 12);
  assert.ok(timeline.notes.length > 0, 'Should generate standard notes for CQ 73');
  assert.strictEqual(timeline.charsData.length, 4, 'Should parse 4 chars (C, Q, 7, 3)');

  // Simulate user pressing notes
  const mockUserNotes = [
    { id: 'u1', startMs: timeline.notes[0].startMs + 10, endMs: timeline.notes[0].endMs + 10, duration: timeline.notes[0].duration }
  ];
  const evalResult = alignAndEvaluateNotes(timeline.notes, mockUserNotes, timeline.unitT);
  assert.strictEqual(evalResult.evaluatedUserNotes[0].status, 'PERFECT', 'Close note should be PERFECT');
  assert.strictEqual(evalResult.telemetry.perfectCount, 1);
  console.log('✓ Waterfall timeline generation and user alignment evaluated.');

  console.log('All Morse game & waterfall engine tests passed successfully!');
}

// Self-run when executed directly via node
testMorseGameEngines().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

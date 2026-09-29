import assert from 'node:assert/strict';
import { test } from 'node:test';
import audioPlayer from '../src/utils/audioPlayer.js';
import { textToMorseTokens } from '../src/utils/morseCode.js';
import { generateTargetTimeline } from '../src/utils/morseTimingAnalyzer.js';
import { parseTelegramContent } from '../src/utils/telegramParser.js';
import { generatePracticeText } from '../src/utils/morse/structuredRandom.js';

const Player = audioPlayer.constructor;
const near = (actual, expected, message) => assert.ok(
  Math.abs(actual - expected) < 1e-7,
  message + ': expected ' + expected + ', got ' + actual,
);

// Record the real scheduleTone() GainNode calls, not just queue metadata.
function recordPlayback(text, options = {}, tick = 0.025, firstTick = 0, onTick = () => {}) {
  const player = new Player();
  const events = [];
  player.audioContext = { currentTime: firstTick };
  player.oscGain = { gain: {
    setValueAtTime: (value, time) => events.push({ value, time, method: 'set' }),
    linearRampToValueAtTime: (value, time) => events.push({ value, time, method: 'ramp' }),
    cancelScheduledValues: time => {
      for (let i = events.length - 1; i >= 0; i--) if (events[i].time >= time) events.splice(i, 1);
    },
  } };
  player.playbackConfig = { ...player.playbackConfig, wpm: 20, ...options };
  player._buildQueue(text, options);
  player.playbackState.isPlaying = true;
  player.nextNoteTime = 0.35;
  const originalTimeout = globalThis.setTimeout;
  // UI callbacks are irrelevant here; avoid leaving real timers running.
  globalThis.setTimeout = () => 0;
  try {
    let ticks = 0;
    while (player.queueIndex < player.queue.length) {
      assert.ok(ticks++ < 200000, 'scheduler must make progress');
      onTick(player);
      player.scheduler();
      player.audioContext.currentTime += tick;
    }
  } finally {
    globalThis.setTimeout = originalTimeout;
  }
  const tones = [];
  for (let i = 0; i < events.length; i++) {
    const [start, attack, release, end] = events.slice(i, i + 4);
    if (attack?.method !== 'ramp') {
      assert.equal(start.value, 0, 'reschedule may insert a standalone silence anchor');
      continue;
    }
    i += 3;
    assert.equal(start.value, 0);
    assert.equal(end.value, 0);
    assert.equal(attack.method, 'ramp');
    assert.equal(end.method, 'ramp');
    near(attack.time - start.time, 0.002, 'attack remains inside tone');
    near(end.time - release.time, 0.002, 'release remains inside tone');
    tones.push({ start: start.time, end: end.time });
  }
  return { player, tones };
}

// Independent oracle: count silence BETWEEN tones, never read the player's
// 3+4 implementation or the analyzer's WORD_GAP field as a complete word gap.
function verifyStandard(text, options = {}, tick) {
  const { player, tones } = recordPlayback(text, options, tick);
  verifyRhythm(player, tones);

  const timeline = generateTargetTimeline({ text, ...player.playbackConfig, ...options });
  assert.equal(timeline.pulses.length, tones.length);
  for (let i = 0; i < tones.length; i++) {
    near((tones[i].start - 0.35) * 1000, timeline.pulses[i].start, 'analyzer pulse start');
    near((tones[i].end - tones[i].start) * 1000, timeline.pulses[i].duration, 'analyzer pulse duration');
  }
  for (const item of player.queue) {
    near((item.startTime - 0.35) * 1000, item.timelineStartMs, 'queue offset');
    near((item.endTime - item.startTime) * 1000, item.timelineDurationMs, 'queue duration');
  }
  return { player, tones };
}

function verifyRhythm(player, tones) {
  const unit = 1.2 / player.playbackConfig.wpm;
  let toneIndex = 0;
  let previousEnd = null;
  let wordBoundary = false;
  for (const token of player.queue) {
    if (token.code === null) {
      wordBoundary = true;
      continue;
    }
    for (let i = 0; i < token.code.length; i++) {
      const tone = tones[toneIndex++];
      near(tone.end - tone.start, (token.code[i] === '-' ? 3 : 1) * unit, 'dot/dash');
      if (previousEnd !== null) {
        near(tone.start - previousEnd, (i > 0 ? 1 : wordBoundary ? 7 : 3) * unit, 'inter-tone silence');
      }
      previousEnd = tone.end;
      wordBoundary = false;
    }
  }
  assert.equal(toneIndex, tones.length);

}

function verifyOffsets(player) {
  for (const item of player.queue) {
    near((item.startTime - 0.35) * 1000, item.timelineStartMs, 'retimed queue offset');
    near((item.endTime - item.startTime) * 1000, item.timelineDurationMs, 'retimed queue duration');
    near(item.timelineStartMs + item.timelineDurationMs, item.timelineEndMs, 'retimed queue end');
  }
}

const scenarios = {
  numbers: '0123 4567 8901',
  letters: 'ABCDE FGHIJ KLMNO PQRST UVWXY ZABCD',
  mixed: 'A1B2C D3E4F G5H6J',
  english: 'HELLO WORLD, THIS IS A TEST.',
  callsigns: 'CQ DE B1ABC K',
};

for (const [name, text] of Object.entries(scenarios)) {
  for (const numberMode of ['long', 'short5', 'short10']) {
    for (const wpm of [5, 8, 10, 20, 30, 40, 60]) {
      test(name + ' / ' + numberMode + ' / ' + wpm + ' WPM = 1:3:1:3:7', () => {
        verifyStandard(text, { wpm, numberMode });
      });
    }
  }
}

test('spaces, tabs, newlines and Unicode whitespace preserve one seven-unit gap', () => {
  for (const separator of [' ', '   ', '\t', '\r\n', '\n\n', '\u00a0', '\u3000']) {
    const text = 'AB' + separator + 'CD';
    assert.equal(textToMorseTokens(text).filter(t => t.code === null).length, 1);
    verifyStandard(text);
  }
});

test('marker/body boundaries have seven units with a trimmed body', () => {
  verifyStandard('0123 4567', { enableMarkers: true, prefixMarker: '===', suffixMarker: 'iii +' });
});

test('parsed 100-group telegram retains all 99 boundaries, including row boundaries', () => {
  const parsed = parseTelegramContent('=== ' + Array(100).fill('0123').join(' ') + ' iii +');
  assert.equal(parsed.rows.length, 10);
  assert.equal(textToMorseTokens(parsed.cleanText).filter(t => t.code === null).length, 99);
  verifyStandard(parsed.cleanText, { wpm: 20, numberMode: 'short10' });
});

test('continuous digits gain real group spaces through the reader parser', () => {
  const parsed = parseTelegramContent('0123456789012345');
  assert.equal(parsed.cleanText, '0123 4567 8901 2345');
  verifyStandard(parsed.cleanText);
});

test('random numeric, letter and mixed generators emit playable group separators', () => {
  for (const mode of ['numbers', 'letters', 'mixed']) {
    const generated = generatePracticeText({ mode, groupCount: 12 });
    assert.ok(generated.includes(' '), 'generator must retain group spaces');
    verifyStandard(generated, { numberMode: 'short10' });
  }
});

test('a PARIS word including its trailing word gap occupies exactly 50 dot units', () => {
  const { player } = verifyStandard('PARIS ', { wpm: 20 });
  near((player.nextNoteTime - 0.35) / 0.06, 50, 'PARIS units');
});

test('bounded scheduler polling jitter does not change timing', () => {
  for (const tick of [0.025, 0.05, 0.1]) {
    verifyStandard('E T A12BC HELLO WORLD', { wpm: 60 }, tick);
  }
});

test('late dispatch must not steal silence from the following group', () => {
  const { tones } = recordPlayback('E E', { wpm: 20 }, 0.025, 0.6);
  near(tones[1].start - tones[0].end, 0.42, 'seven-unit word gap after a late first tone');
});

test('trailing body whitespace plus a suffix must form only one word boundary', () => {
  verifyStandard('E ', { enableMarkers: true, suffixMarker: 'E' });
});

for (const numberMode of ['long', 'short5', 'short10']) {
  test('late mixed telegram preserves every dot, dash and gap / ' + numberMode, () => {
    for (const wpm of [10, 20, 40, 60]) {
      const { player, tones } = recordPlayback('A1B2C D3E4F G5H6J', { wpm, numberMode }, 0.025, 0.6);
      verifyRhythm(player, tones);
      verifyOffsets(player);
    }
  });
}

function changeOnce(at, config) {
  let changed = false;
  return player => {
    if (!changed && player.audioContext.currentTime + 1e-9 >= at) {
      player.updateConfig(config);
      changed = true;
    }
  };
}

function verifyChangedRhythm(player, tones, at, oldWpm, newWpm) {
  let index = 0;
  let lastEnd = null;
  let wordGap = false;
  for (const token of player.queue) {
    if (token.code === null) { wordGap = true; continue; }
    const unit = 1.2 / (token.startTime < at ? oldWpm : newWpm);
    for (let i = 0; i < token.code.length; i++) {
      const tone = tones[index++];
      assert.ok(tone, 'no tone may be skipped by retiming');
      near(tone.end - tone.start, unit * (token.code[i] === '-' ? 3 : 1), 'atomic character code/speed');
      if (lastEnd !== null) near(tone.start - lastEnd, unit * (i ? 1 : wordGap ? 7 : 3), 'complete new-speed gap');
      lastEnd = tone.end;
      wordGap = false;
    }
  }
  assert.equal(index, tones.length, 'cancelled lookahead tones must not remain');
  verifyOffsets(player);
}

test('40 -> 20 WPM retimes the whole word gap to 420 ms, not 330 ms', () => {
  const { player, tones } = recordPlayback('E E E', { wpm: 40 }, 0.025, 0, changeOnce(0.4, { wpm: 20 }));
  near(tones[1].start - tones[0].end, 0.42, 'transition gap');
  verifyChangedRhythm(player, tones, 0.4, 40, 20);
});

for (const numberMode of ['long', 'short5', 'short10']) {
  for (const [oldWpm, newWpm] of [[40, 20], [20, 40]]) {
    test('mixed telegram changes speed and code at a group boundary / ' + numberMode + ' / ' + oldWpm + ' -> ' + newWpm, () => {
      const text = 'A1B2E D3E4F G5H6J';
      const baseline = recordPlayback(text, { wpm: oldWpm });
      const lastInGroup = baseline.player.queue[4];
      const at = lastInGroup.toneEndTime + 0.01;
      const { player, tones } = recordPlayback(text, { wpm: oldWpm }, 0.005, 0,
        changeOnce(at, { wpm: newWpm, numberMode }));
      verifyChangedRhythm(player, tones, at, oldWpm, newWpm);
      assert.equal(player.queue[1].code, '.----', 'already played digit retains its code');
      assert.equal(player.session.options.wpm, newWpm);
      assert.equal(player.session.options.numberMode, numberMode);
    });
  }
}

test('speed and short-code change within a long numeric character preserves its remaining tones', () => {
  const { player, tones } = recordPlayback('A1B2C D3E4F', { wpm: 40 }, 0.005, 0,
    changeOnce(0.7, { wpm: 20, numberMode: 'short10' }));
  verifyChangedRhythm(player, tones, 0.7, 40, 20);
  assert.equal(player.queue[1].code, '.----', 'active long-code digit must finish unchanged');
  assert.equal(player.queue[3].code, '..-', 'pending digit changes to short code');
});

for (const at of [0.1, 0.3]) {
  test('change during lead-in never skips first mixed character / ' + at, () => {
    const { player, tones } = recordPlayback('0A1BC D2E3F', { wpm: 40 }, 0.025, 0,
      changeOnce(at, { wpm: 20, numberMode: 'short10' }));
    assert.equal(player.queue[0].char, '0');
    assert.equal(player.queue[0].code, '-');
    near(tones[0].start, 0.35, 'lead-in retained');
    verifyRhythm(player, tones);
    verifyOffsets(player);
  });
}

test('repeated changes during a word gap clear stale scheduled times', () => {
  const first = changeOnce(0.4, { wpm: 40 });
  const second = changeOnce(0.5, { wpm: 10 });
  const { player, tones } = recordPlayback('E E E', { wpm: 20 }, 0.025, 0, p => { first(p); second(p); });
  assert.equal(tones.length, 3);
  near(tones[1].start - tones[0].end, 0.84, 'latest full word gap');
  near(tones[2].start - tones[1].end, 0.84, 'subsequent word gap');
  verifyOffsets(player);
});

test('speeding up after most of a gap elapsed never rewinds playback', () => {
  const { player, tones } = recordPlayback('E E E', { wpm: 20 }, 0.025, 0, changeOnce(0.75, { wpm: 60 }));
  assert.equal(tones.length, 3);
  assert.ok(tones[1].start >= 0.75);
  assert.ok(tones[1].start - tones[0].end >= 0.14);
  near(tones[2].start - tones[1].end, 0.14, 'subsequent gap uses new speed');
  verifyOffsets(player);
});

test('empty, whitespace and marker-only input cannot create orphan or duplicate gaps', () => {
  for (const text of ['', '   ', 'A1B2C   ']) {
    for (const prefixMarker of ['', '===', '🙂']) {
      verifyStandard(text, { enableMarkers: true, prefixMarker, suffixMarker: 'iii' });
    }
  }
  verifyStandard('A1B2C D3E4F', { startIndex: 5 });
});

test('a stall while dispatching a mixed character never overlaps tones or steals later silence', () => {
  let installed = false;
  const { player, tones } = recordPlayback('A1B2C D3E4F', { wpm: 20 }, 0.025, 0, p => {
    if (installed) return;
    installed = true;
    const original = p.scheduleTone.bind(p);
    let count = 0;
    p.scheduleTone = (...args) => {
      const start = original(...args);
      if (++count === 1) p.audioContext.currentTime = 0.7;
      return start;
    };
  });
  let index = 0;
  let lastEnd = null;
  let wordGap = false;
  for (const item of player.queue) {
    if (item.code === null) { wordGap = true; continue; }
    for (let i = 0; i < item.code.length; i++) {
      const tone = tones[index++];
      near(tone.end - tone.start, (item.code[i] === '-' ? 3 : 1) * 0.06, 'no truncated tone');
      if (lastEnd !== null) assert.ok(tone.start - lastEnd + 1e-9 >= (i ? 1 : wordGap ? 7 : 3) * 0.06, 'no compressed gap');
      lastEnd = tone.end;
      wordGap = false;
    }
  }
  assert.equal(index, tones.length);
  verifyOffsets(player);
});

test('paused speed/code changes rebase pending metadata without rewriting played history', () => {
  const { player } = recordPlayback('A1B2C D3E4F', { wpm: 40 });
  const playedStart = player.queue[0].timelineStartMs;
  const playedEnd = player.queue[0].timelineEndMs;
  player.playbackState.isPaused = true;
  player.queueIndex = 1;
  player.updateConfig({ wpm: 20, numberMode: 'short10' });
  near(player.queue[0].timelineStartMs, playedStart, 'played start retained');
  near(player.queue[0].timelineEndMs, playedEnd, 'played end retained');
  assert.equal(player.queue[1].code, '.-');
  near(player.queue[1].timelineStartMs, playedEnd, 'pending timeline starts after preserved history');
  near(player.queue[1].timelineDurationMs, 480, 'new short-code 1 has eight units including char gap');
});

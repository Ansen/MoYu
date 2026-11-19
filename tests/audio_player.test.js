import assert from 'assert';
import audioPlayer, { AUDIO_STATE } from '../src/utils/audioPlayer.js';
import { NUMBER_MODES } from '../src/utils/morseCode.js';

export async function testAudioPlayerLogic() {
  console.log('--- Running Audio Player Lifecycle & Fallback Unit Tests ---');

  // 1. Initial State Check
  assert.strictEqual(audioPlayer.playbackState.isPlaying, false, 'Player should start not playing');
  assert.strictEqual(audioPlayer.playbackState.isPaused, false, 'Player should start not paused');
  assert.strictEqual(audioPlayer.playbackState.stopRequested, false, 'Player should start without stop request');
  assert.strictEqual(audioPlayer.state, AUDIO_STATE.IDLE, 'Player initial state should be IDLE');
  console.log('✓ Initial player playbackState validated.');

  // 2. Volume Settings Check
  audioPlayer.setOutputVolume(80);
  assert.strictEqual(audioPlayer.volume, 80, 'Volume should be set to 80');
  console.log('✓ Player setOutputVolume validated.');

  // 3. Pause & Resume State Transitions
  audioPlayer.playbackState.isPlaying = true;
  audioPlayer.pause();
  assert.strictEqual(audioPlayer.playbackState.isPaused, true, 'Calling pause() should set isPaused to true');
  assert.strictEqual(audioPlayer.state, AUDIO_STATE.PAUSED, 'State should be PAUSED');
  
  await audioPlayer.resume();
  assert.strictEqual(audioPlayer.playbackState.isPaused, false, 'Calling resume() should set isPaused to false');
  console.log('✓ Player pause / resume state machine transitions validated.');

  // 4. Stop Transition
  audioPlayer.stop();
  assert.strictEqual(audioPlayer.playbackState.isPlaying, false, 'Calling stop() should reset isPlaying');
  assert.strictEqual(audioPlayer.playbackState.isPaused, false, 'Calling stop() should reset isPaused');
  assert.strictEqual(audioPlayer.playbackState.stopRequested, true, 'Calling stop() should set stopRequested');
  assert.strictEqual(audioPlayer.state, AUDIO_STATE.STOPPED, 'State should be STOPPED');
  console.log('✓ Player stop() reset and cleanup validated.');

  // 5. Config update
  audioPlayer.updateConfig({ wpm: 25, freq: 650, numberMode: 'short5', useHarmonics: true });
  assert.strictEqual(audioPlayer.playbackConfig.wpm, 25, 'WPM should be updated to 25');
  assert.strictEqual(audioPlayer.playbackConfig.freq, 650, 'Frequency should be updated to 650');
  assert.strictEqual(audioPlayer.playbackConfig.numberMode, 'short5', 'Number mode should be short5');
  assert.strictEqual(audioPlayer.playbackConfig.useHarmonics, true, 'useHarmonics should be true');
  console.log('✓ Player updateConfig parameters validated.');

  // 6. Enterprise Architecture: Subscription & State Event Broadcasting
  let notifiedState = null;
  const unsubscribe = audioPlayer.subscribe((snapshot) => {
    notifiedState = snapshot.state;
  });
  assert.strictEqual(notifiedState, AUDIO_STATE.STOPPED, 'Subscriber should receive initial snapshot');

  audioPlayer.pause(); // should remain stopped or transition appropriately
  audioPlayer.stop();
  assert.strictEqual(notifiedState, AUDIO_STATE.STOPPED, 'Subscriber should receive updated snapshot');
  unsubscribe();
  console.log('✓ Enterprise MorseAudioCore state subscription validated.');

  // 7. Session Context & Seek without Repassing Full Text
  audioPlayer.session = { text: 'CQ CQ TEST', options: { wpm: 20 }, startIndex: 0 };
  await audioPlayer.seek(4);
  assert.strictEqual(audioPlayer.session.startIndex, 4, 'Seek should update session startIndex without passing text');
  assert.strictEqual(audioPlayer.session.text, 'CQ CQ TEST', 'Seek should preserve session text');
  console.log('✓ Enterprise Session context & zero-redundancy seek validated.');

  // 8. Adaptive Toggle Facade API
  // Current state is stopped/idle
  const emptyToggle = await audioPlayer.toggle('');
  assert.strictEqual(emptyToggle.action, 'started', 'Toggle should use session text fallback if available');
  
  audioPlayer.pause();
  assert.strictEqual(audioPlayer.playbackState.isPaused, true, 'Player should be paused');
  
  const resumeToggle = await audioPlayer.toggle();
  assert.strictEqual(resumeToggle.action, 'resumed', 'Toggle should resume when paused');
  
  const pauseToggle = await audioPlayer.toggle();
  assert.strictEqual(pauseToggle.action, 'paused', 'Toggle should pause when playing');

  audioPlayer.stop();
  assert.strictEqual(audioPlayer.playbackState.isPlaying, false, 'Player stopped cleanly');
  console.log('✓ Enterprise Facade toggle() adaptive state transitions validated.');

  // 9. Multi-Page Lifecycle & Pause-Resume-Stop Recovery Simulation
  // Simulate Page 1 Complete -> Stop
  audioPlayer.stop();
  assert.strictEqual(audioPlayer.playbackState.isPlaying, false);

  // Flip to Page 2 -> Start Play
  const p2Play = await audioPlayer.toggle('PAGE TWO CONTENT');
  assert.strictEqual(p2Play.action, 'started', 'Should start Page 2 cleanly');
  assert.strictEqual(audioPlayer.playbackState.isPlaying, true);
  assert.strictEqual(audioPlayer.playbackState.isPaused, false);

  // Click Pause
  audioPlayer.pause();
  assert.strictEqual(audioPlayer.playbackState.isPaused, true);

  // Click Resume via toggle
  const p2Resume = await audioPlayer.toggle();
  assert.strictEqual(p2Resume.action, 'resumed', 'Should resume Page 2 without deadlock');
  assert.strictEqual(audioPlayer.playbackState.isPaused, false);

  // Click Stop
  audioPlayer.stop();
  assert.strictEqual(audioPlayer.playbackState.isPlaying, false);

  // Click Play again after Stop
  const p2Restart = await audioPlayer.toggle('PAGE TWO CONTENT');
  assert.strictEqual(p2Restart.action, 'started', 'Should be able to restart after stop');
  audioPlayer.stop();
  console.log('✓ Multi-page play-pause-resume-stop cycle completely validated with 0 deadlocks.');

  // 10. Runtime Number Mode (Long -> Short5 -> Short10) Hot-Reload During Playback
  audioPlayer.updateConfig({ numberMode: 'long' });
  await audioPlayer.play('0123456789', { numberMode: 'long' });
  assert.strictEqual(audioPlayer.queue[0].code, '-----', 'Initially 0 should be long code -----');
  assert.strictEqual(audioPlayer.queue[1].code, '.----', 'Initially 1 should be long code .----');
  assert.strictEqual(audioPlayer.queue[4].code, '....-', 'Initially 4 should be long code ....-');

  // Simulate playback in progress: queueIndex is at 1
  audioPlayer.queueIndex = 1;
  audioPlayer.updateConfig({ numberMode: 'short5' });
  assert.strictEqual(audioPlayer.playbackConfig.numberMode, 'short5');
  assert.strictEqual(audioPlayer.queue[1].code, '.-', 'Runtime switch to short5 should immediately update queued 1 to .-');
  assert.strictEqual(audioPlayer.queue[0].code, '-----', 'Past token 0 before queueIndex should remain unchanged');

  // Runtime switch to short10
  audioPlayer.updateConfig({ numberMode: 'short10' });
  assert.strictEqual(audioPlayer.playbackConfig.numberMode, 'short10');
  assert.strictEqual(audioPlayer.queue[4].code, '...-', 'Runtime switch to short10 should immediately update queued 4 to ...-');
  assert.strictEqual(audioPlayer.queue[5].code, '...', 'Runtime switch to short10 should immediately update queued 5 to ...');

  audioPlayer.stop();
  console.log('✓ Runtime numberMode hot-reload (long -> short5 -> short10) during active playback validated.');

  // 11. Runtime WPM Hot-Reload During Playback (Reschedule epoch verification)
  await audioPlayer.play('ABCDEF', { wpm: 20 });
  const initialEpoch = audioPlayer._scheduleEpoch;
  audioPlayer.updateConfig({ wpm: 35 });
  assert.strictEqual(audioPlayer.playbackConfig.wpm, 35, 'WPM should update to 35');
  assert.ok(audioPlayer._scheduleEpoch > initialEpoch, 'Schedule epoch should bump on runtime WPM change to invalidate stale ahead timers');
  audioPlayer.stop();
  console.log('✓ Runtime WPM hot-reload & schedule epoch invalidation validated.');

  // 12. Subscriber error boundary resilience (catch block must not throw ReferenceError)
  const originalConsoleError = console.error;
  let loggedErrorArgs = null;
  console.error = (...args) => {
    loggedErrorArgs = args;
  };
  let throwingUnsub = null;
  try {
    throwingUnsub = audioPlayer.subscribe(() => {
      throw new Error('Intentional subscriber init failure');
    });
  } finally {
    console.error = originalConsoleError;
  }
  assert.strictEqual(typeof throwingUnsub, 'function', 'subscribe() must return unsubscribe function even if initial listener throws');
  assert.ok(Array.isArray(loggedErrorArgs) && loggedErrorArgs[1] instanceof Error, 'subscribe() catch block must log the caught Error instance');
  throwingUnsub();
  console.log('✓ Subscriber initial notification error handling validated.');

  // 13. Number modes table integrity (long vs short5 vs short10)
  const digits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
  for (const d of digits) {
    assert.strictEqual(NUMBER_MODES.long[d].length, 5, `long['${d}'] must be 5 symbols`);
  }
  const short5Changed = digits.filter((d) => NUMBER_MODES.short5[d] !== NUMBER_MODES.long[d]);
  assert.deepStrictEqual(short5Changed.sort(), ['0', '1', '2', '8', '9'], 'short5 must shorten exactly 5 digits (0,1,2,8,9)');
  assert.strictEqual(NUMBER_MODES.short5['7'], '--...', 'short5[7] remains standard 5-symbol --...');
  const short10Changed = digits.filter((d) => NUMBER_MODES.short10[d] !== NUMBER_MODES.long[d]);
  assert.strictEqual(short10Changed.length, 10, 'short10 must shorten all 10 digits');
  assert.strictEqual(new Set(digits.map((d) => NUMBER_MODES.short10[d])).size, 10, 'short10 digit codes must be unique');
  console.log('✓ NUMBER_MODES (long/short5/short10) integrity validated.');

  // 14. Inaudible wake stream catch block resilience (must bind caught error without ReferenceError)
  const originalAudioCtx = audioPlayer.audioContext;
  const originalConsoleWarn = console.warn;
  let loggedWarnArgs = null;
  console.warn = (...args) => {
    loggedWarnArgs = args;
  };
  audioPlayer.audioContext = {
    state: 'running',
    currentTime: 0,
    sampleRate: 44100,
    createBuffer() {
      throw new Error('Simulated wake stream failure');
    }
  };
  try {
    await audioPlayer._startPlaybackEngine({ leadTimeSec: 0.05 });
  } finally {
    audioPlayer.stop();
    audioPlayer.audioContext = originalAudioCtx;
    console.warn = originalConsoleWarn;
  }
  assert.ok(
    Array.isArray(loggedWarnArgs) &&
      loggedWarnArgs[0] === 'Inaudible wake stream error:' &&
      loggedWarnArgs[1] instanceof Error,
    '_startPlaybackEngine wake stream catch block must log the caught Error instance'
  );
  console.log('✓ Inaudible wake stream error handling validated.');

  // 15. timelineVersion monotonicity & cursor-accelerated getPlaybackProgress parity (M1 & M2)
  const longText = 'ABCDE 12345 '.repeat(45).trim();
  const baseVersion = audioPlayer.getSnapshot().timelineVersion;
  await audioPlayer.play(longText, { wpm: 20 });
  const afterPlayVersion = audioPlayer.getSnapshot().timelineVersion;
  assert.ok(afterPlayVersion > baseVersion, 'timelineVersion must increment when building playback queue');

  audioPlayer.setOutputVolume(65);
  assert.strictEqual(
    audioPlayer.getSnapshot().timelineVersion,
    afterPlayVersion,
    'timelineVersion must remain unchanged on volume-only changes'
  );

  // Mock 500+ item timeline progression and verify forward, pause/resume gap, and backward seek parity
  const linearFindItem = (queue, now) => {
    let found = null;
    for (let i = 0; i < queue.length; i++) {
      const it = queue[i];
      if (it.startTime !== undefined && it.endTime !== undefined) {
        if ((now >= it.startTime && now < it.endTime) || now < it.startTime) {
          found = it;
          break;
        }
      }
    }
    if (!found && audioPlayer.queueIndex > 0) {
      found = queue[Math.min(queue.length - 1, audioPlayer.queueIndex - 1)];
    }
    return found;
  };

  const savedCtx = audioPlayer.audioContext;
  try {
    let mockNow = 10;
    audioPlayer.audioContext = { currentTime: mockNow };
    let tCursor = 10;
    const midStart = Math.floor(audioPlayer.queue.length / 2);
    for (let i = 0; i < audioPlayer.queue.length; i++) {
      const durSec = (audioPlayer.queue[i].timelineDurationMs || 100) / 1000;
      if (i < midStart) {
        delete audioPlayer.queue[i].startTime;
        delete audioPlayer.queue[i].endTime;
      } else {
        audioPlayer.queue[i].startTime = tCursor;
        audioPlayer.queue[i].endTime = tCursor + durSec;
        tCursor += durSec;
      }
    }
    audioPlayer._scheduledStartIdx = midStart;
    audioPlayer._progressCursor = midStart;
    audioPlayer.queueIndex = audioPlayer.queue.length;

    const sampleIndices = [midStart, midStart + 25, midStart + 120, audioPlayer.queue.length - 1, midStart + 10];
    for (const idx of sampleIndices) {
      const targetItem = audioPlayer.queue[idx];
      mockNow = (targetItem.startTime + targetItem.endTime) / 2;
      audioPlayer.audioContext.currentTime = mockNow;
      const got = audioPlayer.getPlaybackProgress();
      const expected = linearFindItem(audioPlayer.queue, mockNow);
      const expectedMs = expected.timelineStartMs + Math.max(0, (mockNow - expected.startTime) * 1000);
      assert.ok(Math.abs(got.timeMs - expectedMs) < 1e-6, `Progress cursor timeMs mismatch at idx ${idx}`);
      assert.strictEqual(got.activeToken, expected.type === 'body' ? expected.rawToken : null);
    }

    audioPlayer.updateConfig({ wpm: 25 });
    assert.ok(
      audioPlayer.getSnapshot().timelineVersion > afterPlayVersion,
      'timelineVersion must increment after runtime speed change'
    );
  } finally {
    audioPlayer.audioContext = savedCtx;
    audioPlayer.stop();
  }
  console.log('✓ timelineVersion precision filtering & O(1) cursor progress parity validated.');

  console.log('All Audio Player tests passed successfully!\n');
}



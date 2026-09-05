import assert from 'assert';
import audioPlayer, { AUDIO_STATE } from '../src/utils/audioPlayer.js';

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

  console.log('All Audio Player tests passed successfully!\n');
}



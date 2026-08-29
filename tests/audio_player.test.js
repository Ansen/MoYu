import assert from 'assert';
import audioPlayer from '../src/utils/audioPlayer.js';

export async function testAudioPlayerLogic() {
  console.log('--- Running Audio Player Lifecycle & Fallback Unit Tests ---');

  // 1. Initial State Check
  assert.strictEqual(audioPlayer.playbackState.isPlaying, false, 'Player should start not playing');
  assert.strictEqual(audioPlayer.playbackState.isPaused, false, 'Player should start not paused');
  assert.strictEqual(audioPlayer.playbackState.stopRequested, false, 'Player should start without stop request');
  console.log('✓ Initial player playbackState validated.');

  // 2. Volume Settings Check
  audioPlayer.setOutputVolume(80);
  assert.strictEqual(audioPlayer.volume, 80, 'Volume should be set to 80');
  console.log('✓ Player setOutputVolume validated.');

  // 3. Pause & Resume State Transitions
  audioPlayer.playbackState.isPlaying = true;
  audioPlayer.pause();
  assert.strictEqual(audioPlayer.playbackState.isPaused, true, 'Calling pause() should set isPaused to true');
  
  await audioPlayer.resume();
  assert.strictEqual(audioPlayer.playbackState.isPaused, false, 'Calling resume() should set isPaused to false');
  console.log('✓ Player pause / resume state machine transitions validated.');

  // 4. Stop Transition
  audioPlayer.stop();
  assert.strictEqual(audioPlayer.playbackState.isPlaying, false, 'Calling stop() should reset isPlaying');
  assert.strictEqual(audioPlayer.playbackState.isPaused, false, 'Calling stop() should reset isPaused');
  assert.strictEqual(audioPlayer.playbackState.stopRequested, true, 'Calling stop() should set stopRequested');
  console.log('✓ Player stop() reset and cleanup validated.');

  // 5. Config update
  audioPlayer.updateConfig({ wpm: 25, freq: 650, numberMode: 'short5', useHarmonics: true });
  assert.strictEqual(audioPlayer.playbackConfig.wpm, 25, 'WPM should be updated to 25');
  assert.strictEqual(audioPlayer.playbackConfig.freq, 650, 'Frequency should be updated to 650');
  assert.strictEqual(audioPlayer.playbackConfig.numberMode, 'short5', 'Number mode should be short5');
  assert.strictEqual(audioPlayer.playbackConfig.useHarmonics, true, 'useHarmonics should be true');
  console.log('✓ Player updateConfig parameters validated.');

  console.log('All Audio Player tests passed successfully!\n');
}

import assert from 'assert';
import radioInterference from '../src/utils/radioInterference.js';

export function testRadioInterferenceLogic() {
  console.log('--- Running Radio Interference Engine Unit Tests ---');

  // 1. Initial State Check
  assert.strictEqual(radioInterference.level, 0, 'Default interference level must be 0 (no interference)');
  assert.strictEqual(radioInterference.isPlaying, false, 'Default isPlaying must be false');
  assert.strictEqual(radioInterference.centerFreq, 600, 'Default center frequency should be 600Hz');
  assert.deepStrictEqual(radioInterference.modes, {
    noise: true,
    qsb: true,
    qrh: true,
    qrm: true
  }, 'Default modes should have noise, qsb, qrh, qrm all enabled');
  console.log('✓ Initial radio interference state and modes validated.');

  // 2. Level Setting & Boundary Clamping Check
  radioInterference.setLevel(35);
  assert.strictEqual(radioInterference.level, 35, 'Level should be set to 35');

  radioInterference.setLevel(-10);
  assert.strictEqual(radioInterference.level, 0, 'Negative levels should clamp to 0');

  radioInterference.setLevel(150);
  assert.strictEqual(radioInterference.level, 100, 'Levels > 100 should clamp to 100');

  radioInterference.setLevel(0);
  assert.strictEqual(radioInterference.level, 0, 'Level can be reset to 0');
  console.log('✓ Level clamping and reset validated.');

  // 3. Frequency Sync Check
  radioInterference.setFrequency(700);
  assert.strictEqual(radioInterference.centerFreq, 700, 'Frequency should update to 700Hz');

  radioInterference.setFrequency(50);
  assert.strictEqual(radioInterference.centerFreq, 100, 'Frequency < 100 should clamp to 100Hz');

  radioInterference.setFrequency(3000);
  assert.strictEqual(radioInterference.centerFreq, 2000, 'Frequency > 2000 should clamp to 2000Hz');
  console.log('✓ Frequency sync and limits validated.');

  // 4. Playback State Synchronization Check
  radioInterference.syncPlaybackState(true);
  assert.strictEqual(radioInterference.isPlaying, true, 'isPlaying should be true');

  radioInterference.syncPlaybackState(false);
  assert.strictEqual(radioInterference.isPlaying, false, 'isPlaying should be false');
  console.log('✓ Playback state sync validated.');

  // 5. Four Sub-modes (底噪, QSB, QRH, QRM) Toggle Check
  radioInterference.setModes({ qsb: false, qrh: false });
  assert.strictEqual(radioInterference.modes.qsb, false, 'QSB should be disabled');
  assert.strictEqual(radioInterference.modes.qrh, false, 'QRH should be disabled');
  assert.strictEqual(radioInterference.modes.noise, true, 'Noise should remain enabled');
  assert.strictEqual(radioInterference.modes.qrm, true, 'QRM should remain enabled');

  radioInterference.setModes({ qsb: true, qrh: true });
  assert.strictEqual(radioInterference.modes.qsb, true, 'QSB should be restored');
  assert.strictEqual(radioInterference.modes.qrh, true, 'QRH should be restored');
  console.log('✓ Radio Interference sub-modes (noise, qsb, qrh, qrm) validated.');

  // 6. QRM Context Text Snippet Extraction & Fallback Check
  radioInterference.setCurrentText('PARIS 12345 CQ DE BG4QGX');
  const snippet1 = radioInterference._getQrmTextSnippet();
  assert.ok(snippet1 && snippet1.length >= 2 && snippet1.length <= 4, 'Snippet should be between 2 and 4 characters');
  assert.ok(/^[A-Z0-9]+$/.test(snippet1), 'Snippet characters must be valid alphanumeric');

  // Test empty text fallback to classic callsigns/abbreviations
  radioInterference.setCurrentText('');
  const fallbackSnippet = radioInterference._getQrmTextSnippet();
  assert.ok(fallbackSnippet && fallbackSnippet.length >= 1, 'Fallback snippet should return valid abbreviation');
  console.log(`✓ QRM text snippet extraction validated (Sample snippet: '${snippet1}', Fallback: '${fallbackSnippet}')`);

  // Reset to clean state
  radioInterference.setLevel(0);
  radioInterference.syncPlaybackState(false);
  console.log('✓ Radio Interference Engine tests completed successfully.');
}

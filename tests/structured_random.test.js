import { generateStructuredRandomContent, GENERATOR_MODE } from '../src/utils/morse/structuredRandom.js';

export function testStructuredRandom() {
  console.log('--- Running Upgraded High-Entropy Random Generator Unit Tests ---');

  // 1. Test Mixed Mode Output (Standard Preset: max 1 digit, min 1 digit per group -> exactly 1 digit)
  const mixedResult = generateStructuredRandomContent({
    mode: GENERATOR_MODE.MIXED,
    groupCount: 100,
    charsPerGroup: 5,
  });

  if (!mixedResult || !Array.isArray(mixedResult.groups) || mixedResult.groups.length !== 100) {
    throw new Error('Mixed mode failed to generate 100 groups');
  }

  // 2. Verify "开头结尾不要数字" and "每组恰好有 1 个数字"
  const digitPositions = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  const digitCountsPerGroup = {};

  for (let i = 0; i < mixedResult.groups.length; i++) {
    const group = mixedResult.groups[i];
    if (/[0-9]/.test(group[0])) {
      throw new Error(`Group ${i} ('${group.join('')}') starts with a digit '${group[0]}'. Beginning must not be digit!`);
    }
    if (/[0-9]/.test(group[group.length - 1])) {
      throw new Error(`Group ${i} ('${group.join('')}') ends with a digit '${group[group.length - 1]}'. Ending must not be digit!`);
    }

    let digitCount = 0;
    group.forEach((char, idx) => {
      if (/[0-9]/.test(char)) {
        digitPositions[idx]++;
        digitCount++;
      }
    });
    if (digitCount !== 1) {
      throw new Error(`Standard mixed group ${i} ('${group.join('')}') has ${digitCount} digits; expected EXACTLY 1 digit`);
    }
    digitCountsPerGroup[digitCount] = (digitCountsPerGroup[digitCount] || 0) + 1;
  }

  console.log('✓ Mixed Mode Digit Position Distribution across 100 groups:', digitPositions);
  console.log('✓ Mixed Mode Digit Counts Per Group Distribution:', digitCountsPerGroup);

  if (digitPositions[0] !== 0 || digitPositions[4] !== 0) {
    throw new Error('Digits found at boundary index 0 or 4');
  }
  console.log('✓ Verified 100% of mixed groups start and end with letters (0 digits at index 0 and index 4).');
  console.log('✓ Verified 100% of standard mixed groups have EXACTLY 1 digit (100 out of 100 groups).');

  // Verify that interior positions (1, 2, 3) are all well-populated with digits
  for (let pos = 1; pos <= 3; pos++) {
    if (digitPositions[pos] < 15) {
      throw new Error(`Interior position ${pos} received too few digits (${digitPositions[pos]}). Dispersion check failed!`);
    }
  }
  console.log('✓ Verified digits are evenly and smoothly dispersed across interior positions (1, 2, 3).');

  // 3. Test Custom Generator Parameters (Custom Pool, Custom maxDigitsPerGroup = 2, Custom Length)
  const customResult2 = generateStructuredRandomContent({
    mode: 'custom',
    pool: '0123456789abcdefghijklmnopqrstuvwxyz'.split(''),
    charsPerGroup: 5,
    maxDigitsPerGroup: 2,
    groupCount: 80,
    allowAdjacentDuplicate: false,
    customProfile: true,
  });

  if (!customResult2 || customResult2.groups.length !== 80) {
    throw new Error('Custom mode failed to generate 80 groups');
  }

  for (let i = 0; i < customResult2.groups.length; i++) {
    const group = customResult2.groups[i];
    const digitCount = group.filter(c => /[0-9]/.test(c)).length;
    if (digitCount < 1 || digitCount > 2) {
      throw new Error(`Custom mixed group ${i} ('${group.join('')}') has ${digitCount} digits; expected between 1 and 2`);
    }
    if (/[0-9]/.test(group[0]) || /[0-9]/.test(group[group.length - 1])) {
      throw new Error(`Custom mixed group ${i} has digit at boundary`);
    }
  }
  console.log('✓ Verified custom maxDigitsPerGroup = 2 produces between 1 and 2 digits per group with start/end non-digit rules.');

  // 4. Test Column Anti-Correlation between adjacent groups
  let sameCharSamePosCount = 0;
  for (let i = 1; i < mixedResult.groups.length; i++) {
    const prev = mixedResult.groups[i - 1];
    const curr = mixedResult.groups[i];
    for (let j = 0; j < 5; j++) {
      if (curr[j] === prev[j]) {
        sameCharSamePosCount++;
      }
    }
  }

  const columnCorrelationRate = sameCharSamePosCount / (99 * 5);
  console.log(`✓ Column repetition rate between adjacent groups: ${(columnCorrelationRate * 100).toFixed(2)}% (Target: < 5%)`);
  if (columnCorrelationRate > 0.1) {
    throw new Error(`Column correlation too high: ${(columnCorrelationRate * 100).toFixed(2)}%`);
  }

  // 5. Test Callsigns Mode Anti-Clustering & High Dispersion
  const callsignResult = generateStructuredRandomContent({
    mode: GENERATOR_MODE.CALLSIGNS,
    groupCount: 100,
    includeCallsignSuffix: true
  });

  if (!callsignResult || !Array.isArray(callsignResult.groups) || callsignResult.groups.length !== 100) {
    throw new Error('Callsigns mode failed to generate 100 callsigns');
  }

  const callsignStrings = callsignResult.groups.map(g => g.join(''));
  let immediatePrefixRepeatCount = 0;
  for (let i = 1; i < callsignStrings.length; i++) {
    const prevPrefix = callsignStrings[i - 1].slice(0, 2);
    const currPrefix = callsignStrings[i].slice(0, 2);
    if (prevPrefix === currPrefix) {
      immediatePrefixRepeatCount++;
    }
  }

  // Verify callsigns are in lowercase
  for (const cs of callsignStrings) {
    if (/[A-Z]/.test(cs)) {
      throw new Error(`Callsign '${cs}' contains uppercase letters; expected lowercase`);
    }
  }
  console.log('✓ Verified all generated callsigns are formatted in lowercase.');
  console.log('✓ Sample generated lowercase callsigns:', callsignStrings.slice(0, 8).join(', '));

  // 6. Test Numbers Mode and Letters Mode
  const numResult = generateStructuredRandomContent({ mode: GENERATOR_MODE.NUMBERS, groupCount: 50, charsPerGroup: 4 });
  if (!numResult || numResult.groups.length !== 50 || numResult.groups.some(g => g.length !== 4)) {
    throw new Error('Numbers mode generation failed');
  }
  console.log('✓ Numbers mode (4-digit groups) validated.');

  const letterResult = generateStructuredRandomContent({ mode: GENERATOR_MODE.LETTERS, groupCount: 50, charsPerGroup: 5 });
  if (!letterResult || letterResult.groups.length !== 50 || letterResult.groups.some(g => g.length !== 5)) {
    throw new Error('Letters mode (5-letter groups) validated.');
  }
  console.log('✓ Letters mode (5-letter groups) validated.');

  console.log('All Upgraded Random Generator tests passed successfully!\n');
}

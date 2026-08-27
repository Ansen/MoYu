// translator.js
// Standard Morse Code mapping for 0-9
const digitToMorse = {
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
  '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
};

const charToMorse = {
  ...digitToMorse,
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..'
};

const morseToChar = Object.fromEntries(
  Object.entries(charToMorse).map(([k, v]) => [v, k])
);

// We will load the dictionary mapping externally (e.g. via fetch)
// and pass it to these functions.

const monthChars = '㋀㋁㋂㋃㋄㋅㋆㋇㋈㋉㋊㋋';
const dayChars = '㏠㏡㏢㏣㏤㏥㏦㏧㏨㏩㏪㏫㏬㏭㏮㏯㏰㏱㏲㏳㏴㏵㏶㏷㏸㏹㏺㏻㏼㏽㏾';
const hourChars = '㍘㍙㍚㍛㍜㍝㍞㍟㍠㍡㍢㍣㍤㍥㍦㍧㍨㍩㍪㍫㍬㍭㍮㍯㍰';

function normalizeShortcuts(text) {
  let result = text;
  result = result.replace(/([1-9]|1[0-2])月/g, (match, p1) => monthChars[parseInt(p1, 10) - 1]);
  result = result.replace(/([1-9]|[12]\d|3[01])日/g, (match, p1) => dayChars[parseInt(p1, 10) - 1]);
  result = result.replace(/(0|[1-9]|1\d|2[0-4])[点时]/g, (match, p1) => hourChars[parseInt(p1, 10)]);
  return result;
}

export function denormalizeShortcuts(text) {
  let result = text;
  for (let i = 0; i < monthChars.length; i++) {
    result = result.replace(new RegExp(monthChars[i], 'g'), `${i+1}月`);
  }
  for (let i = 0; i < dayChars.length; i++) {
    result = result.replace(new RegExp(dayChars[i], 'g'), `${i+1}日`);
  }
  for (let i = 0; i < hourChars.length; i++) {
    result = result.replace(new RegExp(hourChars[i], 'g'), `${i}时`);
  }
  return result;
}

export function chineseToCodes(text, charToCodeDict) {
  let codes = [];
  let currentWord = '';
  
  const normalizedText = normalizeShortcuts(text);

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    
    // Group ASCII alphanumeric characters together
    if (/^[0-9a-zA-Z]$/.test(char)) {
      currentWord += char.toUpperCase();
    } else {
      // Flush any accumulated alphanumeric characters
      if (currentWord) {
        codes.push(currentWord);
        currentWord = '';
      }
      
      // Look up Chinese character or special symbol
      if (charToCodeDict[char]) {
        codes.push(charToCodeDict[char]);
      } else if (char.trim() !== '') {
        // Unmapped character, push as is
        codes.push(char.toUpperCase());
      }
    }
  }
  
  // Flush remaining alphanumeric characters
  if (currentWord) {
    codes.push(currentWord);
  }
  
  return codes.join(' ');
}

export function chineseToCodesTokens(text, charToCodeDict) {
  let tokens = [];
  let currentWord = '';
  
  const normalizedText = normalizeShortcuts(text);

  for (let i = 0; i < normalizedText.length; i++) {
    const char = normalizedText[i];
    
    if (/^[0-9a-zA-Z]$/.test(char)) {
      currentWord += char;
    } else {
      if (currentWord) {
        tokens.push({ char: currentWord, code: currentWord.toUpperCase() });
        currentWord = '';
      }
      
      if (charToCodeDict[char]) {
        tokens.push({ char: denormalizeShortcuts(char), code: charToCodeDict[char] });
      } else if (char.trim() !== '') {
        tokens.push({ char: char, code: char.toUpperCase() });
      }
    }
  }
  
  if (currentWord) {
    tokens.push({ char: currentWord, code: currentWord.toUpperCase() });
  }
  
  return tokens;
}

export function codesToMorse(codesStr) {
  // codesStr is something like "0001 0002" or "0001 9901 0002" or "0001 H E L L O"
  if (!codesStr.trim()) return '';
  
  const groups = codesStr.trim().split(/\s+/);
  
  const morseGroups = groups.map(group => {
    // For each code group (like "0001" or "H") convert characters to morse
    let morseChars = [];
    for (let i = 0; i < group.length; i++) {
      const c = group[i].toUpperCase();
      if (charToMorse[c]) {
        morseChars.push(charToMorse[c]);
      } else {
        // If it's completely unsupported, just pass it through
        morseChars.push(c); 
      }
    }
    // Join morse characters of a single code group with a space
    return morseChars.join(' ');
  });
  
  // Join code groups with ' / '
  return morseGroups.join(' / ');
}

export function morseToCodes(morseStr) {
  if (!morseStr.trim()) return '';
  
  // Normalize double/triple spaces to '/' to act as word separators
  const normalizedMorse = morseStr.replace(/\s{2,}/g, ' / ');
  
  // morse groups separated by '/'
  const groups = normalizedMorse.split('/');
  
  const codeGroups = groups.map(g => {
    const chars = g.trim().split(/\s+/);
    let codeStr = '';
    for (let c of chars) {
      if (morseToChar[c]) {
        codeStr += morseToChar[c];
      } else if (c) {
        codeStr += c;
      }
    }
    return codeStr;
  });
  
  return codeGroups.filter(c => c).join(' ');
}

export function codesToChinese(codesStr, codeToCharDict) {
  if (!codesStr.trim()) return '';
  
  const groups = codesStr.trim().split(/\s+/);
  let result = '';
  
  for (let group of groups) {
    if (codeToCharDict[group]) {
      result += codeToCharDict[group];
    } else {
      result += group; // keep as is if not found, like English letters
    }
  }
  return denormalizeShortcuts(result);
}

// Auto detection helpers
export function isMainlyMorse(text) {
  // If string contains mostly dots, dashes, spaces and slashes
  const filtered = text.replace(/[.\-\s/]/g, '');
  return filtered.length < text.length * 0.2;
}

export function isMainlyCodes(text) {
  // If string contains mostly digits, A-Z and spaces
  // Since English can be typed in Codes input too now
  const filtered = text.replace(/[\d\w\s]/gi, '');
  return filtered.length < text.length * 0.2 && /\d/.test(text); 
}

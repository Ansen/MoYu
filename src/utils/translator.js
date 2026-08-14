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

export function chineseToCodes(text, charToCodeDict) {
  let codes = [];
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    // If it's in the dict, append its 4-digit code
    if (charToCodeDict[char]) {
      codes.push(charToCodeDict[char]);
    } else if (char.trim() !== '') {
      // Unmapped character (e.g., an English letter or unsupported punctuation)
      // Keep it as uppercase
      codes.push(char.toUpperCase());
    }
  }
  return codes.join(' ');
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
  return result;
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

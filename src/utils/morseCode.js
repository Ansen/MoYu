export const MORSE_DICT = {
  // Letters
  'A': '.-', 'B': '-...', 'C': '-.-.', 'D': '-..', 'E': '.', 'F': '..-.',
  'G': '--.', 'H': '....', 'I': '..', 'J': '.---', 'K': '-.-', 'L': '.-..',
  'M': '--', 'N': '-.', 'O': '---', 'P': '.--.', 'Q': '--.-', 'R': '.-.',
  'S': '...', 'T': '-', 'U': '..-', 'V': '...-', 'W': '.--', 'X': '-..-',
  'Y': '-.--', 'Z': '--..',
  
  // Punctuation
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--',
  '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...', ':': '---...',
  ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-',
  '"': '.-..-.', '$': '...-..-', '@': '.--.-.',
  
  // Prosighs (optional extensions for later)
  '<BT>': '-...-', '<SK>': '...-.-', '<AR>': '.-.-.', '<KN>': '-.--.'
};

const NUMBER_MODES = {
  long: {
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.'
  },
  short5: {
    '1': '.-', '2': '..-', '3': '...--', '4': '....-', '5': '.....',
    '6': '-....', '7': '--...', '8': '-..', '9': '-.', '0': '-'
  },
  short10: {
    '1': '.-', '2': '..-', '3': '.--', '4': '...-', '5': '...',
    '6': '-...', '7': '--.', '8': '-..', '9': '-.', '0': '-'
  }
};

/**
 * Convert a string to a sequence of Morse code tokens.
 * @param {string} text - The input text to convert.
 * @param {string} numberMode - 'long', 'short5', or 'short10'.
 * @returns {Array} Array of token objects: { char, code } (where code is string of dots and dashes, or null for spaces)
 */
export function textToMorseTokens(text, numberMode = 'long') {
  const tokens = [];
    
  for (let i = 0; i < text.length; i++) {
    let char = text[i].toUpperCase();
    if (char === '\u2018' || char === '\u2019') char = "'";
    if (char === '\u201C' || char === '\u201D') char = '"';
    
    // Spaces
    if (/\s/.test(char)) {
      // Collapse multiple spaces into one
      if (tokens.length > 0 && tokens[tokens.length - 1].code !== null) {
        tokens.push({ char: ' ', code: null, index: i });
      }
      continue;
    }
    
    let code = null;
    
    // Numbers
    if (/[0-9]/.test(char)) {
      const modeDict = NUMBER_MODES[numberMode] || NUMBER_MODES.long;
      code = modeDict[char];
    } 
    // Letters and Punctuation
    else if (MORSE_DICT[char]) {
      code = MORSE_DICT[char];
    }
    
    if (code !== null) {
      tokens.push({ char, code, index: i });
    }
  }
  
  return tokens;
}

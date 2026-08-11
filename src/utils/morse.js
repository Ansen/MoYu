// Complete Morse code mapping
export const MORSE_CODE_MAP = {
    // Numbers
    '0': '-----',
    '1': '.----',
    '2': '..---',
    '3': '...--',
    '4': '....-',
    '5': '.....',
    '6': '-....',
    '7': '--...',
    '8': '---..',
    '9': '----.',

    // Letters
    'A': '.-',
    'B': '-...',
    'C': '-.-.',
    'D': '-..',
    'E': '.',
    'F': '..-.',
    'G': '--.',
    'H': '....',
    'I': '..',
    'J': '.---',
    'K': '-.-',
    'L': '.-..',
    'M': '--',
    'N': '-.',
    'O': '---',
    'P': '.--.',
    'Q': '--.-',
    'R': '.-.',
    'S': '...',
    'T': '-',
    'U': '..-',
    'V': '...-',
    'W': '.--',
    'X': '-..-',
    'Y': '-.--',
    'Z': '--..',

    // Punctuation & Symbols
    '.': '.-.-.-',
    ',': '--..--',
    '?': '..--..',
    '/': '-..-.',
    '=': '-...-',
    '-': '-....-',
    '(': '-.--.',
    ')': '-.--.-',
    '@': '.--.-.',
    '!': '-.-.--',
    '&': '.-...',
    ':': '---...',
    ';': '-.-.-.',
    '+': '.-.-.',
    '\'': '.----.',
    '"': '.-..-.',
    '_': '..--.-',
}

/**
 * International Morse timing units.
 *
 * ITU-R 国际摩尔斯码的基础时序:
 * - 点: 1 unit
 * - 划: 3 units
 * - 字符内点划间隔: 1 unit
 * - 字符间隔: 3 units
 * - 词/分组间隔: 7 units
 *
 * PARIS 标准字长为 50 units, 所以 dot duration = 1200 / WPM ms。
 */
export const MORSE_TIMING_UNITS = Object.freeze({
    DOT: 1,
    DASH: 3,
    INTRA_CHARACTER_GAP: 1,
    CHARACTER_GAP: 3,
    WORD_GAP: 7,
    WORD_GAP_EXTRA_AFTER_CHARACTER_GAP: 4,
    PARIS_WORD: 50,
})

/**
 * Convert character to Morse code
 * @param {string} char - Character to convert
 * @returns {string|null} Morse code representation or null if not found
 */
export function charToMorse(char) {
    return MORSE_CODE_MAP[char.toUpperCase()] || null
}

/**
 * Calculate dot duration based on WPM
 * Standard: PARIS method (50 dot units = 1 word)
 * @param {number} wpm - Words per minute
 * @returns {number} Duration in milliseconds
 */
export function calculateDotDuration(wpm) {
    return 60000 / (wpm * MORSE_TIMING_UNITS.PARIS_WORD)
}

/**
 * Convert Morse code to timing array
 * @param {string} morse - Morse code string (dots and dashes)
 * @param {object} config - Configuration with dotDuration
 * @returns {array} Array of timing objects
 */
export function morseToTiming(morse, config) {
    const timings = []
    const { dotDuration } = config

    for (let i = 0; i < morse.length; i++) {
        if (morse[i] === '.') {
            timings.push({ type: 'tone', duration: dotDuration * MORSE_TIMING_UNITS.DOT })
        } else if (morse[i] === '-') {
            timings.push({ type: 'tone', duration: dotDuration * MORSE_TIMING_UNITS.DASH })
        }

        // Add intra-character gap (except after last symbol)
        if (i < morse.length - 1) {
            timings.push({ type: 'silence', duration: dotDuration * MORSE_TIMING_UNITS.INTRA_CHARACTER_GAP })
        }
    }

    return timings
}

export const GENERATOR_MODE = { 
    NUMBERS: 'numbers', 
    LETTERS: 'letters',
    MIXED: 'mixed',
    CALLSIGNS: 'callsigns',
    CUSTOM: 'custom'
};
import { charToMorse } from './morse.js'

export const STRUCTURED_RANDOM_GROUP_LENGTH = {
    [GENERATOR_MODE.NUMBERS]: 4,
    [GENERATOR_MODE.LETTERS]: 5,
    [GENERATOR_MODE.MIXED]: 5,
    [GENERATOR_MODE.CALLSIGNS]: 5,
}

const DIGIT_BASE_WEIGHTS = Object.freeze({
    '0': 0.944,
    '1': 0.917,
    '2': 0.942,
    '3': 1.083,
    '4': 1.053,
    '5': 1.003,
    '6': 1.069,
    '7': 1.083,
    '8': 0.944,
    '9': 0.961,
})

const LETTER_BASE_WEIGHTS = Object.freeze({
    a: 0.983,
    b: 1.056,
    c: 1.056,
    d: 1.009,
    e: 1.009,
    f: 0.931,
    g: 0.952,
    h: 1.051,
    i: 1.019,
    j: 0.988,
    k: 1.009,
    l: 1.025,
    m: 1.030,
    n: 0.863,
    o: 1.087,
    p: 1.035,
    q: 1.119,
    r: 1.009,
    s: 0.999,
    t: 0.884,
    u: 1.025,
    v: 1.019,
    w: 0.999,
    x: 0.884,
    y: 1.046,
    z: 0.915,
})

const MIXED_BASE_WEIGHTS = Object.freeze({
    ...DIGIT_BASE_WEIGHTS,
    ...LETTER_BASE_WEIGHTS
})

const STRUCTURED_RANDOM_PROFILES = Object.freeze({
    [GENERATOR_MODE.NUMBERS]: {
        pool: '0123456789'.split(''),
        baseWeights: DIGIT_BASE_WEIGHTS,
        charsPerGroup: 4,
        allowAdjacentDuplicate: false,
        repeatPenalty: 2.1,
        samePrefixPenalty: 0.55,
        targetDurationPerGroup: 55.5,
        targetDotCountPerGroup: 10.26,
        temperature: 0.8,
    },
    [GENERATOR_MODE.LETTERS]: {
        pool: 'abcdefghijklmnopqrstuvwxyz'.split(''),
        baseWeights: LETTER_BASE_WEIGHTS,
        charsPerGroup: 5,
        allowAdjacentDuplicate: true,
        repeatPenalty: 0.15,
        samePrefixPenalty: 0.2,
        targetDurationPerGroup: 41.4,
        targetDotCountPerGroup: 8.5,
        temperature: 1.05,
    },
    [GENERATOR_MODE.MIXED]: {
        pool: '0123456789abcdefghijklmnopqrstuvwxyz'.split(''),
        baseWeights: MIXED_BASE_WEIGHTS,
        charsPerGroup: 5,
        allowAdjacentDuplicate: false,
        repeatPenalty: 1.8,
        samePrefixPenalty: 0.5,
        targetDurationPerGroup: 48.0,
        targetDotCountPerGroup: 9.5,
        temperature: 1.25,
    },
})

const MORSE_METADATA_CACHE = new Map()

export function isStructuredRandomMode(mode) {
    return mode === GENERATOR_MODE.NUMBERS || mode === GENERATOR_MODE.LETTERS || mode === GENERATOR_MODE.MIXED || mode === GENERATOR_MODE.CALLSIGNS || mode === GENERATOR_MODE.CUSTOM
}

export function getStructuredGroupLength(mode, fallback = 4) {
    return STRUCTURED_RANDOM_GROUP_LENGTH[mode] || fallback
}

function shuffle(items, random = Math.random) {
    const out = [...items]
    for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        const tmp = out[i]
        out[i] = out[j]
        out[j] = tmp
    }
    return out
}

function getProfile(mode, config = {}) {
    if (mode === GENERATOR_MODE.CUSTOM || config.customProfile) {
        const pool = config.pool && config.pool.length > 0 ? config.pool : '0123456789abcdefghijklmnopqrstuvwxyz'.split('');
        const charsPerGroup = Number(config.charsPerGroup) || 4;
        const baseWeights = {};
        pool.forEach(ch => {
            baseWeights[ch] = DIGIT_BASE_WEIGHTS[ch] || LETTER_BASE_WEIGHTS[ch] || 1;
        });
        return {
            pool,
            baseWeights,
            charsPerGroup,
            allowAdjacentDuplicate: config.allowAdjacentDuplicate ?? false,
            repeatPenalty: 1.4,
            samePrefixPenalty: 0.45,
            targetDurationPerGroup: charsPerGroup * 11.5,
            targetDotCountPerGroup: charsPerGroup * 2.3,
            temperature: 0.95,
        };
    }
    return STRUCTURED_RANDOM_PROFILES[mode] || null
}

function getMorseMetadata(char) {
    const key = String(char || '').toUpperCase()
    if (MORSE_METADATA_CACHE.has(key)) {
        return MORSE_METADATA_CACHE.get(key)
    }

    const morse = charToMorse(key) || ''
    const dotCount = [...morse].filter(symbol => symbol === '.').length
    const dashCount = morse.length - dotCount
    const runMatches = morse.match(/\.+|-+/g) || []
    const durationUnits = [...morse].reduce((sum, symbol) => sum + (symbol === '.' ? 1 : 3), 0)
        + Math.max(0, morse.length - 1)
    const metadata = {
        char: key,
        morse,
        symbolCount: morse.length,
        dotCount,
        dashCount,
        durationUnits,
        startsWith: morse[0] || '',
        endsWith: morse[morse.length - 1] || '',
        runCount: runMatches.length,
        switchCount: Math.max(0, runMatches.length - 1),
        balance: dotCount - dashCount,
    }

    MORSE_METADATA_CACHE.set(key, metadata)
    return metadata
}

function buildWeights(profile, config) {
    const weights = new Map(
        profile.pool.map(char => [char, profile.baseWeights[char] || 1]),
    )
    const { enableTargetChars, targetChars, targetWeight = 3 } = config

    if (!enableTargetChars || typeof targetChars !== 'string' || targetWeight <= 1) {
        return weights
    }

    const poolSet = new Set(profile.pool)
    const uniqueTargets = new Set(targetChars.toLowerCase().split(''))
    for (const char of uniqueTargets) {
        if (!poolSet.has(char)) continue
        weights.set(char, (weights.get(char) || 1) * targetWeight)
    }

    return weights
}

function buildQuotaCounts(pool, totalChars, weights, random = Math.random, maxAllowedDigits = Infinity, minRequiredDigits = 0) {
    if (totalChars <= 0) {
        return new Map(pool.map(char => [char, 0]))
    }

    const totalWeight = pool.reduce((sum, char) => sum + (weights.get(char) || 1), 0)
    const quotas = pool.map(char => {
        const exact = totalChars * (weights.get(char) || 1) / totalWeight
        const count = Math.floor(exact)
        return {
            char,
            count,
            remainder: exact - count,
            isDigit: /[0-9]/.test(char),
        }
    })

    let assigned = quotas.reduce((sum, item) => sum + item.count, 0)
    const byRemainder = shuffle(quotas, random).sort((a, b) => b.remainder - a.remainder)
    for (let i = 0; assigned < totalChars; i++, assigned++) {
        byRemainder[i % byRemainder.length].count++
    }

    let currentTotalDigits = quotas.filter(q => q.isDigit).reduce((sum, q) => sum + q.count, 0)

    // 保障最小数字配额
    if (minRequiredDigits > 0 && currentTotalDigits < minRequiredDigits) {
        let deficit = minRequiredDigits - currentTotalDigits
        const nonDigitQuotas = quotas.filter(q => !q.isDigit && q.count > 0)
        const digitQuotas = quotas.filter(q => q.isDigit)
        let dIdx = 0
        while (deficit > 0 && nonDigitQuotas.length > 0 && digitQuotas.length > 0) {
            nonDigitQuotas.sort((a, b) => b.count - a.count)
            if (nonDigitQuotas[0].count > 0) {
                nonDigitQuotas[0].count--
                digitQuotas[dIdx % digitQuotas.length].count++
                dIdx++
                deficit--
            } else {
                break
            }
        }
    }

    currentTotalDigits = quotas.filter(q => q.isDigit).reduce((sum, q) => sum + q.count, 0)
    if (Number.isFinite(maxAllowedDigits) && currentTotalDigits > maxAllowedDigits) {
        let excessDigits = currentTotalDigits - maxAllowedDigits
        const digitQuotas = quotas.filter(q => q.isDigit && q.count > 0)
        while (excessDigits > 0 && digitQuotas.length > 0) {
            digitQuotas.sort((a, b) => b.count - a.count)
            digitQuotas[0].count--
            excessDigits--
        }

        const nonDigitQuotas = quotas.filter(q => !q.isDigit)
        if (nonDigitQuotas.length > 0) {
            let toDistribute = currentTotalDigits - maxAllowedDigits
            let idx = 0
            while (toDistribute > 0) {
                nonDigitQuotas[idx % nonDigitQuotas.length].count++
                idx++
                toDistribute--
            }
        }
    }

    return new Map(quotas.map(item => [item.char, item.count]))
}

function sumRemaining(counts) {
    let total = 0
    for (const value of counts.values()) {
        total += value
    }
    return total
}

function countOccurrences(items, target) {
    let count = 0
    for (const item of items) {
        if (item === target) count++
    }
    return count
}

function hasNonAdjacentAlternative(candidates, previousChar) {
    return candidates.some(char => char !== previousChar)
}

function listCandidates(counts, previousChar, allowAdjacentDuplicate, currentDigitCount = 0, maxDigitsPerGroup = null, isMixed = false, position = null, charsPerGroup = null, minDigitsPerGroup = 0, targetDigitSlots = null) {
    const candidates = []
    const isBoundary = isMixed && charsPerGroup >= 3 && (position === 0 || position === charsPerGroup - 1)
    
    // 如果指定了目标数字槽位
    const isTargetDigitSlot = Boolean(targetDigitSlots && targetDigitSlots.has(position))
    const isForbiddenDigitSlot = Boolean(targetDigitSlots && !targetDigitSlots.has(position))

    // 如果到了最后一个内部有效槽位，且仍无数字，则必须选数字以满足至少1个数字的下限
    const isInterior = position > 0 && position < charsPerGroup - 1
    const mustBeDigit = isTargetDigitSlot || (isMixed && charsPerGroup >= 3 && minDigitsPerGroup > 0 && isInterior &&
        currentDigitCount < minDigitsPerGroup && 
        ((charsPerGroup - 1 - position) <= (minDigitsPerGroup - currentDigitCount)))

    for (const [char, count] of counts.entries()) {
        if (count > 0) {
            // 混合组首尾两端严格不出数字
            if (isBoundary && /[0-9]/.test(char)) {
                continue
            }
            if (isForbiddenDigitSlot && /[0-9]/.test(char)) {
                continue
            }
            if (mustBeDigit && !/[0-9]/.test(char)) {
                continue
            }
            if (maxDigitsPerGroup !== null && maxDigitsPerGroup !== undefined && /[0-9]/.test(char) && currentDigitCount >= maxDigitsPerGroup) {
                continue
            }
            candidates.push(char)
        }
    }

    if (allowAdjacentDuplicate || !previousChar || !hasNonAdjacentAlternative(candidates, previousChar)) {
        return candidates
    }

    return candidates.filter(char => char !== previousChar)
}

function canCompleteGroup(prefix, counts, remainingSlots, profile, maxDigitsPerGroup = null, charsPerGroup = null, minDigitsPerGroup = 0, targetDigitSlots = null) {
    if (profile.allowAdjacentDuplicate) return true
    if (hasAdjacentDuplicate(prefix)) return false
    if (remainingSlots <= 0) {
        const totalDigits = prefix.filter(ch => /[0-9]/.test(ch)).length
        if (minDigitsPerGroup > 0 && totalDigits < minDigitsPerGroup) return false
        return true
    }

    const currentDigitCount = prefix.filter(ch => /[0-9]/.test(ch)).length
    if (maxDigitsPerGroup !== null && maxDigitsPerGroup !== undefined && currentDigitCount > maxDigitsPerGroup) {
        return false
    }

    const hasDigits = profile.pool.some(c => /[0-9]/.test(c))
    const hasLetters = profile.pool.some(c => /[a-z]/i.test(c))
    const isMixed = hasDigits && hasLetters
    const currentPosition = prefix.length
    const effectiveCharsPerGroup = charsPerGroup || (prefix.length + remainingSlots)

    if (minDigitsPerGroup > 0 && isMixed && effectiveCharsPerGroup >= 3) {
        const remainingInteriorSlots = Math.max(0, (effectiveCharsPerGroup - 1) - Math.max(1, currentPosition))
        const digitsNeeded = minDigitsPerGroup - currentDigitCount
        if (digitsNeeded > remainingInteriorSlots) {
            return false
        }
    }

    const previousChar = prefix[prefix.length - 1] || ''
    const candidates = listCandidates(counts, previousChar, profile.allowAdjacentDuplicate, currentDigitCount, maxDigitsPerGroup, isMixed, currentPosition, effectiveCharsPerGroup, minDigitsPerGroup, targetDigitSlots)
    for (const candidate of candidates) {
        const currentCount = counts.get(candidate) || 0
        if (currentCount <= 0) continue

        counts.set(candidate, currentCount - 1)
        if (canCompleteGroup([...prefix, candidate], counts, remainingSlots - 1, profile, maxDigitsPerGroup, effectiveCharsPerGroup, minDigitsPerGroup, targetDigitSlots)) {
            counts.set(candidate, currentCount)
            return true
        }
        counts.set(candidate, currentCount)
    }

    return false
}

function filterFeasibleCandidates(candidates, counts, groupChars, profile, charsPerGroup, maxDigitsPerGroup = null, minDigitsPerGroup = 0, targetDigitSlots = null) {
    if (profile.allowAdjacentDuplicate) {
        return candidates
    }

    const remainingSlots = charsPerGroup - groupChars.length - 1
    const feasible = candidates.filter(candidate => {
        const currentCount = counts.get(candidate) || 0
        if (currentCount <= 0) return false

        const nextCounts = new Map(counts)
        nextCounts.set(candidate, currentCount - 1)
        return canCompleteGroup([...groupChars, candidate], nextCounts, remainingSlots, profile, maxDigitsPerGroup, charsPerGroup, minDigitsPerGroup, targetDigitSlots)
    })

    if (feasible.length > 0) {
        return feasible
    }

    const hasDigits = profile.pool.some(c => /[0-9]/.test(c))
    const hasLetters = profile.pool.some(c => /[a-z]/i.test(c))
    const isMixed = hasDigits && hasLetters
    const position = groupChars.length
    const isBoundary = isMixed && charsPerGroup >= 3 && (position === 0 || position === charsPerGroup - 1)
    const isTargetDigitSlot = Boolean(targetDigitSlots && targetDigitSlots.has(position))
    const isForbiddenDigitSlot = Boolean(targetDigitSlots && !targetDigitSlots.has(position))

    const previousChar = groupChars[groupChars.length - 1] || ''
    const currentDigitCount = groupChars.filter(ch => /[0-9]/.test(ch)).length
    const reserveCounts = new Map(profile.pool.map(char => [char, charsPerGroup]))
    const emergencyCandidates = profile.pool
        .filter(candidate => profile.allowAdjacentDuplicate || candidate !== previousChar)
        .filter(candidate => {
            if (isBoundary && /[0-9]/.test(candidate)) {
                return false
            }
            if (isForbiddenDigitSlot && /[0-9]/.test(candidate)) {
                return false
            }
            if (isTargetDigitSlot && !/[0-9]/.test(candidate)) {
                return false
            }
            if (maxDigitsPerGroup !== null && maxDigitsPerGroup !== undefined && /[0-9]/.test(candidate) && currentDigitCount >= maxDigitsPerGroup) {
                return false
            }
            const nextCounts = new Map(reserveCounts)
            nextCounts.set(candidate, Math.max(0, (nextCounts.get(candidate) || 0) - 1))
            return canCompleteGroup([...groupChars, candidate], nextCounts, remainingSlots, profile, maxDigitsPerGroup, charsPerGroup, minDigitsPerGroup, targetDigitSlots)
        })

    return emergencyCandidates.length > 0 ? emergencyCandidates : candidates
}

function commonPrefixLength(chars, previousGroup) {
    if (!previousGroup) return 0
    let matched = 0
    while (matched < chars.length && matched < previousGroup.length && chars[matched] === previousGroup[matched]) {
        matched++
    }
    return matched
}

function wouldCreateSimpleSequence(group, candidate) {
    if (!/^[0-9]$/.test(candidate)) return false

    const values = [...group, candidate].map(char => Number(char))
    const length = values.length
    if (length < 2) return false

    const step = values[length - 1] - values[length - 2]
    if (Math.abs(step) === 1) {
        return true
    }

    if (length < 3) return false

    const prevStep = values[length - 2] - values[length - 3]
    return prevStep === step && Math.abs(step) <= 1
}

function wouldCreateMonotoneDurationRun(groupMetas, candidateMeta) {
    if (groupMetas.length < 2) return false
    const a = groupMetas[groupMetas.length - 2].durationUnits
    const b = groupMetas[groupMetas.length - 1].durationUnits
    const c = candidateMeta.durationUnits

    return (a < b && b < c) || (a > b && b > c)
}

function maxRepeatedCount(chars, candidate) {
    const counts = new Map()
    for (const char of [...chars, candidate]) {
        counts.set(char, (counts.get(char) || 0) + 1)
    }

    let maxCount = 0
    for (const count of counts.values()) {
        maxCount = Math.max(maxCount, count)
    }
    return maxCount
}

function hasAdjacentDuplicate(chars) {
    for (let i = 1; i < chars.length; i++) {
        if (chars[i] === chars[i - 1]) return true
    }
    return false
}

function uniquePermutations(chars) {
    const counts = new Map()
    for (const char of chars) {
        counts.set(char, (counts.get(char) || 0) + 1)
    }

    const results = []
    const path = []
    const pool = [...counts.keys()].sort()

    function backtrack() {
        if (path.length === chars.length) {
            results.push([...path])
            return
        }

        for (const char of pool) {
            const remaining = counts.get(char) || 0
            if (remaining <= 0) continue
            counts.set(char, remaining - 1)
            path.push(char)
            backtrack()
            path.pop()
            counts.set(char, remaining)
        }
    }

    backtrack()
    return results
}

function scoreGroupPermutation(chars, previousGroup, profile) {
    const metas = chars.map(char => getMorseMetadata(char))
    let score = 0

    const hasLetters = chars.some(c => /[a-z]/i.test(c))
    const hasDigits = chars.some(c => /[0-9]/.test(c))
    const isMixed = hasLetters && hasDigits && chars.length >= 3

    // 混合组首尾两端严格不出数字
    if (isMixed) {
        if (/[0-9]/.test(chars[0])) score -= 1000
        if (/[0-9]/.test(chars[chars.length - 1])) score -= 1000
    }

    // Anti-column correlation with previous group (避免相邻组同位置出现相同字符或同为数字)
    if (previousGroup) {
        chars.forEach((c, idx) => {
            if (previousGroup[idx] === c) score -= 8.0
            if (/[0-9]/.test(c) && /[0-9]/.test(previousGroup[idx])) score -= 2.5
        })
    }

    for (let i = 1; i < metas.length; i++) {
        const prev = metas[i - 1]
        const current = metas[i]
        score += Math.abs(current.dotCount - prev.dotCount) * 0.5
        score += Math.abs(current.durationUnits - prev.durationUnits) * 0.05
        if (chars[i] === chars[i - 1]) score -= 10
    }

    const totalDots = metas.reduce((sum, meta) => sum + meta.dotCount, 0)
    const totalDuration = metas.reduce((sum, meta) => sum + meta.durationUnits, 0)
    const distinctStarts = new Set(metas.map(meta => meta.startsWith)).size
    const distinctDots = new Set(metas.map(meta => meta.dotCount)).size

    score -= Math.abs(totalDots - profile.targetDotCountPerGroup) * 0.05
    score -= Math.abs(totalDuration - profile.targetDurationPerGroup) * 0.03
    if (distinctStarts === 1) score -= 0.5
    if (distinctDots <= 2) score -= 0.4

    if (previousGroup && previousGroup === chars.join('')) {
        score -= 100
    }

    return score
}

function normalizeGroupOrder(group, previousGroup, profile, random = Math.random, minDigitsPerGroup = 0) {
    if (!group || group.length <= 1) return group

    const hasLetters = group.some(c => /[a-z]/i.test(c))
    const hasDigits = group.some(c => /[0-9]/.test(c))
    const isMixed = hasLetters && hasDigits && group.length >= 3
    const digitCount = group.filter(c => /[0-9]/.test(c)).length

    const hasBadDigitPlacement = isMixed && (
        /[0-9]/.test(group[0]) || 
        /[0-9]/.test(group[group.length - 1]) ||
        (minDigitsPerGroup > 0 && digitCount < minDigitsPerGroup)
    )

    if (!hasAdjacentDuplicate(group) && (!previousGroup || group.join('') !== previousGroup) && !hasBadDigitPlacement) {
        return group
    }

    const permutations = uniquePermutations(group)
        .filter(candidate => !hasAdjacentDuplicate(candidate))
        .filter(candidate => !isMixed || (!/[0-9]/.test(candidate[0]) && !/[0-9]/.test(candidate[candidate.length - 1])))
        .filter(candidate => !previousGroup || candidate.join('') !== previousGroup)

    if (permutations.length === 0) {
        return group
    }

    const scored = permutations.map(candidate => ({
        candidate,
        score: scoreGroupPermutation(candidate, previousGroup, profile) + (random() - 0.5) * 0.05,
    }))
    scored.sort((a, b) => b.score - a.score)
    return scored[0].candidate
}

function scoreSharedCandidate({
    profile,
    candidate,
    counts,
    remainingTotal,
    groupChars,
    previousGroup,
    position,
    charsPerGroup,
}) {
    const candidateMeta = getMorseMetadata(candidate)
    const previousChar = groupChars[groupChars.length - 1] || ''
    const previousMeta = previousChar ? getMorseMetadata(previousChar) : null
    const groupMetas = groupChars.map(char => getMorseMetadata(char))
    const repeatedCount = countOccurrences(groupChars, candidate)
    const prefixLength = commonPrefixLength(groupChars, previousGroup)
    const exactPrefixMatch = Boolean(previousGroup)
        && prefixLength === position
        && previousGroup[position] === candidate

    let score = ((counts.get(candidate) || 0) / Math.max(1, remainingTotal)) * 6

    if (previousMeta) {
        const durationDelta = Math.abs(candidateMeta.durationUnits - previousMeta.durationUnits)
        score += Math.min(durationDelta, 10) * 0.08
    }

    if (repeatedCount > 0) {
        score -= repeatedCount * profile.repeatPenalty
    }

    if (exactPrefixMatch) {
        score -= profile.samePrefixPenalty * (position + 1)
        if (position === charsPerGroup - 1) {
            score -= 100
        }
    }

    return {
        score,
        candidateMeta,
        groupMetas,
        previousMeta,
    }
}

function scoreNumberCandidate(context) {
    const {
        profile,
        candidate,
        candidateMeta,
        groupChars,
        groupMetas,
        previousMeta,
        position,
        charsPerGroup,
        previousGroup,
    } = context

    let score = context.score

    if (previousMeta) {
        const dotDelta = Math.abs(candidateMeta.dotCount - previousMeta.dotCount)
        const durationDelta = Math.abs(candidateMeta.durationUnits - previousMeta.durationUnits)

        score += dotDelta * 0.9
        score += Math.min(durationDelta, 8) * 0.12

        if (candidateMeta.startsWith === previousMeta.startsWith) score -= 0.55
        if (candidateMeta.endsWith === previousMeta.endsWith) score -= 0.2
        if (dotDelta === 0) score -= 0.7
    }

    if (groupMetas.some(meta => meta.dotCount === candidateMeta.dotCount)) score -= 0.45
    else score += 0.45

    if (groupMetas.some(meta => meta.durationUnits === candidateMeta.durationUnits)) score -= 0.25

    if (groupMetas.some(meta => meta.startsWith === candidateMeta.startsWith)) score -= 0.08

    if (wouldCreateSimpleSequence(groupChars, candidate)) score -= 1.4
    if (wouldCreateMonotoneDurationRun(groupMetas, candidateMeta)) score -= 0.85

    const dotTotal = groupMetas.reduce((sum, meta) => sum + meta.dotCount, 0) + candidateMeta.dotCount
    const expectedDotTotal = profile.targetDotCountPerGroup * ((position + 1) / charsPerGroup)
    score -= Math.abs(dotTotal - expectedDotTotal) * 0.08

    if (position === charsPerGroup - 1) {
        const finalMetas = [...groupMetas, candidateMeta]
        const totalDuration = finalMetas.reduce((sum, meta) => sum + meta.durationUnits, 0)
        const distinctStarts = new Set(finalMetas.map(meta => meta.startsWith)).size
        const distinctDots = new Set(finalMetas.map(meta => meta.dotCount)).size

        score -= Math.abs(totalDuration - profile.targetDurationPerGroup) * 0.05
        if (distinctStarts === 1) score -= 0.9
        if (distinctDots <= 2) score -= 0.7

        if (previousGroup && previousGroup === [...groupChars, candidate].join('')) {
            score -= 100
        }
    }

    return score
}

function scoreLetterCandidate(context) {
    const {
        profile,
        candidate,
        candidateMeta,
        groupChars,
        groupMetas,
        previousMeta,
        position,
        charsPerGroup,
        previousGroup,
    } = context

    let score = context.score

    if (previousMeta) {
        if (candidate === groupChars[groupChars.length - 1]) score -= 0.35
        if (candidateMeta.startsWith === previousMeta.startsWith) score -= 0.12
        if (candidateMeta.endsWith === previousMeta.endsWith) score -= 0.05

        const dotDelta = Math.abs(candidateMeta.dotCount - previousMeta.dotCount)
        const durationDelta = Math.abs(candidateMeta.durationUnits - previousMeta.durationUnits)
        score += Math.min(dotDelta, 3) * 0.18
        score += Math.min(durationDelta, 6) * 0.05
    }

    const nextMaxRepeat = maxRepeatedCount(groupChars, candidate)
    if (nextMaxRepeat >= 3) score -= 0.9
    else if (nextMaxRepeat === 2) score -= 0.05

    if (position === charsPerGroup - 1) {
        const finalMetas = [...groupMetas, candidateMeta]
        const totalDuration = finalMetas.reduce((sum, meta) => sum + meta.durationUnits, 0)
        const durationPenalty = Math.abs(totalDuration - profile.targetDurationPerGroup) * 0.03

        score -= durationPenalty
        if (previousGroup && previousGroup === [...groupChars, candidate].join('')) {
            score -= 100
        }
    }

    return score
}

function scoreMixedCandidate(context) {
    const {
        profile,
        candidate,
        candidateMeta,
        groupChars,
        groupMetas,
        previousMeta,
        position,
        charsPerGroup,
        previousGroup,
        recentDigits = [],
        recentStartLetters = [],
        recentEndLetters = [],
        recentDigitPositions = [],
    } = context

    let score = context.score

    // 0. Boundary rule: 混合组首尾两端严格不出数字
    if (charsPerGroup >= 3 && /[0-9]/.test(candidate)) {
        if (position === 0 || position === charsPerGroup - 1) {
            return -9999 // 首尾绝不出数字
        }
    }

    // 1. Cross-group digit anti-clustering (强力排斥近期组使用过的数字，促使0-9十个数字全域大范围轮换)
    if (/[0-9]/.test(candidate)) {
        if (recentDigits.slice(-1).includes(candidate)) {
            score -= 8.0 // 严禁上一组刚刚用过的相同数字
        } else if (recentDigits.slice(-3).includes(candidate)) {
            score -= 4.0 // 强力抑制近3组用过的数字
        } else if (recentDigits.slice(-6).includes(candidate)) {
            score -= 1.8 // 适度抑制近6组用过的数字
        }

        // 槽位跳跃：如果上一组数字在第 k 位，本组强烈排斥在同一位放置数字，强制跳跃到其他槽位
        if (recentDigitPositions.slice(-1).includes(position)) {
            score -= 4.0
        } else if (recentDigitPositions.slice(-2).includes(position)) {
            score -= 2.0
        }

        // 内部槽位（1, 2, 3）等概率均分补偿（使数字在第1位、第2位、第3位的出现频次严格呈 1:1:1 完美均等）
        if (charsPerGroup >= 3 && !groupChars.some(c => /[0-9]/.test(c))) {
            if (position === 1) {
                score += 0.85
            } else if (position === 2) {
                score += 1.45
            }
        }
    }

    // 2. Cross-group letter anti-clustering (首尾字母防聚集)
    if (position === 0 && recentStartLetters.slice(-2).includes(candidate)) {
        score -= 3.5
    }
    if (position === charsPerGroup - 1 && recentEndLetters.slice(-2).includes(candidate)) {
        score -= 3.5
    }

    // 3. Cross-group anti-column character repetition (避免相邻组同一列出现相同字符)
    if (previousGroup && previousGroup[position]) {
        const prevChar = previousGroup[position]
        if (candidate === prevChar) {
            score -= 4.5 // 强烈惩罚相邻组同一列出现完全相同的字符
        }
        if (/[0-9]/.test(candidate) && /[0-9]/.test(prevChar)) {
            score -= 3.0 // 强烈惩罚连续在同一列出现数字
        }
    }

    // 4. In-group character repetition penalty (组内防重复字符)
    if (groupChars.includes(candidate)) {
        score -= profile.repeatPenalty * 2.0
    }

    // 5. Morse code rhythm transition (电报节拍与点划过渡平滑度)
    if (previousMeta) {
        const dotDelta = Math.abs(candidateMeta.dotCount - previousMeta.dotCount)
        const durationDelta = Math.abs(candidateMeta.durationUnits - previousMeta.durationUnits)

        score += dotDelta * 0.3
        score += Math.min(durationDelta, 8) * 0.04

        if (candidateMeta.startsWith === previousMeta.startsWith) score -= 0.15
        if (candidateMeta.endsWith === previousMeta.endsWith) score -= 0.08
        if (candidate === groupChars[groupChars.length - 1]) score -= 2.0
    }

    if (groupMetas.some(meta => meta.dotCount === candidateMeta.dotCount)) score -= 0.1
    if (wouldCreateMonotoneDurationRun(groupMetas, candidateMeta)) score -= 0.3

    if (position === charsPerGroup - 1) {
        if (previousGroup && previousGroup === [...groupChars, candidate].join('')) {
            score -= 100
        }
    }

    return score
}

function scoreCandidate(context) {
    const shared = scoreSharedCandidate(context)
    if (context.profile === STRUCTURED_RANDOM_PROFILES[GENERATOR_MODE.NUMBERS]) {
        return scoreNumberCandidate({ ...context, ...shared })
    }
    const hasDigits = context.profile?.pool?.some(c => /[0-9]/.test(c))
    const hasLetters = context.profile?.pool?.some(c => /[a-z]/i.test(c))
    if (context.profile === STRUCTURED_RANDOM_PROFILES[GENERATOR_MODE.MIXED] || (hasDigits && hasLetters)) {
        return scoreMixedCandidate({ ...context, ...shared })
    }
    return scoreLetterCandidate({ ...context, ...shared })
}

function pickCandidate(scoredCandidates, temperature, random = Math.random) {
    if (scoredCandidates.length === 1) {
        return scoredCandidates[0].char
    }

    const maxScore = scoredCandidates.reduce((max, item) => Math.max(max, item.score), -Infinity)
    const weighted = scoredCandidates.map(item => ({
        ...item,
        weight: Math.exp((item.score - maxScore) / temperature),
    }))
    const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0)

    if (totalWeight <= 0 || !Number.isFinite(totalWeight)) {
        return weighted.sort((a, b) => b.score - a.score)[0].char
    }

    let threshold = random() * totalWeight
    for (const item of weighted) {
        threshold -= item.weight
        if (threshold <= 0) {
            return item.char
        }
    }

    return weighted[weighted.length - 1].char
}

function buildGroup({
    profile,
    counts,
    charsPerGroup,
    previousGroup,
    random = Math.random,
    maxDigitsPerGroup = null,
    minDigitsPerGroup = 0,
    recentDigits = [],
    recentStartLetters = [],
    recentEndLetters = [],
    recentDigitPositions = [],
}) {
    const groupChars = []
    const hasDigits = profile.pool.some(c => /[0-9]/.test(c))
    const hasLetters = profile.pool.some(c => /[a-z]/i.test(c))
    const isMixed = hasDigits && hasLetters

    // 为混合组精确分配目标数字槽位，实现列间绝对跳跃和槽位均分
    let targetDigitSlots = null
    if (isMixed && charsPerGroup >= 3 && minDigitsPerGroup > 0) {
        const interiorSlots = []
        for (let s = 1; s < charsPerGroup - 1; s++) {
            interiorSlots.push(s)
        }
        if (maxDigitsPerGroup === 1) {
            let possibleSlots = interiorSlots.filter(s => !recentDigitPositions.slice(-1).includes(s))
            if (possibleSlots.length === 0) possibleSlots = interiorSlots
            const chosenSlot = possibleSlots[Math.floor(random() * possibleSlots.length)]
            targetDigitSlots = new Set([chosenSlot])
        } else if (maxDigitsPerGroup > 1) {
            const numDigits = Math.min(maxDigitsPerGroup, interiorSlots.length)
            const shuffledSlots = shuffle([...interiorSlots], random)
            targetDigitSlots = new Set(shuffledSlots.slice(0, numDigits))
        }
    }

    for (let position = 0; position < charsPerGroup; position++) {
        const previousChar = groupChars[groupChars.length - 1] || ''
        const currentDigitCount = groupChars.filter(ch => /[0-9]/.test(ch)).length
        const candidates = filterFeasibleCandidates(
            listCandidates(counts, previousChar, profile.allowAdjacentDuplicate, currentDigitCount, maxDigitsPerGroup, isMixed, position, charsPerGroup, minDigitsPerGroup, targetDigitSlots),
            counts,
            groupChars,
            profile,
            charsPerGroup,
            maxDigitsPerGroup,
            minDigitsPerGroup,
            targetDigitSlots,
        )
        if (candidates.length === 0) break

        const remainingTotal = sumRemaining(counts)
        const scoredCandidates = candidates.map(candidate => ({
            char: candidate,
            score: scoreCandidate({
                profile,
                candidate,
                counts,
                remainingTotal,
                groupChars,
                previousGroup,
                position,
                charsPerGroup,
                recentDigits,
                recentStartLetters,
                recentEndLetters,
                recentDigitPositions,
            }),
        }))

        const picked = pickCandidate(scoredCandidates, profile.temperature, random)
        groupChars.push(picked)
        counts.set(picked, Math.max(0, (counts.get(picked) || 0) - 1))
    }

    return normalizeGroupOrder(groupChars, previousGroup, profile, random, minDigitsPerGroup)
}

function repairRepeatedGroup(group, previousGroup, counts, profile, random = Math.random, maxDigitsPerGroup = null, minDigitsPerGroup = 0, recentDigits = [], recentStartLetters = [], recentEndLetters = [], recentDigitPositions = []) {
    if (!previousGroup || group.join('') !== previousGroup || group.length === 0) {
        return group
    }

    const hasDigits = profile.pool.some(c => /[0-9]/.test(c))
    const hasLetters = profile.pool.some(c => /[a-z]/i.test(c))
    const isMixed = hasDigits && hasLetters

    const repaired = [...group]
    for (let index = repaired.length - 1; index >= 0; index--) {
        const current = repaired[index]
        counts.set(current, (counts.get(current) || 0) + 1)

        const prefix = repaired.slice(0, index)
        const suffix = repaired.slice(index + 1)
        const otherDigits = prefix.filter(c => /[0-9]/.test(c)).length + suffix.filter(c => /[0-9]/.test(c)).length
        const previousChar = prefix[prefix.length - 1] || ''
        const candidates = listCandidates(counts, previousChar, profile.allowAdjacentDuplicate, otherDigits, maxDigitsPerGroup, isMixed, index, repaired.length, minDigitsPerGroup)
            .filter(candidate => candidate !== current)
        if (candidates.length > 0) {
            const scoredCandidates = candidates.map(candidate => ({
                char: candidate,
                score: scoreCandidate({
                    profile,
                    candidate,
                    counts,
                    remainingTotal: sumRemaining(counts),
                    groupChars: prefix,
                    previousGroup,
                    position: index,
                    charsPerGroup: repaired.length,
                    recentDigits,
                    recentStartLetters,
                    recentEndLetters,
                    recentDigitPositions,
                }),
            }))

            const picked = pickCandidate(scoredCandidates, profile.temperature, random)
            repaired[index] = picked
            counts.set(picked, Math.max(0, (counts.get(picked) || 0) - 1))
            return repaired
        }

        counts.set(current, Math.max(0, (counts.get(current) || 0) - 1))
    }

    return repaired
}

// ITU RR Art 19.68 Forbidden Suffixes (Q-codes QRA-QUZ & Distress signals SOS, XXX, TTT)
const FORBIDDEN_SUFFIXES = new Set([
    'SOS', 'XXX', 'TTT',
    'QRA', 'QRB', 'QRC', 'QRD', 'QRE', 'QRF', 'QRG', 'QRH', 'QRI', 'QRJ', 'QRK', 'QRL', 'QRM', 'QRN', 'QRO', 'QRP', 'QRQ', 'QRR', 'QRS', 'QRT', 'QRU', 'QRV', 'QRW', 'QRX', 'QRY', 'QRZ',
    'QSA', 'QSB', 'QSC', 'QSD', 'QSE', 'QSF', 'QSG', 'QSH', 'QSI', 'QSJ', 'QSK', 'QSL', 'QSM', 'QSN', 'QSO', 'QSP', 'QSQ', 'QSR', 'QSS', 'QST', 'QSU', 'QSV', 'QSW', 'QSX', 'QSY', 'QSZ',
    'QTA', 'QTB', 'QTC', 'QTD', 'QTE', 'QTF', 'QTG', 'QTH', 'QTI', 'QTJ', 'QTK', 'QTL', 'QTM', 'QTN', 'QTO', 'QTP', 'QTQ', 'QTR', 'QTS', 'QTT', 'QTU', 'QTV', 'QTW', 'QTX', 'QTY', 'QTZ',
    'QUA', 'QUB', 'QUC', 'QUD', 'QUE', 'QUF', 'QUG', 'QUH', 'QUI', 'QUJ', 'QUK', 'QUL', 'QUM', 'QUN', 'QUO', 'QUP', 'QUQ', 'QUR', 'QUS', 'QUT', 'QUU', 'QUV', 'QUW', 'QUX', 'QUY', 'QUZ'
])

const CALLSIGN_PREFIX_WEIGHTED = [
    // China (CRAC Allocations) ~35%
    { prefix: 'BG', weight: 12, needDigit: true },
    { prefix: 'BH', weight: 10, needDigit: true },
    { prefix: 'BD', weight: 5,  needDigit: true },
    { prefix: 'BA', weight: 3,  needDigit: true },
    { prefix: 'BY', weight: 3,  needDigit: true },
    { prefix: 'BI', weight: 1,  needDigit: true },
    { prefix: 'VR2', weight: 2, needDigit: false },
    { prefix: 'XX9', weight: 1, needDigit: false },

    // USA (FCC Part 97 Allocations) ~25%
    { prefix: 'W', weight: 5,  needDigit: true },
    { prefix: 'K', weight: 5,  needDigit: true },
    { prefix: 'N', weight: 4,  needDigit: true },
    { prefix: 'AA', weight: 1, needDigit: true },
    { prefix: 'AB', weight: 1, needDigit: true },
    { prefix: 'AC', weight: 1, needDigit: true },
    { prefix: 'AD', weight: 1, needDigit: true },
    { prefix: 'AF', weight: 1, needDigit: true },
    { prefix: 'AG', weight: 1, needDigit: true },
    { prefix: 'WA', weight: 2, needDigit: true },
    { prefix: 'WB', weight: 2, needDigit: true },
    { prefix: 'KA', weight: 2, needDigit: true },
    { prefix: 'KB', weight: 2, needDigit: true },
    { prefix: 'KC', weight: 2, needDigit: true },
    { prefix: 'KD', weight: 2, needDigit: true },
    { prefix: 'KE', weight: 1, needDigit: true },
    { prefix: 'KF', weight: 1, needDigit: true },
    { prefix: 'KG', weight: 1, needDigit: true },
    { prefix: 'KI', weight: 1, needDigit: true },
    { prefix: 'KJ', weight: 1, needDigit: true },
    { prefix: 'KK', weight: 1, needDigit: true },
    { prefix: 'KL', weight: 1, needDigit: true },
    { prefix: 'KM', weight: 1, needDigit: true },
    { prefix: 'KN', weight: 1, needDigit: true },
    { prefix: 'KO', weight: 1, needDigit: true },
    { prefix: 'KP', weight: 1, needDigit: true },
    { prefix: 'KQ', weight: 1, needDigit: true },
    { prefix: 'KR', weight: 1, needDigit: true },
    { prefix: 'KS', weight: 1, needDigit: true },
    { prefix: 'KT', weight: 1, needDigit: true },
    { prefix: 'KU', weight: 1, needDigit: true },
    { prefix: 'KV', weight: 1, needDigit: true },
    { prefix: 'KW', weight: 1, needDigit: true },
    { prefix: 'KX', weight: 1, needDigit: true },
    { prefix: 'KY', weight: 1, needDigit: true },
    { prefix: 'KZ', weight: 1, needDigit: true },

    // Japan (JARL Allocations) ~15%
    { prefix: 'JA', weight: 4, needDigit: true },
    { prefix: 'JH', weight: 2, needDigit: true },
    { prefix: 'JR', weight: 2, needDigit: true },
    { prefix: 'JE', weight: 1, needDigit: true },
    { prefix: 'JF', weight: 1, needDigit: true },
    { prefix: 'JG', weight: 1, needDigit: true },
    { prefix: 'JI', weight: 1, needDigit: true },
    { prefix: 'JJ', weight: 1, needDigit: true },
    { prefix: 'JK', weight: 1, needDigit: true },
    { prefix: 'JL', weight: 1, needDigit: true },
    { prefix: 'JM', weight: 1, needDigit: true },
    { prefix: 'JN', weight: 1, needDigit: true },
    { prefix: 'JO', weight: 1, needDigit: true },
    { prefix: 'JP', weight: 1, needDigit: true },
    { prefix: 'JQ', weight: 1, needDigit: true },
    { prefix: 'JS', weight: 1, needDigit: true },
    { prefix: '7K', weight: 1, needDigit: true },
    { prefix: '7L', weight: 1, needDigit: true },
    { prefix: '7M', weight: 1, needDigit: true },
    { prefix: '7N', weight: 1, needDigit: true },

    // Europe & Global DX ~25%
    { prefix: 'DL', weight: 3, needDigit: true },
    { prefix: 'DK', weight: 2, needDigit: true },
    { prefix: 'DF', weight: 2, needDigit: true },
    { prefix: 'DG', weight: 1, needDigit: true },
    { prefix: 'DH', weight: 1, needDigit: true },
    { prefix: 'DO', weight: 1, needDigit: true },
    { prefix: 'G',  weight: 3, needDigit: true },
    { prefix: 'M',  weight: 2, needDigit: true },
    { prefix: '2E', weight: 1, needDigit: true },
    { prefix: 'F',  weight: 2, needDigit: true },
    { prefix: 'I',  weight: 2, needDigit: true },
    { prefix: 'IK', weight: 1, needDigit: true },
    { prefix: 'IZ', weight: 1, needDigit: true },
    { prefix: 'EA', weight: 2, needDigit: true },
    { prefix: 'EB', weight: 1, needDigit: true },
    { prefix: 'OH', weight: 1, needDigit: true },
    { prefix: 'SM', weight: 1, needDigit: true },
    { prefix: 'SP', weight: 1, needDigit: true },
    { prefix: 'OK', weight: 1, needDigit: true },
    { prefix: 'OM', weight: 1, needDigit: true },
    { prefix: 'HA', weight: 1, needDigit: true },
    { prefix: 'YO', weight: 1, needDigit: true },
    { prefix: 'LZ', weight: 1, needDigit: true },
    { prefix: 'SV', weight: 1, needDigit: true },
    { prefix: 'OE', weight: 1, needDigit: true },
    { prefix: 'S5', weight: 1, needDigit: true },
    { prefix: '9A', weight: 1, needDigit: true },
    { prefix: 'HB9', weight: 1, needDigit: false },
    { prefix: '4X', weight: 1, needDigit: true },
    { prefix: '4Z', weight: 1, needDigit: true },
    { prefix: '9V1', weight: 1, needDigit: false },
    { prefix: '9M2', weight: 1, needDigit: false },
    { prefix: 'VK', weight: 2, needDigit: true },
    { prefix: 'ZL', weight: 1, needDigit: true },
    { prefix: 'PY', weight: 2, needDigit: true },
    { prefix: 'LU', weight: 1, needDigit: true },
    { prefix: 'VE', weight: 2, needDigit: true },
    { prefix: 'VA', weight: 1, needDigit: true },
    { prefix: 'RA', weight: 2, needDigit: true },
    { prefix: 'RU', weight: 2, needDigit: true },
    { prefix: 'RX', weight: 2, needDigit: true },
    { prefix: 'UA', weight: 2, needDigit: true },
]

const TOTAL_PREFIX_WEIGHT = CALLSIGN_PREFIX_WEIGHTED.reduce((sum, item) => sum + item.weight, 0)

const PORTABLE_SUFFIX_POOL = [
    '/1', '/2', '/3', '/4', '/5', '/6', '/7', '/8', '/9', '/0',
    '/P', '/P', '/P', '/M', '/M', '/QRP', '/MM', '/AM'
]

function generateValidSuffix(suffixLen, random = Math.random) {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    for (let attempt = 0; attempt < 30; attempt++) {
        let suf = ''
        for (let i = 0; i < suffixLen; i++) {
            suf += letters[Math.floor(random() * letters.length)]
        }
        if (!FORBIDDEN_SUFFIXES.has(suf)) {
            return suf
        }
    }
    return 'ABC'
}

function generateSingleCallsign(includeSuffix = false, random = Math.random) {
    let r = random() * TOTAL_PREFIX_WEIGHT
    let item = CALLSIGN_PREFIX_WEIGHTED[0]
    for (const p of CALLSIGN_PREFIX_WEIGHTED) {
        if (r < p.weight) {
            item = p
            break
        }
        r -= p.weight
    }

    const prefix = item.prefix
    let digitStr = ''

    if (item.needDigit && !/[0-9]$/.test(prefix)) {
        if (prefix.startsWith('B')) {
            digitStr = random() < 0.95 ? String(1 + Math.floor(random() * 9)) : '0'
        } else {
            digitStr = String(Math.floor(random() * 10))
        }
    }

    const roll = random()
    const suffixLen = roll < 0.65 ? 3 : (roll < 0.90 ? 2 : 1)
    const suffix = generateValidSuffix(suffixLen, random)

    let callsign = `${prefix}${digitStr}${suffix}`

    if (includeSuffix && random() < 0.20) {
        const pSuffix = PORTABLE_SUFFIX_POOL[Math.floor(random() * PORTABLE_SUFFIX_POOL.length)]
        callsign += pSuffix
    }

    return callsign
}

export function generateCallsignsContent(config = {}, options = {}) {
    const { groupCount = 100, includeCallsignSuffix = false } = config;
    const random = options.random || Math.random;
    const groups = [];
    const allChars = [];

    // History trackers for anti-clustering & dispersion
    const recentPrefixes = [];
    let lastDigit = null;
    let lastSuffixInitial = '';
    let lastCallsign = '';

    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

    for (let i = 0; i < groupCount; i++) {
        let callsign = '';
        let chosenPrefixItem = null;
        let chosenDigit = '';
        let chosenSuffix = '';

        // Attempt generation with anti-clustering filter
        for (let attempt = 0; attempt < 50; attempt++) {
            // 1. Pick a prefix with anti-repeat weighting (强力抑制连续出现相同国家/前缀)
            let totalWeight = 0;
            const weightedCandidates = CALLSIGN_PREFIX_WEIGHTED.map(p => {
                let w = p.weight;
                if (recentPrefixes.slice(-2).includes(p.prefix)) {
                    w *= 0.05; // 最近2个呼号用过的前缀降低95%权重
                } else if (recentPrefixes.slice(-4).includes(p.prefix)) {
                    w *= 0.3;  // 最近4个呼号用过的前缀降低70%权重
                }
                totalWeight += w;
                return { item: p, weight: w };
            });

            let r = random() * totalWeight;
            chosenPrefixItem = weightedCandidates[0].item;
            for (const cand of weightedCandidates) {
                if (r < cand.weight) {
                    chosenPrefixItem = cand.item;
                    break;
                }
                r -= cand.weight;
            }

            const prefix = chosenPrefixItem.prefix;

            // 2. Pick a zone digit with anti-repeating lastDigit (避免连续呼号同分区号)
            if (chosenPrefixItem.needDigit && !/[0-9]$/.test(prefix)) {
                const possibleDigits = prefix.startsWith('B')
                    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
                    : ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
                
                const filteredDigits = possibleDigits.filter(d => d !== lastDigit);
                chosenDigit = (filteredDigits.length > 0)
                    ? filteredDigits[Math.floor(random() * filteredDigits.length)]
                    : possibleDigits[Math.floor(random() * possibleDigits.length)];
            } else {
                chosenDigit = '';
            }

            // 3. Generate a distinct, valid suffix (后缀字母去重复、长度多样化)
            const roll = random();
            const suffixLen = roll < 0.60 ? 3 : (roll < 0.90 ? 2 : 1);
            
            let suf = '';
            for (let sIdx = 0; sIdx < suffixLen; sIdx++) {
                const prevChar = suf[suf.length - 1] || '';
                let candLetters = letters.filter(c => c !== prevChar);
                if (sIdx === 0 && lastSuffixInitial) {
                    candLetters = candLetters.filter(c => c !== lastSuffixInitial);
                }
                if (candLetters.length === 0) candLetters = letters;
                suf += candLetters[Math.floor(random() * candLetters.length)];
            }

            if (FORBIDDEN_SUFFIXES.has(suf)) continue;

            chosenSuffix = suf;
            callsign = `${prefix}${chosenDigit}${chosenSuffix}`;

            if (includeCallsignSuffix && random() < 0.20) {
                const pSuffix = PORTABLE_SUFFIX_POOL[Math.floor(random() * PORTABLE_SUFFIX_POOL.length)];
                callsign += pSuffix;
            }

            if (callsign !== lastCallsign) {
                break;
            }
        }

        // Update tracking history
        recentPrefixes.push(chosenPrefixItem.prefix);
        if (recentPrefixes.length > 6) recentPrefixes.shift();
        lastDigit = chosenDigit;
        lastSuffixInitial = chosenSuffix[0] || '';
        const finalCallsign = callsign.toLowerCase();
        lastCallsign = finalCallsign;

        const chars = finalCallsign.split('');
        groups.push(chars);
        allChars.push(...chars);
    }

    return {
        groups,
        allChars,
        totalChars: allChars.length
    };
}

/**
 * Generate book-style Morse practice groups.
 */
export function generateStructuredRandomContent(config, options = {}) {
    const { mode = GENERATOR_MODE.NUMBERS, groupCount = 100 } = config
    if (!isStructuredRandomMode(mode)) return null

    if (mode === GENERATOR_MODE.CALLSIGNS) {
        return generateCallsignsContent(config, options);
    }

    const profile = getProfile(mode, config)
    if (!profile) return null

    const random = options.random || Math.random
    const charsPerGroup = Number(config.charsPerGroup) || getStructuredGroupLength(mode, profile.charsPerGroup)

    const hasDigits = profile.pool.some(c => /[0-9]/.test(c))
    const hasLetters = profile.pool.some(c => /[a-z]/i.test(c))
    const isMixed = hasDigits && hasLetters

    let maxDigitsPerGroup = null
    let minDigitsPerGroup = 0
    if (config.maxDigitsPerGroup !== undefined && config.maxDigitsPerGroup !== null) {
        maxDigitsPerGroup = Math.max(1, Math.min(Math.max(1, charsPerGroup - 2), Number(config.maxDigitsPerGroup)))
        minDigitsPerGroup = isMixed && charsPerGroup >= 3 ? 1 : 0
    } else if (mode === GENERATOR_MODE.MIXED || isMixed) {
        maxDigitsPerGroup = 1
        minDigitsPerGroup = charsPerGroup >= 3 ? 1 : 0
    }

    const totalChars = Math.max(0, groupCount) * charsPerGroup
    const maxAllowedDigits = (maxDigitsPerGroup !== null) ? groupCount * maxDigitsPerGroup : Infinity
    const minRequiredDigits = (minDigitsPerGroup > 0) ? groupCount * minDigitsPerGroup : 0
    const counts = buildQuotaCounts(profile.pool, totalChars, buildWeights(profile, config), random, maxAllowedDigits, minRequiredDigits)
    const groups = []
    const allChars = []
    let previousGroup = ''

    const recentDigits = []
    const recentStartLetters = []
    const recentEndLetters = []
    const recentDigitPositions = []

    for (let i = 0; i < groupCount; i++) {
        const group = buildGroup({
            profile,
            counts,
            charsPerGroup,
            previousGroup,
            random,
            maxDigitsPerGroup,
            minDigitsPerGroup,
            recentDigits,
            recentStartLetters,
            recentEndLetters,
            recentDigitPositions,
        })
        const repaired = repairRepeatedGroup(
            group,
            previousGroup,
            counts,
            profile,
            random,
            maxDigitsPerGroup,
            minDigitsPerGroup,
            recentDigits,
            recentStartLetters,
            recentEndLetters,
            recentDigitPositions,
        )
        groups.push(repaired)
        allChars.push(...repaired)
        previousGroup = repaired.join('')

        // 更新滑动历史窗口
        const groupDigits = repaired.filter(c => /[0-9]/.test(c))
        if (groupDigits.length > 0) {
            recentDigits.push(...groupDigits)
            if (recentDigits.length > 8) recentDigits.splice(0, recentDigits.length - 8)
        }
        repaired.forEach((c, idx) => {
            if (/[0-9]/.test(c)) {
                recentDigitPositions.push(idx)
                if (recentDigitPositions.length > 4) recentDigitPositions.shift()
            }
        })
        if (repaired.length > 0) {
            recentStartLetters.push(repaired[0])
            if (recentStartLetters.length > 4) recentStartLetters.shift()
            recentEndLetters.push(repaired[repaired.length - 1])
            if (recentEndLetters.length > 4) recentEndLetters.shift()
        }
    }

    return {
        groups,
        allChars,
        totalChars: allChars.length,
    }
}

export function generatePracticeText(modeOrConfig) {
  let config = {};
  if (typeof modeOrConfig === 'string') {
    config = { mode: modeOrConfig, groupCount: 100 };
  } else if (modeOrConfig && typeof modeOrConfig === 'object') {
    config = { ...modeOrConfig, groupCount: modeOrConfig.groupCount || 100 };
  } else {
    config = { mode: GENERATOR_MODE.NUMBERS, groupCount: 100 };
  }
  const result = generateStructuredRandomContent(config);
  if (!result || !result.groups) return '';
  const text = result.groups.map(g => g.join('')).join(' ');
  return `=== ${text} iii`;
}

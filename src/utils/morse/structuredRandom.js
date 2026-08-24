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
        repeatPenalty: 1.6,
        samePrefixPenalty: 0.45,
        targetDurationPerGroup: 55.0,
        targetDotCountPerGroup: 10.5,
        temperature: 0.95,
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

function buildQuotaCounts(pool, totalChars, weights, random = Math.random, maxAllowedDigits = Infinity) {
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

    if (Number.isFinite(maxAllowedDigits)) {
        let currentTotalDigits = quotas.filter(q => q.isDigit).reduce((sum, q) => sum + q.count, 0)
        if (currentTotalDigits > maxAllowedDigits) {
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

function listCandidates(counts, previousChar, allowAdjacentDuplicate, currentDigitCount = 0, maxDigitsPerGroup = null) {
    const candidates = []
    for (const [char, count] of counts.entries()) {
        if (count > 0) {
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

function canCompleteGroup(prefix, counts, remainingSlots, profile, maxDigitsPerGroup = null) {
    if (profile.allowAdjacentDuplicate) return true
    if (hasAdjacentDuplicate(prefix)) return false
    if (remainingSlots <= 0) return true

    const currentDigitCount = prefix.filter(ch => /[0-9]/.test(ch)).length
    if (maxDigitsPerGroup !== null && maxDigitsPerGroup !== undefined && currentDigitCount > maxDigitsPerGroup) {
        return false
    }

    const previousChar = prefix[prefix.length - 1] || ''
    const candidates = listCandidates(counts, previousChar, profile.allowAdjacentDuplicate, currentDigitCount, maxDigitsPerGroup)
    for (const candidate of candidates) {
        const currentCount = counts.get(candidate) || 0
        if (currentCount <= 0) continue

        counts.set(candidate, currentCount - 1)
        if (canCompleteGroup([...prefix, candidate], counts, remainingSlots - 1, profile, maxDigitsPerGroup)) {
            counts.set(candidate, currentCount)
            return true
        }
        counts.set(candidate, currentCount)
    }

    return false
}

function filterFeasibleCandidates(candidates, counts, groupChars, profile, charsPerGroup, maxDigitsPerGroup = null) {
    if (profile.allowAdjacentDuplicate) {
        return candidates
    }

    const remainingSlots = charsPerGroup - groupChars.length - 1
    const feasible = candidates.filter(candidate => {
        const currentCount = counts.get(candidate) || 0
        if (currentCount <= 0) return false

        const nextCounts = new Map(counts)
        nextCounts.set(candidate, currentCount - 1)
        return canCompleteGroup([...groupChars, candidate], nextCounts, remainingSlots, profile, maxDigitsPerGroup)
    })

    if (feasible.length > 0) {
        return feasible
    }

    const previousChar = groupChars[groupChars.length - 1] || ''
    const currentDigitCount = groupChars.filter(ch => /[0-9]/.test(ch)).length
    const reserveCounts = new Map(profile.pool.map(char => [char, charsPerGroup]))
    const emergencyCandidates = profile.pool
        .filter(candidate => profile.allowAdjacentDuplicate || candidate !== previousChar)
        .filter(candidate => {
            if (maxDigitsPerGroup !== null && maxDigitsPerGroup !== undefined && /[0-9]/.test(candidate) && currentDigitCount >= maxDigitsPerGroup) {
                return false
            }
            const nextCounts = new Map(reserveCounts)
            nextCounts.set(candidate, Math.max(0, (nextCounts.get(candidate) || 0) - 1))
            return canCompleteGroup([...groupChars, candidate], nextCounts, remainingSlots, profile, maxDigitsPerGroup)
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
    if (hasLetters) {
        if (/[0-9]/.test(chars[0])) score -= 3.5
        if (/[0-9]/.test(chars[chars.length - 1])) score -= 3.5
    }

    for (let i = 1; i < metas.length; i++) {
        const prev = metas[i - 1]
        const current = metas[i]
        score += Math.abs(current.dotCount - prev.dotCount) * 0.7
        score += Math.abs(current.durationUnits - prev.durationUnits) * 0.08
        if (chars[i] === chars[i - 1]) score -= 10
    }

    const totalDots = metas.reduce((sum, meta) => sum + meta.dotCount, 0)
    const totalDuration = metas.reduce((sum, meta) => sum + meta.durationUnits, 0)
    const distinctStarts = new Set(metas.map(meta => meta.startsWith)).size
    const distinctDots = new Set(metas.map(meta => meta.dotCount)).size

    score -= Math.abs(totalDots - profile.targetDotCountPerGroup) * 0.08
    score -= Math.abs(totalDuration - profile.targetDurationPerGroup) * 0.05
    if (distinctStarts === 1) score -= 0.9
    if (distinctDots <= 2) score -= 0.7

    if (previousGroup && previousGroup === chars.join('')) {
        score -= 100
    }

    return score
}

function normalizeGroupOrder(group, previousGroup, profile, random = Math.random) {
    if (!group || group.length <= 1) return group
    if (!hasAdjacentDuplicate(group) && (!previousGroup || group.join('') !== previousGroup)) {
        return group
    }

    const permutations = uniquePermutations(group)
        .filter(candidate => !hasAdjacentDuplicate(candidate))
        .filter(candidate => !previousGroup || candidate.join('') !== previousGroup)

    if (permutations.length === 0) {
        return group
    }

    const scored = permutations.map(candidate => ({
        candidate,
        score: scoreGroupPermutation(candidate, previousGroup, profile) + (random() - 0.5) * 0.01,
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
    } = context

    let score = context.score

    if (/[0-9]/.test(candidate)) {
        if (position === 0 || position === charsPerGroup - 1) {
            score -= 3.5
        } else {
            score += 2.5
        }
    }

    if (previousMeta) {
        const dotDelta = Math.abs(candidateMeta.dotCount - previousMeta.dotCount)
        const durationDelta = Math.abs(candidateMeta.durationUnits - previousMeta.durationUnits)

        score += dotDelta * 0.6
        score += Math.min(durationDelta, 8) * 0.08

        if (candidateMeta.startsWith === previousMeta.startsWith) score -= 0.35
        if (candidateMeta.endsWith === previousMeta.endsWith) score -= 0.15
        if (candidate === groupChars[groupChars.length - 1]) score -= 1.0
    }

    if (groupMetas.some(meta => meta.dotCount === candidateMeta.dotCount)) score -= 0.3
    if (wouldCreateMonotoneDurationRun(groupMetas, candidateMeta)) score -= 0.6

    if (position === charsPerGroup - 1) {
        const finalMetas = [...groupMetas, candidateMeta]
        const totalDuration = finalMetas.reduce((sum, meta) => sum + meta.durationUnits, 0)
        score -= Math.abs(totalDuration - profile.targetDurationPerGroup) * 0.04

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
    if (context.profile === STRUCTURED_RANDOM_PROFILES[GENERATOR_MODE.MIXED] || context.profile?.charsPerGroup === 4) {
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
}) {
    const groupChars = []

    for (let position = 0; position < charsPerGroup; position++) {
        const previousChar = groupChars[groupChars.length - 1] || ''
        const currentDigitCount = groupChars.filter(ch => /[0-9]/.test(ch)).length
        const candidates = filterFeasibleCandidates(
            listCandidates(counts, previousChar, profile.allowAdjacentDuplicate, currentDigitCount, maxDigitsPerGroup),
            counts,
            groupChars,
            profile,
            charsPerGroup,
            maxDigitsPerGroup,
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
            }),
        }))

        const picked = pickCandidate(scoredCandidates, profile.temperature, random)
        groupChars.push(picked)
        counts.set(picked, Math.max(0, (counts.get(picked) || 0) - 1))
    }

    return normalizeGroupOrder(groupChars, previousGroup, profile, random)
}

function repairRepeatedGroup(group, previousGroup, counts, profile, random = Math.random, maxDigitsPerGroup = null) {
    if (!previousGroup || group.join('') !== previousGroup || group.length === 0) {
        return group
    }

    const repaired = [...group]
    for (let index = repaired.length - 1; index >= 0; index--) {
        const current = repaired[index]
        counts.set(current, (counts.get(current) || 0) + 1)

        const prefix = repaired.slice(0, index)
        const suffix = repaired.slice(index + 1)
        const otherDigits = prefix.filter(c => /[0-9]/.test(c)).length + suffix.filter(c => /[0-9]/.test(c)).length
        const previousChar = prefix[prefix.length - 1] || ''
        const candidates = listCandidates(counts, previousChar, profile.allowAdjacentDuplicate, otherDigits, maxDigitsPerGroup)
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

    for (let i = 0; i < groupCount; i++) {
        const cs = generateSingleCallsign(includeCallsignSuffix, random);
        const chars = cs.split('');
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

    let maxDigitsPerGroup = null
    if (config.maxDigitsPerGroup !== undefined && config.maxDigitsPerGroup !== null) {
        maxDigitsPerGroup = Math.max(1, Math.min(charsPerGroup - 1, Number(config.maxDigitsPerGroup)))
    } else if (mode === GENERATOR_MODE.MIXED || (config.pool && config.pool.some(c => /[0-9]/.test(c)) && config.pool.some(c => /[a-z]/i.test(c)))) {
        maxDigitsPerGroup = Math.max(1, Math.min(charsPerGroup - 1, 1))
    }

    const totalChars = Math.max(0, groupCount) * charsPerGroup
    const maxAllowedDigits = (maxDigitsPerGroup !== null) ? groupCount * maxDigitsPerGroup : Infinity
    const counts = buildQuotaCounts(profile.pool, totalChars, buildWeights(profile, config), random, maxAllowedDigits)
    const groups = []
    const allChars = []
    let previousGroup = ''

    for (let i = 0; i < groupCount; i++) {
        const group = buildGroup({
            profile,
            counts,
            charsPerGroup,
            previousGroup,
            random,
            maxDigitsPerGroup,
        })
        const repaired = repairRepeatedGroup(group, previousGroup, counts, profile, random, maxDigitsPerGroup)
        groups.push(repaired)
        allChars.push(...repaired)
        previousGroup = repaired.join('')
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

/**
 * Morse 音频相关配置集中入口。
 *
 * 这里放“跨页面共享”的音频默认值、可调范围和底层输出参数。
 * 页面/组件应从这里派生设置范围，避免配置页、播放页和音频引擎各自硬编码。
 */
export const MORSE_AUDIO_CONFIG = {
    // 播放速度，单位 WPM。
    WPM: {
        MIN: 8,
        MAX: 40,
        DEFAULT: 20,
        STEP: 1,
    },

    // Farnsworth 字符间距速度，单位 WPM。
    // 最大值通常由当前播放 WPM 约束，调用侧仍需按实际 wpm 做二次限制。
    FARNSWORTH: {
        MIN: 5,
        DEFAULT: 10,
    },

    // 侧音频率，单位 Hz。
    // 默认 400Hz：低频侧音听感更舒适；默认音量保持保守以降低共振风险。
    FREQUENCY: {
        MIN: 200,
        MAX: 900,
        DEFAULT: 400,
        STEP: 10,
    },

    // 用户可调音量，单位百分比。
    // 100% 以上只会继续数字放大并增加削顶/扬声器失真风险。
    VOLUME: {
        MIN: 0,
        MAX: 100,
        DEFAULT: 100,
        STEP: 5,
    },

    // 底层侧音输出参数。
    // TONE_VOLUME 是固定基础振幅，最终输出还会乘以用户音量百分比。
    OUTPUT: {
        TONE_VOLUME: 1,
        // 保留约 0.45 dBFS 数字峰值余量，同时释放高音量档位的输出空间。
        SAFE_PEAK_CEILING: 0.95,
    },
}

/**
 * 将任意输入限制到指定 range 内。
 * range 需要包含 MIN / MAX，并可选 DEFAULT；非法输入会回退到 DEFAULT 或 MIN。
 */
export function clampMorseAudioValue(value, range) {
    const fallback = range.DEFAULT ?? range.MIN
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return fallback
    return Math.max(range.MIN, Math.min(range.MAX, numeric))
}

/**
 * 规范化存储、分享或 URL 传入的音频设置。
 *
 * 主要用于兼容旧数据：例如旧版本可能保存过 1000Hz 侧音，
 * 当前加载时会被收敛到 FREQUENCY.MAX。
 */
export function normalizeMorseAudioSettings(settings = {}) {
    const normalized = { ...settings }
    delete normalized.toneClarity
    delete normalized.atmosphericNoise

    return {
        ...normalized,
        wpm: clampMorseAudioValue(settings.wpm, MORSE_AUDIO_CONFIG.WPM),
        frequency: clampMorseAudioValue(settings.frequency, MORSE_AUDIO_CONFIG.FREQUENCY),
        volume: clampMorseAudioValue(settings.volume, MORSE_AUDIO_CONFIG.VOLUME),
    }
}

export default MORSE_AUDIO_CONFIG

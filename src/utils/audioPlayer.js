import { MORSE_AUDIO_CONFIG } from '../config/morseAudio'
import { textToMorseTokens } from './morseCode'

const TONE_VOLUME = MORSE_AUDIO_CONFIG.OUTPUT.TONE_VOLUME
const TONE_FADE_SECONDS = 0.002
const STOP_FADE_SECONDS = 0.012

/**
 * 桌面端原生 Web Audio 播放器 (Tauri WebView 完美支持)
 * 完全移除了原小程序为了兼容 iOS 和微信内核所做的所有 Hack (如静音保活、WAV Base64 预渲染等)，
 * 直接采用性能最高的 OscillatorNode 实时生成正弦波。
 */
class DesktopAudioPlayer {
    constructor() {
        this.audioContext = null
        this.masterGain = null
        this.volume = MORSE_AUDIO_CONFIG.VOLUME.DEFAULT
        this.currentNodes = []
        this.cleanupTimers = new Set()
        this.playbackState = {
            isPlaying: false,
            isPaused: false,
            stopRequested: false,
        }
    }

    async init() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
            this.masterGain = this.audioContext.createGain()
            this.masterGain.connect(this.audioContext.destination)
            this.setOutputVolume(this.volume)
            console.log('Desktop Web Audio API 初始化成功')
        }

        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume()
        }
    }

    setOutputVolume(volumePercent) {
        this.volume = volumePercent
        if (!this.masterGain || !this.audioContext) return
        
        // 将 0-100 的百分比映射到合适的 gain 值
        const gain = Math.min((volumePercent / 100), 1)
        const now = this.audioContext.currentTime
        this.masterGain.gain.setTargetAtTime(gain, now, 0.01)
    }

    async playTone(frequency, durationMs, startTime) {
        if (!this.audioContext) await this.init()

        const oscillator = this.audioContext.createOscillator()
        const gainNode = this.audioContext.createGain()
        
        const start = startTime || this.audioContext.currentTime
        const durationSec = durationMs / 1000

        // 使用包含谐波的自定义波形来代替纯正弦波，这能极大增加人耳感知的响度（RMS能量），并带来无线电的质感
        if (this.playbackConfig && this.playbackConfig.useHarmonics) {
            if (!this.customWave) {
                // 极大地减弱了谐波比例，使其不至于改变音高听感，仅增加一点点厚度
                const real = new Float32Array([0, 1, 0.1, 0.05, 0]);
                const imag = new Float32Array([0, 0, 0, 0, 0]);
                this.customWave = this.audioContext.createPeriodicWave(real, imag);
            }
            oscillator.setPeriodicWave(this.customWave);
        } else {
            oscillator.type = 'sine';
        }

        oscillator.frequency.value = frequency

        oscillator.connect(gainNode)
        gainNode.connect(this.masterGain)

        // 包络线处理：避免爆音 (Clicking noise)
        const fadeTime = Math.min(TONE_FADE_SECONDS, durationSec * 0.2)
        gainNode.gain.setValueAtTime(0, start)
        gainNode.gain.linearRampToValueAtTime(TONE_VOLUME, start + fadeTime)
        gainNode.gain.setValueAtTime(TONE_VOLUME, start + durationSec - fadeTime)
        gainNode.gain.linearRampToValueAtTime(0, start + durationSec)

        oscillator.start(start)
        oscillator.stop(start + durationSec)

        const endTime = start + durationSec
        this.currentNodes.push({ oscillator, gainNode, startTime: start, endTime })

        // 定时自动清理垃圾节点
        const timerId = setTimeout(() => {
            oscillator.disconnect()
            gainNode.disconnect()
            this.currentNodes = this.currentNodes.filter(n => n.oscillator !== oscillator)
            this.cleanupTimers.delete(timerId)
        }, (start - this.audioContext.currentTime) * 1000 + durationMs + 100)
        
        this.cleanupTimers.add(timerId)
    }

    updateConfig(config) {
        if (!this.playbackConfig) return;
        this.playbackConfig = { ...this.playbackConfig, ...config };
    }

    /**
     * @param {string} text 
     * @param {Object} options 
     */
    async playMorseText(text, { wpm = 20, freq = 700, numberMode = 'long', startIndex = 0, onCharPlay, onComplete }) {
        if (!this.audioContext) await this.init()
        
        this.playbackState.isPlaying = true
        this.playbackState.isPaused = false
        this.playbackState.stopRequested = false

        this.playbackConfig = { wpm, freq, numberMode };

        let tokens = textToMorseTokens(text, this.playbackConfig.numberMode)
        let dotSec = (1200 / this.playbackConfig.wpm) / 1000

        let currentTime = this.audioContext.currentTime + 0.1 // 100ms padding to start

        for (let i = 0; i < tokens.length; i++) {
            if (this.playbackState.stopRequested) break;

            if (this.playbackConfig) {
                dotSec = (1200 / this.playbackConfig.wpm) / 1000;
                freq = this.playbackConfig.freq;
                if (this.playbackConfig.numberMode !== numberMode) {
                    numberMode = this.playbackConfig.numberMode;
                    tokens = textToMorseTokens(text, numberMode);
                }
            }

            const token = tokens[i];
            if (token.index < startIndex) continue;
            
            // Wait for pause
            while (this.playbackState.isPaused && !this.playbackState.stopRequested) {
                await new Promise(r => setTimeout(r, 100));
                // Shift currentTime forward so we don't schedule in the past
                currentTime = this.audioContext.currentTime + 0.1; 
            }
            if (this.playbackState.stopRequested) break;

            // Trigger UI callback
            const waitMs = (currentTime - this.audioContext.currentTime) * 1000;
            if (waitMs > 0 && onCharPlay) {
                const timerId = setTimeout(() => {
                    if (!this.playbackState.stopRequested) onCharPlay(token, i);
                    this.cleanupTimers.delete(timerId);
                }, waitMs);
                this.cleanupTimers.add(timerId);
            } else if (onCharPlay) {
                onCharPlay(token, i);
            }

            if (token.code === null) {
                // Word space (7 dots total, but char gap is 3, so we add 4 dots of silence)
                currentTime += 4 * dotSec;
            } else {
                // Play each symbol
                const symbols = token.code.split('');
                for (let j = 0; j < symbols.length; j++) {
                    const sym = symbols[j];
                    const durSec = sym === '-' ? 3 * dotSec : 1 * dotSec;
                    
                    this.playTone(freq, durSec * 1000, currentTime);
                    currentTime += durSec;
                    
                    // Element gap (1 dot)
                    if (j < symbols.length - 1) {
                        currentTime += 1 * dotSec;
                    }
                }
                // Char gap (3 dots total, so add 3 dots after character)
                currentTime += 3 * dotSec;
            }
            
            // Throttle the loop so we don't schedule too far ahead and can respond to pause/stop quickly
            // We want to stay about 200ms ahead of the audio context
            let interruptedDuringSound = false;
            while (currentTime - this.audioContext.currentTime > 0.2) {
                await new Promise(r => setTimeout(r, 50));
                if (this.playbackState.isPaused || this.playbackState.stopRequested) {
                    const soundEndTime = token.code ? (currentTime - 3 * dotSec) : currentTime;
                    if (this.audioContext.currentTime < soundEndTime) {
                        interruptedDuringSound = true;
                    }
                    break;
                }
            }

            if (interruptedDuringSound && this.playbackState.isPaused) {
                i--;
                continue;
            }
        }

        this.playbackState.isPlaying = false;
        if (onComplete && !this.playbackState.stopRequested) {
            onComplete();
        }
    }

    pause() {
        this.playbackState.isPaused = true;
        this.stopScheduledNodes();
    }

    resume() {
        this.playbackState.isPaused = false;
    }

    stopScheduledNodes() {
        this.cleanupTimers.forEach(clearTimeout)
        this.cleanupTimers.clear()

        const now = this.audioContext ? this.audioContext.currentTime : 0
        let lastEndTime = now

        this.currentNodes.forEach(({ oscillator, gainNode, startTime, endTime }) => {
            try {
                if (startTime > now) {
                    gainNode.gain.cancelScheduledValues(now)
                    gainNode.gain.setValueAtTime(0, now)
                    oscillator.stop(now + 0.001)
                } else if (endTime > now) {
                    gainNode.gain.cancelScheduledValues(now)
                    gainNode.gain.setValueAtTime(gainNode.gain.value, now)
                    gainNode.gain.linearRampToValueAtTime(0, now + STOP_FADE_SECONDS)
                    oscillator.stop(now + STOP_FADE_SECONDS + 0.001)
                    lastEndTime = Math.max(lastEndTime, now + STOP_FADE_SECONDS)
                }
            } catch (e) { console.error('Stop error:', e) }
        })
        
        this.currentNodes = []
        return Math.max(50, (lastEndTime - now) * 1000 + 50)
    }

    stop() {
        this.playbackState.stopRequested = true;
        this.playbackState.isPlaying = false;
        this.playbackState.isPaused = false;
        return this.stopScheduledNodes();
    }

    get currentTime() {
        return this.audioContext ? this.audioContext.currentTime : 0
    }

    destroy() {
        const closeDelay = this.stop()
        if (this.audioContext) {
            const ctx = this.audioContext
            this.audioContext = null
            setTimeout(() => ctx.close(), closeDelay + 40)
        }
    }
}

export default new DesktopAudioPlayer()

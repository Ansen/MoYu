/**
 * 日志管理工具 (桌面端精简版)
 */
class Logger {
    constructor() {
        this.logCache = []
        this.maxCacheSize = 100
    }

    addToCache(level, message, data) {
        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            data: data ? JSON.stringify(data) : null
        }
        this.logCache.push(logEntry)
        if (this.logCache.length > this.maxCacheSize) {
            this.logCache.shift()
        }
    }

    getLogs() {
        return this.logCache
    }

    clearLogs() {
        this.logCache = []
    }

    exportLogs() {
        return this.logCache.map(log => {
            const time = new Date(log.timestamp).toLocaleString('zh-CN')
            const data = log.data ? ` | ${log.data}` : ''
            return `[${time}] [${log.level}] ${log.message}${data}`
        }).join('\n')
    }

    info(message, data) {
        console.log(`[INFO] ${message}`, data || '')
        this.addToCache('INFO', message, data)
    }

    warn(message, data) {
        console.warn(`[WARN] ${message}`, data || '')
        this.addToCache('WARN', message, data)
    }

    error(message, data) {
        console.error(`[ERROR] ${message}`, data || '')
        this.addToCache('ERROR', message, data)
    }

    debug(message, data) {
        if (import.meta.env.DEV) {
            console.log(`[DEBUG] ${message}`, data || '')
            this.addToCache('DEBUG', message, data)
        }
    }
}

const logger = new Logger()
export default logger

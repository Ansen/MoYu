import { LazyStore } from '@tauri-apps/plugin-store';

// 初始化本地存储文件 (保存在操作系统的应用数据目录)
const store = new LazyStore('moyu-reader-settings.json');

/**
 * 保存阅读进度
 * @param {string} bookId - 电子书的唯一ID (如文件名或哈希)
 * @param {string|number} cfiOrPercent - EPUB的CFI或者TXT的进度百分比
 */
export async function saveReadingProgress(bookId, cfiOrPercent) {
  try {
    const key = `progress_${bookId}`;
    await store.set(key, cfiOrPercent);
    await store.save(); // 强制持久化到磁盘
    console.log(`Progress saved for ${bookId}:`, cfiOrPercent);
  } catch (err) {
    console.error('Failed to save reading progress:', err);
  }
}

/**
 * 加载阅读进度
 * @param {string} bookId - 电子书的唯一ID
 * @returns {Promise<string|number|null>}
 */
export async function loadReadingProgress(bookId) {
  try {
    const key = `progress_${bookId}`;
    const val = await store.get(key);
    return val || null;
  } catch (err) {
    console.error('Failed to load reading progress:', err);
    return null;
  }
}


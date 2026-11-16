import { invoke } from '@tauri-apps/api/core';

export const KEY_REMEMBER_WINDOW_STATE = 'pref_remember_window_state';

function getDefaultStorage() {
  return typeof globalThis !== 'undefined' && 'localStorage' in globalThis
    ? globalThis.localStorage
    : null;
}

function resolveInvoker(customInvoke) {
  if (typeof customInvoke === 'function') {
    return customInvoke;
  }
  if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
    return null;
  }
  return invoke;
}

function readLocalFallback(storage) {
  if (!storage) return true;
  try {
    const raw = storage.getItem(KEY_REMEMBER_WINDOW_STATE);
    if (raw === null || raw === undefined) return true;
    return raw !== 'false';
  } catch {
    return true;
  }
}

function writeLocalFallback(storage, enabled) {
  if (!storage) return;
  try {
    storage.setItem(KEY_REMEMBER_WINDOW_STATE, enabled ? 'true' : 'false');
  } catch {
    // 忽略存储异常
  }
}

/**
 * 读取“记住窗口大小与位置（含最大化状态）”设置开关，默认返回 true
 * @param {{ invokeFn?: Function, storage?: Storage }} [options]
 * @returns {Promise<boolean>}
 */
export async function loadRememberWindowState(options = {}) {
  const storage = options.storage ?? getDefaultStorage();
  const invoker = resolveInvoker(options.invokeFn);

  if (invoker) {
    try {
      const value = await invoker('get_remember_window_state');
      if (typeof value === 'boolean') {
        writeLocalFallback(storage, value);
        return value;
      }
    } catch {
      // 非 Tauri 运行环境或后端暂不可用时回退到本地存储
    }
  }

  return readLocalFallback(storage);
}

/**
 * 保存“记住窗口大小与位置（含最大化状态）”设置开关，并同步通知 Rust 侧
 * @param {boolean} enabled
 * @param {{ invokeFn?: Function, storage?: Storage }} [options]
 * @returns {Promise<boolean>}
 */
export async function saveRememberWindowState(enabled, options = {}) {
  const normalized = Boolean(enabled);
  const storage = options.storage ?? getDefaultStorage();
  writeLocalFallback(storage, normalized);

  const invoker = resolveInvoker(options.invokeFn);
  if (invoker) {
    try {
      await invoker('set_remember_window_state', { enabled: normalized });
      return true;
    } catch (err) {
      console.error('Failed to sync remember window state:', err);
      return false;
    }
  }

  return true;
}

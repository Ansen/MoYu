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
  const invoker = resolveInvoker(options.invokeFn);

  if (invoker) {
    try {
      await invoker('set_remember_window_state', { enabled: normalized });
      writeLocalFallback(storage, normalized);
      return true;
    } catch (err) {
      console.error('Failed to sync remember window state:', err);
      return false;
    }
  }

  writeLocalFallback(storage, normalized);
  return true;
}

/**
 * 查询主窗口当前是否处于最大化状态（优先调用后端权威判定，不可用时回退至原生窗口 API）
 * @param {{ invokeFn?: Function, win?: { isMaximized?: Function } }} [options]
 * @returns {Promise<boolean|null>}
 */
export async function queryMainWindowMaximized(options = {}) {
  const invoker = resolveInvoker(options.invokeFn);
  if (invoker) {
    try {
      const maximized = await invoker('is_main_window_maximized');
      if (typeof maximized === 'boolean') {
        return maximized;
      }
    } catch {
      // 后端权威命令不可用时优雅降级至窗口原生接口
    }
  }

  const win = options.win;
  if (win && typeof win.isMaximized === 'function') {
    try {
      const maximized = await win.isMaximized();
      if (typeof maximized === 'boolean') {
        return maximized;
      }
    } catch {
      // 忽略窗口查询异常
    }
  }

  return null;
}

/**
 * 切换主窗口最大化/还原状态（优先调用后端权威命令，不可用时回退至原生窗口 API）
 * @param {{ invokeFn?: Function, win?: { toggleMaximize?: Function, isMaximized?: Function } }} [options]
 * @returns {Promise<boolean|null>}
 */
export async function toggleMainWindowMaximize(options = {}) {
  const invoker = resolveInvoker(options.invokeFn);
  if (invoker) {
    try {
      const maximized = await invoker('toggle_main_window_maximize');
      if (typeof maximized === 'boolean') {
        return maximized;
      }
    } catch {
      // 后端权威命令不可用时优雅降级至窗口原生接口
    }
  }

  const win = options.win;
  if (win && typeof win.toggleMaximize === 'function') {
    try {
      await win.toggleMaximize();
      if (typeof win.isMaximized === 'function') {
        const maximized = await win.isMaximized();
        if (typeof maximized === 'boolean') {
          return maximized;
        }
      }
    } catch {
      // 忽略窗口切换异常
    }
  }

  return null;
}

/**
 * 创建窗口最大化状态同步控制器，统一处理 StrictMode 卸载竞态、请求序号防乱序及事件防抖
 * @param {{
 *   win?: { isMaximized?: Function, onResized?: Function } | null,
 *   invokeFn?: Function,
 *   onMaximizedChange?: (maximized: boolean) => void,
 *   debounceMs?: number
 * }} [options]
 */
export function createWindowMaximizedMonitor(options = {}) {
  const { win = null, invokeFn, onMaximizedChange, debounceMs = 50 } = options;
  let cancelled = false;
  let reqSeq = 0;
  let unlisten = null;
  let debounceTimer = null;

  const refresh = async () => {
    const seq = ++reqSeq;
    const maximized = await queryMainWindowMaximized({ invokeFn, win });
    if (cancelled || seq !== reqSeq || typeof maximized !== 'boolean') {
      return;
    }
    onMaximizedChange?.(maximized);
  };

  const start = () => {
    void refresh();
    if (!win || typeof win.onResized !== 'function') {
      return;
    }

    try {
      Promise.resolve(
        win.onResized(() => {
          if (cancelled) return;
          if (debounceTimer !== null) {
            clearTimeout(debounceTimer);
            debounceTimer = null;
          }
          if (debounceMs <= 0) {
            void refresh();
          } else {
            debounceTimer = setTimeout(() => {
              debounceTimer = null;
              if (!cancelled) {
                void refresh();
              }
            }, debounceMs);
          }
        })
      )
        .then((u) => {
          if (typeof u !== 'function') return;
          if (cancelled) {
            try {
              u();
            } catch {
              // 忽略卸载后的退订异常
            }
          } else {
            unlisten = u;
          }
        })
        .catch(() => {});
    } catch {
      // 忽略非原生窗口环境异常
    }
  };

  const applyAuthoritativeState = (maximized) => {
    reqSeq += 1;
    if (!cancelled && typeof maximized === 'boolean') {
      onMaximizedChange?.(maximized);
    }
  };

  const stop = () => {
    cancelled = true;
    reqSeq += 1;
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (unlisten) {
      const fn = unlisten;
      unlisten = null;
      try {
        fn();
      } catch {
        // 忽略退订异常
      }
    }
  };

  return { start, stop, refresh, applyAuthoritativeState };
}

import assert from 'node:assert/strict';
import {
  KEY_REMEMBER_WINDOW_STATE,
  loadRememberWindowState,
  saveRememberWindowState,
  queryMainWindowMaximized,
  toggleMainWindowMaximize,
  createWindowMaximizedMonitor,
} from '../src/utils/windowStatePrefs.js';
import { translations } from '../src/i18n/locales.js';

function createMemoryStorage(initial = {}) {
  const map = { ...initial };
  return {
    getItem: (key) => (key in map ? map[key] : null),
    setItem: (key, val) => {
      map[key] = String(val);
    },
    removeItem: (key) => {
      delete map[key];
    },
  };
}

export async function testWindowStateSettings() {
  console.log('--- Running Window State Settings Unit Tests ---');

  // 1. 缺省默认值为 true
  {
    const storage = createMemoryStorage();
    const val = await loadRememberWindowState({ storage });
    assert.equal(val, true);
  }

  // 2. Tauri 后端返回 false 时以后端为准并同步镜像
  {
    const storage = createMemoryStorage();
    const calls = [];
    const val = await loadRememberWindowState({
      storage,
      invokeFn: async (cmd) => {
        calls.push(cmd);
        return false;
      },
    });
    assert.deepEqual(calls, ['get_remember_window_state']);
    assert.equal(val, false);
    assert.equal(storage.getItem(KEY_REMEMBER_WINDOW_STATE), 'false');
  }

  // 3. 后端调用异常时安全降级到本地缓存
  {
    const storage = createMemoryStorage({ [KEY_REMEMBER_WINDOW_STATE]: 'false' });
    const val = await loadRememberWindowState({
      storage,
      invokeFn: async () => {
        throw new Error('not in tauri');
      },
    });
    assert.equal(val, false);
  }

  // 4. 保存开关状态时同步写入后端命令和本地缓存
  {
    const storage = createMemoryStorage();
    const calls = [];
    const invokeFn = async (cmd, args) => {
      calls.push({ cmd, args });
    };

    const okFalse = await saveRememberWindowState(false, { storage, invokeFn });
    assert.equal(okFalse, true);
    assert.equal(storage.getItem(KEY_REMEMBER_WINDOW_STATE), 'false');

    const okTrue = await saveRememberWindowState(true, { storage, invokeFn });
    assert.equal(okTrue, true);
    assert.equal(storage.getItem(KEY_REMEMBER_WINDOW_STATE), 'true');

    assert.deepEqual(calls, [
      { cmd: 'set_remember_window_state', args: { enabled: false } },
      { cmd: 'set_remember_window_state', args: { enabled: true } },
    ]);
  }

  // 5. 后端同步失败时返回 false 且不得覆盖 localStorage 中的原值
  {
    const storage = createMemoryStorage({ [KEY_REMEMBER_WINDOW_STATE]: 'true' });
    const ok = await saveRememberWindowState(false, {
      storage,
      invokeFn: async () => {
        throw new Error('ipc write failed');
      },
    });
    assert.equal(ok, false);
    assert.equal(storage.getItem(KEY_REMEMBER_WINDOW_STATE), 'true');
  }

  // 6. 窗口最大化状态查询与切换优先使用后端权威命令，不可用时优雅降级
  {
    const calls = [];
    const mockWin = {
      isMaximized: async () => false,
      toggleMaximize: async () => {
        calls.push('win.toggleMaximize');
      },
    };

    const authoritativeMax = await queryMainWindowMaximized({
      win: mockWin,
      invokeFn: async (cmd) => {
        calls.push(cmd);
        return true;
      },
    });
    assert.equal(authoritativeMax, true);

    const toggled = await toggleMainWindowMaximize({
      win: mockWin,
      invokeFn: async (cmd) => {
        calls.push(cmd);
        return false;
      },
    });
    assert.equal(toggled, false);
    assert.deepEqual(calls, ['is_main_window_maximized', 'toggle_main_window_maximize']);

    // 后端命令不可用时回退至原生 win API
    let winState = false;
    const fallbackWin = {
      isMaximized: async () => winState,
      toggleMaximize: async () => {
        winState = !winState;
      },
    };
    const fallbackQuery = await queryMainWindowMaximized({
      win: fallbackWin,
      invokeFn: async () => {
        throw new Error('command not found');
      },
    });
    assert.equal(fallbackQuery, false);

    const fallbackToggle = await toggleMainWindowMaximize({
      win: fallbackWin,
      invokeFn: async () => {
        throw new Error('command not found');
      },
    });
    assert.equal(fallbackToggle, true);
  }

  // 7. StrictMode 竞态：onResized 尚未 resolve 即卸载时，resolve 后应自动调用 unlisten
  {
    let resolveOnResized;
    let unlistenCalled = 0;
    let resizeHandler = null;
    const win = {
      onResized: (cb) => {
        resizeHandler = cb;
        return new Promise((resolve) => {
          resolveOnResized = resolve;
        });
      },
    };

    const updates = [];
    const monitor = createWindowMaximizedMonitor({
      win,
      invokeFn: async () => true,
      onMaximizedChange: (val) => updates.push(val),
      debounceMs: 0,
    });
    monitor.start();
    // 模拟 React StrictMode 首次卸载发生在 onResized Promise resolve 之前
    monitor.stop();
    assert.equal(unlistenCalled, 0);

    resolveOnResized(() => {
      unlistenCalled += 1;
    });
    await new Promise((r) => setTimeout(r, 10));
    assert.equal(unlistenCalled, 1);

    // 卸载后不再响应残留回调
    resizeHandler?.();
    await new Promise((r) => setTimeout(r, 10));
    assert.deepEqual(updates, []);
  }

  // 8. 并发异步查询乱序防覆写：慢速旧请求不得覆盖快速新请求
  {
    let resizeHandler = null;
    const pending = [];
    const win = {
      onResized: async (cb) => {
        resizeHandler = cb;
        return () => {};
      },
    };
    const observed = [];
    const monitor = createWindowMaximizedMonitor({
      win,
      invokeFn: () =>
        new Promise((resolve) => {
          pending.push(resolve);
        }),
      onMaximizedChange: (val) => observed.push(val),
      debounceMs: 0,
    });

    monitor.start();
    // 触发第 2 次查询（模拟快速 resize），使第 1 次初始查询失效
    resizeHandler();

    assert.equal(pending.length, 2);
    // 先返回较新的第 2 次结果 (true)
    pending[1](true);
    await Promise.resolve();
    // 再延迟返回较旧的第 1 次结果 (false)
    pending[0](false);
    await Promise.resolve();

    assert.deepEqual(observed, [true]);

    // 主动切换权威状态时同样作废此前未决查询
    resizeHandler();
    assert.equal(pending.length, 3);
    monitor.applyAuthoritativeState(false);
    pending[2](true);
    await Promise.resolve();

    assert.deepEqual(observed, [true, false]);
    monitor.stop();
  }

  // 9. 校验中英文 i18n 文案存在
  assert.ok(translations.zh['settings.startup.rememberWindow']);
  assert.ok(translations.en['settings.startup.rememberWindow']);

  console.log('✅ Window state settings tests passed!\n');
}

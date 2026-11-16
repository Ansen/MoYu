import assert from 'node:assert/strict';
import {
  KEY_REMEMBER_WINDOW_STATE,
  loadRememberWindowState,
  saveRememberWindowState,
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

  // 5. 校验中英文 i18n 文案存在
  assert.ok(translations.zh['settings.startup.rememberWindow']);
  assert.ok(translations.en['settings.startup.rememberWindow']);

  console.log('✅ Window state settings tests passed!\n');
}

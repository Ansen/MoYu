import { invoke } from '@tauri-apps/api/core';

let clickCount = 0;
let lastClickTime = 0;

/**
 * 开发者调试工具彩蛋触发器（连续快速点击 5 次打开/关闭 DevTools）
 */
export async function handleDevtoolsEasterEgg(e) {
  if (e && typeof e.stopPropagation === 'function') {
    e.stopPropagation();
  }
  const now = Date.now();
  if (now - lastClickTime < 700) {
    clickCount++;
  } else {
    clickCount = 1;
  }
  lastClickTime = now;

  if (clickCount >= 5) {
    clickCount = 0;
    try {
      await invoke('toggle_devtools');
    } catch (err) {
      console.warn('Toggle devtools invocation error:', err);
    }
  }
}

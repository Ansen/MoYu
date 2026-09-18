/**
 * 统一输入引擎 (Input Engine)
 * 抽象支持:
 * 1. 键盘 J 键 (点) / K 键 (划) - 兼容 CH552G 硬件免驱适配器
 * 2. 键盘 Space 键 (手键长短按)
 * 3. 鼠标左键 (点/手键) / 鼠标右键 (划)
 */

export class MorseInputEngine {
  constructor(options = {}) {
    this.mode = options.mode || 'PADDLE'; // 'PADDLE' (自动键双按键) | 'STRAIGHT' (手键单按键)
    this.onEvent = options.onEvent || (() => {});
    
    this.keyState = {
      ditDown: false,
      dahDown: false,
      straightDown: false
    };

    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    this.boundHandleMouseDown = this.handleMouseDown.bind(this);
    this.boundHandleMouseUp = this.handleMouseUp.bind(this);
    this.boundContextMenu = (e) => e.preventDefault();
    this.isAttached = false;
  }

  setMode(newMode) {
    this.mode = newMode;
  }

  attach(domElement = window) {
    if (this.isAttached) return;
    this.target = domElement;
    
    window.addEventListener('keydown', this.boundHandleKeyDown);
    window.addEventListener('keyup', this.boundHandleKeyUp);
    window.addEventListener('contextmenu', this.boundContextMenu);
    
    this.isAttached = true;
  }

  detach() {
    if (!this.isAttached) return;
    window.removeEventListener('keydown', this.boundHandleKeyDown);
    window.removeEventListener('keyup', this.boundHandleKeyUp);
    window.removeEventListener('contextmenu', this.boundContextMenu);
    this.isAttached = false;
  }

  handleKeyDown(e) {
    // 忽略长按系统连击 repeat 事件
    if (e.repeat) return;
    
    // 如果焦点在输入框中，不拦截游戏键
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    const now = performance.now();
    const key = e.key.toLowerCase();

    if (this.mode === 'PADDLE') {
      if (key === 'j' || e.code === 'KeyJ') {
        e.preventDefault();
        this.keyState.ditDown = true;
        this.onEvent({ type: 'DIT_DOWN', timestamp: now });
      } else if (key === 'k' || e.code === 'KeyK') {
        e.preventDefault();
        this.keyState.dahDown = true;
        this.onEvent({ type: 'DAH_DOWN', timestamp: now });
      }
    } else if (this.mode === 'STRAIGHT') {
      if (e.code === 'Space' || key === ' ' || key === 'j') {
        e.preventDefault();
        this.keyState.straightDown = true;
        this.onEvent({ type: 'STRAIGHT_DOWN', timestamp: now });
      }
    }
  }

  handleKeyUp(e) {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    const now = performance.now();
    const key = e.key.toLowerCase();

    if (this.mode === 'PADDLE') {
      if (key === 'j' || e.code === 'KeyJ') {
        e.preventDefault();
        this.keyState.ditDown = false;
        this.onEvent({ type: 'DIT_UP', timestamp: now });
      } else if (key === 'k' || e.code === 'KeyK') {
        e.preventDefault();
        this.keyState.dahDown = false;
        this.onEvent({ type: 'DAH_UP', timestamp: now });
      }
    } else if (this.mode === 'STRAIGHT') {
      if (e.code === 'Space' || key === ' ' || key === 'j') {
        e.preventDefault();
        this.keyState.straightDown = false;
        this.onEvent({ type: 'STRAIGHT_UP', timestamp: now });
      }
    }
  }

  handleMouseDown(e) {
    const now = performance.now();
    if (this.mode === 'PADDLE') {
      if (e.button === 0) { // 左键: 点
        this.keyState.ditDown = true;
        this.onEvent({ type: 'DIT_DOWN', timestamp: now });
      } else if (e.button === 2) { // 右键: 划
        this.keyState.dahDown = true;
        this.onEvent({ type: 'DAH_DOWN', timestamp: now });
      }
    } else if (this.mode === 'STRAIGHT') {
      if (e.button === 0) {
        this.keyState.straightDown = true;
        this.onEvent({ type: 'STRAIGHT_DOWN', timestamp: now });
      }
    }
  }

  handleMouseUp(e) {
    const now = performance.now();
    if (this.mode === 'PADDLE') {
      if (e.button === 0) {
        this.keyState.ditDown = false;
        this.onEvent({ type: 'DIT_UP', timestamp: now });
      } else if (e.button === 2) {
        this.keyState.dahDown = false;
        this.onEvent({ type: 'DAH_UP', timestamp: now });
      }
    } else if (this.mode === 'STRAIGHT') {
      if (e.button === 0) {
        this.keyState.straightDown = false;
        this.onEvent({ type: 'STRAIGHT_UP', timestamp: now });
      }
    }
  }
}

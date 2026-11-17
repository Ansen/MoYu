use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;
use tauri::{
    window::Color, AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Position, Size,
    State, Theme, WebviewWindow, WindowEvent,
};
use tauri_plugin_store::StoreExt;

/// 持久化配置文件名（与前端 store.js 共用同一 Store 文件）
pub const SETTINGS_STORE_FILE: &str = "moyu-reader-settings.json";
/// 设置开关键名：是否记住窗口大小、位置与最大化状态
pub const KEY_REMEMBER_WINDOW_STATE: &str = "pref_remember_window_state";
/// 窗口状态快照键名
pub const KEY_WINDOW_STATE: &str = "window_state";

/// 默认逻辑窗口宽高（与 tauri.conf.json 保持一致）
const DEFAULT_LOGICAL_WIDTH: f64 = 1010.0;
const DEFAULT_LOGICAL_HEIGHT: f64 = 680.0;

/// 合法窗口尺寸下限（避免异常或损坏数据导致窗口过小无法操作）
const MIN_VALID_WIDTH: u32 = 400;
const MIN_VALID_HEIGHT: u32 = 300;

/// 判断窗口是否仍在显示器工作区内的最小有效重叠区域（物理像素）
const MIN_VISIBLE_OVERLAP_WIDTH: i64 = 120;
const MIN_VISIBLE_OVERLAP_HEIGHT: i64 = 48;

/// 拖拽移动或缩放窗口后的防抖落盘延迟
const SAVE_DEBOUNCE_MS: u64 = 500;
/// 前端首帧就绪超时兜底显窗时长（防止极端加载异常导致窗口永久隐藏；dev 模式需给 Vite 冷编译留足时间）
#[cfg(debug_assertions)]
const REVEAL_FALLBACK_TIMEOUT_MS: u64 = 15_000;
#[cfg(not(debug_assertions))]
const REVEAL_FALLBACK_TIMEOUT_MS: u64 = 6_000;
/// Windows DWM 隐身预热（cloaking）解封兜底超时时长
#[cfg(target_os = "windows")]
const UNCLOAK_FALLBACK_TIMEOUT_MS: u64 = 250;

/// 持久化存储的窗口几何与最大化状态（均使用物理像素）
#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
pub struct PersistedWindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
}

impl PersistedWindowState {
    /// 校验宽高是否达到最低可用阈值
    pub fn is_valid_dimensions(&self) -> bool {
        self.width >= MIN_VALID_WIDTH && self.height >= MIN_VALID_HEIGHT
    }
}

/// 显示器工作区矩形（物理像素）
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct MonitorWorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}

impl MonitorWorkArea {
    fn from_monitor(monitor: &Monitor) -> Self {
        let area = monitor.work_area();
        Self {
            x: area.position.x,
            y: area.position.y,
            width: area.size.width,
            height: area.size.height,
        }
    }
}

/// 启动时解析出的最终窗口放置策略
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum RestoredPlacement {
    /// 恢复到有效的（经工作区边界钳位后的）指定位置与尺寸
    Positioned {
        x: i32,
        y: i32,
        width: u32,
        height: u32,
        maximized: bool,
    },
    /// 原显示器不可用时，回退至当前主屏幕安全尺寸并居中
    CenteredFallback {
        width: u32,
        height: u32,
        maximized: bool,
    },
}

/// 运行期窗口状态采样输入（用于纯函数状态机合并，方便单元测试）
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LiveWindowSample {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
    pub minimized: bool,
    pub fullscreen: bool,
}

/// 全局窗口状态管理器（由 Tauri State 托管）
pub struct WindowStateManager {
    /// 是否启用窗口状态记忆（默认 true）
    enabled: Arc<AtomicBool>,
    /// 主窗口是否已完成首帧显窗（确保只触发一次且忽略显窗前的瞬态尺寸事件）
    shown: Arc<AtomicBool>,
    /// 主窗口是否已完成 DWM 解封显示（仅触发一次）
    uncloaked: Arc<AtomicBool>,
    /// 内存中保存的最近一次有效窗口快照（最大化和还原时保护普通尺寸不被覆盖）
    snapshot: Arc<Mutex<Option<PersistedWindowState>>>,
    /// 串口化磁盘写入锁，避免后台防抖线程与同步关闭/开关变更产生写入竞态
    persist_lock: Arc<Mutex<()>>,
    /// 防抖保存通道发送端（容量为 1，O(1) 非阻塞合并事件）
    save_tx: Mutex<Option<mpsc::SyncSender<()>>>,
}

impl Default for WindowStateManager {
    fn default() -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(true)),
            shown: Arc::new(AtomicBool::new(false)),
            uncloaked: Arc::new(AtomicBool::new(false)),
            snapshot: Arc::new(Mutex::new(None)),
            persist_lock: Arc::new(Mutex::new(())),
            save_tx: Mutex::new(None),
        }
    }
}

impl WindowStateManager {
    /// 读取当前内存中的启用状态
    pub fn is_enabled(&self) -> bool {
        self.enabled.load(Ordering::Acquire)
    }

    /// 读取窗口是否已经显示
    pub fn is_shown(&self) -> bool {
        self.shown.load(Ordering::Acquire)
    }

    /// 原子标记窗口已显示，仅首次返回 true
    fn mark_shown_once(&self) -> bool {
        self.shown
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    /// 原子标记窗口已完成解封，仅首次返回 true
    fn mark_uncloaked_once(&self) -> bool {
        self.uncloaked
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    /// 设置内存中的启用状态
    fn set_enabled_flag(&self, enabled: bool) {
        self.enabled.store(enabled, Ordering::Release);
    }

    /// 获取快照副本
    fn get_snapshot(&self) -> Option<PersistedWindowState> {
        self.snapshot.lock().ok().and_then(|guard| guard.clone())
    }

    /// 更新内存快照
    fn set_snapshot(&self, next: Option<PersistedWindowState>) {
        if let Ok(mut guard) = self.snapshot.lock() {
            *guard = next;
        }
    }

    /// 启动唯一后台防抖写盘线程
    fn ensure_debounce_worker(&self, app_handle: AppHandle) {
        let Ok(mut tx_guard) = self.save_tx.lock() else {
            return;
        };
        if tx_guard.is_some() {
            return;
        }

        let (tx, rx) = mpsc::sync_channel::<()>(1);
        *tx_guard = Some(tx);
        drop(tx_guard);

        let enabled = Arc::clone(&self.enabled);
        let snapshot = Arc::clone(&self.snapshot);
        let persist_lock = Arc::clone(&self.persist_lock);

        std::thread::spawn(move || {
            while rx.recv().is_ok() {
                // 等待一段静默期，期间若持续收到拖拽/缩放信号则合并等待
                loop {
                    match rx.recv_timeout(Duration::from_millis(SAVE_DEBOUNCE_MS)) {
                        Ok(()) => continue,
                        Err(mpsc::RecvTimeoutError::Timeout) => break,
                        Err(mpsc::RecvTimeoutError::Disconnected) => return,
                    }
                }

                flush_snapshot_internal(&app_handle, &enabled, &snapshot, &persist_lock);
            }
        });
    }

    /// 触发防抖写盘信号（非阻塞）
    fn schedule_debounced_save(&self) {
        if !self.is_enabled() {
            return;
        }
        if let Ok(guard) = self.save_tx.lock() {
            if let Some(tx) = guard.as_ref() {
                // 队列满说明已有待处理信号，直接忽略即可
                let _ = tx.try_send(());
            }
        }
    }
}

/// 纯函数：合并实时窗口采样与已有快照
/// - 最小化或全屏状态下直接忽略，保留原快照
/// - 最大化状态下仅翻转 `maximized = true`，保留原有普通 `x/y/width/height`
/// - 普通状态下（非最大化、非最小化、非全屏）更新完整坐标与尺寸
pub fn merge_window_snapshot(
    prev: Option<&PersistedWindowState>,
    sample: &LiveWindowSample,
) -> Option<PersistedWindowState> {
    if sample.minimized || sample.fullscreen {
        return prev.cloned();
    }

    if sample.maximized {
        return match prev {
            Some(existing) if existing.is_valid_dimensions() => Some(PersistedWindowState {
                maximized: true,
                ..existing.clone()
            }),
            _ => None,
        };
    }

    if sample.width < MIN_VALID_WIDTH || sample.height < MIN_VALID_HEIGHT {
        return prev.cloned();
    }

    Some(PersistedWindowState {
        x: sample.x,
        y: sample.y,
        width: sample.width,
        height: sample.height,
        maximized: false,
    })
}

/// 计算两个矩形在横纵方向上的交集大小及面积
fn compute_intersection(
    ax: i32,
    ay: i32,
    aw: u32,
    ah: u32,
    area: &MonitorWorkArea,
) -> (i64, i64, i64) {
    let a_left = i64::from(ax);
    let a_top = i64::from(ay);
    let a_right = a_left + i64::from(aw);
    let a_bottom = a_top + i64::from(ah);

    let b_left = i64::from(area.x);
    let b_top = i64::from(area.y);
    let b_right = b_left + i64::from(area.width);
    let b_bottom = b_top + i64::from(area.height);

    let overlap_w = (a_right.min(b_right) - a_left.max(b_left)).max(0);
    let overlap_h = (a_bottom.min(b_bottom) - a_top.max(b_top)).max(0);
    (overlap_w, overlap_h, overlap_w * overlap_h)
}

/// 纯函数：根据当前显示器列表校验并计算恢复后的安全窗口位置
pub fn resolve_restored_geometry(
    saved: &PersistedWindowState,
    monitors: &[MonitorWorkArea],
    primary: Option<MonitorWorkArea>,
) -> Option<RestoredPlacement> {
    if !saved.is_valid_dimensions() {
        return None;
    }

    let req_overlap_w = MIN_VISIBLE_OVERLAP_WIDTH.min(i64::from(saved.width));
    let req_overlap_h = MIN_VISIBLE_OVERLAP_HEIGHT.min(i64::from(saved.height));

    // 查找交集面积最大的显示器工作区，要求至少有可拖拽操作区域留在工作区内
    let best_monitor = monitors
        .iter()
        .filter_map(|monitor| {
            let (ow, oh, area) =
                compute_intersection(saved.x, saved.y, saved.width, saved.height, monitor);
            if ow >= req_overlap_w && oh >= req_overlap_h {
                Some((area, *monitor))
            } else {
                None
            }
        })
        .max_by_key(|(area, _)| *area)
        .map(|(_, monitor)| monitor);

    if let Some(monitor) = best_monitor {
        let clamped_width = saved
            .width
            .min(monitor.width)
            .max(MIN_VALID_WIDTH.min(monitor.width));
        let clamped_height = saved
            .height
            .min(monitor.height)
            .max(MIN_VALID_HEIGHT.min(monitor.height));

        // 左右允许部分移出屏幕，但至少保留一段可操作宽度在工作区内
        let min_x = monitor.x - clamped_width as i32 + req_overlap_w as i32;
        let max_x = monitor.x + monitor.width as i32 - req_overlap_w as i32;
        let clamped_x = saved.x.clamp(min_x.min(max_x), min_x.max(max_x));

        // 无边框自定义标题栏禁止顶部露出工作区上方，同时避免沉到任务栏下方拖不回来
        let min_y = monitor.y;
        let max_y = monitor.y + monitor.height as i32 - req_overlap_h as i32;
        let clamped_y = saved.y.clamp(min_y, min_y.max(max_y));

        return Some(RestoredPlacement::Positioned {
            x: clamped_x,
            y: clamped_y,
            width: clamped_width,
            height: clamped_height,
            maximized: saved.maximized,
        });
    }

    // 所有已保存位置均不在当前显示器工作区内（例如断开外接副屏）
    let (fallback_w, fallback_h) = match primary.or_else(|| monitors.first().copied()) {
        Some(target) => (
            saved
                .width
                .min(target.width)
                .max(MIN_VALID_WIDTH.min(target.width)),
            saved
                .height
                .min(target.height)
                .max(MIN_VALID_HEIGHT.min(target.height)),
        ),
        None => (saved.width, saved.height),
    };

    Some(RestoredPlacement::CenteredFallback {
        width: fallback_w,
        height: fallback_h,
        maximized: saved.maximized,
    })
}

/// 从 Store 读取设置开关与历史窗口状态（读取失败时返回安全默认值）
fn load_persisted_config(app: &AppHandle) -> (bool, Option<PersistedWindowState>) {
    let Ok(store) = app.store(SETTINGS_STORE_FILE) else {
        return (true, None);
    };

    let enabled = store
        .get(KEY_REMEMBER_WINDOW_STATE)
        .and_then(|v| v.as_bool())
        .unwrap_or(true);

    let window_state = store
        .get(KEY_WINDOW_STATE)
        .and_then(|v| serde_json::from_value::<PersistedWindowState>(v).ok())
        .filter(|s| s.is_valid_dimensions());

    (enabled, window_state)
}

/// 将内存快照持久化至磁盘 Store（需受 persist_lock 保护）
fn flush_snapshot_internal(
    app: &AppHandle,
    enabled: &AtomicBool,
    snapshot: &Mutex<Option<PersistedWindowState>>,
    persist_lock: &Mutex<()>,
) {
    let Ok(_persist_guard) = persist_lock.lock() else {
        return;
    };
    if !enabled.load(Ordering::Acquire) {
        return;
    }

    let snap = snapshot.lock().ok().and_then(|guard| guard.clone());
    let Some(state_to_save) = snap else {
        return;
    };
    if !state_to_save.is_valid_dimensions() {
        return;
    }

    let Ok(store) = app.store(SETTINGS_STORE_FILE) else {
        return;
    };
    let Ok(json_value) = serde_json::to_value(&state_to_save) else {
        return;
    };

    store.set(KEY_WINDOW_STATE, json_value);
    if let Err(err) = store.save() {
        log::warn!("保存窗口状态失败: {}", err);
    }
}

/// 采样当前原生窗口的实时几何与状态
fn sample_live_window(window: &WebviewWindow) -> Option<LiveWindowSample> {
    let maximized = window.is_maximized().unwrap_or(false);
    let minimized = window.is_minimized().unwrap_or(false);
    let fullscreen = window.is_fullscreen().unwrap_or(false);
    let pos = window.outer_position().ok()?;
    let size = window.inner_size().ok()?;

    Some(LiveWindowSample {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        maximized,
        minimized,
        fullscreen,
    })
}

/// Windows DWM 窗口遮罩（Cloak）辅助：允许窗口先以 WS_VISIBLE 唤醒 WebView2 GPU 合成首帧，再瞬时揭开呈现
#[cfg(target_os = "windows")]
mod win_cloak {
    use std::ffi::{c_char, c_void};
    use std::sync::OnceLock;
    use tauri::WebviewWindow;

    const DWMWA_CLOAK: u32 = 13;

    type DwmSetWindowAttributeFn = unsafe extern "system" fn(
        hwnd: *mut c_void,
        dw_attribute: u32,
        pv_attribute: *const c_void,
        cb_attribute: u32,
    ) -> i32;

    extern "system" {
        fn LoadLibraryA(lp_lib_file_name: *const c_char) -> *mut c_void;
        fn GetProcAddress(h_module: *mut c_void, lp_proc_name: *const c_char) -> *mut c_void;
    }

    fn resolve_dwm_set_window_attribute() -> Option<DwmSetWindowAttributeFn> {
        static FN_CACHE: OnceLock<Option<DwmSetWindowAttributeFn>> = OnceLock::new();
        *FN_CACHE.get_or_init(|| unsafe {
            let module = LoadLibraryA(c"dwmapi.dll".as_ptr());
            if module.is_null() {
                return None;
            }
            let proc_addr = GetProcAddress(module, c"DwmSetWindowAttribute".as_ptr());
            if proc_addr.is_null() {
                return None;
            }
            Some(std::mem::transmute::<*mut c_void, DwmSetWindowAttributeFn>(
                proc_addr,
            ))
        })
    }

    pub fn set_window_cloaked(window: &WebviewWindow, cloaked: bool) -> bool {
        let Some(func) = resolve_dwm_set_window_attribute() else {
            return false;
        };
        let Ok(hwnd) = window.hwnd() else {
            return false;
        };
        let value: i32 = if cloaked { 1 } else { 0 };
        // SAFETY: hwnd 与 value 指针及长度均按 Win32 DwmSetWindowAttribute(DWMWA_CLOAK) 规范传入
        let hr = unsafe {
            func(
                hwnd.0,
                DWMWA_CLOAK,
                (&value as *const i32).cast::<c_void>(),
                std::mem::size_of::<i32>() as u32,
            )
        };
        hr == 0
    }
}

#[cfg(not(target_os = "windows"))]
mod win_cloak {
    use tauri::WebviewWindow;

    pub fn set_window_cloaked(_window: &WebviewWindow, _cloaked: bool) -> bool {
        false
    }
}

/// 获取与当前主题对应的原生窗口底色（对齐前端 App.jsx 背景色）
fn theme_background_color(is_dark: bool) -> Color {
    if is_dark {
        Color(0x1e, 0x1e, 0x1e, 255)
    } else {
        Color(0xff, 0xff, 0xff, 255)
    }
}

/// 幂等地解除 Windows DWM 窗口遮罩，确保首帧合成后再完整呈现给用户
fn uncloak_window_once(window: &WebviewWindow, state: &WindowStateManager) {
    if !state.mark_uncloaked_once() {
        return;
    }
    win_cloak::set_window_cloaked(window, false);
    let _ = window.set_focus();
}

/// 幂等地显示主窗口，并在首次启动尚无基线时记录默认几何快照
fn reveal_main_window(
    window: &WebviewWindow,
    state: &WindowStateManager,
    is_dark: Option<bool>,
    from_frontend: bool,
) {
    if !state.mark_shown_once() {
        return;
    }

    log::info!(
        "显示主窗口 (来源: {}, is_dark: {:?})",
        if from_frontend { "frontend" } else { "fallback_timeout" },
        is_dark
    );

    if let Some(dark) = is_dark {
        let _ = window.set_background_color(Some(theme_background_color(dark)));
    }

    // Windows 下先通过 DWM Cloak 保持视觉隐身再 show()，让 WebView2 唤醒合成器画完首帧后再揭开
    let cloaked = from_frontend && win_cloak::set_window_cloaked(window, true);

    let _ = window.show();
    if !cloaked {
        state.mark_uncloaked_once();
        let _ = window.set_focus();
    } else {
        #[cfg(target_os = "windows")]
        {
            let app_handle = window.app_handle().clone();
            std::thread::spawn(move || {
                std::thread::sleep(Duration::from_millis(UNCLOAK_FALLBACK_TIMEOUT_MS));
                let state = app_handle.state::<WindowStateManager>();
                if let Some(win) = app_handle.get_webview_window("main") {
                    uncloak_window_once(&win, &state);
                }
            });
        }
    }

    // 若开启记忆且尚未有基线快照（例如首次启动），采样当前默认窗口作为后续还原基线
    if state.is_enabled() && state.get_snapshot().is_none() {
        if let Some(sample) = sample_live_window(window) {
            let initial = merge_window_snapshot(None, &sample);
            state.set_snapshot(initial);
        }
    }
}

/// 启动阶段：恢复主窗口尺寸/位置/最大化状态（保持隐藏等待首帧就绪后显示），并挂载事件监听
pub fn setup_main_window(app: &tauri::App) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    // 启动初期先按系统主题设置窗口容器底色，配合前端首帧就绪后显窗，避免白屏闪现
    let system_dark = matches!(window.theme(), Ok(Theme::Dark));
    let _ = window.set_background_color(Some(theme_background_color(system_dark)));

    let app_handle = app.handle().clone();
    let manager = app.state::<WindowStateManager>();
    let (enabled, saved_opt) = load_persisted_config(&app_handle);
    manager.set_enabled_flag(enabled);

    if enabled {
        if let Some(saved) = saved_opt {
            let monitors: Vec<MonitorWorkArea> = window
                .available_monitors()
                .unwrap_or_default()
                .iter()
                .map(MonitorWorkArea::from_monitor)
                .collect();
            let primary = window
                .primary_monitor()
                .ok()
                .flatten()
                .map(|m| MonitorWorkArea::from_monitor(&m));

            if let Some(placement) = resolve_restored_geometry(&saved, &monitors, primary) {
                match placement {
                    RestoredPlacement::Positioned {
                        x,
                        y,
                        width,
                        height,
                        maximized,
                    } => {
                        // 先移动位置以匹配目标显示器 DPI，再设置物理尺寸
                        let _ = window.set_position(Position::Physical(PhysicalPosition::new(x, y)));
                        let _ = window.set_size(Size::Physical(PhysicalSize::new(width, height)));
                        if maximized {
                            let _ = window.maximize();
                        }
                        manager.set_snapshot(Some(PersistedWindowState {
                            x,
                            y,
                            width,
                            height,
                            maximized,
                        }));
                    }
                    RestoredPlacement::CenteredFallback {
                        width,
                        height,
                        maximized,
                    } => {
                        let _ = window.set_size(Size::Physical(PhysicalSize::new(width, height)));
                        let _ = window.center();
                        // 在 maximize() 之前采样居中后的普通位置，避免记录成最大化边界坐标
                        let centered_pos = window.outer_position().ok();
                        if maximized {
                            let _ = window.maximize();
                        }
                        if let Some(pos) = centered_pos {
                            manager.set_snapshot(Some(PersistedWindowState {
                                x: pos.x,
                                y: pos.y,
                                width,
                                height,
                                maximized,
                            }));
                        } else {
                            manager.set_snapshot(Some(saved));
                        }
                    }
                }
            }
        }
    }

    // 超时兜底显窗：即使前端脚本异常未及时通知，也能保证窗口不会永久隐身
    let fallback_app = app_handle.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(REVEAL_FALLBACK_TIMEOUT_MS));
        let state = fallback_app.state::<WindowStateManager>();
        if !state.is_shown() {
            if let Some(win) = fallback_app.get_webview_window("main") {
                reveal_main_window(&win, &state, None, false);
            }
        }
    });

    manager.ensure_debounce_worker(app_handle.clone());

    let window_clone = window.clone();
    window.on_window_event(move |event| {
        let state = app_handle.state::<WindowStateManager>();
        match event {
            WindowEvent::Moved(_) | WindowEvent::Resized(_) => {
                // 显窗前忽略操作系统或布局初始化触发的瞬态事件，防止覆盖已恢复快照
                if !state.is_shown() || !state.is_enabled() {
                    return;
                }
                if let Some(sample) = sample_live_window(&window_clone) {
                    let prev = state.get_snapshot();
                    let next = compute_next_snapshot(&window_clone, prev.as_ref(), &sample, false);
                    if next != prev {
                        state.set_snapshot(next);
                        state.schedule_debounced_save();
                    }
                }
            }
            WindowEvent::CloseRequested { .. } => {
                if !state.is_enabled() {
                    return;
                }
                if let Some(sample) = sample_live_window(&window_clone) {
                    let prev = state.get_snapshot();
                    let next = compute_next_snapshot(&window_clone, prev.as_ref(), &sample, false);
                    state.set_snapshot(next);
                }
                flush_snapshot_internal(
                    &app_handle,
                    &state.enabled,
                    &state.snapshot,
                    &state.persist_lock,
                );
            }
            WindowEvent::Destroyed if state.is_enabled() => {
                flush_snapshot_internal(
                    &app_handle,
                    &state.enabled,
                    &state.snapshot,
                    &state.persist_lock,
                );
            }
            _ => {}
        }
    });
}

/// 前端首帧渲染就绪后调用：同步主题底色并显示主窗口（幂等，仅首次生效）
#[tauri::command]
pub fn show_main_window(
    window: WebviewWindow,
    state: State<'_, WindowStateManager>,
    is_dark: Option<bool>,
) {
    reveal_main_window(&window, &state, is_dark, true);
}

/// 前端确认 GPU 合成器完成首帧绘制后调用：解除 DWM 遮罩以零白屏呈现窗口
#[tauri::command]
pub fn uncloak_main_window(window: WebviewWindow, state: State<'_, WindowStateManager>) {
    uncloak_window_once(&window, &state);
}

/// 读取“记住窗口大小与位置”开关状态
#[tauri::command]
pub fn get_remember_window_state(
    app: AppHandle,
    state: State<'_, WindowStateManager>,
) -> Result<bool, String> {
    if let Ok(store) = app.store(SETTINGS_STORE_FILE) {
        if let Some(val) = store
            .get(KEY_REMEMBER_WINDOW_STATE)
            .and_then(|v| v.as_bool())
        {
            state.set_enabled_flag(val);
            return Ok(val);
        }
    }
    Ok(state.is_enabled())
}

/// 计算当前显示器居中的默认普通窗口矩形（当在最大化状态下重新开启记忆且无历史普通尺寸时作为还原基线）
fn default_centered_bounds(window: &WebviewWindow, maximized: bool) -> PersistedWindowState {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    if let Some(mon) = monitor {
        let scale = mon.scale_factor();
        let area = MonitorWorkArea::from_monitor(&mon);
        let width = ((DEFAULT_LOGICAL_WIDTH * scale).round() as u32)
            .min(area.width)
            .max(MIN_VALID_WIDTH.min(area.width));
        let height = ((DEFAULT_LOGICAL_HEIGHT * scale).round() as u32)
            .min(area.height)
            .max(MIN_VALID_HEIGHT.min(area.height));
        let x = area.x + ((area.width as i32 - width as i32) / 2);
        let y = area.y + ((area.height as i32 - height as i32) / 2);
        return PersistedWindowState {
            x,
            y,
            width,
            height,
            maximized,
        };
    }

    PersistedWindowState {
        x: 0,
        y: 0,
        width: DEFAULT_LOGICAL_WIDTH as u32,
        height: DEFAULT_LOGICAL_HEIGHT as u32,
        maximized,
    }
}

/// 结合实时采样更新快照；当首次即以最大化状态捕获且尚无普通尺寸基线时，补充居中默认尺寸作为还原基线
fn compute_next_snapshot(
    window: &WebviewWindow,
    prev: Option<&PersistedWindowState>,
    sample: &LiveWindowSample,
    fallback_on_untracked_hidden: bool,
) -> Option<PersistedWindowState> {
    if let Some(merged) = merge_window_snapshot(prev, sample) {
        return Some(merged);
    }
    if sample.maximized
        || (fallback_on_untracked_hidden && (sample.minimized || sample.fullscreen))
    {
        return Some(default_centered_bounds(window, sample.maximized));
    }
    None
}

/// 更新“记住窗口大小与位置”开关状态并立即同步持久化存储
#[tauri::command]
pub fn set_remember_window_state(
    app: AppHandle,
    window: WebviewWindow,
    state: State<'_, WindowStateManager>,
    enabled: bool,
) -> Result<(), String> {
    let _persist_guard = state
        .persist_lock
        .lock()
        .map_err(|_| "获取窗口状态写入锁失败".to_string())?;

    state.set_enabled_flag(enabled);

    let store = app
        .store(SETTINGS_STORE_FILE)
        .map_err(|e| format!("打开设置存储失败: {}", e))?;

    store.set(KEY_REMEMBER_WINDOW_STATE, serde_json::json!(enabled));

    if enabled {
        if let Some(sample) = sample_live_window(&window) {
            let prev = state.get_snapshot();
            let merged = compute_next_snapshot(&window, prev.as_ref(), &sample, true);
            state.set_snapshot(merged.clone());
            if let Some(snap) = merged {
                let json_val = serde_json::to_value(&snap)
                    .map_err(|e| format!("序列化窗口状态失败: {}", e))?;
                store.set(KEY_WINDOW_STATE, json_val);
            }
        }
    } else {
        // 关闭开关时同步清理旧几何缓存，确保下次重启和重新开启时状态干净
        state.set_snapshot(None);
        let _ = store.delete(KEY_WINDOW_STATE);
    }

    store
        .save()
        .map_err(|e| format!("保存窗口设置失败: {}", e))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_monitor(x: i32, y: i32, width: u32, height: u32) -> MonitorWorkArea {
        MonitorWorkArea {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn test_merge_window_snapshot_preserves_normal_bounds_when_maximized() {
        let prev = PersistedWindowState {
            x: 120,
            y: 80,
            width: 1010,
            height: 680,
            maximized: false,
        };

        let maximized_sample = LiveWindowSample {
            x: -8,
            y: -8,
            width: 1920,
            height: 1040,
            maximized: true,
            minimized: false,
            fullscreen: false,
        };

        let next = merge_window_snapshot(Some(&prev), &maximized_sample)
            .expect("should keep normal bounds with maximized=true");

        assert_eq!(next.x, 120);
        assert_eq!(next.y, 80);
        assert_eq!(next.width, 1010);
        assert_eq!(next.height, 680);
        assert!(next.maximized);
    }

    #[test]
    fn test_merge_window_snapshot_ignores_minimized_and_fullscreen() {
        let prev = PersistedWindowState {
            x: 200,
            y: 100,
            width: 1100,
            height: 720,
            maximized: false,
        };

        // Windows 最小化时坐标常为 -32000，宽高为 160x28
        let minimized_sample = LiveWindowSample {
            x: -32000,
            y: -32000,
            width: 160,
            height: 28,
            maximized: false,
            minimized: true,
            fullscreen: false,
        };
        assert_eq!(
            merge_window_snapshot(Some(&prev), &minimized_sample),
            Some(prev.clone())
        );

        let fullscreen_sample = LiveWindowSample {
            x: 0,
            y: 0,
            width: 1920,
            height: 1080,
            maximized: false,
            minimized: false,
            fullscreen: true,
        };
        assert_eq!(
            merge_window_snapshot(Some(&prev), &fullscreen_sample),
            Some(prev)
        );
    }

    #[test]
    fn test_merge_window_snapshot_updates_when_restored_from_maximized() {
        let prev = PersistedWindowState {
            x: 100,
            y: 100,
            width: 1010,
            height: 680,
            maximized: true,
        };

        let restored_sample = LiveWindowSample {
            x: 240,
            y: 150,
            width: 1200,
            height: 760,
            maximized: false,
            minimized: false,
            fullscreen: false,
        };

        let next = merge_window_snapshot(Some(&prev), &restored_sample).unwrap();
        assert_eq!(
            next,
            PersistedWindowState {
                x: 240,
                y: 150,
                width: 1200,
                height: 760,
                maximized: false,
            }
        );
    }

    #[test]
    fn test_resolve_restored_geometry_on_primary_monitor_and_clamps_top() {
        let monitors = vec![sample_monitor(0, 0, 1920, 1040)];
        let saved = PersistedWindowState {
            x: 150,
            y: -25, // 模拟异常偏上，需钳位到工作区顶部避免无边框标题栏不可拖
            width: 1200,
            height: 800,
            maximized: true,
        };

        let placement = resolve_restored_geometry(&saved, &monitors, Some(monitors[0])).unwrap();
        assert_eq!(
            placement,
            RestoredPlacement::Positioned {
                x: 150,
                y: 0,
                width: 1200,
                height: 800,
                maximized: true,
            }
        );
    }

    #[test]
    fn test_resolve_restored_geometry_falls_back_when_secondary_monitor_disconnected() {
        let primary = sample_monitor(0, 0, 1920, 1040);
        // 曾经摆在右侧副屏 (x=2100)
        let saved = PersistedWindowState {
            x: 2100,
            y: 100,
            width: 1280,
            height: 800,
            maximized: true,
        };

        let placement = resolve_restored_geometry(&saved, &[primary], Some(primary)).unwrap();
        assert_eq!(
            placement,
            RestoredPlacement::CenteredFallback {
                width: 1280,
                height: 800,
                maximized: true,
            }
        );
    }

    #[test]
    fn test_resolve_restored_geometry_rejects_corrupted_small_dimensions() {
        let primary = sample_monitor(0, 0, 1920, 1040);
        let corrupted = PersistedWindowState {
            x: 100,
            y: 100,
            width: 80,
            height: 40,
            maximized: false,
        };

        assert_eq!(
            resolve_restored_geometry(&corrupted, &[primary], Some(primary)),
            None
        );
    }

    #[test]
    fn test_window_state_manager_mark_shown_once_is_idempotent() {
        let mgr = WindowStateManager::default();
        assert!(!mgr.is_shown());
        assert!(mgr.mark_shown_once());
        assert!(mgr.is_shown());
        assert!(!mgr.mark_shown_once());
    }

    #[test]
    fn test_theme_background_color_matches_dark_and_light() {
        assert_eq!(theme_background_color(true), Color(0x1e, 0x1e, 0x1e, 255));
        assert_eq!(theme_background_color(false), Color(0xff, 0xff, 0xff, 255));
    }
}

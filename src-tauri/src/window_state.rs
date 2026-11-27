use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};
#[cfg(not(test))]
use std::time::Duration;
use std::time::{SystemTime, UNIX_EPOCH};
#[cfg(not(test))]
use tauri::{
    window::Color, AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Position, Size,
    State, Theme, WebviewWindow, WindowEvent,
};
#[cfg(not(test))]
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

/// 合法窗口尺寸上下限（避免异常或损坏数据导致窗口过小或无限巨大）
const MIN_VALID_WIDTH: u32 = 400;
const MIN_VALID_HEIGHT: u32 = 300;
const MAX_VALID_WIDTH: u32 = 16_384;
const MAX_VALID_HEIGHT: u32 = 16_384;

/// 合法显示器缩放比例区间
const MIN_VALID_SCALE_FACTOR: f64 = 0.25;
const MAX_VALID_SCALE_FACTOR: f64 = 8.0;

/// 判断窗口尺寸是否已几乎占满显示器工作区的物理像素容差
const WORK_AREA_FULL_TOLERANCE: u32 = 24;

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

/// 校验缩放因子是否处于合理有限区间
fn is_valid_scale_factor(scale: f64) -> bool {
    scale.is_finite() && (MIN_VALID_SCALE_FACTOR..=MAX_VALID_SCALE_FACTOR).contains(&scale)
}

/// 持久化存储的窗口几何与最大化状态（均使用物理像素）
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct PersistedWindowState {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scale_factor: Option<f64>,
}

impl PersistedWindowState {
    /// 校验宽高及缩放比例是否达到合法可用范围
    pub fn is_valid_dimensions(&self) -> bool {
        let valid_dims = (MIN_VALID_WIDTH..=MAX_VALID_WIDTH).contains(&self.width)
            && (MIN_VALID_HEIGHT..=MAX_VALID_HEIGHT).contains(&self.height);
        let valid_scale = self.scale_factor.map_or(true, is_valid_scale_factor);
        valid_dims && valid_scale
    }
}

/// 显示器工作区矩形（物理像素）
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MonitorWorkArea {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f64,
}

#[cfg(not(test))]
impl MonitorWorkArea {
    fn from_monitor(monitor: &Monitor) -> Self {
        let area = monitor.work_area();
        let scale = monitor.scale_factor();
        Self {
            x: area.position.x,
            y: area.position.y,
            width: area.size.width,
            height: area.size.height,
            scale_factor: if is_valid_scale_factor(scale) {
                scale
            } else {
                1.0
            },
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
#[derive(Clone, Debug, PartialEq)]
pub struct LiveWindowSample {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
    pub maximized: bool,
    pub minimized: bool,
    pub fullscreen: bool,
    pub scale_factor: Option<f64>,
    pub monitor_work_area: Option<MonitorWorkArea>,
}

/// 全局窗口状态管理器（由 Tauri State 托管）
pub struct WindowStateManager {
    /// 是否启用窗口状态记忆（默认 true）
    enabled: Arc<AtomicBool>,
    /// 主窗口是否已完成首帧显窗（确保只触发一次）
    shown: Arc<AtomicBool>,
    /// 主窗口显窗后的运行期事件监听是否已就绪（在 window.show() 之后置位）
    events_ready: Arc<AtomicBool>,
    /// 主窗口是否已完成 DWM 解封显示（仅触发一次）
    uncloaked: Arc<AtomicBool>,
    /// 正在主动执行几何自愈/还原时的防重入守卫
    restoring_geometry: Arc<AtomicBool>,
    /// 关闭流程是否已完成同步落盘（防止 CloseRequested 与 Destroyed 重复写入）
    closed_flushed: Arc<AtomicBool>,
    /// 内存中保存的最近一次有效窗口快照（最大化和还原时保护普通尺寸不被覆盖）
    snapshot: Arc<Mutex<Option<PersistedWindowState>>>,
    /// 串行化磁盘写入锁，避免后台防抖线程与同步关闭/开关变更产生写入竞态
    persist_lock: Arc<Mutex<()>>,
    /// 防抖保存通道发送端（容量为 1，O(1) 非阻塞合并事件）
    save_tx: Mutex<Option<mpsc::SyncSender<()>>>,
}

impl Default for WindowStateManager {
    fn default() -> Self {
        Self {
            enabled: Arc::new(AtomicBool::new(true)),
            shown: Arc::new(AtomicBool::new(false)),
            events_ready: Arc::new(AtomicBool::new(false)),
            uncloaked: Arc::new(AtomicBool::new(false)),
            restoring_geometry: Arc::new(AtomicBool::new(false)),
            closed_flushed: Arc::new(AtomicBool::new(false)),
            snapshot: Arc::new(Mutex::new(None)),
            persist_lock: Arc::new(Mutex::new(())),
            save_tx: Mutex::new(None),
        }
    }
}

/// 几何自愈防重入守卫（离开作用域自动复位）
#[cfg(not(test))]
struct RestoringGeometryGuard {
    flag: Arc<AtomicBool>,
}

#[cfg(not(test))]
impl RestoringGeometryGuard {
    fn try_acquire(flag: &Arc<AtomicBool>) -> Option<Self> {
        flag.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .ok()
            .map(|_| Self {
                flag: Arc::clone(flag),
            })
    }
}

#[cfg(not(test))]
impl Drop for RestoringGeometryGuard {
    fn drop(&mut self) {
        self.flag.store(false, Ordering::Release);
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

    /// 读取运行期窗口事件采样是否已就绪
    pub fn is_events_ready(&self) -> bool {
        self.events_ready.load(Ordering::Acquire)
    }

    /// 原子标记窗口已显示，仅首次返回 true
    fn mark_shown_once(&self) -> bool {
        self.shown
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }

    /// 标记运行期窗口事件采样已就绪
    #[cfg(not(test))]
    fn mark_events_ready(&self) {
        self.events_ready.store(true, Ordering::Release);
    }

    /// 判断是否正在执行几何还原
    #[cfg(not(test))]
    fn is_restoring_geometry(&self) -> bool {
        self.restoring_geometry.load(Ordering::Acquire)
    }

    /// 判断关闭流程是否已完成刷盘
    #[cfg(not(test))]
    fn is_closed_flushed(&self) -> bool {
        self.closed_flushed.load(Ordering::Acquire)
    }

    /// 标记关闭流程已完成刷盘
    #[cfg(not(test))]
    fn mark_closed_flushed(&self) {
        self.closed_flushed.store(true, Ordering::Release);
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
    #[cfg(not(test))]
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

/// 纯函数：判断窗口宽高是否已几乎占满目标显示器工作区（物理像素）
pub fn is_covering_work_area(width: u32, height: u32, area: &MonitorWorkArea) -> bool {
    if area.width == 0 || area.height == 0 {
        return false;
    }
    width >= area.width.saturating_sub(WORK_AREA_FULL_TOLERANCE)
        && height >= area.height.saturating_sub(WORK_AREA_FULL_TOLERANCE)
}

/// 纯函数：合并实时窗口采样与已有快照
/// - 最小化或全屏状态下直接忽略，保留原快照
/// - 最大化状态下仅翻转 `maximized = true`，保留原有普通 `x/y/width/height/scale_factor`
/// - 若原快照为最大化且当前 `sample.maximized == false` 但尺寸仍占满工作区，则保护原普通几何不被全屏尺寸覆盖
/// - 普通状态下（非最大化、非最小化、非全屏）更新完整坐标、尺寸与缩放因子
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

    if sample.width < MIN_VALID_WIDTH
        || sample.height < MIN_VALID_HEIGHT
        || sample.width > MAX_VALID_WIDTH
        || sample.height > MAX_VALID_HEIGHT
    {
        return prev.cloned();
    }

    // 最大化退出瞬态或 WM_DPICHANGED 丢标志后尺寸仍占满工作区时，保护原有普通小窗口几何不被覆盖
    if let (Some(existing), Some(area)) = (prev, sample.monitor_work_area.as_ref()) {
        if existing.maximized
            && existing.is_valid_dimensions()
            && is_covering_work_area(sample.width, sample.height, area)
        {
            return Some(PersistedWindowState {
                maximized: false,
                ..existing.clone()
            });
        }
    }

    let valid_scale = sample.scale_factor.filter(|&s| is_valid_scale_factor(s));

    Some(PersistedWindowState {
        x: sample.x,
        y: sample.y,
        width: sample.width,
        height: sample.height,
        maximized: false,
        scale_factor: valid_scale,
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

/// 根据目标显示器缩放因子计算默认物理宽高
fn default_physical_size_for_scale(scale_factor: f64) -> (u32, u32) {
    let scale = if is_valid_scale_factor(scale_factor) {
        scale_factor
    } else {
        1.0
    };
    (
        (DEFAULT_LOGICAL_WIDTH * scale).round() as u32,
        (DEFAULT_LOGICAL_HEIGHT * scale).round() as u32,
    )
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
        // 旧污染配置自愈：若历史快照为最大化且普通尺寸已占满目标工作区，则重置为居中默认尺寸
        if saved.maximized && is_covering_work_area(saved.width, saved.height, &monitor) {
            let (def_w, def_h) = default_physical_size_for_scale(monitor.scale_factor);
            let (cx, cy, cw, ch) = centered_geometry_in_area(&monitor, def_w, def_h);
            return Some(RestoredPlacement::Positioned {
                x: cx,
                y: cy,
                width: cw,
                height: ch,
                maximized: true,
            });
        }

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
        Some(target) => {
            let (mut desired_w, mut desired_h) = (saved.width, saved.height);

            // 若记录了原显示器 DPI，且与回退目标显示器不同，按比例换算物理宽高以维持逻辑视觉尺寸
            if let Some(saved_scale) = saved.scale_factor {
                if is_valid_scale_factor(saved_scale)
                    && is_valid_scale_factor(target.scale_factor)
                    && (target.scale_factor - saved_scale).abs() > f64::EPSILON
                {
                    let ratio = target.scale_factor / saved_scale;
                    desired_w = (f64::from(saved.width) * ratio).round().max(1.0) as u32;
                    desired_h = (f64::from(saved.height) * ratio).round().max(1.0) as u32;
                }
            }

            // 旧污染配置自愈：若换算后在目标工作区仍占满屏幕，替换为目标显示器默认逻辑尺寸
            if saved.maximized && is_covering_work_area(desired_w, desired_h, &target) {
                let (def_w, def_h) = default_physical_size_for_scale(target.scale_factor);
                desired_w = def_w;
                desired_h = def_h;
            }

            (
                desired_w
                    .min(target.width)
                    .max(MIN_VALID_WIDTH.min(target.width)),
                desired_h
                    .min(target.height)
                    .max(MIN_VALID_HEIGHT.min(target.height)),
            )
        }
        None => (saved.width, saved.height),
    };

    Some(RestoredPlacement::CenteredFallback {
        width: fallback_w,
        height: fallback_h,
        maximized: saved.maximized,
    })
}

/// 检查并在设置文件损坏（非合法 JSON Object）时先备份原文件，防止空 Store 静默覆盖历史进度
pub fn backup_corrupt_settings_file(path: &Path) -> bool {
    if !path.exists() {
        return false;
    }

    let Ok(bytes) = std::fs::read(path) else {
        return false;
    };

    if let Ok(serde_json::Value::Object(_)) = serde_json::from_slice::<serde_json::Value>(&bytes) {
        return false;
    }

    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(SETTINGS_STORE_FILE);

    let mut backup_path = path.with_file_name(format!("{}.corrupt.{}.bak", file_name, ts));
    if backup_path.exists() {
        for idx in 1..=100 {
            let candidate =
                path.with_file_name(format!("{}.corrupt.{}.{}.bak", file_name, ts, idx));
            if !candidate.exists() {
                backup_path = candidate;
                break;
            }
        }
    }

    match std::fs::rename(path, &backup_path) {
        Ok(()) => {
            log::warn!("检测到损坏的设置文件，已备份至 {:?}", backup_path);
            true
        }
        Err(err) => {
            log::warn!("备份损坏的设置文件失败 ({:?}): {}", path, err);
            false
        }
    }
}

/// 从 Store 读取设置开关与历史窗口状态（读取失败时返回安全默认值）
#[cfg(not(test))]
fn load_persisted_config(app: &AppHandle) -> (bool, Option<PersistedWindowState>) {
    if let Ok(app_data_dir) = app.path().app_data_dir() {
        let settings_path = app_data_dir.join(SETTINGS_STORE_FILE);
        backup_corrupt_settings_file(&settings_path);
    }

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
#[cfg(not(test))]
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

/// Windows 原生窗口状态查询（通过 user32.dll 动态解析，避免受 tao 内存缓存标志滞后影响）
#[cfg(all(not(test), target_os = "windows"))]
mod win_native {
    use std::ffi::{c_char, c_void};
    use std::sync::OnceLock;
    use tauri::WebviewWindow;

    const SW_SHOWMINIMIZED: u32 = 2;
    const SW_SHOWMAXIMIZED: u32 = 3;

    #[repr(C)]
    #[derive(Default)]
    struct Point {
        x: i32,
        y: i32,
    }

    #[repr(C)]
    #[derive(Default)]
    struct Rect {
        left: i32,
        top: i32,
        right: i32,
        bottom: i32,
    }

    #[repr(C)]
    #[derive(Default)]
    struct WindowPlacement {
        length: u32,
        flags: u32,
        show_cmd: u32,
        pt_min_position: Point,
        pt_max_position: Point,
        rc_normal_position: Rect,
    }

    type IsZoomedFn = unsafe extern "system" fn(hwnd: *mut c_void) -> i32;
    type IsIconicFn = unsafe extern "system" fn(hwnd: *mut c_void) -> i32;
    type GetWindowPlacementFn =
        unsafe extern "system" fn(hwnd: *mut c_void, lpwndpl: *mut WindowPlacement) -> i32;

    struct User32Procs {
        is_zoomed: IsZoomedFn,
        is_iconic: IsIconicFn,
        get_window_placement: GetWindowPlacementFn,
    }

    extern "system" {
        fn LoadLibraryA(lp_lib_file_name: *const c_char) -> *mut c_void;
        fn GetProcAddress(h_module: *mut c_void, lp_proc_name: *const c_char) -> *mut c_void;
    }

    fn resolve_user32_procs() -> Option<&'static User32Procs> {
        static CACHE: OnceLock<Option<User32Procs>> = OnceLock::new();
        CACHE
            .get_or_init(|| unsafe {
                let module = LoadLibraryA(c"user32.dll".as_ptr());
                if module.is_null() {
                    return None;
                }
                let p_zoomed = GetProcAddress(module, c"IsZoomed".as_ptr());
                let p_iconic = GetProcAddress(module, c"IsIconic".as_ptr());
                let p_placement = GetProcAddress(module, c"GetWindowPlacement".as_ptr());
                if p_zoomed.is_null() || p_iconic.is_null() || p_placement.is_null() {
                    return None;
                }
                Some(User32Procs {
                    is_zoomed: std::mem::transmute::<*mut c_void, IsZoomedFn>(p_zoomed),
                    is_iconic: std::mem::transmute::<*mut c_void, IsIconicFn>(p_iconic),
                    get_window_placement: std::mem::transmute::<*mut c_void, GetWindowPlacementFn>(
                        p_placement,
                    ),
                })
            })
            .as_ref()
    }

    /// 同步查询 Win32 真实窗口状态，返回 (maximized, minimized)
    pub fn query_native_window_flags(window: &WebviewWindow) -> Option<(bool, bool)> {
        let procs = resolve_user32_procs()?;
        let Ok(hwnd) = window.hwnd() else {
            return None;
        };
        if hwnd.0.is_null() {
            return None;
        }

        let mut wp = WindowPlacement {
            length: std::mem::size_of::<WindowPlacement>() as u32,
            ..Default::default()
        };

        // SAFETY: hwnd 非空且 wp.length 已按 Win32 GetWindowPlacement 规范初始化
        let (zoomed, iconic, placement_ok) = unsafe {
            (
                (procs.is_zoomed)(hwnd.0) != 0,
                (procs.is_iconic)(hwnd.0) != 0,
                (procs.get_window_placement)(hwnd.0, &mut wp) != 0,
            )
        };

        let maximized = zoomed || (placement_ok && wp.show_cmd == SW_SHOWMAXIMIZED);
        let minimized = iconic || (placement_ok && wp.show_cmd == SW_SHOWMINIMIZED);
        Some((maximized, minimized))
    }
}

#[cfg(all(not(test), not(target_os = "windows")))]
mod win_native {
    use tauri::WebviewWindow;

    pub fn query_native_window_flags(_window: &WebviewWindow) -> Option<(bool, bool)> {
        None
    }
}

/// 跨平台权威判断主窗口是否处于最大化状态
#[cfg(not(test))]
fn is_window_maximized_authoritative(window: &WebviewWindow) -> Option<bool> {
    let tauri_maximized = window.is_maximized().ok()?;
    let native_maximized = win_native::query_native_window_flags(window).map(|(m, _)| m);
    Some(native_maximized.map_or(tauri_maximized, |nm| tauri_maximized || nm))
}

/// 采样当前原生窗口的实时几何与状态
#[cfg(not(test))]
fn sample_live_window(window: &WebviewWindow) -> Option<LiveWindowSample> {
    let tauri_maximized = window.is_maximized().ok()?;
    let tauri_minimized = window.is_minimized().ok()?;
    let fullscreen = window.is_fullscreen().ok()?;
    let pos = window.outer_position().ok()?;
    let size = window.inner_size().ok()?;

    let (maximized, minimized) = match win_native::query_native_window_flags(window) {
        Some((native_max, native_min)) => {
            (tauri_maximized || native_max, tauri_minimized || native_min)
        }
        None => (tauri_maximized, tauri_minimized),
    };

    let monitor_work_area = window
        .current_monitor()
        .ok()
        .flatten()
        .map(|m| MonitorWorkArea::from_monitor(&m));

    let scale_factor = monitor_work_area
        .map(|m| m.scale_factor)
        .or_else(|| window.scale_factor().ok())
        .filter(|&s| is_valid_scale_factor(s));

    Some(LiveWindowSample {
        x: pos.x,
        y: pos.y,
        width: size.width,
        height: size.height,
        maximized,
        minimized,
        fullscreen,
        scale_factor,
        monitor_work_area,
    })
}

/// Windows DWM 窗口遮罩（Cloak）辅助：允许窗口先以 WS_VISIBLE 唤醒 WebView2 GPU 合成首帧，再瞬时揭开呈现
#[cfg(all(not(test), target_os = "windows"))]
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
        if hwnd.0.is_null() {
            return false;
        }
        let value: i32 = if cloaked { 1 } else { 0 };
        // SAFETY: hwnd 非空且 value 指针与长度均按 Win32 DwmSetWindowAttribute(DWMWA_CLOAK) 规范传入
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

#[cfg(all(not(test), not(target_os = "windows")))]
mod win_cloak {
    use tauri::WebviewWindow;

    pub fn set_window_cloaked(_window: &WebviewWindow, _cloaked: bool) -> bool {
        false
    }
}

/// 获取与当前主题对应的原生窗口底色 RGBA（对齐前端 App.jsx 背景色）
fn theme_background_rgba(is_dark: bool) -> (u8, u8, u8, u8) {
    if is_dark {
        (0x1e, 0x1e, 0x1e, 255)
    } else {
        (0xff, 0xff, 0xff, 255)
    }
}

/// 获取与当前主题对应的原生窗口底色（对齐前端 App.jsx 背景色）
#[cfg(not(test))]
fn theme_background_color(is_dark: bool) -> Color {
    let (r, g, b, a) = theme_background_rgba(is_dark);
    Color(r, g, b, a)
}

/// 幂等地解除 Windows DWM 窗口遮罩，确保首帧合成后再完整呈现给用户
#[cfg(not(test))]
fn uncloak_window_once(window: &WebviewWindow, state: &WindowStateManager) {
    if !state.mark_uncloaked_once() {
        return;
    }
    win_cloak::set_window_cloaked(window, false);
    let _ = window.set_focus();
}

/// 在启动阶段对隐藏窗口安全施加最大化，保持 DWM Cloak 直至 reveal_main_window 统一解封，避免 SW_MAXIMIZE -> SW_HIDE 造成空窗闪框
#[cfg(not(test))]
fn apply_initial_maximize_cloaked(window: &WebviewWindow) {
    let _ = win_cloak::set_window_cloaked(window, true);
    let _ = window.maximize();
}

/// 将窗口物理坐标与尺寸恢复为指定普通几何（先移动以匹配目标显示器 DPI 再设尺寸）
#[cfg(not(test))]
fn apply_normal_window_bounds(window: &WebviewWindow, bounds: &PersistedWindowState) {
    let _ = window.set_position(Position::Physical(PhysicalPosition::new(
        bounds.x, bounds.y,
    )));
    let _ = window.set_size(Size::Physical(PhysicalSize::new(
        bounds.width,
        bounds.height,
    )));
}

/// 从异常的全屏普通态自愈回目标普通小窗口尺寸，并更新内存快照与防抖落盘
#[cfg(not(test))]
fn heal_to_normal_window_bounds(
    window: &WebviewWindow,
    state: &WindowStateManager,
    prev: Option<&PersistedWindowState>,
    current_area: Option<&MonitorWorkArea>,
) {
    let Some(_guard) = RestoringGeometryGuard::try_acquire(&state.restoring_geometry) else {
        return;
    };

    let target = match prev {
        Some(existing)
            if existing.is_valid_dimensions()
                && !current_area
                    .is_some_and(|area| is_covering_work_area(existing.width, existing.height, area)) =>
        {
            PersistedWindowState {
                maximized: false,
                ..existing.clone()
            }
        }
        _ => default_centered_bounds(window, false),
    };

    apply_normal_window_bounds(window, &target);
    state.set_snapshot(Some(target));
    state.schedule_debounced_save();
}

/// 幂等地显示主窗口，并在首次启动尚无基线时记录默认几何快照
#[cfg(not(test))]
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
        if from_frontend {
            "frontend"
        } else {
            "fallback_timeout"
        },
        is_dark
    );

    if let Some(dark) = is_dark {
        let _ = window.set_background_color(Some(theme_background_color(dark)));
    }

    // Windows 下先通过 DWM Cloak 保持视觉隐身再 show()，让 WebView2 唤醒合成器画完首帧后再揭开
    let cloaked = from_frontend && win_cloak::set_window_cloaked(window, true);

    let _ = window.show();
    if !cloaked {
        win_cloak::set_window_cloaked(window, false);
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

    // 在 show() 及基线采样完成后再放开运行期事件采集，屏蔽显窗瞬态事件
    state.mark_events_ready();
}

/// 启动阶段：恢复主窗口尺寸/位置/最大化状态（保持隐藏等待首帧就绪后显示），并挂载事件监听
#[cfg(not(test))]
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
                            apply_initial_maximize_cloaked(&window);
                        }
                        let scale_factor = window
                            .current_monitor()
                            .ok()
                            .flatten()
                            .map(|m| m.scale_factor())
                            .or(saved.scale_factor)
                            .filter(|&s| is_valid_scale_factor(s));
                        manager.set_snapshot(Some(PersistedWindowState {
                            x,
                            y,
                            width,
                            height,
                            maximized,
                            scale_factor,
                        }));
                    }
                    RestoredPlacement::CenteredFallback {
                        width,
                        height,
                        maximized,
                    } => {
                        // 直接基于目标显示器工作区计算居中坐标并先定位再设尺寸，兼容跨 DPI 显示器且避免 macOS/Linux 异步 center() 采样失准
                        let target_monitor = primary.or_else(|| monitors.first().copied());
                        let centered_coords = if let Some(area) = target_monitor {
                            let (cx, cy, cw, ch) = centered_geometry_in_area(&area, width, height);
                            let _ = window
                                .set_position(Position::Physical(PhysicalPosition::new(cx, cy)));
                            let _ = window.set_size(Size::Physical(PhysicalSize::new(cw, ch)));
                            Some((cx, cy, cw, ch, Some(area.scale_factor)))
                        } else {
                            let _ =
                                window.set_size(Size::Physical(PhysicalSize::new(width, height)));
                            let _ = window.center();
                            let scale = window.scale_factor().ok().filter(|&s| is_valid_scale_factor(s));
                            window
                                .outer_position()
                                .ok()
                                .map(|pos| (pos.x, pos.y, width, height, scale))
                        };
                        if maximized {
                            apply_initial_maximize_cloaked(&window);
                        }
                        if let Some((cx, cy, cw, ch, scale_factor)) = centered_coords {
                            manager.set_snapshot(Some(PersistedWindowState {
                                x: cx,
                                y: cy,
                                width: cw,
                                height: ch,
                                maximized,
                                scale_factor,
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
                // 显窗及基线就绪前或正在主动几何自愈时忽略瞬态事件，防止覆盖已恢复快照
                if !state.is_events_ready()
                    || !state.is_enabled()
                    || state.is_restoring_geometry()
                {
                    return;
                }
                if let Some(sample) = sample_live_window(&window_clone) {
                    let prev = state.get_snapshot();
                    let covering_area = sample
                        .monitor_work_area
                        .as_ref()
                        .is_some_and(|area| is_covering_work_area(sample.width, sample.height, area));

                    // 若此前为最大化而当前非最大化/非最小化/非全屏且尺寸仍占满工作区（如 WM_DPICHANGED 丢标志锁死），主动自愈回普通窗口尺寸
                    if prev.as_ref().is_some_and(|p| p.maximized)
                        && !sample.maximized
                        && !sample.minimized
                        && !sample.fullscreen
                        && covering_area
                    {
                        heal_to_normal_window_bounds(
                            &window_clone,
                            &state,
                            prev.as_ref(),
                            sample.monitor_work_area.as_ref(),
                        );
                        return;
                    }

                    let next = compute_next_snapshot(&window_clone, prev.as_ref(), &sample, false);
                    if next != prev {
                        state.set_snapshot(next);
                        state.schedule_debounced_save();
                    }
                }
            }
            WindowEvent::ScaleFactorChanged { .. } => {
                if !state.is_events_ready()
                    || !state.is_enabled()
                    || state.is_restoring_geometry()
                {
                    return;
                }
                if let Some(sample) = sample_live_window(&window_clone) {
                    let prev = state.get_snapshot();
                    if sample.minimized || sample.fullscreen {
                        return;
                    }
                    if sample.maximized {
                        let next =
                            compute_next_snapshot(&window_clone, prev.as_ref(), &sample, false);
                        if next != prev {
                            state.set_snapshot(next);
                            state.schedule_debounced_save();
                        }
                        return;
                    }

                    // 非最大化状态下发生 DPI/拓扑变化，检查是否越出当前可见工作区
                    if let Some(candidate) = merge_window_snapshot(prev.as_ref(), &sample) {
                        let monitors: Vec<MonitorWorkArea> = window_clone
                            .available_monitors()
                            .unwrap_or_default()
                            .iter()
                            .map(MonitorWorkArea::from_monitor)
                            .collect();
                        let primary = window_clone
                            .primary_monitor()
                            .ok()
                            .flatten()
                            .map(|m| MonitorWorkArea::from_monitor(&m));

                        if let Some(placement) =
                            resolve_restored_geometry(&candidate, &monitors, primary)
                        {
                            match placement {
                                RestoredPlacement::Positioned {
                                    x,
                                    y,
                                    width,
                                    height,
                                    ..
                                } if x != sample.x
                                    || y != sample.y
                                    || width != sample.width
                                    || height != sample.height =>
                                {
                                    if let Some(_guard) =
                                        RestoringGeometryGuard::try_acquire(&state.restoring_geometry)
                                    {
                                        let corrected = PersistedWindowState {
                                            x,
                                            y,
                                            width,
                                            height,
                                            maximized: false,
                                            scale_factor: candidate.scale_factor,
                                        };
                                        apply_normal_window_bounds(&window_clone, &corrected);
                                        state.set_snapshot(Some(corrected));
                                        state.schedule_debounced_save();
                                    }
                                    return;
                                }
                                RestoredPlacement::CenteredFallback { width, height, .. } => {
                                    if let Some(_guard) =
                                        RestoringGeometryGuard::try_acquire(&state.restoring_geometry)
                                    {
                                        let target = primary.or_else(|| monitors.first().copied());
                                        let corrected = if let Some(area) = target {
                                            let (cx, cy, cw, ch) =
                                                centered_geometry_in_area(&area, width, height);
                                            PersistedWindowState {
                                                x: cx,
                                                y: cy,
                                                width: cw,
                                                height: ch,
                                                maximized: false,
                                                scale_factor: Some(area.scale_factor),
                                            }
                                        } else {
                                            default_centered_bounds(&window_clone, false)
                                        };
                                        apply_normal_window_bounds(&window_clone, &corrected);
                                        state.set_snapshot(Some(corrected));
                                        state.schedule_debounced_save();
                                    }
                                    return;
                                }
                                _ => {}
                            }
                        }

                        if Some(&candidate) != prev.as_ref() {
                            state.set_snapshot(Some(candidate));
                            state.schedule_debounced_save();
                        }
                    }
                }
            }
            WindowEvent::CloseRequested { .. } => {
                if !state.is_enabled() {
                    return;
                }
                if state.is_events_ready() {
                    if let Some(sample) = sample_live_window(&window_clone) {
                        let prev = state.get_snapshot();
                        let next =
                            compute_next_snapshot(&window_clone, prev.as_ref(), &sample, false);
                        state.set_snapshot(next);
                    }
                }
                flush_snapshot_internal(
                    &app_handle,
                    &state.enabled,
                    &state.snapshot,
                    &state.persist_lock,
                );
                state.mark_closed_flushed();
            }
            WindowEvent::Destroyed if state.is_enabled() && !state.is_closed_flushed() => {
                flush_snapshot_internal(
                    &app_handle,
                    &state.enabled,
                    &state.snapshot,
                    &state.persist_lock,
                );
                state.mark_closed_flushed();
            }
            _ => {}
        }
    });
}

/// 前端首帧渲染就绪后调用：同步主题底色并显示主窗口（幂等，仅首次生效）
#[cfg(not(test))]
#[tauri::command]
pub fn show_main_window(
    window: WebviewWindow,
    state: State<'_, WindowStateManager>,
    is_dark: Option<bool>,
) {
    reveal_main_window(&window, &state, is_dark, true);
}

/// 前端确认 GPU 合成器完成首帧绘制后调用：解除 DWM 遮罩以零白屏呈现窗口
#[cfg(not(test))]
#[tauri::command]
pub fn uncloak_main_window(window: WebviewWindow, state: State<'_, WindowStateManager>) {
    uncloak_window_once(&window, &state);
}

/// 权威查询主窗口当前是否处于最大化状态（优先结合 Win32 原生标志）
#[cfg(not(test))]
#[tauri::command]
pub fn is_main_window_maximized(window: WebviewWindow) -> Result<bool, String> {
    if let Some(maximized) = is_window_maximized_authoritative(&window) {
        return Ok(maximized);
    }
    window
        .is_maximized()
        .map_err(|e| format!("查询窗口最大化状态失败: {}", e))
}

/// 权威切换主窗口最大化/还原状态，并在系统还原仍占满屏幕时主动自愈回普通尺寸
#[cfg(not(test))]
#[tauri::command]
pub fn toggle_main_window_maximize(
    window: WebviewWindow,
    state: State<'_, WindowStateManager>,
) -> Result<bool, String> {
    let currently_maximized = is_window_maximized_authoritative(&window)
        .unwrap_or_else(|| window.is_maximized().unwrap_or(false));
    let prev = state.get_snapshot();

    if currently_maximized {
        window
            .unmaximize()
            .map_err(|e| format!("恢复窗口失败: {}", e))?;

        if state.is_enabled() {
            if let Some(sample) = sample_live_window(&window) {
                let still_covering = sample
                    .monitor_work_area
                    .as_ref()
                    .is_some_and(|area| is_covering_work_area(sample.width, sample.height, area));
                if still_covering {
                    if prev.is_some() {
                        heal_to_normal_window_bounds(
                            &window,
                            &state,
                            prev.as_ref(),
                            sample.monitor_work_area.as_ref(),
                        );
                    }
                } else {
                    let next = compute_next_snapshot(&window, prev.as_ref(), &sample, false);
                    if next != prev {
                        state.set_snapshot(next);
                        state.schedule_debounced_save();
                    }
                }
            }
        }
        return Ok(false);
    }

    // 处理 WM_DPICHANGED 丢标志锁死：系统标志已变成未最大化，但快照曾记录最大化且当前窗口仍占满工作区
    if prev.as_ref().is_some_and(|p| p.maximized) {
        if let Some(sample) = sample_live_window(&window) {
            let still_covering = sample
                .monitor_work_area
                .as_ref()
                .is_some_and(|area| is_covering_work_area(sample.width, sample.height, area));
            if still_covering {
                heal_to_normal_window_bounds(
                    &window,
                    &state,
                    prev.as_ref(),
                    sample.monitor_work_area.as_ref(),
                );
                return Ok(false);
            }
        }
    }

    window
        .maximize()
        .map_err(|e| format!("最大化窗口失败: {}", e))?;
    Ok(true)
}

/// 读取“记住窗口大小与位置”开关状态
#[cfg(not(test))]
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

/// 计算窗口在目标显示器工作区矩形内居中放置的安全物理几何坐标与宽高
fn centered_geometry_in_area(
    area: &MonitorWorkArea,
    desired_width: u32,
    desired_height: u32,
) -> (i32, i32, u32, u32) {
    let width = desired_width
        .min(area.width)
        .max(MIN_VALID_WIDTH.min(area.width));
    let height = desired_height
        .min(area.height)
        .max(MIN_VALID_HEIGHT.min(area.height));
    let x = area.x + ((area.width as i32 - width as i32) / 2);
    let y = area.y + ((area.height as i32 - height as i32) / 2);
    (x, y, width, height)
}

/// 计算当前显示器居中的默认普通窗口矩形（当在最大化状态下重新开启记忆且无历史普通尺寸时作为还原基线）
#[cfg(not(test))]
fn default_centered_bounds(window: &WebviewWindow, maximized: bool) -> PersistedWindowState {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| window.primary_monitor().ok().flatten());

    if let Some(mon) = monitor {
        let scale = mon.scale_factor();
        let valid_scale = if is_valid_scale_factor(scale) {
            scale
        } else {
            1.0
        };
        let area = MonitorWorkArea::from_monitor(&mon);
        let (def_w, def_h) = default_physical_size_for_scale(valid_scale);
        let (x, y, width, height) = centered_geometry_in_area(&area, def_w, def_h);
        return PersistedWindowState {
            x,
            y,
            width,
            height,
            maximized,
            scale_factor: Some(valid_scale),
        };
    }

    let raw_scale = window.scale_factor().unwrap_or(1.0);
    let valid_scale = if is_valid_scale_factor(raw_scale) {
        raw_scale
    } else {
        1.0
    };
    let (width, height) = default_physical_size_for_scale(valid_scale);

    PersistedWindowState {
        x: 0,
        y: 0,
        width,
        height,
        maximized,
        scale_factor: Some(valid_scale),
    }
}

/// 结合实时采样更新快照；当首次即以最大化状态捕获且尚无普通尺寸基线时，补充居中默认尺寸作为还原基线
#[cfg(not(test))]
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
#[cfg(not(test))]
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
            scale_factor: 1.0,
        }
    }

    fn sample_monitor_with_scale(
        x: i32,
        y: i32,
        width: u32,
        height: u32,
        scale_factor: f64,
    ) -> MonitorWorkArea {
        MonitorWorkArea {
            x,
            y,
            width,
            height,
            scale_factor,
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
            scale_factor: Some(1.0),
        };

        let maximized_sample = LiveWindowSample {
            x: -8,
            y: -8,
            width: 1920,
            height: 1040,
            maximized: true,
            minimized: false,
            fullscreen: false,
            scale_factor: Some(1.0),
            monitor_work_area: Some(sample_monitor(0, 0, 1920, 1040)),
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
            scale_factor: Some(1.0),
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
            scale_factor: Some(1.0),
            monitor_work_area: Some(sample_monitor(0, 0, 1920, 1040)),
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
            scale_factor: Some(1.0),
            monitor_work_area: Some(sample_monitor(0, 0, 1920, 1040)),
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
            scale_factor: Some(1.0),
        };

        let restored_sample = LiveWindowSample {
            x: 240,
            y: 150,
            width: 1200,
            height: 760,
            maximized: false,
            minimized: false,
            fullscreen: false,
            scale_factor: Some(1.0),
            monitor_work_area: Some(sample_monitor(0, 0, 1920, 1040)),
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
                scale_factor: Some(1.0),
            }
        );
    }

    #[test]
    fn test_merge_window_snapshot_protects_normal_bounds_when_unmaximized_still_covers_work_area()
    {
        let area = sample_monitor(0, 0, 1920, 1040);
        let prev = PersistedWindowState {
            x: 120,
            y: 80,
            width: 1010,
            height: 680,
            maximized: true,
            scale_factor: Some(1.0),
        };

        // 模拟最大化后瞬态 maximized=false（如最小化还原或 WM_DPICHANGED 丢标志）但尺寸仍占满工作区
        let transient_fullscreen = LiveWindowSample {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
            maximized: false,
            minimized: false,
            fullscreen: false,
            scale_factor: Some(1.0),
            monitor_work_area: Some(area),
        };

        let next = merge_window_snapshot(Some(&prev), &transient_fullscreen).unwrap();
        assert_eq!(
            next,
            PersistedWindowState {
                x: 120,
                y: 80,
                width: 1010,
                height: 680,
                maximized: false,
                scale_factor: Some(1.0),
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
            scale_factor: Some(1.0),
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
    fn test_resolve_restored_geometry_heals_polluted_maximized_fullscreen_snapshot() {
        let monitor = sample_monitor_with_scale(0, 0, 1920, 1040, 1.0);
        let polluted = PersistedWindowState {
            x: 0,
            y: 0,
            width: 1920,
            height: 1040,
            maximized: true,
            scale_factor: Some(1.0),
        };

        let placement = resolve_restored_geometry(&polluted, &[monitor], Some(monitor)).unwrap();
        assert_eq!(
            placement,
            RestoredPlacement::Positioned {
                x: 455,
                y: 180,
                width: 1010,
                height: 680,
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
            scale_factor: Some(1.0),
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
    fn test_resolve_restored_geometry_scales_across_dpi_on_fallback() {
        let primary_100 = sample_monitor_with_scale(0, 0, 1920, 1040, 1.0);
        // 原在 200% DPI 4K 副屏上的 2020x1360 物理像素窗口（对应 1010x680 逻辑尺寸）
        let saved_200 = PersistedWindowState {
            x: 2500,
            y: 100,
            width: 2020,
            height: 1360,
            maximized: false,
            scale_factor: Some(2.0),
        };

        let placement =
            resolve_restored_geometry(&saved_200, &[primary_100], Some(primary_100)).unwrap();
        assert_eq!(
            placement,
            RestoredPlacement::CenteredFallback {
                width: 1010,
                height: 680,
                maximized: false,
            }
        );
    }

    #[test]
    fn test_resolve_restored_geometry_rejects_corrupted_small_oversized_and_bad_scale() {
        let primary = sample_monitor(0, 0, 1920, 1040);
        let corrupted_small = PersistedWindowState {
            x: 100,
            y: 100,
            width: 80,
            height: 40,
            maximized: false,
            scale_factor: Some(1.0),
        };
        assert_eq!(
            resolve_restored_geometry(&corrupted_small, &[primary], Some(primary)),
            None
        );

        let corrupted_huge = PersistedWindowState {
            x: 100,
            y: 100,
            width: 20_000,
            height: 20_000,
            maximized: false,
            scale_factor: Some(1.0),
        };
        assert_eq!(
            resolve_restored_geometry(&corrupted_huge, &[primary], Some(primary)),
            None
        );

        let bad_scale = PersistedWindowState {
            x: 100,
            y: 100,
            width: 1010,
            height: 680,
            maximized: false,
            scale_factor: Some(12.0),
        };
        assert_eq!(
            resolve_restored_geometry(&bad_scale, &[primary], Some(primary)),
            None
        );

        let nan_scale = PersistedWindowState {
            x: 100,
            y: 100,
            width: 1010,
            height: 680,
            maximized: false,
            scale_factor: Some(f64::NAN),
        };
        assert_eq!(
            resolve_restored_geometry(&nan_scale, &[primary], Some(primary)),
            None
        );
    }

    #[test]
    fn test_persisted_window_state_deserializes_legacy_json_without_scale_factor() {
        let legacy_json = r#"{"x":100,"y":120,"width":1010,"height":680,"maximized":true}"#;
        let parsed: PersistedWindowState = serde_json::from_str(legacy_json).unwrap();
        assert_eq!(parsed.scale_factor, None);
        assert!(parsed.is_valid_dimensions());
    }

    #[test]
    fn test_backup_corrupt_settings_file_renames_invalid_and_keeps_valid() {
        let ts = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("moyu_ws_test_{}", ts));
        std::fs::create_dir_all(&dir).unwrap();

        let valid_path = dir.join("valid.json");
        std::fs::write(&valid_path, r#"{"progress_1":"50%"}"#).unwrap();
        assert!(!backup_corrupt_settings_file(&valid_path));
        assert!(valid_path.exists());

        let corrupt_path = dir.join("corrupt.json");
        std::fs::write(&corrupt_path, "{broken json").unwrap();
        assert!(backup_corrupt_settings_file(&corrupt_path));
        assert!(!corrupt_path.exists());

        let has_backup = std::fs::read_dir(&dir)
            .unwrap()
            .flatten()
            .any(|entry| entry.file_name().to_string_lossy().contains("corrupt.json.corrupt."));
        assert!(has_backup);

        let _ = std::fs::remove_dir_all(&dir);
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
        assert_eq!(theme_background_rgba(true), (0x1e, 0x1e, 0x1e, 255));
        assert_eq!(theme_background_rgba(false), (0xff, 0xff, 0xff, 255));
    }

    #[test]
    fn test_centered_geometry_in_area_clamps_and_centers() {
        let area = sample_monitor(100, 40, 1440, 900);
        assert_eq!(
            centered_geometry_in_area(&area, 1010, 680),
            (315, 150, 1010, 680)
        );
        assert_eq!(
            centered_geometry_in_area(&area, 2000, 1200),
            (100, 40, 1440, 900)
        );
    }
}

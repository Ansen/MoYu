use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};

/// 串口连接状态事件负载
#[derive(Clone, Debug, Serialize)]
pub struct SerialStatusPayload {
    pub connected: bool,
    pub port: Option<String>,
    pub device_name: Option<String>,
}

/// 全局串口守护状态（由 Tauri State 托管）
pub struct SerialManagerState {
    pub connected: Arc<AtomicBool>,
    pub current_port: Arc<Mutex<Option<String>>>,
    pub current_device_name: Arc<Mutex<Option<String>>>,
    pub auto_connect_enabled: Arc<AtomicBool>,
    pub force_disconnect: Arc<AtomicBool>,
}

impl Default for SerialManagerState {
    fn default() -> Self {
        Self {
            connected: Arc::new(AtomicBool::new(false)),
            current_port: Arc::new(Mutex::new(None)),
            current_device_name: Arc::new(Mutex::new(None)),
            auto_connect_enabled: Arc::new(AtomicBool::new(true)),
            force_disconnect: Arc::new(AtomicBool::new(false)),
        }
    }
}

/// CH552G 硬件专属 USB VID 列表：
/// - 0x16C0: MoYu CH552G USB CDC 官方固件 VID (PID: 0xBA8B)
/// - 0x1209: MorseLink / 开源 CH552G 电键固件 VID (PID: 0xC550)
/// - 0x1A86: WCH (沁恒官方 CH552G / CH55x VID)
const CH552_VIDS: &[u16] = &[0x16C0, 0x1209, 0x1A86];

/// 匹配到的串口设备信息
struct MatchedSerialPort {
    port_name: String,
    device_name: String,
}

/// Linux 平台无 libudev 依赖的 sysfs USB 串口枚举辅助函数
#[cfg(target_os = "linux")]
fn find_linux_sysfs_port() -> Option<MatchedSerialPort> {
    use std::fs;
    use std::path::Path;

    let tty_dir = Path::new("/sys/class/tty");
    let entries = fs::read_dir(tty_dir).ok()?;

    let mut best_match: Option<MatchedSerialPort> = None;

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.starts_with("ttyACM") && !name.starts_with("ttyUSB") {
            continue;
        }

        let dev_link = entry.path().join("device");
        if let Ok(real_dev) = fs::canonicalize(&dev_link) {
            let mut cur = real_dev.as_path();
            for _ in 0..4 {
                let vendor_path = cur.join("idVendor");
                let product_path = cur.join("idProduct");
                if let Ok(vid_str) = fs::read_to_string(&vendor_path) {
                    if let Ok(vid) = u16::from_str_radix(vid_str.trim(), 16) {
                        let pid = fs::read_to_string(&product_path)
                            .ok()
                            .and_then(|s| u16::from_str_radix(s.trim(), 16).ok())
                            .unwrap_or(0);

                        if CH552_VIDS.contains(&vid) {
                            let dev_node = format!("/dev/{}", name);
                            let is_exact = (vid == 0x16C0 && pid == 0xBA8B)
                                || (vid == 0x1209 && pid == 0xC550);
                            let candidate = MatchedSerialPort {
                                port_name: dev_node,
                                device_name: "CH552G".to_string(),
                            };
                            if is_exact {
                                return Some(candidate);
                            }
                            if best_match.is_none() {
                                best_match = Some(candidate);
                            }
                        }
                        break;
                    }
                }
                if let Some(parent) = cur.parent() {
                    cur = parent;
                } else {
                    break;
                }
            }
        }
    }

    best_match
}

/// 扫描系统可用串口并自动匹配 CH552G 硬件设备
fn find_ch552g_port() -> Option<MatchedSerialPort> {
    if let Ok(ports) = serialport::available_ports() {
        let mut best_match: Option<MatchedSerialPort> = None;

        for p in ports {
            if let serialport::SerialPortType::UsbPort(usb_info) = p.port_type {
                let vid = usb_info.vid;
                let pid = usb_info.pid;
                let prod_lower = usb_info
                    .product
                    .as_deref()
                    .unwrap_or("")
                    .to_ascii_lowercase();
                let mfg_lower = usb_info
                    .manufacturer
                    .as_deref()
                    .unwrap_or("")
                    .to_ascii_lowercase();

                // 1. 最高优先级：精确匹配 MoYu CH552G (0x16C0:0xBA8B) 或 MorseLink CH552G (0x1209:0xC550) 或包含特征名称
                let is_exact_firmware = (vid == 0x16C0 && pid == 0xBA8B)
                    || (vid == 0x1209 && pid == 0xC550)
                    || prod_lower.contains("moyu")
                    || prod_lower.contains("keyer")
                    || prod_lower.contains("ch552")
                    || prod_lower.contains("ch55x")
                    || mfg_lower.contains("moyu")
                    || mfg_lower.contains("ba8bak");

                if is_exact_firmware {
                    return Some(MatchedSerialPort {
                        port_name: p.port_name,
                        device_name: "CH552G".to_string(),
                    });
                }

                // 2. 次高优先级：匹配 CH552_VIDS 列表 (0x16C0 / 0x1209 / 0x1A86)
                if CH552_VIDS.contains(&vid) && best_match.is_none() {
                    best_match = Some(MatchedSerialPort {
                        port_name: p.port_name,
                        device_name: "CH552G".to_string(),
                    });
                }
            }
        }

        if best_match.is_some() {
            return best_match;
        }
    }

    #[cfg(target_os = "linux")]
    {
        if let Some(matched) = find_linux_sysfs_port() {
            return Some(matched);
        }
    }

    None
}

/// 检查指定端口在系统中是否仍然存在（用于辅助检测热拔出）
#[allow(dead_code)]
fn port_still_exists(port_name: &str) -> bool {
    #[cfg(target_os = "linux")]
    {
        return std::path::Path::new(port_name).exists();
    }

    #[cfg(not(target_os = "linux"))]
    {
        if let Ok(ports) = serialport::available_ports() {
            return ports.iter().any(|p| p.port_name == port_name);
        }
        true
    }
}

/// 启动后台常驻 CH552G 串口热插拔探测与低延迟字节流读取线程
pub fn spawn_serial_monitor(app_handle: AppHandle, state: &SerialManagerState) {
    let connected = Arc::clone(&state.connected);
    let current_port = Arc::clone(&state.current_port);
    let current_device_name = Arc::clone(&state.current_device_name);
    let auto_connect_enabled = Arc::clone(&state.auto_connect_enabled);
    let force_disconnect = Arc::clone(&state.force_disconnect);

    std::thread::spawn(move || {
        loop {
            if !auto_connect_enabled.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_millis(300));
                continue;
            }

            let Some(matched) = find_ch552g_port() else {
                std::thread::sleep(Duration::from_millis(500));
                continue;
            };

            let port_name = matched.port_name;
            let device_name = matched.device_name;

            // 尝试以 115200 波特率、15ms 超时打开目标串口
            let open_res = serialport::new(&port_name, 115_200)
                .timeout(Duration::from_millis(15))
                .open();

            match open_res {
                Ok(mut port) => {
                    // 拉高 DTR 与 RTS，确保 CH552G USB CDC 固件激活数据发送通道
                    let _ = port.write_data_terminal_ready(true);
                    let _ = port.write_request_to_send(true);
                    // 等待 25ms 让 CH552G 端点排空未连接期间可能积压的旧按键字节，解锁固件 CDC_writeBusyFlag
                    std::thread::sleep(Duration::from_millis(25));
                    let _ = port.clear(serialport::ClearBuffer::Input);
                    let mut drain_buf = [0u8; 64];
                    while let Ok(n) = port.read(&mut drain_buf) {
                        if n == 0 {
                            break;
                        }
                    }

                    force_disconnect.store(false, Ordering::Relaxed);
                    connected.store(true, Ordering::Relaxed);
                    if let Ok(mut guard) = current_port.lock() {
                        *guard = Some(port_name.clone());
                    }
                    if let Ok(mut guard) = current_device_name.lock() {
                        *guard = Some(device_name.clone());
                    }

                    log::info!("[CH552G Serial] Connected to {} ({})", port_name, device_name);
                    let _ = app_handle.emit(
                        "ch552g-status",
                        SerialStatusPayload {
                            connected: true,
                            port: Some(port_name.clone()),
                            device_name: Some(device_name.clone()),
                        },
                    );

                    let mut buf = [0u8; 32];
                    let mut idle_ticks: u32 = 0;

                    // 高速低延迟读取循环
                    loop {
                        if force_disconnect.load(Ordering::Relaxed)
                            || !auto_connect_enabled.load(Ordering::Relaxed)
                        {
                            break;
                        }

                        match port.read(&mut buf) {
                            Ok(n) if n > 0 => {
                                idle_ticks = 0;
                                for &byte in &buf[..n] {
                                    let _ = app_handle.emit("ch552g-byte", byte);
                                }
                            }
                            Ok(_) => {
                                // 读到 0 字节 EOF，代表 USB 设备已断开
                                break;
                            }
                            Err(ref e)
                                if e.kind() == std::io::ErrorKind::TimedOut
                                    || e.kind() == std::io::ErrorKind::WouldBlock
                                    || e.kind() == std::io::ErrorKind::Interrupted =>
                            {
                                idle_ticks += 1;
                                // 每约 600ms (40 * 15ms) 执行一次硬件存活探针，确保拔出后 <0.6s 即时感知
                                if idle_ticks >= 40 {
                                    idle_ticks = 0;
                                    #[cfg(target_os = "linux")]
                                    {
                                        if port.bytes_to_read().is_err() || !port_still_exists(&port_name) {
                                            break;
                                        }
                                    }
                                    #[cfg(not(target_os = "linux"))]
                                    {
                                        // Windows 下 bytes_to_read() (ClearCommError) 仅需 <1μs，
                                        // 杜绝调用 available_ports() 全系统 PnP 设备树扫描阻塞串口读取线程
                                        if port.bytes_to_read().is_err() {
                                            break;
                                        }
                                    }
                                }
                            }
                            Err(err) => {
                                log::warn!(
                                    "[CH552G Serial] Read error on {} (device unplugged): {}",
                                    port_name,
                                    err
                                );
                                break;
                            }
                        }
                    }

                    // 显式释放串口句柄并广播断开状态
                    drop(port);
                    connected.store(false, Ordering::Relaxed);
                    if let Ok(mut guard) = current_port.lock() {
                        *guard = None;
                    }
                    if let Ok(mut guard) = current_device_name.lock() {
                        *guard = None;
                    }

                    log::info!("[CH552G Serial] Disconnected from {}", port_name);
                    let _ = app_handle.emit(
                        "ch552g-status",
                        SerialStatusPayload {
                            connected: false,
                            port: None,
                            device_name: None,
                        },
                    );

                    std::thread::sleep(Duration::from_millis(400));
                }
                Err(err) => {
                    // 设备刚插入时操作系统驱动可能正在挂载，等待 500ms 后重试
                    log::debug!("[CH552G Serial] Waiting to open {}: {}", port_name, err);
                    std::thread::sleep(Duration::from_millis(500));
                }
            }
        }
    });
}


/// 查询当前 Rust 串口连接状态
#[tauri::command]
pub fn get_serial_status(state: State<'_, SerialManagerState>) -> SerialStatusPayload {
    let is_connected = state.connected.load(Ordering::Relaxed);
    let port = state
        .current_port
        .lock()
        .ok()
        .and_then(|guard| guard.clone());
    let device_name = state
        .current_device_name
        .lock()
        .ok()
        .and_then(|guard| guard.clone());
    SerialStatusPayload {
        connected: is_connected,
        port,
        device_name,
    }
}

/// 激活并触发串口自动探测连接
#[tauri::command]
pub fn connect_serial_port(state: State<'_, SerialManagerState>) -> SerialStatusPayload {
    state.force_disconnect.store(false, Ordering::Relaxed);
    state.auto_connect_enabled.store(true, Ordering::Relaxed);

    get_serial_status(state)
}

/// 主动断开当前串口连接并暂停后台自动抢占
#[tauri::command]
pub fn disconnect_serial_port(state: State<'_, SerialManagerState>) -> SerialStatusPayload {
    state.auto_connect_enabled.store(false, Ordering::Relaxed);
    state.force_disconnect.store(true, Ordering::Relaxed);

    SerialStatusPayload {
        connected: false,
        port: None,
        device_name: None,
    }
}

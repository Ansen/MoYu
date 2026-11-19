#[cfg(not(test))]
use epub_builder::{EpubBuilder, EpubContent, ReferenceType, ZipLibrary};
#[cfg(not(test))]
use tauri::Manager;

#[cfg_attr(test, allow(dead_code))]
mod audio_export;
#[cfg(not(test))]
mod serial;
#[cfg_attr(test, allow(dead_code))]
mod window_state;
#[cfg(not(test))]
use audio_export::{write_morse_wav_file, MorsePulse};
#[cfg(not(test))]
use serial::{
    connect_serial_port, disconnect_serial_port, get_serial_status, spawn_serial_monitor,
    SerialManagerState,
};
#[cfg(not(test))]
use window_state::{
    get_remember_window_state, set_remember_window_state, setup_main_window, show_main_window,
    uncloak_main_window, WindowStateManager,
};

#[cfg(not(test))]
#[tauri::command]
fn generate_epub(
    title: String,
    chapters: Vec<String>,
    save_path: Option<String>,
) -> Result<Vec<u8>, String> {
    let mut builder = EpubBuilder::new(ZipLibrary::new().map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    
    builder.metadata("author", "MoYu")
        .map_err(|e| e.to_string())?;
    builder.metadata("title", &title)
        .map_err(|e| e.to_string())?;

    let css_content = r#"body {
    margin: 1.5em;
    padding: 0;
    background-color: #ffffff;
    color: #111111;
    font-family: 'Cascadia Mono', 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}
.telegram-content {
    line-height: 1.8;
    word-break: break-all;
    white-space: pre-wrap;
}"#;
    builder.stylesheet(css_content.as_bytes())
        .map_err(|e| e.to_string())?;

    for (i, content) in chapters.iter().enumerate() {
        let chapter_html = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"/>
<title></title>
<link rel="stylesheet" type="text/css" href="stylesheet.css"/>
</head>
<body>
{}
</body>
</html>"#,
            content
        );
        
        builder.add_content(
            EpubContent::new(format!("chapter_{}.xhtml", i), chapter_html.as_bytes())
                .title(format!("Page {}", i + 1))
                .reftype(ReferenceType::Text)
        ).map_err(|e| e.to_string())?;
    }

    let mut out = Vec::new();
    builder.generate(&mut out).map_err(|e| e.to_string())?;
    if let Some(path) = save_path {
        std::fs::write(&path, &out).map_err(|e| e.to_string())?;
        return Ok(Vec::new());
    }
    Ok(out)
}

#[cfg(not(test))]
#[tauri::command]
fn save_companion_text(path: String, content: String) -> Result<(), String> {
    let lower = path.to_ascii_lowercase();
    if !lower.ends_with(".lrc") && !lower.ends_with(".txt") {
        return Err("Only .lrc or .txt companion files are allowed".to_string());
    }
    std::fs::write(&path, content.as_bytes()).map_err(|e| e.to_string())
}

/// 异步后台流式导出莫尔斯 16-bit PCM WAV 音频文件
#[cfg(not(test))]
#[tauri::command]
async fn export_morse_wav(
    path: String,
    pulses: Vec<MorsePulse>,
    freq: f64,
    sample_rate: u32,
    total_duration_ms: f64,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        write_morse_wav_file(&path, &pulses, freq, sample_rate, total_duration_ms)
    })
    .await
    .map_err(|e| format!("WAV export worker panicked: {e}"))?
}

#[cfg(not(test))]
#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) {
    if window.is_devtools_open() {
        window.close_devtools();
    } else {
        window.open_devtools();
    }
}

#[cfg(not(test))]
pub fn run() {
    let serial_state = SerialManagerState::default();
    let window_state = WindowStateManager::default();

    let builder = tauri::Builder::default()
        .manage(serial_state)
        .manage(window_state)
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            generate_epub,
            save_companion_text,
            export_morse_wav,
            toggle_devtools,
            get_serial_status,
            connect_serial_port,
            disconnect_serial_port,
            get_remember_window_state,
            set_remember_window_state,
            show_main_window,
            uncloak_main_window
        ]);

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // 恢复窗口几何位置与最大化状态后统一显示窗口，避免冷启动闪屏
            setup_main_window(app);

            let state = app.state::<SerialManagerState>();
            spawn_serial_monitor(app.handle().clone(), &state);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

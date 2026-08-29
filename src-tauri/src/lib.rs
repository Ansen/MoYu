use epub_builder::{EpubBuilder, EpubContent, ReferenceType, ZipLibrary};

#[tauri::command]
fn generate_epub(title: String, chapters: Vec<String>) -> Result<Vec<u8>, String> {
    let mut builder = EpubBuilder::new(ZipLibrary::new().map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    
    builder.metadata("author", "MoYu")
        .map_err(|e| e.to_string())?;
    builder.metadata("title", &title)
        .map_err(|e| e.to_string())?;

    for (i, content) in chapters.iter().enumerate() {
        let chapter_html = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8"/>
<title>Page {}</title>
<style type="text/css">
body {{
    margin: 1.5em;
    padding: 0;
    background-color: #ffffff;
    color: #111111;
    font-family: 'Cascadia Mono', 'SF Mono', 'JetBrains Mono', 'Fira Code', Consolas, monospace;
}}
.telegram-content {{
    line-height: 1.8;
    word-break: break-all;
    white-space: pre-wrap;
}}
</style>
</head>
<body>
{}
</body>
</html>"#,
            i + 1,
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
    Ok(out)
}

#[tauri::command]
fn toggle_devtools(window: tauri::WebviewWindow) {
    if window.is_devtools_open() {
        window.close_devtools();
    } else {
        window.open_devtools();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![generate_epub, toggle_devtools]);

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_updater::Builder::new().build());
    }

    builder
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

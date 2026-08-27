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
        let escaped_content = content
            .replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;");

        let chapter_html = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>Page {}</title>
<style>
  body {{ font-family: monospace; white-space: pre-wrap; line-height: 1.8; word-wrap: break-word; font-size: 1.2em; }}
</style>
</head>
<body>
<p>{}</p>
</body>
</html>"#,
            i + 1, escaped_content
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .invoke_handler(tauri::generate_handler![generate_epub]);

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

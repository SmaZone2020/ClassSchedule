use std::fs;
use std::path::PathBuf;

use tauri::{AppHandle, Manager};

use crate::models::Settings;
use crate::schedule;

pub fn data_dir(app: &AppHandle) -> PathBuf {
    app.path()
        .app_data_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
}

pub fn ensure_data_dir(app: &AppHandle) -> PathBuf {
    let dir = data_dir(app);
    let _ = fs::create_dir_all(&dir);
    dir
}

pub fn settings_path(app: &AppHandle) -> PathBuf {
    data_dir(app).join("settings.json")
}

pub fn schedule_path(app: &AppHandle) -> PathBuf {
    data_dir(app).join("schedule.json")
}

pub fn load_settings(app: &AppHandle) -> Settings {
    let path = settings_path(app);
    let Ok(text) = fs::read_to_string(&path) else {
        return Settings::default();
    };
    serde_json::from_str(&text).unwrap_or_default()
}

pub fn save_settings(app: &AppHandle, settings: &Settings) -> Result<(), String> {
    ensure_data_dir(app);
    let text = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    write_atomic(&settings_path(app), text.as_bytes())
}

pub fn write_atomic(path: &PathBuf, bytes: &[u8]) -> Result<(), String> {
    let tmp = path.with_extension("tmp");
    fs::write(&tmp, bytes).map_err(|e| format!("写入失败: {e}"))?;
    fs::rename(&tmp, path).map_err(|e| format!("写入失败: {e}"))
}

pub fn load_schedule(app: &AppHandle) -> Option<serde_json::Value> {
    let path = schedule_path(app);
    if let Ok(text) = fs::read_to_string(&path) {
        if let Ok(value) = schedule::validate(&text) {
            return Some(value);
        }
    }
    seed_schedule(app)
}

fn seed_schedule(app: &AppHandle) -> Option<serde_json::Value> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(dir) = app.path().resource_dir() {
        candidates.push(dir.join("resources").join("defaultSchedule.json"));
        candidates.push(dir.join("defaultSchedule.json"));
    }
    candidates.push(data_dir(app).join("defaultSchedule.json"));

    for path in candidates {
        if let Ok(text) = fs::read_to_string(&path) {
            if let Ok(value) = schedule::validate(&text) {
                ensure_data_dir(app);
                let _ = fs::write(schedule_path(app), text.as_bytes());
                return Some(value);
            }
        }
    }

    let value = schedule::template();
    if let Ok(text) = serde_json::to_string_pretty(&value) {
        ensure_data_dir(app);
        let _ = fs::write(schedule_path(app), text.as_bytes());
    }
    Some(value)
}

pub fn store_schedule(app: &AppHandle, value: &serde_json::Value) -> Result<(), String> {
    ensure_data_dir(app);
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    write_atomic(&schedule_path(app), text.as_bytes())
}

pub fn read_text_file(path: &str) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|e| format!("无法读取文件: {e}"))?;
    let text = String::from_utf8(bytes).map_err(|_| "文件不是有效的 UTF-8 文本".to_string())?;
    Ok(text.trim_start_matches('\u{feff}').to_string())
}

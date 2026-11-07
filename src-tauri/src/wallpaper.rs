use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::UNIX_EPOCH;

use base64::Engine;
use tauri::AppHandle;

use crate::models::{WallpaperInfo, WallpaperSettings};

const MAX_WALLPAPER_BYTES: u64 = 24 * 1024 * 1024;

type Cache = Mutex<Option<(String, u64, String)>>;

fn cache() -> &'static Cache {
    static CACHE: OnceLock<Cache> = OnceLock::new();
    CACHE.get_or_init(|| Mutex::new(None))
}

pub fn load(settings: &WallpaperSettings) -> WallpaperInfo {
    if settings.mode == "custom" {
        return match settings.custom_path.as_ref().map(PathBuf::from) {
            Some(path) if path.exists() => build_info(&path, "custom"),
            Some(path) => WallpaperInfo {
                data_url: None,
                style: "fill".into(),
                source: "custom".into(),
                path: Some(path.to_string_lossy().to_string()),
                error: Some("自定义壁纸文件不存在".into()),
            },
            None => empty("custom", Some("尚未选择自定义壁纸")),
        };
    }

    match system_wallpaper() {
        Ok(Some(path)) => build_info(&path, "system"),
        Ok(None) => empty("system", Some("未能读取系统壁纸")),
        Err(error) => empty("system", Some(&error)),
    }
}

pub fn import(app: &AppHandle, source: &str) -> Result<WallpaperInfo, String> {
    let source_path = PathBuf::from(source);
    if !source_path.is_file() {
        return Err("所选图片不存在".into());
    }
    let extension = source_path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_else(|| "png".to_string());
    if !matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp" | "bmp" | "gif") {
        return Err("仅支持 png / jpg / webp / bmp / gif 图片".into());
    }

    let dir = crate::storage::ensure_data_dir(app);
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())?.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with("wallpaper.") {
            let _ = std::fs::remove_file(entry.path());
        }
    }

    let target = dir.join(format!("wallpaper.{extension}"));
    std::fs::copy(&source_path, &target).map_err(|e| format!("复制壁纸失败: {e}"))?;
    Ok(build_info(&target, "custom"))
}

fn empty(source: &str, error: Option<&str>) -> WallpaperInfo {
    WallpaperInfo {
        data_url: None,
        style: "fill".into(),
        source: source.into(),
        path: None,
        error: error.map(|value| value.to_string()),
    }
}

fn build_info(path: &Path, source: &str) -> WallpaperInfo {
    let style = if source == "system" {
        system_style().unwrap_or_else(|| "fill".to_string())
    } else {
        "fill".to_string()
    };

    match encode(path) {
        Ok(data_url) => WallpaperInfo {
            data_url: Some(data_url),
            style,
            source: source.into(),
            path: Some(path.to_string_lossy().to_string()),
            error: None,
        },
        Err(error) => WallpaperInfo {
            data_url: None,
            style,
            source: source.into(),
            path: Some(path.to_string_lossy().to_string()),
            error: Some(error),
        },
    }
}

fn encode(path: &Path) -> Result<String, String> {
    let metadata = std::fs::metadata(path).map_err(|e| format!("无法读取壁纸文件: {e}"))?;
    if metadata.len() > MAX_WALLPAPER_BYTES {
        return Err("壁纸文件过大（超过 24MB）".into());
    }
    let modified = metadata
        .modified()
        .ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|value| value.as_secs())
        .unwrap_or(0);
    let key = path.to_string_lossy().to_string();

    if let Some((cached_key, cached_mtime, cached_url)) = cache().lock().unwrap().as_ref() {
        if cached_key == &key && *cached_mtime == modified {
            return Ok(cached_url.clone());
        }
    }

    let bytes = std::fs::read(path).map_err(|e| format!("无法读取壁纸文件: {e}"))?;
    let mime = mime_for(path, &bytes);
    let encoded = base64::engine::general_purpose::STANDARD.encode(bytes);
    let data_url = format!("data:{mime};base64,{encoded}");

    *cache().lock().unwrap() = Some((key, modified, data_url.clone()));
    Ok(data_url)
}

fn mime_for(path: &Path, bytes: &[u8]) -> &'static str {
    if bytes.starts_with(&[0x89, 0x50, 0x4e, 0x47]) {
        return "image/png";
    }
    if bytes.starts_with(&[0xff, 0xd8, 0xff]) {
        return "image/jpeg";
    }
    if bytes.starts_with(b"BM") {
        return "image/bmp";
    }
    if bytes.len() > 12 && &bytes[0..4] == b"RIFF" && &bytes[8..12] == b"WEBP" {
        return "image/webp";
    }
    if bytes.starts_with(b"GIF8") {
        return "image/gif";
    }

    match path
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.to_ascii_lowercase())
        .as_deref()
    {
        Some("png") => "image/png",
        Some("webp") => "image/webp",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        _ => "image/jpeg",
    }
}

#[cfg(windows)]
fn system_wallpaper() -> Result<Option<PathBuf>, String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("Control Panel\\Desktop")
        .map_err(|e| format!("无法读取桌面注册表: {e}"))?;
    let value: String = key
        .get_value("WallPaper")
        .map_err(|e| format!("无法读取系统壁纸路径: {e}"))?;
    let trimmed = value.trim().trim_matches('"');
    if trimmed.is_empty() {
        return Ok(None);
    }
    let path = PathBuf::from(trimmed);
    if path.is_file() {
        return Ok(Some(path));
    }

    Ok(transcoded_wallpaper())
}

#[cfg(windows)]
fn transcoded_wallpaper() -> Option<PathBuf> {
    let appdata = std::env::var_os("APPDATA")?;
    let path = PathBuf::from(appdata)
        .join("Microsoft")
        .join("Windows")
        .join("Themes")
        .join("TranscodedWallpaper");
    path.is_file().then_some(path)
}

#[cfg(windows)]
fn system_style() -> Option<String> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    let key = RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey("Control Panel\\Desktop")
        .ok()?;
    let style: String = key.get_value("WallpaperStyle").ok()?;
    let tile: String = key.get_value("TileWallpaper").unwrap_or_default();
    if tile.trim() == "1" {
        return Some("tile".into());
    }
    let value = match style.trim() {
        "0" => "center",
        "2" => "stretch",
        "6" => "fit",
        "10" => "fill",
        "22" => "fill",
        _ => "fill",
    };
    Some(value.to_string())
}

#[cfg(not(windows))]
fn system_wallpaper() -> Result<Option<PathBuf>, String> {
    Ok(None)
}

#[cfg(not(windows))]
fn system_style() -> Option<String> {
    None
}

use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};

use crate::models::Settings;

const FALLBACK_WIDTH: f64 = 620.0;
const FALLBACK_HEIGHT: f64 = 420.0;

pub fn apply_position(window: &WebviewWindow, settings: &Settings) -> Result<(), String> {
    let scale = settings.scale.max(0.1);
    let width = FALLBACK_WIDTH * scale;
    let height = FALLBACK_HEIGHT * scale;
    let _ = window.set_size(tauri::LogicalSize::new(width, height));

    let monitors = window
        .available_monitors()
        .map_err(|e| format!("获取显示器失败: {e}"))?;
    let primary = window
        .primary_monitor()
        .map_err(|e| format!("获取主显示器失败: {e}"))?
        .ok_or("没有可用显示器")?;

    let target = settings
        .position
        .monitor
        .as_ref()
        .and_then(|name| {
            monitors
                .iter()
                .find(|m| m.name().as_deref().map(|value| value == name.as_str()).unwrap_or(false))
        })
        .unwrap_or(&primary);

    let scale_factor = target.scale_factor();
    let pos = PhysicalPosition::new(
        target.position().x + (settings.position.x * scale_factor) as i32,
        target.position().y + (settings.position.y * scale_factor) as i32,
    );
    window.set_position(pos).map_err(|e| format!("设置位置失败: {e}"))?;
    Ok(())
}

pub fn apply_click_through(window: &WebviewWindow, enabled: bool) -> Result<(), String> {
    window
        .set_ignore_cursor_events(enabled)
        .map_err(|e| format!("设置鼠标穿透失败: {e}"))
}

pub fn apply_visibility(window: &WebviewWindow, visible: bool) -> Result<(), String> {
    if visible {
        window.show().map_err(|e| format!("显示窗口失败: {e}"))?;
    } else {
        window.hide().map_err(|e| format!("隐藏窗口失败: {e}"))?;
    }
    Ok(())
}

pub fn send_settings(app: &AppHandle, settings: &Settings) {
    use tauri::Emitter;
    for label in ["widget", "settings"] {
        if let Some(window) = app.get_webview_window(label) {
            let _ = window.emit("settings-changed", settings);
        }
    }
}

pub fn widget_logical_size(settings: &Settings) -> (f64, f64) {
    let scale = settings.scale.max(0.1);
    (FALLBACK_WIDTH * scale, FALLBACK_HEIGHT * scale)
}

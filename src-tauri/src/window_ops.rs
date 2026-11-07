use tauri::{AppHandle, Manager, PhysicalPosition, WebviewWindow};

use crate::models::{MonitorInfo, Settings, WidgetRect};

pub const DAY_WIDTH: f64 = 80.0;
pub const PANEL_PAD: f64 = 14.0;
pub const PANEL_GAP: f64 = 6.0;
pub const MULTI_HEIGHT: f64 = 420.0;
pub const TODAY_WIDTH: f64 = 320.0;
pub const TODAY_HEIGHT: f64 = 380.0;
pub const SLOT_COLUMNS: u32 = 7;

/// Base (unscaled) size of the widget for the given visible column count.
pub fn base_size(columns: u32) -> (f64, f64) {
    let columns = columns.clamp(1, 7);
    if columns <= 1 {
        (TODAY_WIDTH, TODAY_HEIGHT)
    } else {
        let columns = columns as f64;
        (
            PANEL_PAD * 2.0 + columns * DAY_WIDTH + (columns - 1.0) * PANEL_GAP,
            MULTI_HEIGHT,
        )
    }
}

/// Width reserved by the widest (7 column) layout. Narrower layouts are
/// anchored inside this slot so `position.x` always means the slot's left edge.
pub fn slot_width() -> f64 {
    base_size(SLOT_COLUMNS).0
}

pub fn widget_logical_size(settings: &Settings, columns: u32) -> (f64, f64) {
    let scale = settings.scale.max(0.1);
    let (width, height) = base_size(columns);
    (width * scale, height * scale)
}

/// Horizontal offset applied inside the slot so narrower layouts stay anchored
/// to the left or right edge according to `settings.align`.
fn slot_shift(settings: &Settings, width: f64, monitor_width: f64) -> f64 {
    let slot = slot_width() * settings.scale.max(0.1);
    let room = (slot - width).max(0.0);
    match settings.align.as_str() {
        "right" => room,
        "auto" => {
            let center = settings.position.x + slot / 2.0;
            if center > monitor_width / 2.0 {
                room
            } else {
                0.0
            }
        }
        _ => 0.0,
    }
}

/// Pure layout calculation. Coordinates are logical pixels relative to the
/// monitor origin, matching `settings.position`.
pub fn layout_rect(settings: &Settings, columns: u32, monitor: &MonitorInfo) -> WidgetRect {
    let (width, height) = widget_logical_size(settings, columns);
    let shift = slot_shift(settings, width, monitor.width);
    let max_x = (monitor.width - width).max(0.0);
    let max_y = (monitor.height - height).max(0.0);

    WidgetRect {
        x: (settings.position.x + shift).clamp(0.0, max_x),
        y: settings.position.y.clamp(0.0, max_y),
        width,
        height,
    }
}

pub fn apply_position(
    window: &WebviewWindow,
    settings: &Settings,
    columns: u32,
) -> Result<WidgetRect, String> {
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
    let monitor = MonitorInfo {
        name: String::new(),
        label: String::new(),
        x: target.position().x as f64 / scale_factor,
        y: target.position().y as f64 / scale_factor,
        width: target.size().width as f64 / scale_factor,
        height: target.size().height as f64 / scale_factor,
        is_primary: true,
    };

    let rect = layout_rect(settings, columns, &monitor);
    window
        .set_size(tauri::LogicalSize::new(rect.width, rect.height))
        .map_err(|e| format!("设置尺寸失败: {e}"))?;

    let position = PhysicalPosition::new(
        target.position().x + (rect.x * scale_factor).round() as i32,
        target.position().y + (rect.y * scale_factor).round() as i32,
    );
    window
        .set_position(position)
        .map_err(|e| format!("设置位置失败: {e}"))?;

    Ok(rect)
}

pub fn emit_layout(app: &AppHandle, rect: &WidgetRect) {
    use tauri::Emitter;
    if let Some(window) = app.get_webview_window("widget") {
        let _ = window.emit("layout-changed", rect);
    }
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
    if let Some(window) = app.get_webview_window("widget") {
        let _ = window.emit("settings-changed", settings);
    }
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.emit("settings-changed", settings);
    }
}

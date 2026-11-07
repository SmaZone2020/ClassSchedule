use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};

use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, WebviewWindow};

use crate::models::{MonitorInfo, Settings, WidgetRect};

/// Bumped whenever a new layout animation starts so older tweens stop early.
static LAYOUT_GEN: AtomicU64 = AtomicU64::new(0);

pub const DAY_WIDTH: f64 = 80.0;
pub const PANEL_PAD: f64 = 14.0;
pub const PANEL_GAP: f64 = 6.0;
pub const MULTI_HEIGHT: f64 = 420.0;
pub const TODAY_WIDTH: f64 = 320.0;
pub const TODAY_HEIGHT: f64 = 380.0;
pub const SLOT_COLUMNS: u32 = 7;

/// Transparent margin around the panel so the drop shadow is not clipped by the
/// window edge. Derived from the shadow size; must match `shadowPad` in
/// `src/settingsDefaults.ts`.
pub fn shadow_pad(shadow_size: f64) -> f64 {
    (shadow_size.clamp(0.0, 24.0) * 2.6 + 8.0).ceil().clamp(20.0, 72.0)
}

/// Panel (visible glass) size for the given visible column count.
pub fn panel_size(columns: u32) -> (f64, f64) {
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

/// Native window size: the panel plus the shadow margin.
pub fn base_size(columns: u32, shadow_size: f64) -> (f64, f64) {
    let (width, height) = panel_size(columns);
    let pad = shadow_pad(shadow_size);
    (width + pad * 2.0, height + pad * 2.0)
}

/// Width reserved by the widest (7 column) window. Narrower layouts are
/// anchored inside this slot so `position.x` always means the slot's left edge.
pub fn slot_width(shadow_size: f64) -> f64 {
    base_size(SLOT_COLUMNS, shadow_size).0
}

pub fn widget_logical_size(settings: &Settings, columns: u32) -> (f64, f64) {
    let scale = settings.scale.max(0.1);
    let (width, height) = base_size(columns, settings.panel.shadow_size);
    (width * scale, height * scale)
}

/// Horizontal offset applied inside the slot so narrower layouts stay anchored
/// to the left or right edge according to `settings.align`.
fn slot_shift(settings: &Settings, width: f64, monitor_width: f64) -> f64 {
    let slot = slot_width(settings.panel.shadow_size) * settings.scale.max(0.1);
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
/// monitor origin, matching `settings.position` (which anchors the visible panel,
/// not the window, so the shadow margin does not shift the widget).
pub fn layout_rect(settings: &Settings, columns: u32, monitor: &MonitorInfo) -> WidgetRect {
    let (width, height) = widget_logical_size(settings, columns);
    let shift = slot_shift(settings, width, monitor.width);
    let pad = shadow_pad(settings.panel.shadow_size) * settings.scale.max(0.1);

    // Anchor the visible panel, then subtract the shadow margin for the window.
    let panel_x = settings.position.x + shift;
    let max_x = (monitor.width - width).max(0.0);
    let max_y = (monitor.height - height).max(0.0);

    WidgetRect {
        x: (panel_x - pad).clamp(-pad, max_x),
        y: (settings.position.y - pad).clamp(-pad, max_y),
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

/// Eased tween of the native window footprint.
///
/// The window is transparent and only the inner panel is painted, so resizing
/// the OS window frame-by-frame reads as the panel itself growing. A single
/// `set_size` jump looks like a hard cut because the webview reflows after the
/// fact.
pub fn apply_position_animated(
    app: &AppHandle,
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
        .cloned()
        .unwrap_or(primary);

    let scale_factor = target.scale_factor();
    let origin = *target.position();
    let target_size = *target.size();
    let monitor = MonitorInfo {
        name: String::new(),
        label: String::new(),
        x: origin.x as f64 / scale_factor,
        y: origin.y as f64 / scale_factor,
        width: target_size.width as f64 / scale_factor,
        height: target_size.height as f64 / scale_factor,
        is_primary: true,
    };

    let to = layout_rect(settings, columns, &monitor);

    // Current window rect in logical px, relative to the monitor.
    let size = window
        .inner_size()
        .map_err(|e| format!("读取窗口尺寸失败: {e}"))?;
    let pos = window
        .inner_position()
        .map_err(|e| format!("读取窗口位置失败: {e}"))?;
    let from = WidgetRect {
        x: (pos.x as f64 - origin.x as f64) / scale_factor,
        y: (pos.y as f64 - origin.y as f64) / scale_factor,
        width: size.width as f64 / scale_factor,
        height: size.height as f64 / scale_factor,
    };

    let unchanged = (from.x - to.x).abs() < 0.5
        && (from.y - to.y).abs() < 0.5
        && (from.width - to.width).abs() < 0.5
        && (from.height - to.height).abs() < 0.5;

    if unchanged {
        let _ = app.emit_to("widget", "layout-changed", &to);
        return Ok(to);
    }

    let generation = LAYOUT_GEN.fetch_add(1, Ordering::SeqCst) + 1;
    let app = app.clone();
    let window = window.clone();
    let target_rect = to.clone();

    std::thread::spawn(move || {
        let frames = 18u32;
        let step = Duration::from_millis(12);
        let started = Instant::now();

        for frame in 1..=frames {
            if LAYOUT_GEN.load(Ordering::SeqCst) != generation {
                return;
            }

            let t = frame as f64 / frames as f64;
            // easeOutCubic: quick start, soft landing.
            let e = 1.0 - (1.0 - t).powi(3);

            let rect = WidgetRect {
                x: from.x + (target_rect.x - from.x) * e,
                y: from.y + (target_rect.y - from.y) * e,
                width: from.width + (target_rect.width - from.width) * e,
                height: from.height + (target_rect.height - from.height) * e,
            };

            let _ = window.set_size(tauri::LogicalSize::new(rect.width, rect.height));
            let _ = window.set_position(PhysicalPosition::new(
                origin.x + (rect.x * scale_factor).round() as i32,
                origin.y + (rect.y * scale_factor).round() as i32,
            ));

            let _ = app.emit_to("widget", "layout-animating", &rect);

            let due = started + step * frame;
            if let Some(wait) = due.checked_duration_since(Instant::now()) {
                std::thread::sleep(wait);
            }
        }

        if LAYOUT_GEN.load(Ordering::SeqCst) == generation {
            let _ = app.emit_to("widget", "layout-changed", &target_rect);
        }
    });

    Ok(to)
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

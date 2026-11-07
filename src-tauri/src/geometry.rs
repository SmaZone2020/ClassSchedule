use tauri::{AppHandle, Manager};

use crate::models::{MonitorInfo, Settings, WidgetRect};
use crate::tray::AppState;
use crate::window_ops;

pub fn monitor_list(app: &AppHandle) -> Result<Vec<MonitorInfo>, String> {
    let window = app
        .get_webview_window("widget")
        .ok_or("组件窗口不存在")?;
    let monitors = window
        .available_monitors()
        .map_err(|e| format!("获取显示器失败: {e}"))?;
    let primary = window
        .primary_monitor()
        .map_err(|e| format!("获取主显示器失败: {e}"))?
        .ok_or("没有可用显示器")?;

    Ok(monitors
        .iter()
        .map(|monitor| {
            let scale = monitor.scale_factor();
            let name: String = monitor
                .name()
                .clone()
                .map(|value| value.to_string())
                .unwrap_or_else(|| "主显示器".to_string());
            MonitorInfo {
                is_primary: monitor.name() == primary.name(),
                label: name.clone(),
                name,
                x: monitor.position().x as f64 / scale,
                y: monitor.position().y as f64 / scale,
                width: monitor.size().width as f64 / scale,
                height: monitor.size().height as f64 / scale,
            }
        })
        .collect())
}

pub fn resolve_monitor(monitors: &[MonitorInfo], settings: &Settings) -> Option<MonitorInfo> {
    settings
        .position
        .monitor
        .as_ref()
        .and_then(|name| monitors.iter().find(|item| &item.name == name))
        .or_else(|| monitors.iter().find(|item| item.is_primary))
        .or_else(|| monitors.first())
        .cloned()
}

/// Widget rectangle (logical px, relative to the monitor origin) for the
/// current settings and rendered column count.
pub fn rect(monitors: &[MonitorInfo], settings: &Settings, columns: u32) -> WidgetRect {
    let monitor = resolve_monitor(monitors, settings);
    match monitor {
        Some(monitor) => window_ops::layout_rect(settings, columns, &monitor),
        None => WidgetRect {
            x: settings.position.x,
            y: settings.position.y,
            width: window_ops::widget_logical_size(settings, columns).0,
            height: window_ops::widget_logical_size(settings, columns).1,
        },
    }
}

pub fn widget_size(app: &AppHandle, settings: &Settings) -> crate::models::WidgetSize {
    let columns = app.state::<AppState>().columns();
    let (width, height) = window_ops::widget_logical_size(settings, columns);
    crate::models::WidgetSize { width, height }
}

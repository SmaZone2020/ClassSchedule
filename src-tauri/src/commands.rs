use serde_json::{json, Value};
use tauri::command;
use tauri::{AppHandle, Manager};

use crate::models::{AppData, MonitorInfo, Settings, WidgetSize};
use crate::storage;
use crate::tray::{self, AppState};
use crate::window_ops;

#[command]
pub fn get_app_data(app: AppHandle) -> Result<AppData, String> {
    let state = app.state::<AppState>();
    let settings = state.with_settings(|s| s.clone());
    let schedule = storage::load_schedule(&app);
    let schedule_error = if schedule.is_none() {
        Some("课表数据损坏".into())
    } else {
        None
    };
    let config_dir = storage::data_dir(&app).to_string_lossy().to_string();
    let widget = app
        .get_webview_window("widget")
        .ok_or("组件窗口不存在")?;

    Ok(AppData {
        widget_size: widget_size(&widget, &settings),
        settings,
        schedule,
        schedule_error,
        monitors: monitor_list(&app)?,
        config_dir,
    })
}

#[command]
pub fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let state = app.state::<AppState>();
    Ok(state.with_settings(|s| s.clone()))
}

#[command]
pub fn update_settings(app: AppHandle, settings: Settings) -> Result<Settings, String> {
    let scale = settings.scale.clamp(0.3, 2.0);
    let mut settings = settings;
    settings.scale = scale;
    storage::save_settings(&app, &settings)?;
    *app.state::<AppState>().settings.lock().unwrap() = settings.clone();

    if let Some(widget) = app.get_webview_window("widget") {
        window_ops::apply_position(&widget, &settings)?;
        window_ops::apply_click_through(&widget, settings.click_through)?;
        tray::apply_widget_state(&app, &settings, settings.widget_visible);
    }
    window_ops::send_settings(&app, &settings);
    Ok(settings)
}

#[command]
pub fn get_schedule(app: AppHandle) -> Result<Option<Value>, String> {
    Ok(storage::load_schedule(&app))
}

#[command]
pub fn import_schedule_from_path(app: AppHandle, path: String) -> Result<Value, String> {
    let text = storage::read_text_file(&path)?;
    let report = crate::schedule::build_report(&text);
    if !report.valid {
        return Err(report.error.unwrap_or_else(|| "课表校验失败".into()));
    }
    let value: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    storage::store_schedule(&app, &value)?;
    Ok(json!({
        "report": report,
        "schedule": value
    }))
}

#[command]
pub fn validate_schedule_text(text: String) -> crate::schedule::ValidationReport {
    crate::schedule::build_report(&text)
}

#[command]
pub fn export_template(_app: AppHandle, path: String) -> Result<(), String> {
    let value = crate::schedule::template();
    let text = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    storage::write_atomic(
        &std::path::PathBuf::from(&path),
        format!("{text}\n").into_bytes().as_slice(),
    )
    .map_err(|e| format!("导出失败: {e}"))?;
    Ok(())
}

#[command]
pub fn clear_schedule(app: AppHandle) -> Result<(), String> {
    let path = storage::schedule_path(&app);
    std::fs::remove_file(path).map_err(|e| format!("删除失败: {e}"))?;
    Ok(())
}

#[command]
pub fn open_settings_window(app: AppHandle) {
    tray::open_settings(&app);
}

#[command]
pub fn apply_widget(app: AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let settings = state.with_settings(|s| s.clone());
    if let Some(widget) = app.get_webview_window("widget") {
        window_ops::apply_position(&widget, &settings)?;
        window_ops::apply_click_through(&widget, settings.click_through)?;
        if settings.widget_visible {
            window_ops::apply_visibility(&widget, true)?;
            tray::pin_to_desktop(&widget);
        }
    }
    Ok(())
}

#[command]
pub fn set_widget_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    {
        let mut guard = state.settings.lock().unwrap();
        guard.widget_visible = visible;
        let settings = guard.clone();
        drop(guard);
        tray::apply_widget_state(&app, &settings, visible);
        storage::save_settings(&app, &settings)?;
    }
    let settings = state.with_settings(|s| s.clone());
    window_ops::send_settings(&app, &settings);
    Ok(())
}

#[command]
pub fn set_click_through(app: AppHandle, enabled: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    {
        let mut guard = state.settings.lock().unwrap();
        guard.click_through = enabled;
        let settings = guard.clone();
        drop(guard);
        if let Some(widget) = app.get_webview_window("widget") {
            tray::apply_click_through_state(&widget, enabled);
        }
        storage::save_settings(&app, &settings)?;
    }
    let settings = state.with_settings(|s| s.clone());
    window_ops::send_settings(&app, &settings);
    Ok(())
}

#[command]
pub fn save_custom_css(app: AppHandle, container: String, course: String, enabled: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    let settings = {
        let mut guard = state.settings.lock().unwrap();
        guard.css.container = container;
        guard.css.course = course;
        guard.css.enabled = enabled;
        guard.clone()
    };
    storage::save_settings(&app, &settings)?;
    window_ops::send_settings(&app, &settings);
    Ok(())
}

#[command]
pub fn get_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    monitor_list(&app)
}

#[command]
pub fn get_widget_window_state(app: AppHandle) -> Result<WidgetSize, String> {
    let state = app.state::<AppState>();
    let settings = state.with_settings(|s| s.clone());
    let widget = app
        .get_webview_window("widget")
        .ok_or("组件窗口不存在")?;
    Ok(widget_size(&widget, &settings))
}

#[command]
pub fn set_widget_position(app: AppHandle, x: f64, y: f64, monitor: Option<String>) -> Result<(), String> {
    let state = app.state::<AppState>();
    let settings = {
        let mut guard = state.settings.lock().unwrap();
        guard.position.x = x;
        guard.position.y = y;
        if monitor.is_some() {
            guard.position.monitor = monitor;
        }
        guard.clone()
    };
    if let Some(widget) = app.get_webview_window("widget") {
        window_ops::apply_position(&widget, &settings)?;
    }
    storage::save_settings(&app, &settings)?;
    window_ops::send_settings(&app, &settings);
    Ok(())
}

#[command]
pub fn set_widget_size(app: AppHandle, scale: f64) -> Result<(), String> {
    let state = app.state::<AppState>();
    let settings = {
        let mut guard = state.settings.lock().unwrap();
        guard.scale = scale.clamp(0.3, 2.0);
        guard.clone()
    };
    if let Some(widget) = app.get_webview_window("widget") {
        window_ops::apply_position(&widget, &settings)?;
    }
    storage::save_settings(&app, &settings)?;
    window_ops::send_settings(&app, &settings);
    Ok(())
}

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
            let name: String = monitor
                .name()
                .clone()
                .map(|value| value.to_string())
                .unwrap_or_else(|| "主显示器".to_string());
            MonitorInfo {
                is_primary: monitor.name() == primary.name(),
                name: name.clone(),
                label: name.clone(),
                width: monitor.size().width as f64,
                height: monitor.size().height as f64,
            }
        })
        .collect())
}

pub fn widget_size(widget: &tauri::WebviewWindow, settings: &Settings) -> WidgetSize {
    let (width, height) = window_ops::widget_logical_size(settings);
    let _ = widget;
    WidgetSize { width, height }
}

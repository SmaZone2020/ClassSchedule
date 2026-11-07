use serde_json::{json, Value};
use tauri::command;
use tauri::{AppHandle, Manager};

use crate::geometry;
use crate::models::{AppData, MonitorInfo, Settings, WallpaperInfo, WidgetSize};
use crate::storage;
use crate::tray::{self, AppState};
use crate::wallpaper;
use crate::window_ops;

#[command]
pub fn get_app_data(app: AppHandle) -> Result<AppData, String> {
    let settings = app.state::<AppState>().with_settings(|s| s.clone());
    let schedule = storage::load_schedule(&app);
    let monitors = geometry::monitor_list(&app)?;
    let columns = app.state::<AppState>().columns();

    Ok(AppData {
        rect: geometry::rect(&monitors, &settings, columns),
        wallpaper: wallpaper::load(&settings.wallpaper),
        widget_size: geometry::widget_size(&app, &settings),
        config_dir: storage::data_dir(&app).to_string_lossy().to_string(),
        settings,
        schedule,
        schedule_error: None,
        monitors,
    })
}

#[command]
pub fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let state = app.state::<AppState>();
    Ok(state.with_settings(|s| s.clone()))
}

#[command]
pub fn update_settings(app: AppHandle, mut settings: Settings) -> Result<Settings, String> {
    settings.scale = settings.scale.clamp(0.3, 2.0);
    settings.wallpaper.dim = settings.wallpaper.dim.clamp(0.0, 0.9);
    storage::save_settings(&app, &settings)?;
    *app.state::<AppState>().settings.lock().unwrap() = settings.clone();

    if let Some(widget) = app.get_webview_window("widget") {
        if settings.widget_visible {
            apply_layout(&app, &widget, &settings)?;
        }
        window_ops::apply_click_through(&widget, settings.click_through)?;
        tray::pin_to_desktop(&widget, settings.desktop_pin);
    }
    tray::apply_widget_state(&app, &settings);
    window_ops::send_settings(&app, &settings);
    Ok(settings)
}

fn apply_layout(
    app: &AppHandle,
    widget: &tauri::WebviewWindow,
    settings: &Settings,
) -> Result<(), String> {
    let columns = app.state::<AppState>().columns();
    // The tween emits `layout-changed` when it lands, so the front end can track
    // the intermediate frames without a jump to the final rect first.
    window_ops::apply_position_animated(app, widget, settings, columns)?;
    Ok(())
}

/// The widget reports how many columns it actually renders (1 / 5 / 7) so the
/// native window can shrink or grow and stay anchored by `settings.align`.
#[command]
pub fn set_layout_columns(app: AppHandle, columns: u32) -> Result<(), String> {
    let state = app.state::<AppState>();
    if state.columns() == columns {
        return Ok(());
    }
    state.set_columns(columns);
    let settings = state.with_settings(|s| s.clone());
    if let Some(widget) = app.get_webview_window("widget") {
        apply_layout(&app, &widget, &settings)?;
    }
    Ok(())
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
    notify_schedule(&app, &value);
    Ok(json!({ "report": report, "schedule": value }))
}

#[command]
pub fn validate_schedule_text(text: String) -> crate::schedule::ValidationReport {
    crate::schedule::build_report(&text)
}

#[command]
pub fn export_template(path: String) -> Result<(), String> {
    let value = crate::schedule::template();
    let text = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    storage::write_atomic(
        &std::path::PathBuf::from(&path),
        format!("{text}\n").into_bytes().as_slice(),
    )
    .map_err(|e| format!("导出失败: {e}"))
}

#[command]
pub fn clear_schedule(app: AppHandle) -> Result<(), String> {
    let path = storage::schedule_path(&app);
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| format!("删除失败: {e}"))?;
    }
    notify_schedule(&app, &Value::Null);
    Ok(())
}

#[command]
pub fn open_settings_window(app: AppHandle) {
    tray::open_settings(&app);
}

#[command]
pub fn apply_widget(app: AppHandle) -> Result<(), String> {
    let settings = app.state::<AppState>().with_settings(|s| s.clone());
    tray::apply_widget_state(&app, &settings);
    Ok(())
}

#[command]
pub fn set_widget_visible(app: AppHandle, visible: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    let settings = state.update(|guard| guard.widget_visible = visible);
    storage::save_settings(&app, &settings)?;
    tray::apply_widget_state(&app, &settings);
    window_ops::send_settings(&app, &settings);
    Ok(())
}

#[command]
pub fn set_click_through(app: AppHandle, enabled: bool) -> Result<(), String> {
    let state = app.state::<AppState>();
    let settings = state.update(|guard| guard.click_through = enabled);
    if let Some(widget) = app.get_webview_window("widget") {
        tray::apply_click_through_state(&widget, enabled);
    }
    storage::save_settings(&app, &settings)?;
    window_ops::send_settings(&app, &settings);
    Ok(())
}

#[command]
pub fn save_custom_css(
    app: AppHandle,
    container: String,
    course: String,
    enabled: bool,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let settings = state.update(|guard| {
        guard.css.container = container;
        guard.css.course = course;
        guard.css.enabled = enabled;
    });
    storage::save_settings(&app, &settings)?;
    window_ops::send_settings(&app, &settings);
    Ok(())
}

#[command]
pub fn get_monitors(app: AppHandle) -> Result<Vec<MonitorInfo>, String> {
    geometry::monitor_list(&app)
}

#[command]
pub fn get_widget_window_state(app: AppHandle) -> Result<WidgetSize, String> {
    let settings = app.state::<AppState>().with_settings(|s| s.clone());
    Ok(geometry::widget_size(&app, &settings))
}

#[command]
pub fn get_widget_rect(app: AppHandle) -> Result<crate::models::WidgetRect, String> {
    let state = app.state::<AppState>();
    let settings = state.with_settings(|s| s.clone());
    let monitors = geometry::monitor_list(&app)?;
    Ok(geometry::rect(&monitors, &settings, state.columns()))
}

#[command]
pub fn get_wallpaper(app: AppHandle) -> Result<WallpaperInfo, String> {
    let settings = app.state::<AppState>().with_settings(|s| s.clone());
    Ok(wallpaper::load(&settings.wallpaper))
}

#[command]
pub fn import_wallpaper(app: AppHandle, path: String) -> Result<WallpaperInfo, String> {
    let info = wallpaper::import(&app, &path)?;
    let custom = info.path.clone();
    let state = app.state::<AppState>();
    let settings = state.update(|guard| {
        guard.wallpaper.mode = "custom".into();
        guard.wallpaper.custom_path = custom.clone();
    });
    storage::save_settings(&app, &settings)?;
    emit_wallpaper(&app, &info);
    window_ops::send_settings(&app, &settings);
    Ok(info)
}

#[command]
pub fn set_wallpaper_mode(app: AppHandle, mode: String) -> Result<WallpaperInfo, String> {
    let state = app.state::<AppState>();
    let settings = state.update(|guard| {
        guard.wallpaper.mode = if mode == "custom" { "custom" } else { "system" }.into();
    });
    storage::save_settings(&app, &settings)?;
    let info = wallpaper::load(&settings.wallpaper);
    emit_wallpaper(&app, &info);
    window_ops::send_settings(&app, &settings);
    Ok(info)
}

fn emit_wallpaper(app: &AppHandle, info: &WallpaperInfo) {
    use tauri::Emitter;
    if let Some(window) = app.get_webview_window("widget") {
        let _ = window.emit("wallpaper-changed", info);
    }
}

#[command]
pub fn set_widget_position(
    app: AppHandle,
    x: f64,
    y: f64,
    monitor: Option<String>,
) -> Result<(), String> {
    let state = app.state::<AppState>();
    let settings = state.update(|guard| {
        guard.position.x = x;
        guard.position.y = y;
        if monitor.is_some() {
            guard.position.monitor = monitor;
        }
    });
    if let Some(widget) = app.get_webview_window("widget") {
        apply_layout(&app, &widget, &settings)?;
    }
    storage::save_settings(&app, &settings)?;
    window_ops::send_settings(&app, &settings);
    Ok(())
}

#[command]
pub fn set_widget_size(app: AppHandle, scale: f64) -> Result<(), String> {
    let state = app.state::<AppState>();
    let settings = state.update(|guard| guard.scale = scale.clamp(0.3, 2.0));
    if let Some(widget) = app.get_webview_window("widget") {
        apply_layout(&app, &widget, &settings)?;
    }
    storage::save_settings(&app, &settings)?;
    window_ops::send_settings(&app, &settings);
    Ok(())
}

fn notify_schedule(app: &AppHandle, value: &Value) {
    use tauri::Emitter;
    if let Some(window) = app.get_webview_window("widget") {
        let _ = window.emit("schedule-changed", value);
    }
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.emit("schedule-changed", value);
    }
}

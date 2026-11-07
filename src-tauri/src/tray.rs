use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::models::Settings;
use crate::platform;
use crate::storage;
use crate::window_ops;

pub struct AppState {
    pub settings: Mutex<Settings>,
    /// Columns currently rendered by the widget: 1 (today), 5 or 7.
    pub layout_columns: Mutex<u32>,
}

impl AppState {
    pub fn new(settings: Settings) -> Self {
        Self {
            settings: Mutex::new(settings),
            layout_columns: Mutex::new(7),
        }
    }

    pub fn columns(&self) -> u32 {
        *self.layout_columns.lock().unwrap()
    }

    pub fn set_columns(&self, columns: u32) {
        *self.layout_columns.lock().unwrap() = columns.clamp(1, 7);
    }

    pub fn with_settings<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&Settings) -> R,
    {
        let guard = self.settings.lock().unwrap();
        f(&guard)
    }

    pub fn update<F>(&self, f: F) -> Settings
    where
        F: FnOnce(&mut Settings),
    {
        let mut guard = self.settings.lock().unwrap();
        f(&mut guard);
        guard.clone()
    }
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "显示/隐藏组件", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(app, &[&toggle, &settings_item, &separator, &quit])?;

    let icon = app
        .default_window_icon()
        .ok_or_else(|| tauri::Error::AssetNotFound("default icon".into()))?
        .clone();

    TrayIconBuilder::with_id("main-tray")
        .icon(icon)
        .tooltip("课表组件")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => toggle_widget(app),
            "settings" => open_settings(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

fn toggle_widget(app: &AppHandle) {
    let state = app.state::<AppState>();
    let settings = {
        let mut guard = state.settings.lock().unwrap();
        guard.widget_visible = !guard.widget_visible;
        guard.clone()
    };
    let _ = storage::save_settings(app, &settings);
    apply_widget_state(app, &settings);
    window_ops::send_settings(app, &settings);
}

pub fn apply_widget_state(app: &AppHandle, settings: &Settings) {
    let Some(window) = app.get_webview_window("widget") else {
        return;
    };
    let _ = window_ops::apply_visibility(&window, settings.widget_visible);
    if !settings.widget_visible {
        return;
    }
    let columns = app.state::<AppState>().columns();
    let _ = window_ops::apply_position(&window, settings, columns);
    let _ = window_ops::apply_click_through(&window, settings.click_through);
    pin_to_desktop(&window, settings.desktop_pin);
}

pub fn pin_to_desktop(window: &tauri::WebviewWindow, enabled: bool) {
    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd() {
        platform::set_desktop_pin(hwnd.0 as isize, enabled);
    }
}

/// Let the widget window take keyboard focus while a form is open, then hand
/// the desktop-pin behaviour back when the form closes.
pub fn set_editable(window: &tauri::WebviewWindow, editable: bool) {
    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd() {
        platform::set_editable(hwnd.0 as isize, editable);
    }
    if editable {
        let _ = window.set_focus();
    }
}

pub fn apply_click_through_state(window: &tauri::WebviewWindow, enabled: bool) {
    let _ = window.set_ignore_cursor_events(enabled);
    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd() {
        platform::set_click_through(hwnd.0 as isize, enabled);
    }
}

pub fn open_settings(app: &AppHandle) {
    if let Some(existing) = app.get_webview_window("settings") {
        let _ = existing.show();
        let _ = existing.unminimize();
        let _ = existing.set_focus();
        return;
    }

    let builder = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
        .title("课表组件设置")
        .inner_size(780.0, 660.0)
        .min_inner_size(700.0, 560.0)
        .resizable(true)
        .visible(true)
        .skip_taskbar(false)
        .decorations(true)
        .center();

    if let Err(error) = builder.build() {
        eprintln!("failed to open settings window: {error}");
    }
}

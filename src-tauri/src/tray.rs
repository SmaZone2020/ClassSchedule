use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

use crate::models::Settings;
use crate::platform;
use crate::window_ops;

pub struct AppState {
    pub settings: Mutex<Settings>,
}

impl AppState {
    pub fn new(settings: Settings) -> Self {
        Self {
            settings: Mutex::new(settings),
        }
    }

    pub fn with_settings<F, R>(&self, f: F) -> R
    where
        F: FnOnce(&Settings) -> R,
    {
        let guard = self.settings.lock().unwrap();
        f(&guard)
    }
}

pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    let toggle = MenuItem::with_id(app, "toggle", "显示/隐藏组件", true, None::<&str>)?;
    let settings_item = MenuItem::with_id(app, "settings", "设置…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;

    let menu = Menu::with_items(app, &[&toggle, &settings_item, &separator, &quit])?;

    let _tray = TrayIconBuilder::with_id("main-tray")
        .icon(app.default_window_icon().unwrap().clone())
        .tooltip("课表组件")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "toggle" => {
                let state = app.state::<AppState>();
                let mut guard = state.settings.lock().unwrap();
                guard.widget_visible = !guard.widget_visible;
                let visible = guard.widget_visible;
                let settings = guard.clone();
                drop(guard);
                apply_widget_state(app, &settings, visible);
                crate::storage::save_settings(app, &settings).ok();
                window_ops::send_settings(app, &settings);
            }
            "settings" => open_settings(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;

    Ok(())
}

pub fn apply_widget_state(app: &AppHandle, settings: &Settings, visible: bool) {
    if let Some(window) = app.get_webview_window("widget") {
        window_ops::apply_visibility(&window, visible).ok();
        if visible {
            window_ops::apply_position(&window, settings).ok();
            window_ops::apply_click_through(&window, settings.click_through).ok();
            pin_to_desktop(&window);
        }
    }
}

pub fn pin_to_desktop(window: &tauri::WebviewWindow) {
    #[cfg(windows)]
    if let Ok(hwnd) = window.hwnd() {
        platform::pin_above_desktop(hwnd.0 as isize);
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
        .inner_size(760.0, 640.0)
        .min_inner_size(680.0, 560.0)
        .resizable(true)
        .visible(true)
        .skip_taskbar(false)
        .decorations(true);

    builder.build().ok();
}


mod commands;
mod geometry;
mod models;
mod platform;
mod schedule;
mod storage;
mod tray;
mod wallpaper;
mod window_ops;

use tauri::Manager;

use models::Settings;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(tray::AppState::new(Settings::default()))
        .invoke_handler(tauri::generate_handler![
            commands::get_app_data,
            commands::get_settings,
            commands::update_settings,
            commands::get_schedule,
            commands::import_schedule_from_path,
            commands::export_template,
            commands::open_settings_window,
            commands::apply_widget,
            commands::set_widget_visible,
            commands::set_click_through,
            commands::validate_schedule_text,
            commands::save_custom_css,
            commands::clear_schedule,
            commands::get_monitors,
            commands::get_widget_window_state,
            commands::set_layout_columns,
            commands::get_widget_rect,
            commands::get_wallpaper,
            commands::import_wallpaper,
            commands::set_wallpaper_mode,
            commands::set_widget_position,
            commands::set_widget_size
        ])        .on_window_event(|window, event| {
            if window.label() == "settings" {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                    let app = window.app_handle();
                    let state = app.state::<tray::AppState>();
                    if !state.with_settings(|s| s.widget_visible) {
                        app.exit(0);
                    }
                }
            }
        })
        .setup(|app| {
            let handle = app.handle().clone();
            let settings = storage::load_settings(&handle);
            storage::ensure_data_dir(&handle);
            storage::load_schedule(&handle);
            *app.state::<tray::AppState>().settings.lock().unwrap() = settings.clone();

            tray::setup_tray(&handle)?;

            let widget = app.get_webview_window("widget").expect("widget window");
            widget.hide()?;
            if settings.widget_visible {
                window_ops::apply_position(&widget, &settings, 7).ok();
                window_ops::apply_click_through(&widget, settings.click_through).ok();
                tray::pin_to_desktop(&widget, settings.desktop_pin);
                let _ = widget.show();
            }

            if let Some(win) = app.get_webview_window("settings") {
                let _ = win.close();
            }

            #[cfg(debug_assertions)]
            if std::env::var("SCHEDULE_OPEN_SETTINGS").is_ok() {
                tray::open_settings(&handle);
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

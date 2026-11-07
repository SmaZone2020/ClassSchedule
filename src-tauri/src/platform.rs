#![cfg(windows)]

use std::sync::atomic::{AtomicBool, AtomicIsize, Ordering};
use std::sync::OnceLock;
use std::time::Duration;

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    GetWindowLongW, SetWindowLongW, SetWindowPos, GWL_EXSTYLE, HWND_BOTTOM, HWND_NOTOPMOST,
    SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
};

static PIN_HWND: AtomicIsize = AtomicIsize::new(0);
static PIN_ENABLED: AtomicBool = AtomicBool::new(false);
static EDITABLE: AtomicBool = AtomicBool::new(false);
static KEEPER: OnceLock<()> = OnceLock::new();

fn apply_pin(hwnd: isize, enabled: bool) {
    unsafe {
        let window = HWND(hwnd as _);
        let insert_after = if enabled { HWND_BOTTOM } else { HWND_NOTOPMOST };
        let _ = SetWindowPos(
            window,
            Some(insert_after),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );

        // Never show up in the taskbar. When unpinned the window may take focus
        // again, so the widget can be brought forward like any other window.
        //
        // `WS_EX_NOACTIVATE` keeps the widget from stealing focus while it sits
        // on the desktop, but it also means the window can never become the
        // foreground window — a form inside it can hold DOM focus and still
        // receive no keystroke. While a form is open `EDITABLE` lifts the flag.
        let style = GetWindowLongW(window, GWL_EXSTYLE) as u32;
        let mut updated = style | WS_EX_TOOLWINDOW.0;
        updated = if enabled && !EDITABLE.load(Ordering::SeqCst) {
            updated | WS_EX_NOACTIVATE.0
        } else {
            updated & !WS_EX_NOACTIVATE.0
        };
        let _ = SetWindowLongW(window, GWL_EXSTYLE, updated as i32);
    }
}

/// Keep the widget pinned to the desktop layer (below every normal window).
///
/// A single `HWND_BOTTOM` call is not sticky: any later `ShowWindow`,
/// activation or z-order change can lift the window back up. A light keeper
/// thread re-applies the pin so it survives those events.
pub fn set_desktop_pin(hwnd: isize, enabled: bool) {
    PIN_HWND.store(hwnd, Ordering::SeqCst);
    PIN_ENABLED.store(enabled, Ordering::SeqCst);
    apply_pin(hwnd, enabled);

    KEEPER.get_or_init(|| {
        std::thread::spawn(|| loop {
            std::thread::sleep(Duration::from_millis(700));
            if !PIN_ENABLED.load(Ordering::SeqCst) {
                continue;
            }
            let hwnd = PIN_HWND.load(Ordering::SeqCst);
            if hwnd != 0 {
                apply_pin(hwnd, true);
            }
        });
    });
}

/// Allow the widget to become the foreground window so an open form can take
/// keyboard input. Restores the pinned style when disabled.
pub fn set_editable(hwnd: isize, editable: bool) {
    EDITABLE.store(editable, Ordering::SeqCst);
    let enabled = PIN_ENABLED.load(Ordering::SeqCst);
    apply_pin(hwnd, enabled);
}

pub fn set_click_through(hwnd: isize, enabled: bool) {
    unsafe {
        let style = GetWindowLongW(HWND(hwnd as _), GWL_EXSTYLE) as u32;
        let updated = if enabled {
            style | WS_EX_TRANSPARENT.0
        } else {
            style & !WS_EX_TRANSPARENT.0
        };
        let _ = SetWindowLongW(HWND(hwnd as _), GWL_EXSTYLE, updated as i32);
    }
}

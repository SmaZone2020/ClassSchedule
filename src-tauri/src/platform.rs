#![cfg(windows)]

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowLongW, SetWindowPos, GWL_EXSTYLE, HWND_BOTTOM, HWND_NOTOPMOST, SWP_NOACTIVATE,
    SWP_NOMOVE, SWP_NOSIZE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
};

/// Keep the widget pinned to the desktop layer (below every normal window) or
/// release it so it behaves like an ordinary floating window.
pub fn set_desktop_pin(hwnd: isize, enabled: bool) {
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
        let style = windows::Win32::UI::WindowsAndMessaging::GetWindowLongW(window, GWL_EXSTYLE)
            as u32;
        let mut updated = style | WS_EX_TOOLWINDOW.0;
        updated = if enabled {
            updated | WS_EX_NOACTIVATE.0
        } else {
            updated & !WS_EX_NOACTIVATE.0
        };
        let _ = SetWindowLongW(window, GWL_EXSTYLE, updated as i32);
    }
}

pub fn set_click_through(hwnd: isize, enabled: bool) {    unsafe {
        let style =
            windows::Win32::UI::WindowsAndMessaging::GetWindowLongW(HWND(hwnd as _), GWL_EXSTYLE)
                as u32;
        let updated = if enabled {
            style | WS_EX_TRANSPARENT.0
        } else {
            style & !WS_EX_TRANSPARENT.0
        };
        let _ = SetWindowLongW(HWND(hwnd as _), GWL_EXSTYLE, updated as i32);
    }
}

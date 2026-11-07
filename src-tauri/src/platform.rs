#![cfg(windows)]

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowLongW, SetWindowPos, GWL_EXSTYLE, HWND_NOTOPMOST, SWP_NOACTIVATE, SWP_NOMOVE,
    SWP_NOSIZE, WS_EX_NOACTIVATE, WS_EX_TOOLWINDOW, WS_EX_TRANSPARENT,
};

pub fn pin_below_normal_windows(hwnd: isize) {
    unsafe {
        let _ = SetWindowPos(
            HWND(hwnd as _),
            Some(HWND_NOTOPMOST),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE,
        );
        let style =
            windows::Win32::UI::WindowsAndMessaging::GetWindowLongW(HWND(hwnd as _), GWL_EXSTYLE)
                as u32;
        let updated = style | WS_EX_NOACTIVATE.0 | WS_EX_TOOLWINDOW.0;
        let _ = SetWindowLongW(HWND(hwnd as _), GWL_EXSTYLE, updated as i32);
    }
}

pub fn set_click_through(hwnd: isize, enabled: bool) {
    unsafe {
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

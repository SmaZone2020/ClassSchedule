#![cfg(windows)]

use windows::Win32::Foundation::HWND;
use windows::Win32::UI::WindowsAndMessaging::{
    SetWindowLongW, SetWindowPos, GWL_EXSTYLE, HWND_BOTTOM, SWP_NOACTIVATE, SWP_NOMOVE, SWP_NOSIZE,
    SWP_NOREDRAW, WS_EX_TRANSPARENT,
};

pub fn pin_above_desktop(hwnd: isize) {
    unsafe {
        let _ = SetWindowPos(
            HWND(hwnd as _),
            Some(HWND_BOTTOM),
            0,
            0,
            0,
            0,
            SWP_NOMOVE | SWP_NOSIZE | SWP_NOACTIVATE | SWP_NOREDRAW,
        );
    }
}

pub fn set_click_through(hwnd: isize, enabled: bool) {
    unsafe {
        let style =
            windows::Win32::UI::WindowsAndMessaging::GetWindowLongW(HWND(hwnd as _), GWL_EXSTYLE)
                as u32;
        let new_style = if enabled {
            style | WS_EX_TRANSPARENT.0
        } else {
            style & !WS_EX_TRANSPARENT.0
        };
        let _ = SetWindowLongW(HWND(hwnd as _), GWL_EXSTYLE, new_style as i32);
    }
}

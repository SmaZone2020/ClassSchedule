//! Launch-at-login support.
//!
//! Windows only needs a value under
//! `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, so this stays a small
//! registry write instead of pulling in an extra plugin.

use std::env;

const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
const VALUE_NAME: &str = "ClassScheduleWidget";

#[cfg(windows)]
fn run_key() -> Result<winreg::RegKey, String> {
    use winreg::enums::HKEY_CURRENT_USER;
    winreg::RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey_with_flags(RUN_KEY, winreg::enums::KEY_ALL_ACCESS)
        .map_err(|error| format!("无法打开自启动注册表项: {error}"))
}

/// The command written to the registry: the current executable, quoted so
/// paths containing spaces still work.
fn launch_command() -> Result<String, String> {
    let exe = env::current_exe().map_err(|error| format!("无法获取程序路径: {error}"))?;
    Ok(format!("\"{}\"", exe.display()))
}

#[cfg(windows)]
pub fn is_enabled() -> bool {
    let Ok(key) = run_key() else {
        return false;
    };
    key.get_value::<String, _>(VALUE_NAME).is_ok()
}

#[cfg(not(windows))]
pub fn is_enabled() -> bool {
    false
}

#[cfg(windows)]
pub fn set_enabled(enabled: bool) -> Result<(), String> {
    let key = run_key()?;
    if enabled {
        let command = launch_command()?;
        key.set_value(VALUE_NAME, &command)
            .map_err(|error| format!("写入自启动项失败: {error}"))
    } else {
        match key.delete_value(VALUE_NAME) {
            Ok(()) => Ok(()),
            // Already absent is the state we want.
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(error) => Err(format!("删除自启动项失败: {error}")),
        }
    }
}

#[cfg(not(windows))]
pub fn set_enabled(_enabled: bool) -> Result<(), String> {
    Err("当前平台不支持开机自启动".to_string())
}

/// Bring the registry in line with the saved setting on startup, so moving the
/// executable (or a reinstall) refreshes the recorded path.
pub fn sync(enabled: bool) {
    if enabled && !is_enabled() {
        let _ = set_enabled(true);
    }
}

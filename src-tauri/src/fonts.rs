use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use base64::Engine;
use serde::Serialize;

/// CSS family used for every `@font-face` we inject. The user picks the file,
/// not the internal name, so we always expose one stable family.
pub const CUSTOM_FAMILY: &str = "WidgetCustomFont";

const FONT_EXTENSIONS: [&str; 4] = ["ttf", "otf", "ttc", "woff2"];

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FontFile {
    pub path: String,
    pub label: String,
    /// `http://font.localhost/?b=...` URL served by the custom protocol.
    pub url: String,
    pub weight: u32,
    pub style: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FontCatalog {
    pub system: Vec<String>,
    pub custom: Vec<FontFile>,
    pub family: String,
}

/// Base64url of the UTF-8 path — avoids every percent-encoding edge case in a
/// Windows path (drive letters, backslashes, CJK).
pub fn encode_path(path: &str) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(path.as_bytes())
}

pub fn decode_path(token: &str) -> Option<String> {
    let bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(token)
        .ok()?;
    String::from_utf8(bytes).ok()
}

pub fn url_for(path: &str) -> String {
    format!("http://font.localhost/?b={}", encode_path(path))
}

fn weight_of(name: &str) -> (u32, &'static str) {
    let lower = name.to_ascii_lowercase();
    let weight = if lower.contains("extralight") || lower.contains("ultralight") {
        200
    } else if lower.contains("semibold") || lower.contains("demibold") {
        600
    } else if lower.contains("extrabold") || lower.contains("ultrabold") {
        800
    } else if lower.contains("bold") {
        700
    } else if lower.contains("medium") {
        500
    } else if lower.contains("light") {
        300
    } else if lower.contains("heavy") || lower.contains("black") {
        900
    } else {
        400
    };
    let style = if lower.contains("italic") || lower.contains("oblique") {
        "italic"
    } else {
        "normal"
    };
    (weight, style)
}

fn is_font(path: &Path) -> bool {
    path.extension()
        .and_then(|value| value.to_str())
        .map(|value| FONT_EXTENSIONS.contains(&value.to_ascii_lowercase().as_str()))
        .unwrap_or(false)
}

fn collect(dir: &Path, depth: u8, out: &mut Vec<PathBuf>) {
    if depth > 3 {
        return;
    }
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect(&path, depth + 1, out);
        } else if is_font(&path) {
            out.push(path);
        }
    }
}

/// Every font file inside `dir` (recursively, capped) as injectable faces.
pub fn faces_in(dir: &str) -> Vec<FontFile> {
    let root = PathBuf::from(dir);
    if !root.exists() {
        return Vec::new();
    }

    let mut files = Vec::new();
    if root.is_file() {
        if is_font(&root) {
            files.push(root);
        }
    } else {
        collect(&root, 0, &mut files);
    }
    files.sort();

    files
        .into_iter()
        .map(|path| {
            let stem = path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("font")
                .to_string();
            let (weight, style) = weight_of(&stem);
            let text = path.to_string_lossy().to_string();
            FontFile {
                url: url_for(&text),
                label: stem,
                path: text,
                weight,
                style: style.into(),
            }
        })
        .collect()
}

fn push_family(out: &mut BTreeSet<String>, raw: &str) {
    // Registry names look like `Microsoft YaHei & Microsoft YaHei UI (TrueType)`.
    let trimmed = match raw.find('(') {
        Some(index) => &raw[..index],
        None => raw,
    };
    for part in trimmed.split('&') {
        let name = part.trim().trim_start_matches('@').trim();
        if name.is_empty() || name.starts_with('@') {
            continue;
        }
        out.insert(name.to_string());
    }
}

/// Installed font families, read straight from the Windows font registry keys.
pub fn system_families() -> Vec<String> {
    #[cfg(windows)]
    {
        use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ};
        use winreg::RegKey;

        let mut names = BTreeSet::new();
        let roots = [
            (HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"),
            (HKEY_CURRENT_USER, r"SOFTWARE\Microsoft\Windows NT\CurrentVersion\Fonts"),
        ];
        for (root, key) in roots {
            let Ok(reg) = RegKey::predef(root).open_subkey_with_flags(key, KEY_READ) else {
                continue;
            };
            for value in reg.enum_values().flatten() {
                push_family(&mut names, &value.0);
            }
        }
        names.into_iter().collect()
    }
    #[cfg(not(windows))]
    {
        Vec::new()
    }
}

pub fn catalog(current_dir: &str) -> FontCatalog {
    let custom = faces_in(current_dir);

    FontCatalog {
        system: system_families(),
        custom,
        family: CUSTOM_FAMILY.into(),
    }
}

pub fn content_type(path: &str) -> &'static str {
    match path.rsplit('.').next().unwrap_or("").to_ascii_lowercase().as_str() {
        "otf" => "font/otf",
        "ttf" => "font/ttf",
        "ttc" => "font/collection",
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        _ => "application/octet-stream",
    }
}

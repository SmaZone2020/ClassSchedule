use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Position {
    pub monitor: Option<String>,
    pub x: f64,
    pub y: f64,
}

impl Default for Position {
    fn default() -> Self {
        Self {
            monitor: None,
            x: 60.0,
            y: 60.0,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct PanelStyle {
    pub radius: f64,
    pub opacity: f64,
    pub blur: f64,
    pub gap: f64,
    pub show_location: bool,
    pub show_period_time: bool,
    pub show_header: bool,
}

impl Default for PanelStyle {
    fn default() -> Self {
        Self {
            radius: 20.0,
            opacity: 0.62,
            blur: 18.0,
            gap: 6.0,
            show_location: true,
            show_period_time: true,
            show_header: true,
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct PeriodTime {
    pub index: u32,
    pub start: String,
    pub end: String,
}

impl Default for PeriodTime {
    fn default() -> Self {
        Self {
            index: 1,
            start: "08:00".into(),
            end: "08:45".into(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct CustomCss {
    pub enabled: bool,
    pub container: String,
    pub course: String,
}

impl Default for CustomCss {
    fn default() -> Self {
        Self {
            enabled: false,
            container: String::new(),
            course: String::new(),
        }
    }
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase", default)]
pub struct Settings {
    pub position: Position,
    pub scale: f64,
    pub days_mode: String,
    pub click_through: bool,
    pub desktop_pin: bool,
    pub theme: String,
    pub accent: String,
    pub style: String,
    pub panel: PanelStyle,
    pub system_acrylic: bool,
    pub periods: Vec<PeriodTime>,
    pub css: CustomCss,
    pub widget_visible: bool,
}

fn default_periods() -> Vec<PeriodTime> {
    let ranges = [
        ("08:00", "08:45"),
        ("08:55", "09:40"),
        ("10:00", "10:45"),
        ("10:55", "11:40"),
        ("14:00", "14:45"),
        ("14:55", "15:40"),
        ("16:00", "16:45"),
        ("16:55", "17:40"),
    ];
    ranges
        .iter()
        .enumerate()
        .map(|(index, (start, end))| PeriodTime {
            index: index as u32 + 1,
            start: (*start).to_string(),
            end: (*end).to_string(),
        })
        .collect()
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            position: Position::default(),
            scale: 1.0,
            days_mode: "auto".into(),
            click_through: true,
            desktop_pin: true,
            theme: "auto".into(),
            accent: "#4f8ef7".into(),
            style: "frosted".into(),
            panel: PanelStyle::default(),
            system_acrylic: true,
            periods: default_periods(),
            css: CustomCss::default(),
            widget_visible: true,
        }
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonitorInfo {
    pub name: String,
    pub label: String,
    pub width: f64,
    pub height: f64,
    pub is_primary: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    pub settings: Settings,
    pub schedule: Option<serde_json::Value>,
    pub schedule_error: Option<String>,
    pub monitors: Vec<MonitorInfo>,
    pub widget_size: WidgetSize,
    pub config_dir: String,
}

#[derive(Serialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct WidgetSize {
    pub width: f64,
    pub height: f64,
}

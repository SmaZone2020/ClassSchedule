use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use serde::Serialize;
use serde_json::Value;

const CACHE_TTL: Duration = Duration::from_secs(600);
const UA: &str = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
                  (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ForecastDay {
    /// `今天` / `星期日` …
    pub label: String,
    /// `11/7`
    pub date: String,
    pub high: Option<f64>,
    pub low: Option<f64>,
    /// Day icon code, e.g. `02`.
    pub code: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherInfo {
    pub area_id: String,
    pub province: String,
    pub city: String,
    pub district: String,
    /// China Weather 2-digit icon code, e.g. `02` for overcast.
    pub code: String,
    pub condition: String,
    pub temperature: f64,
    pub temp_max: Option<f64>,
    pub temp_min: Option<f64>,
    pub humidity: Option<f64>,
    pub wind: String,
    pub wind_power: String,
    pub aqi: Option<i64>,
    pub comfort: Option<String>,
    pub sport: Option<String>,
    pub dressing: Option<String>,
    pub mood: Option<String>,
    pub forecast: Vec<ForecastDay>,
    pub updated_at: i64,
}

#[derive(Default)]
pub struct WeatherState {
    cache: Mutex<Option<(Instant, WeatherInfo)>>,
}

impl WeatherState {
    fn cached(&self) -> Option<WeatherInfo> {
        let guard = self.cache.lock().ok()?;
        let (at, info) = guard.as_ref()?;
        (at.elapsed() < CACHE_TTL).then(|| info.clone())
    }

    fn store(&self, info: WeatherInfo) {
        if let Ok(mut guard) = self.cache.lock() {
            *guard = Some((Instant::now(), info));
        }
    }
}

fn client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(12))
        .user_agent(UA)
        .build()
        .map_err(|error| format!("初始化网络失败: {error}"))
}

/// The CDN serves UTF-8 today but historically used GBK, so fall back safely.
fn decode_body(bytes: &[u8]) -> String {
    match std::str::from_utf8(bytes) {
        Ok(text) => text.to_string(),
        Err(_) => {
            let (text, _, _) = encoding_rs::GB18030.decode(bytes);
            text.into_owned()
        }
    }
}

/// Pull `var name = {...}` out of the JS wrapper the weather CDN returns.
fn json_block<'a>(body: &'a str, name: &str) -> Option<&'a str> {
    // The CDN sometimes serves `var x ={...}` without the space.
    for marker in [format!("var {name} ="), format!("var {name}=")] {
        let Some(found) = body.find(&marker) else {
            continue;
        };
        let start = found + marker.len();
        let rest = &body[start..];
        let open = rest.find('{')?;
        let mut depth = 0i32;
        let mut in_string = false;
        let mut escaped = false;

        for (offset, ch) in rest[open..].char_indices() {
            if in_string {
                if escaped {
                    escaped = false;
                } else if ch == '\\' {
                    escaped = true;
                } else if ch == '"' {
                    in_string = false;
                }
                continue;
            }
            match ch {
                '"' => in_string = true,
                '{' => depth += 1,
                '}' => {
                    depth -= 1;
                    if depth == 0 {
                        return rest.get(open..open + offset + 1);
                    }
                }
                _ => {}
            }
        }
    }
    None
}

fn text_of(value: &Value, key: &str) -> Option<String> {
    let raw = value.get(key)?.as_str()?.trim();
    (!raw.is_empty()).then(|| raw.to_string())
}

fn number_of(value: &Value, key: &str) -> Option<f64> {
    let raw = value.get(key)?.as_str()?.trim();
    // Values such as `69%`, `<3级` or `15.4` need light clean-up.
    let cleaned: String = raw
        .chars()
        .take_while(|ch| ch.is_ascii_digit() || *ch == '.' || *ch == '-')
        .collect();
    cleaned.parse().ok()
}

/// `https://wgeo.weather.com.cn/ip/` answers
/// `var ip="..";var id="101110809";var addr="陕西,汉中,宁强";`.
async fn locate_by_ip(http: &reqwest::Client) -> Option<(String, String, String, String)> {
    let bytes = http
        .get("https://wgeo.weather.com.cn/ip/")
        .header(reqwest::header::REFERER, "https://e.weather.com.cn/")
        .send()
        .await
        .ok()?
        .bytes()
        .await
        .ok()?;

    let body = decode_body(&bytes);
    let id = regex::Regex::new(r#"var id="(\d+)""#)
        .ok()?
        .captures(&body)?
        .get(1)?
        .as_str()
        .to_string();
    let addr = regex::Regex::new(r#"var addr="([^"]*)""#)
        .ok()?
        .captures(&body)
        .and_then(|caps| caps.get(1))
        .map(|item| item.as_str().to_string())
        .unwrap_or_default();

    let mut parts = addr.split(',').map(str::trim);
    let province = parts.next().unwrap_or("").to_string();
    let city = parts.next().unwrap_or("").to_string();
    let district = parts.next().unwrap_or("").to_string();
    Some((id, province, city, district))
}

/// Fallback: coordinates from a public IP lookup, then China Weather's own
/// station resolver.
async fn locate_by_coordinates(http: &reqwest::Client) -> Option<(String, String, String, String)> {
    let coords = http
        .get("https://ipwho.is/")
        .send()
        .await
        .ok()?
        .json::<Value>()
        .await
        .ok()?;
    let lat = coords.get("latitude")?.as_f64()?;
    let lon = coords.get("longitude")?.as_f64()?;

    let params = format!(r#"{{"method":"stationinfo","lat":{lat},"lng":{lon}}}"#);
    let body = http
        .get("https://d4.weather.com.cn/geong/v1/api")
        .query(&[("params", params)])
        .header(reqwest::header::REFERER, "https://e.weather.com.cn/")
        .send()
        .await
        .ok()?
        .text()
        .await
        .ok()?;

    let value: Value = serde_json::from_str(&body).ok()?;
    let station = value.get("data")?.get("station")?;
    Some((
        station.get("areaid")?.as_str()?.to_string(),
        station
            .get("provincecn")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        station
            .get("distictcn")
            .and_then(Value::as_str)
            .unwrap_or("")
            .to_string(),
        String::new(),
    ))
}

fn index_hint(indices: &Value, prefix: &str) -> Option<String> {
    let key = format!("{prefix}_hint");
    indices
        .get(&key)
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|text| !text.is_empty())
        .map(str::to_string)
}

/// `d02` / `n2` / `02` → `02`.
fn normalize_code(raw: &str) -> String {
    let digits = raw
        .trim()
        .trim_start_matches(['d', 'n'])
        .chars()
        .filter(char::is_ascii_digit)
        .collect::<String>();
    let trimmed = digits.trim_start_matches('0');
    match trimmed.len() {
        0 => "00".to_string(),
        1 => format!("0{trimmed}"),
        _ => trimmed.to_string(),
    }
}

async fn fetch(http: &reqwest::Client) -> Result<WeatherInfo, String> {
    let (area_id, mut province, mut city, mut district) = match locate_by_ip(http).await {
        Some(found) => found,
        None => locate_by_coordinates(http)
            .await
            .ok_or_else(|| "无法定位当前城市".to_string())?,
    };

    let url = format!("https://d1.weather.com.cn/weather_index/{area_id}.html");
    let bytes = http
        .get(url)
        .header(reqwest::header::REFERER, "https://www.weather.com.cn/")
        .send()
        .await
        .map_err(|error| format!("天气请求失败: {error}"))?
        .bytes()
        .await
        .map_err(|error| format!("天气读取失败: {error}"))?;

    let body = decode_body(&bytes);

    let current: Value = json_block(&body, "dataSK")
        .and_then(|block| serde_json::from_str(block).ok())
        .ok_or_else(|| "天气数据缺少实时观测".to_string())?;

    let indices: Value = json_block(&body, "dataZS")
        .and_then(|block| serde_json::from_str(block).ok())
        .and_then(|root: Value| root.get("zs").cloned())
        .unwrap_or(Value::Null);

    let forecast: Value = json_block(&body, "fc")
        .and_then(|block| serde_json::from_str(block).ok())
        .unwrap_or(Value::Null);
    let today = forecast
        .get("f")
        .and_then(|list| list.get(0))
        .cloned()
        .unwrap_or(Value::Null);
    let days = forecast
        .get("f")
        .and_then(Value::as_array)
        .map(|list| {
            list.iter()
                .filter_map(|day| {
                    Some(ForecastDay {
                        label: text_of(day, "fj")?,
                        date: text_of(day, "fi").unwrap_or_default(),
                        high: number_of(day, "fc"),
                        low: number_of(day, "fd"),
                        code: normalize_code(&text_of(day, "fa").unwrap_or_else(|| "00".into())),
                    })
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    if city.is_empty() {
        city = text_of(&current, "cityname").unwrap_or_default();
    }
    if province.is_empty() {
        province = text_of(&current, "nameen").unwrap_or_default();
    }

    let raw_code = text_of(&current, "weathercode").unwrap_or_else(|| "d02".into());
    let code = normalize_code(&raw_code);

    let temperature = number_of(&current, "temp").unwrap_or(0.0);

    Ok(WeatherInfo {
        area_id,
        province,
        city,
        district,
        code,
        condition: text_of(&current, "weather").unwrap_or_else(|| "未知".into()),
        temperature,
        temp_max: number_of(&today, "fc"),
        temp_min: number_of(&today, "fd"),
        humidity: number_of(&current, "SD"),
        wind: text_of(&current, "WD").unwrap_or_default(),
        wind_power: text_of(&current, "WS").unwrap_or_default(),
        aqi: number_of(&current, "aqi").map(|value| value.round() as i64),
        comfort: index_hint(&indices, "co"),
        sport: index_hint(&indices, "yd"),
        dressing: index_hint(&indices, "ct"),
        mood: index_hint(&indices, "xq"),
        forecast: days,
        updated_at: SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|elapsed| elapsed.as_secs() as i64)
            .unwrap_or(0),
    })
}

#[tauri::command]
pub async fn get_weather(
    state: tauri::State<'_, WeatherState>,
    force: Option<bool>,
) -> Result<WeatherInfo, String> {
    if force != Some(true) {
        if let Some(info) = state.cached() {
            return Ok(info);
        }
    }

    let http = client()?;
    let info = fetch(&http).await?;
    state.store(info.clone());
    Ok(info)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"var cityDZ ={"weatherinfo":{"city":"汉中"}};
var alarmDZ ={"w":[]};
var dataSK ={"nameen":"hanzhong","cityname":"汉中","city":"101110801","temp":"15.3","WD":"东风","WS":"1级","SD":"70%","aqi":"34","weather":"阴","weathercode":"d02"};
var dataZS ={"zs":{"co_hint":"较舒适","yd_hint":"较不宜","ct_hint":"较冷","xq_hint":"较差"}};
var fc ={"f":[{"fa":"02","fb":"02","fc":"16","fd":"11","fi":"11\/7","fj":"今天"}]};"#;

    #[test]
    fn extracts_each_json_block() {
        let current: Value = serde_json::from_str(json_block(SAMPLE, "dataSK").unwrap()).unwrap();
        assert_eq!(current["cityname"], "汉中");

        let indices: Value = serde_json::from_str(json_block(SAMPLE, "dataZS").unwrap()).unwrap();
        assert_eq!(indices["zs"]["co_hint"], "较舒适");

        let forecast: Value = serde_json::from_str(json_block(SAMPLE, "fc").unwrap()).unwrap();
        assert_eq!(forecast["f"][0]["fc"], "16");
    }

    #[test]
    fn parses_number_fields_with_units() {
        let current: Value = serde_json::from_str(json_block(SAMPLE, "dataSK").unwrap()).unwrap();
        assert_eq!(number_of(&current, "temp"), Some(15.3));
        assert_eq!(number_of(&current, "SD"), Some(70.0));
        assert_eq!(number_of(&current, "aqi"), Some(34.0));
        assert_eq!(number_of(&current, "WS"), Some(1.0));
    }

    #[test]
    fn normalizes_china_weather_codes() {
        assert_eq!(normalize_code("d02"), "02");
        assert_eq!(normalize_code("n2"), "02");
        assert_eq!(normalize_code("00"), "00");
        assert_eq!(normalize_code("d00"), "00");
        assert_eq!(normalize_code("d53"), "53");
    }

    #[test]
    fn decodes_utf8_and_gbk() {
        assert_eq!(decode_body("阴".as_bytes()), "阴");
        let (gbk, _, _) = encoding_rs::GB18030.encode("阴");
        assert_eq!(decode_body(&gbk), "阴");
    }
}

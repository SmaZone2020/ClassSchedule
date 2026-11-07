//! 喜鹊儿（xiqueer）课表导入。
//!
//! 协议移植自仓库根目录的 `xiqueer_timetable.py`：登录参数需要一套自定义
//! 编码 + MD5 签名，登录响应是 AES-128-CBC 密文。这里只保留导入所需的
//! 最小流程：学校搜索 → 登录 → 学期列表 → 逐周拉取课表 → 转成本应用的
//! `Schedule` JSON。

use std::collections::{BTreeMap, BTreeSet};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use aes::Aes128;
use base64::Engine as _;
use cbc::cipher::{block_padding::Pkcs7, BlockDecryptMut, KeyIvInit};
use md5::{Digest, Md5};
use regex::Regex;
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};

type Aes128CbcDec = cbc::Decryptor<Aes128>;

const GATEWAY_URL: &str = "https://api.xiqueer.com/manager//wap/wapController.jsp";
const ENC_KEY: &str = "yt6n78";
const APP_INFO: &str = "Android2.6.450";
const MODEL: &str = "MI 8";
const OS_NAME: &str = "Android";
const OS_VERSION: &str = "10";
const LOGIN_AES_KEY: &[u8] = b"loginkeyapp93214";
const LOGIN_AES_IV: &[u8] = b"12fg45gpsdfz34ab";

const APP_STORE_URL: &str = "https://apps.apple.com/cn/app/id1152127141";
const APP_LOOKUP_URL: &str = "https://itunes.apple.com/lookup?id=1152127141&country=cn";
const FALLBACK_APP_VERSION: &str = "2.6.455";

const WEEKDAY_NAMES: [&str; 7] = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

/// Process-wide state: the current login plus the scraped app version.
#[derive(Default)]
pub struct XiqueerState {
    session: Mutex<Option<LoginState>>,
    version: Mutex<Option<String>>,
}

#[derive(Clone, Debug)]
struct LoginState {
    school_name: String,
    school_code: String,
    user_id: String,
    user_type: String,
    uuid: String,
    token: String,
    xm: String,
    cache_md5: String,
    account: String,
    password: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SchoolInfo {
    pub name: String,
    pub code: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermInfo {
    pub code: String,
    pub name: String,
    pub current: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginResult {
    pub school_name: String,
    pub user_name: String,
    pub terms: Vec<TermInfo>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImportResult {
    pub schedule: Value,
    pub periods: Vec<PeriodSlot>,
    pub weeks: usize,
    pub sessions: usize,
    pub warnings: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PeriodSlot {
    pub index: u32,
    pub start: String,
    pub end: String,
}

// ---------------------------------------------------------------- primitives

fn md5_hex(text: &str) -> String {
    let mut hasher = Md5::new();
    hasher.update(text.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn to_base36(mut value: u64) -> String {
    const CHARS: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    if value == 0 {
        return "0".into();
    }
    let mut out = Vec::new();
    while value > 0 {
        out.push(CHARS[(value % 36) as usize]);
        value /= 36;
    }
    out.reverse();
    String::from_utf8(out).unwrap_or_default()
}

fn encode_param(raw: &str, key: &str) -> String {
    if raw.is_empty() || key.is_empty() {
        return raw.to_string();
    }

    let raw_chars: Vec<char> = raw.chars().collect();
    let key_chars: Vec<char> = key.chars().collect();
    let key_len = key_chars.len();
    let raw_len = raw_chars.len();
    let rounds = (raw_len + key_len - 1) / key_len;
    let offset = (((raw_len as f64 * 3.0 * 6.0 / 9.0 / 6.0).ceil() * 6.0) as usize) % key_len;

    let mut stream = String::new();
    'outer: for i in 0..rounds {
        for j in 1..=key_len {
            let idx = i * key_len + j;
            let sum = raw_chars[idx - 1] as u32 + key_chars[j - 1] as u32 + offset as u32;
            let chunk = format!("000{sum}");
            let chars: Vec<char> = chunk.chars().collect();
            let start = chars.len().saturating_sub(3);
            stream.extend(&chars[start..]);
            if idx == raw_len {
                break 'outer;
            }
        }
    }

    let chars: Vec<char> = stream.chars().collect();
    let mut out = String::new();
    let mut pos = 0;
    while pos < chars.len() {
        let end = (pos + 9).min(chars.len());
        let seg: String = chars[pos..end].iter().collect();
        pos = end;
        let value: u64 = seg.parse().unwrap_or(0);
        let padded = format!("000000{}", to_base36(value));
        let n = padded.chars().count();
        out.extend(padded.chars().skip(n - 6));
    }
    out
}

fn encode_param2(raw: &str) -> String {
    let digest = md5_hex(raw);
    let mut split: Vec<char> = Vec::with_capacity(33);
    split.push('\0');
    split.extend(digest.chars());

    let mut kept = String::new();
    for (index, ch) in split.iter().enumerate() {
        if matches!(index, 3 | 10 | 17 | 25) {
            continue;
        }
        if *ch != '\0' {
            kept.push(*ch);
        }
    }
    md5_hex(&kept)
}

fn js_escape(text: &str) -> String {
    let mut out = String::new();
    for ch in text.chars() {
        let code = ch as u32;
        if ch.is_ascii_alphanumeric() || "-_.!~*'()".contains(ch) {
            out.push(ch);
        } else if code <= 0x7F {
            out.push_str(&format!("%{code:02X}"));
        } else {
            out.push_str(&format!("%u{code:04X}"));
        }
    }
    out
}

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn percent_decode(input: &str) -> String {
    let bytes = input.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let (Some(high), Some(low)) = (hex_value(bytes[i + 1]), hex_value(bytes[i + 2])) {
                out.push(high * 16 + low);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).to_string()
}

fn decrypt_login_response(text: &str) -> Result<String, String> {
    let decoded = percent_decode(text);
    let raw = base64::engine::general_purpose::STANDARD
        .decode(decoded.trim())
        .map_err(|e| format!("登录响应解码失败: {e}"))?;
    let mut buffer = raw;
    let plain = Aes128CbcDec::new_from_slices(LOGIN_AES_KEY, LOGIN_AES_IV)
        .map_err(|e| e.to_string())?
        .decrypt_padded_mut::<Pkcs7>(&mut buffer)
        .map_err(|_| "登录响应解密失败".to_string())?;
    Ok(String::from_utf8_lossy(plain).to_string())
}

fn json_text(value: &Value) -> String {
    match value {
        Value::String(text) => text.clone(),
        Value::Null => String::new(),
        other => other.to_string(),
    }
}

// ------------------------------------------------------------------- gateway

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn now_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn signed_form(raw: &str, token: &str) -> Vec<(String, String)> {
    let stamp = now_seconds();
    let millis = now_millis().to_string();
    let echo_tail: String = millis.chars().skip(millis.len().saturating_sub(8)).collect();
    vec![
        ("param".into(), encode_param(raw, ENC_KEY)),
        ("param2".into(), encode_param2(raw)),
        ("timestamp".into(), stamp.to_string()),
        ("echo".into(), format!("echo{echo_tail}")),
        ("encrptSecretKey".into(), "x".repeat(64)),
        ("xqerSign".into(), md5_hex(raw)),
        ("token".into(), token.to_string()),
        ("appinfo".into(), APP_INFO.to_string()),
        ("appsjxh".into(), MODEL.to_string()),
    ]
}

fn http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(20))
        .user_agent("okhttp/3.12.0")
        .build()
        .map_err(|e| format!("初始化网络失败: {e}"))
}

async fn search_schools_raw(
    http: &reqwest::Client,
    keyword: &str,
    version: &str,
) -> Result<Vec<Value>, String> {
    let response = http
        .post(GATEWAY_URL)
        .form(&[
            ("action", "getAgent"),
            ("xxmc", keyword),
            ("appver", version),
        ])
        .send()
        .await
        .map_err(|e| format!("学校搜索失败: {e}"))?;
    let status = response.status();
    let text = response.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!("学校搜索失败: HTTP {status}"));
    }
    let value: Value =
        serde_json::from_str(&text).map_err(|_| "学校搜索返回异常".to_string())?;
    Ok(value.as_array().cloned().unwrap_or_default())
}

async fn login_raw(
    http: &reqwest::Client,
    school_code: &str,
    account: &str,
    password: &str,
    version: &str,
) -> Result<LoginState, String> {
    let raw = format!(
        "loginId={account}&xxdm={school_code}&pwd={}&pwdsfzm=1&action=getLoginInfoNew&zddl=1&isky=1&sjbz=&sswl=&sjxh={MODEL}&os={OS_NAME}&xtbb={OS_VERSION}&loginmode=0&appver={version}",
        js_escape(password)
    );
    let form = signed_form(&raw, "00000");

    let response = http
        .post(GATEWAY_URL)
        .form(&form)
        .send()
        .await
        .map_err(|e| format!("登录请求失败: {e}"))?;
    let text = response.text().await.map_err(|e| e.to_string())?;
    let trimmed = text.trim();

    if trimmed.starts_with('{') {
        let err: Value = serde_json::from_str(trimmed).unwrap_or(Value::Null);
        let message = err
            .get("message")
            .map(json_text)
            .filter(|m| !m.is_empty())
            .unwrap_or_else(|| "登录失败".into());
        return Err(format!("登录失败: {message}"));
    }

    let plain = decrypt_login_response(trimmed)?;
    let data: Value = serde_json::from_str(&plain).map_err(|_| {
        let preview: String = plain.chars().take(200).collect();
        format!("登录响应解析失败: {preview}")
    })?;

    if json_text(data.get("flag").unwrap_or(&Value::Null)) != "0" {
        let message = data
            .get("msg")
            .map(json_text)
            .filter(|m| !m.is_empty())
            .unwrap_or_else(|| "登录失败".into());
        return Err(format!("登录失败: {message}"));
    }

    let cache_md5 = data
        .get("cache")
        .and_then(|cache| cache.get("md5"))
        .map(json_text)
        .unwrap_or_default();
    let user_id = data
        .get("userid")
        .map(json_text)
        .filter(|v| !v.is_empty())
        .ok_or("登录响应缺少 userid")?;

    Ok(LoginState {
        school_name: data
            .get("xxmc")
            .map(json_text)
            .filter(|v| !v.is_empty())
            .unwrap_or_default(),
        school_code: data
            .get("xxdm")
            .map(json_text)
            .filter(|v| !v.is_empty())
            .unwrap_or_else(|| school_code.to_string()),
        user_id: user_id.clone(),
        user_type: data
            .get("usertype")
            .map(json_text)
            .filter(|v| !v.is_empty())
            .unwrap_or_default(),
        uuid: data
            .get("uuid")
            .map(json_text)
            .filter(|v| !v.is_empty())
            .unwrap_or(user_id),
        token: data.get("token").map(json_text).unwrap_or_default(),
        xm: data.get("xm").map(json_text).unwrap_or_default(),
        cache_md5,
        account: account.to_string(),
        password: password.to_string(),
    })
}

fn authed_raw(base: &[(&str, String)], state: &LoginState) -> String {
    let mut pairs: Vec<(String, String)> = base
        .iter()
        .map(|(key, value)| (key.to_string(), value.clone()))
        .collect();
    let keys: BTreeSet<String> = pairs.iter().map(|(key, _)| key.clone()).collect();

    pairs.push(("xqerxm".into(), js_escape(&state.xm)));
    if !keys.contains("uuid") {
        pairs.push(("uuid".into(), state.uuid.clone()));
    }
    pairs.push(("md5".into(), state.cache_md5.clone()));
    if !keys.contains("userId") {
        pairs.push(("userId".into(), state.user_id.clone()));
    }
    if !keys.contains("usertype") {
        pairs.push(("usertype".into(), state.user_type.clone()));
    }

    pairs
        .iter()
        .map(|(key, value)| format!("{key}={value}"))
        .collect::<Vec<_>>()
        .join("&")
}

async fn authed_get_json(
    http: &reqwest::Client,
    base: &[(&str, String)],
    state: &LoginState,
) -> Result<Value, String> {
    let raw = authed_raw(base, state);
    let form = signed_form(&raw, &state.token);

    let response = http
        .get(GATEWAY_URL)
        .query(&form)
        .send()
        .await
        .map_err(|e| format!("接口请求失败: {e}"))?;
    let text = response.text().await.map_err(|e| e.to_string())?;
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Err("接口返回空内容".into());
    }

    let data: Value = serde_json::from_str(trimmed).map_err(|_| {
        let preview: String = trimmed.chars().take(200).collect();
        format!("接口返回非 JSON: {preview}")
    })?;

    if let Some(code) = data.get("errcode") {
        if json_text(code) != "0" {
            let message = data
                .get("message")
                .map(json_text)
                .filter(|m| !m.is_empty())
                .unwrap_or_else(|| "未知错误".into());
            return Err(format!("接口错误: {message}"));
        }
    }
    Ok(data)
}

async fn fetch_terms_raw(
    http: &reqwest::Client,
    state: &LoginState,
) -> Result<Vec<Value>, String> {
    let data = authed_get_json(
        http,
        &[
            ("userId", state.user_id.clone()),
            ("usertype", state.user_type.clone()),
            ("action", "getXtgn".into()),
            ("step", "xnxq".into()),
        ],
        state,
    )
    .await?;

    data.get("xnxq")
        .and_then(|value| value.as_array())
        .cloned()
        .ok_or_else(|| "获取学期失败：响应缺少 xnxq".to_string())
}

async fn fetch_timetable_raw(
    http: &reqwest::Client,
    state: &LoginState,
    term_code: &str,
    week: &str,
) -> Result<Value, String> {
    authed_get_json(
        http,
        &[
            ("usertype", state.user_type.clone()),
            ("action", "getKb".into()),
            ("step", "kbdetail_bz".into()),
            ("bjdm", String::new()),
            ("jsdm", String::new()),
            ("xnxq", term_code.to_string()),
            ("week", week.to_string()),
            ("userId", state.user_id.clone()),
            ("channel", "jrkb".into()),
        ],
        state,
    )
    .await
}

async fn fetch_time_profile_raw(
    http: &reqwest::Client,
    state: &LoginState,
    action: &str,
    step: &str,
) -> Result<Vec<PeriodSlot>, String> {
    let data = authed_get_json(
        http,
        &[
            ("action", action.to_string()),
            ("step", step.to_string()),
            ("userId", state.user_id.clone()),
            ("usertype", state.user_type.clone()),
        ],
        state,
    )
    .await?;

    let raw = data.get("sksj").cloned().unwrap_or(Value::Null);
    let payload: Value = match raw {
        Value::String(text) => {
            let trimmed = text.trim().to_string();
            if trimmed.is_empty() {
                return Ok(vec![]);
            }
            serde_json::from_str(&trimmed).unwrap_or(Value::Null)
        }
        other => other,
    };

    let mut map: BTreeMap<u32, PeriodSlot> = BTreeMap::new();
    if let Some(items) = payload.as_array() {
        for item in items {
            let section = number_runs(&json_text(item.get("jieci").unwrap_or(&Value::Null)))
                .first()
                .and_then(|v| v.parse::<u32>().ok());
            let start = normalize_hhmm(&json_text(item.get("time").unwrap_or(&Value::Null)));
            let duration = json_text(item.get("shichang").unwrap_or(&Value::Null))
                .parse::<i64>()
                .unwrap_or(0);

            let (Some(section), Some(start)) = (section, start) else {
                continue;
            };
            if section == 0 || duration <= 0 {
                continue;
            }
            let end = add_minutes(&start, duration);
            if end.is_empty() {
                continue;
            }
            map.insert(
                section,
                PeriodSlot {
                    index: section,
                    start,
                    end,
                },
            );
        }
    }
    Ok(map.into_values().collect())
}

// -------------------------------------------------------------- text parsing

fn number_runs(text: &str) -> Vec<String> {
    let mut out = Vec::new();
    let mut current = String::new();
    for ch in text.chars() {
        if ch.is_ascii_digit() {
            current.push(ch);
        } else if !current.is_empty() {
            out.push(std::mem::take(&mut current));
        }
    }
    if !current.is_empty() {
        out.push(current);
    }
    out
}

fn normalize_hhmm(text: &str) -> Option<String> {
    let text = text.trim();
    let (hours, minutes) = text.split_once(':')?;
    let hours: u32 = hours.trim().parse().ok()?;
    let minutes: u32 = minutes.trim().parse().ok()?;
    if hours > 23 || minutes > 59 {
        return None;
    }
    Some(format!("{hours:02}:{minutes:02}"))
}

fn minutes_of(text: &str) -> Option<u32> {
    let (hours, minutes) = text.split_once(':')?;
    Some(hours.parse::<u32>().ok()? * 60 + minutes.parse::<u32>().ok()?)
}

fn add_minutes(start: &str, delta: i64) -> String {
    let Some(base) = minutes_of(start) else {
        return String::new();
    };
    let total = (base as i64 + delta.max(0)).min(23 * 60 + 59);
    format!("{:02}:{:02}", total / 60, total % 60)
}

fn clean_section_text(text: &str) -> String {
    let mut out = text
        .replace('，', ",")
        .replace('；', ",")
        .replace(';', ",")
        .replace('第', "")
        .replace('节', "")
        .replace(' ', "");
    for ch in ['~', '～', '—', '–', '－', '至'] {
        out = out.replace(ch, "-");
    }
    out
}

fn parse_section_numbers(text: &str) -> Vec<u32> {
    if text.trim().is_empty() {
        return vec![];
    }
    let cleaned = clean_section_text(text);
    let mut picked: BTreeSet<u32> = BTreeSet::new();

    for part in cleaned.split(',') {
        let part = part.trim();
        if part.is_empty() {
            continue;
        }
        let nums = number_runs(part);
        if nums.is_empty() {
            continue;
        }

        if part.contains('-') && nums.len() >= 2 {
            let mut start: u32 = nums[0].parse().unwrap_or(0);
            let mut end: u32 = nums[1].parse().unwrap_or(0);
            if start > end {
                std::mem::swap(&mut start, &mut end);
            }
            for value in start..=end {
                if value > 0 && value <= 30 {
                    picked.insert(value);
                }
            }
            continue;
        }

        for token in nums {
            // 节次代码常见 `0102`（两节一组）的写法。
            if token.len() > 2 && token.len() % 2 == 0 {
                let mut values = Vec::new();
                let mut valid = true;
                let bytes = token.as_bytes();
                let mut i = 0;
                while i < bytes.len() {
                    let chunk = &token[i..i + 2];
                    let value: u32 = chunk.parse().unwrap_or(0);
                    if value == 0 || value > 30 {
                        valid = false;
                        break;
                    }
                    values.push(value);
                    i += 2;
                }
                if valid && !values.is_empty() {
                    picked.extend(values);
                    continue;
                }
            }
            if let Ok(value) = token.parse::<u32>() {
                if value > 0 && value <= 30 {
                    picked.insert(value);
                }
            }
        }
    }
    picked.into_iter().collect()
}

fn parse_weeks_expr(text: &str) -> Vec<u32> {
    if text.trim().is_empty() {
        return vec![];
    }
    let mut cleaned = text
        .replace('周', "")
        .replace('第', "")
        .replace('，', ",")
        .replace('；', ",")
        .replace(';', ",")
        .replace(' ', "");
    for ch in ['~', '～', '—', '–', '－', '至'] {
        cleaned = cleaned.replace(ch, "-");
    }

    let mut weeks: BTreeSet<u32> = BTreeSet::new();
    for token in cleaned.split(',') {
        let token = token.trim();
        if token.is_empty() {
            continue;
        }
        let odd_only = token.contains('单');
        let even_only = token.contains('双');
        let token = token.replace('单', "").replace('双', "");
        let nums = number_runs(&token);
        if nums.is_empty() {
            continue;
        }

        let mut values: Vec<u32> = Vec::new();
        if token.contains('-') && nums.len() >= 2 {
            let mut start: u32 = nums[0].parse().unwrap_or(0);
            let mut end: u32 = nums[1].parse().unwrap_or(0);
            if start > end {
                std::mem::swap(&mut start, &mut end);
            }
            values.extend(start..=end);
        } else {
            values.extend(nums.iter().filter_map(|n| n.parse::<u32>().ok()));
        }

        for value in values {
            if value == 0 || value > 30 {
                continue;
            }
            if odd_only && value % 2 == 0 {
                continue;
            }
            if even_only && value % 2 == 1 {
                continue;
            }
            weeks.insert(value);
        }
    }
    weeks.into_iter().collect()
}

// -------------------------------------------------------------------- dates

fn days_from_civil(year: i64, month: i64, day: i64) -> i64 {
    let year = if month <= 2 { year - 1 } else { year };
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let month_prime = (month + 9) % 12;
    let day_of_year = (153 * month_prime + 2) / 5 + day - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

fn civil_from_days(days: i64) -> (i64, i64, i64) {
    let z = days + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let day_of_era = z - era * 146_097;
    let year_of_era =
        (day_of_era - day_of_era / 1460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let year = year_of_era + era * 400;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let month_prime = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * month_prime + 2) / 5 + 1;
    let month = if month_prime < 10 {
        month_prime + 3
    } else {
        month_prime - 9
    };
    (if month <= 2 { year + 1 } else { year }, month, day)
}

fn parse_date(text: &str) -> Option<i64> {
    let parts: Vec<&str> = text.trim().split('-').collect();
    if parts.len() != 3 {
        return None;
    }
    let year: i64 = parts[0].parse().ok()?;
    let month: i64 = parts[1].parse().ok()?;
    let day: i64 = parts[2].parse().ok()?;
    if !(1..=12).contains(&month) || !(1..=31).contains(&day) {
        return None;
    }
    Some(days_from_civil(year, month, day))
}

fn iso_date(days: i64) -> String {
    let (year, month, day) = civil_from_days(days);
    format!("{year:04}-{month:02}-{day:02}")
}

fn monday_of(days: i64) -> i64 {
    // 1970-01-01 was a Thursday; Monday-based index = (days + 3) % 7.
    days - (days + 3).rem_euclid(7)
}

fn today_days() -> i64 {
    let millis = now_millis() as i64;
    days_from_civil(1970, 1, 1) + millis.div_euclid(86_400_000)
}

// ------------------------------------------------------------- app version

fn extract_version(html: &str) -> Option<String> {
    const PATTERNS: &[&str] = &[
        r#"(?:Version|版本)\s*([0-9]+(?:\.[0-9]+)+)"#,
        r#"itunes:version[^>]*>\s*([0-9]+(?:\.[0-9]+)+)\s*<"#,
        r#""softwareVersion"\s*:\s*"([0-9]+(?:\.[0-9]+)+)""#,
    ];
    for pattern in PATTERNS {
        let Ok(re) = Regex::new(pattern) else {
            continue;
        };
        if let Some(captures) = re.captures(html) {
            if let Some(value) = captures.get(1) {
                let version = value.as_str().trim();
                if version.matches('.').count() >= 1 {
                    return Some(version.to_string());
                }
            }
        }
    }
    None
}

async fn scrape_app_version(http: &reqwest::Client) -> Option<String> {
    let response = http
        .get(APP_STORE_URL)
        .header(
            reqwest::header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 \
             (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        )
        .header(reqwest::header::ACCEPT_LANGUAGE, "zh-CN,zh;q=0.9,en;q=0.8")
        .send()
        .await
        .ok()?;
    let html = response.text().await.ok()?;
    extract_version(&html)
}

async fn lookup_app_version(http: &reqwest::Client) -> Option<String> {
    let value: Value = http.get(APP_LOOKUP_URL).send().await.ok()?.json().await.ok()?;
    value
        .get("results")
        .and_then(|results| results.get(0))
        .and_then(|item| item.get("version"))
        .and_then(Value::as_str)
        .map(|version| version.to_string())
}

async fn resolve_app_version(state: &XiqueerState, http: &reqwest::Client) -> String {
    if let Some(cached) = state.version.lock().ok().and_then(|guard| guard.clone()) {
        return cached;
    }

    let version = match scrape_app_version(http).await {
        Some(version) => version,
        None => lookup_app_version(http).await.unwrap_or_else(|| FALLBACK_APP_VERSION.into()),
    };

    if let Ok(mut guard) = state.version.lock() {
        *guard = Some(version.clone());
    }
    version
}

// ---------------------------------------------------------- schedule builder

struct RawCourse {
    weekday: u32,
    course: String,
    teacher: String,
    location: String,
    weeks: Vec<u32>,
    start: u32,
    end: u32,
}

/// `dsz` is the single/double-week flag: `1` = odd weeks only, `2` = even
/// weeks only, anything else means every week in `skzs`.
fn filter_parity(weeks: Vec<u32>, code: &str) -> Vec<u32> {
    match code.trim() {
        "1" => weeks.into_iter().filter(|week| week % 2 == 1).collect(),
        "2" => weeks.into_iter().filter(|week| week % 2 == 0).collect(),
        _ => weeks,
    }
}

/// Read one day list out of a timetable payload.
///
/// The gateway answers `week=<n>` with **only** the lessons that happen that
/// week, so `Some(week)` takes the payload at its word and ignores `skzs`
/// (which is still the full term range and must not be expanded — doing so
/// re-inserted odd-week courses into even weeks).
///
/// `None` means the whole-term overview (`week=""`), where `skzs` + `dsz` are
/// the only way to place a lesson.
fn collect_courses(payload: &Value, week: Option<u32>, out: &mut Vec<RawCourse>) {
    for day in 1..=7u32 {
        let Some(lessons) = payload.get(format!("week{day}")).and_then(Value::as_array) else {
            continue;
        };
        for item in lessons {
            let course = json_text(item.get("kcmc").unwrap_or(&Value::Null));
            if course.trim().is_empty() {
                continue;
            }
            let teacher = json_text(item.get("rkjs").unwrap_or(&Value::Null));
            let location = json_text(item.get("skdd").unwrap_or(&Value::Null));

            let mut sections = parse_section_numbers(&json_text(
                item.get("jcdm").unwrap_or(&Value::Null),
            ));
            if sections.is_empty() || sections.iter().any(|value| *value > 20) {
                sections = parse_section_numbers(&json_text(
                    item.get("jcxx").unwrap_or(&Value::Null),
                ));
            }
            if sections.is_empty() {
                continue;
            }
            let start = *sections.iter().min().unwrap_or(&1);
            let end = *sections.iter().max().unwrap_or(&start);

            let weeks = match week {
                Some(current) => vec![current],
                None => {
                    let weeks =
                        parse_weeks_expr(&json_text(item.get("skzs").unwrap_or(&Value::Null)));
                    let weeks = filter_parity(
                        weeks,
                        &json_text(item.get("dsz").unwrap_or(&Value::Null)),
                    );
                    if weeks.is_empty() {
                        continue;
                    }
                    weeks
                }
            };

            out.push(RawCourse {
                weekday: day,
                course: course.trim().to_string(),
                teacher: teacher.trim().to_string(),
                location: location.trim().to_string(),
                weeks,
                start,
                end,
            });
        }
    }
}

fn build_schedule(
    courses: &[RawCourse],
    term_name: &str,
    school_name: &str,
    account: &str,
    first_monday: i64,
    max_week: u32,
) -> Value {
    let mut by_week: BTreeMap<u32, BTreeMap<u32, Vec<Value>>> = BTreeMap::new();
    let mut flat: Vec<Value> = Vec::new();
    let mut seen: BTreeSet<(u32, u32, String, String, String, u32, u32)> = BTreeSet::new();

    for course in courses {
        for week in &course.weeks {
            if *week == 0 || *week > max_week {
                continue;
            }
            let key = (
                *week,
                course.weekday,
                course.course.clone(),
                course.teacher.clone(),
                course.location.clone(),
                course.start,
                course.end,
            );
            if !seen.insert(key) {
                continue;
            }

            let label = if course.start == course.end {
                format!("第{}节", course.start)
            } else {
                format!("第{}-{}节", course.start, course.end)
            };

            let mut session = json!({
                "periods": { "start": course.start, "end": course.end },
                "periodLabel": label,
                "course": course.course,
                "courseShort": course.course,
                "location": course.location,
            });
            if !course.teacher.is_empty() {
                session["teacher"] = json!(course.teacher);
            }

            by_week
                .entry(*week)
                .or_default()
                .entry(course.weekday)
                .or_default()
                .push(session.clone());

            let date = iso_date(first_monday + ((*week - 1) * 7 + (course.weekday - 1)) as i64);
            flat.push(json!({
                "week": week,
                "date": date,
                "weekday": WEEKDAY_NAMES[(course.weekday - 1) as usize],
                "periods": label,
                "course": course.course,
                "location": course.location,
            }));
        }
    }

    let mut weeks_json = Vec::new();
    for week in 1..=max_week {
        let start = first_monday + ((week - 1) * 7) as i64;
        let end = start + 6;
        let mut days = Vec::new();
        for (index, name) in WEEKDAY_NAMES.iter().enumerate() {
            let date = iso_date(start + index as i64);
            let day = by_week
                .get(&week)
                .and_then(|map| map.get(&(index as u32 + 1)))
                .cloned()
                .unwrap_or_default();
            days.push(json!({
                "weekday": name,
                "date": date,
                "dayOfMonth": day_of_month_label(start + index as i64),
                "sessions": day,
            }));
        }
        weeks_json.push(json!({
            "week": week,
            "startDate": iso_date(start),
            "endDate": iso_date(end),
            "days": days,
        }));
    }

    // Courses summary for the widget's colour list.
    let mut summary: BTreeMap<String, (BTreeSet<String>, usize)> = BTreeMap::new();
    for course in courses {
        let entry = summary.entry(course.course.clone()).or_default();
        if !course.location.is_empty() {
            entry.0.insert(course.location.clone());
        }
        entry.1 += course.weeks.len();
    }
    let courses_json: Vec<Value> = summary
        .into_iter()
        .map(|(name, (locations, count))| {
            json!({
                "name": name,
                "shortName": name,
                "sessionCount": count,
                "locations": locations.into_iter().collect::<Vec<_>>(),
            })
        })
        .collect();

    json!({
        "meta": {
            "semester": term_name,
            "source": "喜鹊儿",
            "school": school_name,
            "account": account,
            "firstMonday": iso_date(first_monday),
        },
        "courses": courses_json,
        "weeks": weeks_json,
        "sessions": flat,
    })
}

fn day_of_month_label(days: i64) -> String {
    let (_, month, day) = civil_from_days(days);
    format!("{month}月{day}日")
}

fn derive_first_monday(payload: &Value) -> Option<i64> {
    let qssj = json_text(payload.get("qssj").unwrap_or(&Value::Null));
    let zc = json_text(payload.get("zc").unwrap_or(&Value::Null));
    let current = parse_date(&qssj)?;
    let week_number = number_runs(&zc).first()?.parse::<i64>().ok()?;
    if week_number <= 0 {
        return None;
    }
    Some(monday_of(current) - (week_number - 1) * 7)
}

// ------------------------------------------------------------------ commands

fn cached_session(state: &XiqueerState) -> Result<LoginState, String> {
    state
        .session
        .lock()
        .map_err(|_| "登录状态不可用".to_string())?
        .clone()
        .ok_or_else(|| "请先登录喜鹊儿".to_string())
}

fn store_session(state: &XiqueerState, session: LoginState) {
    if let Ok(mut guard) = state.session.lock() {
        *guard = Some(session);
    }
}

#[tauri::command]
pub async fn xiqueer_app_version(state: tauri::State<'_, XiqueerState>) -> Result<String, String> {
    let http = http_client()?;
    Ok(resolve_app_version(&state, &http).await)
}

#[tauri::command]
pub async fn xiqueer_search_schools(keyword: String) -> Result<Vec<SchoolInfo>, String> {
    let keyword = keyword.trim().to_string();
    if keyword.is_empty() {
        return Ok(vec![]);
    }

    let http = http_client()?;
    // The search endpoint itself does not need a signature; a stable version is enough.
    let schools = search_schools_raw(&http, &keyword, FALLBACK_APP_VERSION).await?;
    let needle = keyword.to_lowercase();

    let mut matched: Vec<(u8, usize, String, SchoolInfo)> = schools
        .iter()
        .filter_map(|item| {
            let name = json_text(item.get("xxmc").unwrap_or(&Value::Null));
            let code = json_text(item.get("xxdm").unwrap_or(&Value::Null));
            if name.is_empty() || code.is_empty() {
                return None;
            }
            let lower = name.to_lowercase();
            if !lower.contains(&needle) {
                return None;
            }
            let rank = if lower == needle {
                0
            } else if lower.starts_with(&needle) {
                1
            } else {
                2
            };
            Some((rank, name.chars().count(), lower, SchoolInfo { name, code }))
        })
        .collect();

    matched.sort_by(|a, b| (a.0, a.1, &a.2).cmp(&(b.0, b.1, &b.2)));
    Ok(matched.into_iter().take(20).map(|item| item.3).collect())
}

#[tauri::command]
pub async fn xiqueer_login(
    state: tauri::State<'_, XiqueerState>,
    school_code: String,
    school_name: String,
    account: String,
    password: String,
) -> Result<LoginResult, String> {
    let account = account.trim().to_string();
    if school_code.trim().is_empty() {
        return Err("请先选择学校".into());
    }
    if account.is_empty() {
        return Err("请填写账号".into());
    }
    if password.is_empty() {
        return Err("请填写密码".into());
    }

    let http = http_client()?;
    let version = resolve_app_version(&state, &http).await;

    let mut session = login_raw(
        &http,
        school_code.trim(),
        &account,
        &password,
        &version,
    )
    .await?;
    if session.school_name.is_empty() {
        session.school_name = school_name;
    }

    let terms = fetch_terms_raw(&http, &session).await?;
    let terms: Vec<TermInfo> = terms
        .iter()
        .filter_map(|item| {
            let code = json_text(item.get("dm").unwrap_or(&Value::Null));
            if code.is_empty() {
                return None;
            }
            Some(TermInfo {
                code,
                name: json_text(item.get("mc").unwrap_or(&Value::Null)),
                current: json_text(item.get("dqxq").unwrap_or(&Value::Null)) == "1",
            })
        })
        .collect();

    let result = LoginResult {
        school_name: session.school_name.clone(),
        user_name: session.xm.clone(),
        terms,
    };
    store_session(&state, session);
    Ok(result)
}

#[tauri::command]
pub async fn xiqueer_import(
    app: AppHandle,
    state: tauri::State<'_, XiqueerState>,
    term_code: String,
    term_name: String,
    first_monday: Option<String>,
) -> Result<ImportResult, String> {
    if term_code.trim().is_empty() {
        return Err("请选择学期".into());
    }

    let http = http_client()?;
    let mut session = cached_session(&state)?;
    let version = resolve_app_version(&state, &http).await;

    let collected = collect_term(&http, &session, &term_code).await;
    let collected = match collected {
        Ok(value) => value,
        Err(err) if err.contains("其它设备上登录") => {
            // The app logs out older sessions; re-login with the stored password once.
            session = login_raw(
                &http,
                &session.school_code,
                &session.account,
                &session.password,
                &version,
            )
            .await?;
            store_session(&state, session.clone());
            collect_term(&http, &session, &term_code).await?
        }
        Err(err) => return Err(err),
    };

    let (courses, max_week, derived_monday, mut warnings) = collected;

    let first_monday = match first_monday.as_deref().and_then(parse_date) {
        Some(days) => days,
        None => match derived_monday {
            Some(days) => days,
            None => {
                warnings.push("接口没有返回学期起始日期，已按本周作为第 1 周。".into());
                monday_of(today_days())
            }
        },
    };

    if courses.is_empty() {
        return Err("该学期没有可导入的课程".into());
    }

    let schedule = build_schedule(
        &courses,
        if term_name.trim().is_empty() {
            &term_code
        } else {
            term_name.trim()
        },
        &session.school_name,
        &session.account,
        first_monday,
        max_week,
    );

    let text = serde_json::to_string(&schedule).map_err(|e| e.to_string())?;
    let value = crate::schedule::validate(&text)?;
    crate::storage::store_schedule(&app, &value)?;

    use tauri::Emitter;
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.emit("schedule-changed", &value);
    }
    if let Some(window) = app.get_webview_window("widget") {
        let _ = window.emit("schedule-changed", &value);
    }

    let (periods, period_warning) = collect_periods(&http, &session).await;
    if let Some(warning) = period_warning {
        warnings.push(warning);
    }

    let weeks = value["weeks"].as_array().map(|list| list.len()).unwrap_or(0);
    let sessions = value["sessions"].as_array().map(|list| list.len()).unwrap_or(0);

    Ok(ImportResult {
        schedule: value,
        periods,
        weeks,
        sessions,
        warnings,
    })
}

async fn collect_periods(
    http: &reqwest::Client,
    session: &LoginState,
) -> (Vec<PeriodSlot>, Option<String>) {
    let mut merged: BTreeMap<u32, PeriodSlot> = BTreeMap::new();

    if let Ok(list) = fetch_time_profile_raw(http, session, "jwsj", "gettime").await {
        for slot in list {
            merged.insert(slot.index, slot);
        }
    }
    if let Ok(list) = fetch_time_profile_raw(http, session, "sksj", "obtainSksj").await {
        for slot in list {
            merged.insert(slot.index, slot);
        }
    }

    let periods: Vec<PeriodSlot> = merged.into_values().collect();
    if periods.is_empty() {
        (
            periods,
            Some("未读取到学校作息时间，已沿用当前的节次时间设置。".into()),
        )
    } else {
        (periods, None)
    }
}

async fn collect_term(
    http: &reqwest::Client,
    session: &LoginState,
    term_code: &str,
) -> Result<(Vec<RawCourse>, u32, Option<i64>, Vec<String>), String> {
    let first = fetch_timetable_raw(http, session, term_code, "").await?;
    let mut warnings = Vec::new();

    let max_week = json_text(first.get("maxzc").unwrap_or(&Value::Null))
        .parse::<u32>()
        .ok()
        .filter(|value| *value > 0)
        .map(|value| value.min(30))
        .unwrap_or(20);

    let derived_monday = derive_first_monday(&first);
    if derived_monday.is_none() {
        warnings.push("接口没有返回学期起始日期（qssj/zc）。".into());
    }

    let mut courses: Vec<RawCourse> = Vec::new();

    for week in 1..=max_week {
        let payload = match fetch_timetable_raw(http, session, term_code, &week.to_string()).await {
            Ok(value) => value,
            Err(err) if err.contains("其它设备上登录") => return Err(err),
            Err(err) => {
                warnings.push(format!("第 {week} 周拉取失败：{err}"));
                continue;
            }
        };
        collect_courses(&payload, Some(week), &mut courses);
    }

    // Per-week requests answer "what actually happens that week", which is the
    // only trustworthy source. The overview is just a fallback for a gateway
    // that ignores `week`.
    if courses.is_empty() {
        collect_courses(&first, None, &mut courses);
        if !courses.is_empty() {
            warnings.push("逐周课表为空，已改用整学期总览（单双周可能不准）。".into());
        }
    }

    Ok((courses, max_week, derived_monday, warnings))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lesson(name: &str, jcxx: &str, skzs: &str, dsz: &str) -> Value {
        json!({
            "kcmc": name,
            "jcxx": jcxx,
            "jcdm": "",
            "skzs": skzs,
            "dsz": dsz,
            "skdd": "教室",
            "rkjs": "老师",
        })
    }

    /// A per-week payload lists exactly the lessons that happen that week, so
    /// `skzs` (still the whole term range) must not be expanded again — that
    /// used to re-insert odd-week courses into even weeks.
    #[test]
    fn per_week_payload_is_taken_at_face_value() {
        let payload = json!({
            "week4": [
                lesson("安全与健康教育", "1-2", "11-12周", "0"),
                lesson("电路分析基础", "7-8", "11-16周", "0"),
            ]
        });

        let mut out = Vec::new();
        collect_courses(&payload, Some(12), &mut out);

        assert_eq!(out.len(), 2);
        assert_eq!(out[0].weeks, vec![12]);
        assert_eq!(out[1].weeks, vec![12]);
        assert_eq!(out[1].start, 7);
        assert_eq!(out[1].end, 8);
    }

    /// The term overview is the only payload where `skzs` + `dsz` matter.
    #[test]
    fn overview_honours_single_and_double_week_flags() {
        let payload = json!({
            "week4": [
                lesson("安全与健康教育", "1-2", "11-12周", "0"),
                lesson("高等数学(一)", "3-4", "10-19周", "1"),
                lesson("模拟电子技术基础", "5-6", "11-17周", "1"),
                lesson("电路分析基础", "7-8", "11-16周", "0"),
            ]
        });

        let mut out = Vec::new();
        collect_courses(&payload, None, &mut out);

        assert_eq!(out.len(), 4);
        assert_eq!(out[0].weeks, vec![11, 12]);
        assert_eq!(out[1].weeks, vec![11, 13, 15, 17, 19]);
        assert_eq!(out[2].weeks, vec![11, 13, 15, 17]);
        assert_eq!(out[3].weeks, vec![11, 12, 13, 14, 15, 16]);
    }

    #[test]
    fn even_week_flag_keeps_only_even_weeks() {
        assert_eq!(filter_parity(vec![1, 2, 3, 4], "2"), vec![2, 4]);
        assert_eq!(filter_parity(vec![1, 2, 3, 4], "1"), vec![1, 3]);
        assert_eq!(filter_parity(vec![1, 2, 3, 4], "0"), vec![1, 2, 3, 4]);
        assert_eq!(filter_parity(vec![1, 2, 3, 4], ""), vec![1, 2, 3, 4]);
    }
}

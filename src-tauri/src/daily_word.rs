use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;
use serde_json::Value;

const ENDPOINT: &str = "https://www.iamwawa.cn/home/shici/ajax";
const CACHE_TTL: Duration = Duration::from_secs(30);

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DailyWord {
    /// The line itself, e.g. `积雨空林烟火迟，蒸藜炊黍饷东菑。`
    pub content: String,
    pub title: String,
    pub author: String,
}

#[derive(Default)]
pub struct DailyWordState {
    /// The last line plus when it was fetched, so a re-render does not
    /// immediately replace what the user is reading.
    cache: Mutex<Option<(Instant, DailyWord)>>,
}

impl DailyWordState {
    fn cached(&self) -> Option<DailyWord> {
        let guard = self.cache.lock().ok()?;
        let (at, word) = guard.as_ref()?;
        (at.elapsed() < CACHE_TTL).then(|| word.clone())
    }

    fn store(&self, word: DailyWord) {
        if let Ok(mut guard) = self.cache.lock() {
            *guard = Some((Instant::now(), word));
        }
    }
}

async fn fetch() -> Result<DailyWord, String> {
    let http = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) ClassScheduleWidget/0.1")
        .build()
        .map_err(|error| format!("初始化网络失败: {error}"))?;

    let body = http
        .get(ENDPOINT)
        .header(reqwest::header::REFERER, "https://www.iamwawa.cn/shici/")
        .header("X-Requested-With", "XMLHttpRequest")
        .send()
        .await
        .map_err(|error| format!("一言请求失败: {error}"))?
        .text()
        .await
        .map_err(|error| format!("一言读取失败: {error}"))?;

    parse(&body)
}

fn parse(body: &str) -> Result<DailyWord, String> {
    let root: Value = serde_json::from_str(body).map_err(|error| format!("一言解析失败: {error}"))?;
    let data = root
        .get("data")
        .ok_or_else(|| "一言数据为空".to_string())?;

    let text_of = |key: &str| -> String {
        data.get(key)
            .and_then(Value::as_str)
            .map(str::trim)
            .unwrap_or("")
            .to_string()
    };

    let content = text_of("content");
    if content.is_empty() {
        return Err("一言内容为空".to_string());
    }

    Ok(DailyWord {
        content,
        title: text_of("title"),
        author: text_of("author"),
    })
}

#[tauri::command]
pub async fn get_daily_word(
    state: tauri::State<'_, DailyWordState>,
    force: Option<bool>,
) -> Result<DailyWord, String> {
    if force != Some(true) {
        if let Some(word) = state.cached() {
            return Ok(word);
        }
    }

    let word = fetch().await?;
    state.store(word.clone());
    Ok(word)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_payload() {
        let body = r#"{"status":1,"info":"查询成功！","data":{"content":"积雨空林烟火迟，蒸藜炊黍饷东菑。","title":"积雨辋川庄作","author":"王维","explain":"连日雨后…"}}"#;
        let word = parse(body).unwrap();
        assert_eq!(word.content, "积雨空林烟火迟，蒸藜炊黍饷东菑。");
        assert_eq!(word.title, "积雨辋川庄作");
        assert_eq!(word.author, "王维");
    }

    #[test]
    fn rejects_empty_content() {
        let body = r#"{"status":1,"data":{"content":"   ","title":"x","author":"y"}}"#;
        assert!(parse(body).is_err());
    }
}

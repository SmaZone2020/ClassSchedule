use serde::Serialize;
use serde_json::{json, Value};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationReport {
    pub valid: bool,
    pub error: Option<String>,
    pub meta: Option<Value>,
    pub weeks: usize,
    pub sessions: usize,
    pub warnings: Vec<String>,
}

pub fn validate(text: &str) -> Result<Value, String> {
    let value: Value = serde_json::from_str(text).map_err(|e| format!("JSON 解析失败: {e}"))?;
    let Some(obj) = value.as_object() else {
        return Err("根节点必须是对象".into());
    };

    let weeks = obj
        .get("weeks")
        .and_then(Value::as_array)
        .ok_or("缺少 weeks 数组")?;
    if weeks.is_empty() {
        return Err("weeks 不能为空".into());
    }

    for week in weeks {
        let week_obj = week.as_object().ok_or("weeks 元素必须是对象")?;
        week_obj
            .get("week")
            .and_then(Value::as_i64)
            .ok_or("week.week 缺失")?;
        week_obj
            .get("startDate")
            .and_then(Value::as_str)
            .ok_or("week.startDate 缺失")?;
        let days = week_obj
            .get("days")
            .and_then(Value::as_array)
            .ok_or("week.days 缺失")?;
        for day in days {
            let day_obj = day.as_object().ok_or("days 元素必须是对象")?;
            day_obj
                .get("date")
                .and_then(Value::as_str)
                .ok_or("day.date 缺失")?;
            day_obj
                .get("weekday")
                .and_then(Value::as_str)
                .ok_or("day.weekday 缺失")?;
            day_obj
                .get("sessions")
                .and_then(Value::as_array)
                .ok_or("day.sessions 缺失")?;
        }
    }

    Ok(value)
}

pub fn build_report(text: &str) -> ValidationReport {
    match validate(text) {
        Ok(value) => {
            let weeks = value["weeks"].as_array().map(|w| w.len()).unwrap_or(0);
            let sessions = value["sessions"].as_array().map(|s| s.len()).unwrap_or(0);
            ValidationReport {
                valid: true,
                error: None,
                meta: value.get("meta").cloned(),
                weeks,
                sessions,
                warnings: check_warnings(&value),
            }
        }
        Err(err) => ValidationReport {
            valid: false,
            error: Some(err),
            meta: None,
            weeks: 0,
            sessions: 0,
            warnings: vec![],
        },
    }
}

fn check_warnings(value: &Value) -> Vec<String> {
    let mut warnings = vec![];
    let sessions = value["sessions"].as_array();
    if sessions.map(|s| s.is_empty()).unwrap_or(true) {
        warnings.push("sessions 为空，课表将没有课程可显示".into());
    }
    if value
        .get("courses")
        .map(|c| c.as_array().map(|a| a.is_empty()).unwrap_or(true))
        .unwrap_or(false)
    {
        warnings.push("courses 为空，课程卡可能缺少配色依据".into());
    }
    warnings
}

pub fn template() -> Value {
    json!({
        "meta": {
            "semester": "2026-2027学年第一学期",
            "source": "模板",
            "periodRule": "每天最多 8 节，课程按节次区间填写",
            "note": "这是模板文件：把示例数据替换成你自己的课表后导入"
        },
        "courses": [
            {
                "name": "高等数学",
                "shortName": "高数",
                "sessionCount": 16,
                "locations": ["示例校区 教学楼A 301"]
            }
        ],
        "weeks": [
            {
                "week": 1,
                "startDate": "2026-09-07",
                "endDate": "2026-09-11",
                "days": [
                    {
                        "weekday": "周一",
                        "date": "2026-09-07",
                        "dayOfMonth": "9月7日",
                        "sessions": [
                            {
                                "periods": { "start": 1, "end": 2 },
                                "periodLabel": "第1-2节",
                                "course": "高等数学",
                                "courseShort": "高数",
                                "location": "示例校区 教学楼A 301"
                            }
                        ]
                    },
                    { "weekday": "周二", "date": "2026-09-08", "dayOfMonth": "9月8日", "sessions": [] },
                    { "weekday": "周三", "date": "2026-09-09", "dayOfMonth": "9月9日", "sessions": [] },
                    { "weekday": "周四", "date": "2026-09-10", "dayOfMonth": "9月10日", "sessions": [] },
                    { "weekday": "周五", "date": "2026-09-11", "dayOfMonth": "9月11日", "sessions": [] }
                ]
            }
        ],
        "sessions": [
            {
                "week": 1,
                "date": "2026-09-07",
                "weekday": "周一",
                "periods": "第1-2节",
                "course": "高等数学",
                "location": "示例校区 教学楼A 301"
            }
        ]
    })
}

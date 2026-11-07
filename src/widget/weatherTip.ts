import type { WeatherInfo, WeatherKind } from "./weatherInfo";

type Band = "freezing" | "cold" | "cool" | "mild" | "warm" | "hot";
type Family = "dry" | "wet" | "snow" | "fog" | "haze";

/**
 * Short "宜-xxx" tags per weather family and temperature band. Wet days never
 * suggest running; freezing days never suggest cycling. The tag re-rolls every
 * hour so the card does not repeat itself all day.
 */
const TAGS: Record<Family, Record<Band, string[]>> = {
  dry: {
    freezing: [
      "宜宅家取暖", "宜泡杯热茶", "宜裹紧再出门", "宜戴好手套", "宜室内活动",
      "宜喝碗热汤", "宜早点回宿舍", "宜搓搓手", "宜围巾安排上", "宜别出门"
    ],
    cold: [
      "宜添衣", "宜晒晒太阳", "宜喝点热的", "宜早点回宿舍", "宜室内运动",
      "宜戴围巾", "宜捂手", "宜晒被子", "宜泡脚", "宜慢慢走"
    ],
    cool: [
      "宜穿件外套", "宜散步", "宜慢跑", "宜晒被子", "宜午后出门", "宜骑车",
      "宜开窗透气", "宜约球", "宜逛逛校园", "宜看场电影"
    ],
    mild: [
      "宜散步", "宜骑行", "宜运动", "宜晒被子", "宜去操场转转", "宜开窗通风",
      "宜拍照", "宜野餐", "宜慢跑", "宜出门走走", "宜发会儿呆", "宜约饭"
    ],
    warm: [
      "宜傍晚出门", "宜防晒", "宜补水", "宜树荫下散步", "宜洗晒", "宜清晨跑步",
      "宜躲太阳", "宜吃点凉的", "宜通风"
    ],
    hot: [
      "宜宅家避暑", "宜多喝水", "宜避开正午", "宜吃清淡", "宜午睡", "宜吹空调",
      "宜吃西瓜", "宜傍晚散步", "宜少出门"
    ]
  },
  wet: {
    freezing: [
      "宜宅家", "宜穿防滑鞋", "宜带伞", "宜早点回去", "宜喝碗热汤",
      "宜烘干袜子", "宜别出门", "宜暖手"
    ],
    cold: [
      "宜带伞", "宜添衣", "宜宅家", "宜慢行", "宜穿防水鞋", "宜喝点热的",
      "宜早点回宿舍", "宜烘干鞋子", "宜别骑车"
    ],
    cool: [
      "宜带伞", "宜宅家看书", "宜慢行", "宜穿防水鞋", "宜喝杯热的",
      "宜听雨", "宜早睡觉", "宜别骑车", "宜躲屋檐"
    ],
    mild: [
      "宜带伞", "宜听雨", "宜室内活动", "宜喝杯热的", "宜等雨停",
      "宜睡觉", "宜看剧", "宜宅家", "宜慢慢走", "宜别骑车"
    ],
    warm: [
      "宜带伞", "宜室内运动", "宜等雨停", "宜多喝水", "宜宅家", "宜听雨",
      "宜开除湿", "宜别出门"
    ],
    hot: [
      "宜带伞", "宜宅家", "宜补水", "宜避开正午", "宜室内吹空调", "宜等雨停",
      "宜防雷电", "宜别出门"
    ]
  },
  snow: {
    freezing: [
      "宜宅家取暖", "宜穿防滑鞋", "宜戴手套", "宜慢行", "宜别出门", "宜喝热汤",
      "宜堆雪人", "宜看雪景"
    ],
    cold: [
      "宜赏雪", "宜穿防滑鞋", "宜添衣", "宜慢行", "宜戴围巾", "宜堆雪人",
      "宜拍照", "宜喝点热的", "宜别骑车"
    ],
    cool: [
      "宜赏雪", "宜戴手套", "宜穿防滑鞋", "宜喝点热的", "宜拍照", "宜慢行",
      "宜堆雪人"
    ],
    mild: [
      "宜赏雪", "宜拍照", "宜添衣", "宜慢行", "宜穿防滑鞋", "宜堆雪人"
    ],
    warm: ["宜赏雪", "宜穿防滑鞋", "宜避开积水", "宜拍照", "宜慢行"],
    hot: ["宜宅家", "宜穿防滑鞋", "宜慢行", "宜看雪景"]
  },
  fog: {
    freezing: [
      "宜宅家", "宜慢行", "宜穿暖些", "宜远离车道", "宜等雾散", "宜别出门"
    ],
    cold: [
      "宜慢行", "宜戴口罩", "宜开灯", "宜等雾散", "宜宅家", "宜别骑车",
      "宜注意路况"
    ],
    cool: [
      "宜慢行", "宜戴口罩", "宜开灯", "宜等雾散", "宜宅家看书", "宜别骑车"
    ],
    mild: [
      "宜慢行", "宜戴口罩", "宜宅家看书", "宜等雾散", "宜开灯", "宜别骑车"
    ],
    warm: [
      "宜慢行", "宜戴口罩", "宜别骑车", "宜室内活动", "宜等雾散"
    ],
    hot: ["宜宅家", "宜戴口罩", "宜等雾散", "宜慢行", "宜别出门"]
  },
  haze: {
    freezing: [
      "宜戴口罩", "宜宅家", "宜关窗", "宜减少外出", "宜室内运动", "宜开净化器"
    ],
    cold: [
      "宜戴口罩", "宜关窗", "宜减少外出", "宜室内运动", "宜开净化器", "宜多喝水"
    ],
    cool: [
      "宜戴口罩", "宜关窗", "宜室内运动", "宜多喝水", "宜开净化器", "宜别跑步"
    ],
    mild: [
      "宜戴口罩", "宜关窗", "宜室内活动", "宜减少外出", "宜多喝水", "宜别跑步"
    ],
    warm: [
      "宜戴口罩", "宜关窗", "宜室内运动", "宜多喝水", "宜别跑步"
    ],
    hot: [
      "宜戴口罩", "宜宅家", "宜多喝水", "宜关窗", "宜室内运动"
    ]
  }
};

function bandOf(temperature: number): Band {
  if (temperature < 0) return "freezing";
  if (temperature < 8) return "cold";
  if (temperature < 16) return "cool";
  if (temperature < 24) return "mild";
  if (temperature < 30) return "warm";
  return "hot";
}

function familyOf(kind: WeatherKind): Family {
  if (kind === "drizzle" || kind === "rain" || kind === "heavyRain" || kind === "thunder") {
    return "wet";
  }
  if (kind === "snow" || kind === "heavySnow" || kind === "sleet") return "snow";
  if (kind === "fog") return "fog";
  if (kind === "haze") return "haze";
  return "dry";
}

/** Re-rolls each hour so the tag changes between morning and afternoon. */
function seedOf(date: Date, salt: number): number {
  const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
  let hash = salt * 2654435761;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash ^ key.charCodeAt(i)) * 16777619;
  }
  return Math.abs(hash);
}

/** One tag, e.g. `宜带伞` or `宜赏雪`. */
export function weatherTag(weather: WeatherInfo, kind: WeatherKind, now: Date): string {
  const band = bandOf(weather.temperature);
  const pool = TAGS[familyOf(kind)][band];
  return pool[seedOf(now, Number(weather.code) + 7) % pool.length];
}

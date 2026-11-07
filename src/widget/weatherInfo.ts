export interface ForecastDay {
  /** `今天` / `星期日` … */
  label: string;
  /** `11/7` */
  date: string;
  high: number | null;
  low: number | null;
  /** Day icon code, e.g. `02`. */
  code: string;
}

export interface WeatherInfo {
  areaId: string;
  province: string;
  city: string;
  district: string;
  /** China Weather 2-digit icon code, e.g. `02` for overcast. */
  code: string;
  condition: string;
  temperature: number;
  tempMax: number | null;
  tempMin: number | null;
  humidity: number | null;
  wind: string;
  windPower: string;
  aqi: number | null;
  /** Life indices from 中国天气网 (`dataZS`). */
  comfort: string | null;
  sport: string | null;
  dressing: string | null;
  mood: string | null;
  forecast: ForecastDay[];
  updatedAt: number;
}

export type WeatherKind =
  | "clear"
  | "mostlyClear"
  | "partly"
  | "cloudy"
  | "overcast"
  | "fog"
  | "haze"
  | "drizzle"
  | "rain"
  | "heavyRain"
  | "sleet"
  | "snow"
  | "heavySnow"
  | "thunder"
  | "wind";

/** China Weather code → coarse condition family used for wording. */
export function weatherKind(code: string): WeatherKind {
  switch (code) {
    case "00":
      return "clear";
    case "01":
      return "partly";
    case "02":
      return "overcast";
    case "03":
    case "07":
    case "21":
      return "rain";
    case "04":
    case "05":
      return "thunder";
    case "06":
    case "19":
      return "sleet";
    case "08":
    case "22":
      return "rain";
    case "09":
    case "10":
    case "11":
    case "12":
    case "23":
    case "24":
    case "25":
      return "heavyRain";
    case "13":
    case "14":
    case "26":
      return "snow";
    case "15":
      return "snow";
    case "16":
    case "17":
    case "27":
    case "28":
      return "heavySnow";
    case "18":
    case "32":
    case "49":
    case "57":
    case "58":
      return "fog";
    case "20":
    case "29":
    case "30":
    case "31":
    case "53":
    case "54":
    case "55":
    case "56":
      return "haze";
    default:
      return "cloudy";
  }
}

/**
 * China Weather code → MSN icon code (`d`/`n` + three digits), because the
 * bundled icon set is the MSN weather set.
 */
export function msnCode(code: string, isDay: boolean): string {
  const prefix = isDay ? "d" : "n";
  const table: Record<string, string> = {
    "00": "000",
    "01": "200",
    "02": "400",
    "03": "210",
    "04": "240",
    "05": "705",
    "06": "411",
    "07": "410",
    "08": "430",
    "09": "420",
    "10": "420",
    "11": "420",
    "12": "420",
    "13": "312",
    "14": "412",
    "15": "422",
    "16": "432",
    "17": "432",
    "18": "600",
    "19": "603",
    "20": "905",
    "21": "410",
    "22": "430",
    "23": "420",
    "24": "420",
    "25": "420",
    "26": "412",
    "27": "422",
    "28": "432",
    "29": "900",
    "30": "905",
    "31": "905",
    "32": "600",
    "49": "600",
    "53": "900",
    "54": "900",
    "55": "900",
    "56": "900",
    "57": "600",
    "58": "600"
  };
  return `${prefix}${table[code] ?? "400"}`;
}

export const WEATHER_LABELS: Record<WeatherKind, string> = {
  clear: "晴",
  mostlyClear: "晴间多云",
  partly: "多云",
  cloudy: "多云转阴",
  overcast: "阴",
  fog: "雾",
  haze: "霾",
  drizzle: "毛毛雨",
  rain: "小雨",
  heavyRain: "大雨",
  sleet: "雨夹雪",
  snow: "小雪",
  heavySnow: "大雪",
  thunder: "雷阵雨",
  wind: "大风"
};

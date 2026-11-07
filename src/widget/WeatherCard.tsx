import { useMemo } from "react";
import { LineChart, type LineChartSeries } from "@/components/charts/line-chart";
import { LineChartPlot } from "@/components/charts/line-chart/plot";
import type { WeatherInfo } from "./weatherInfo";
import { msnCode, weatherKind } from "./weatherInfo";
import { weatherIconUrl } from "./weatherIcons";
import { weatherTag } from "./weatherTip";

interface WeatherCardProps {
  weather: WeatherInfo | null;
  now: Date;
}

/** `星期日` → `周日`, `今天` stays. */
function shortLabel(label: string) {
  return label.replace("星期", "周");
}

export default function WeatherCard({ weather, now }: WeatherCardProps) {
  const kind = weather ? weatherKind(weather.code) : null;
  const hour = now.getHours();
  const isDay = hour >= 6 && hour < 18;
  const tip = weather && kind ? weatherTag(weather, kind, now) : "";

  const chart = useMemo(() => {
    const days = weather?.forecast ?? [];
    if (days.length < 2) return null;
    const highs = days.map((day) => day.high);
    const lows = days.map((day) => day.low);
    const numbers = [...highs, ...lows].filter((value): value is number => value !== null);
    if (numbers.length < 2) return null;

    const series: LineChartSeries[] = [
      {
        id: "high",
        name: "最高",
        color: "var(--accent)",
        values: highs
      },
      {
        id: "low",
        name: "最低",
        color: "var(--text-dim)",
        values: lows
      }
    ];
    const domain: [number, number] = [
      Math.floor(Math.min(...numbers)) - 1,
      Math.ceil(Math.max(...numbers)) + 1
    ];
    return {
      series,
      categories: days.map((day) => shortLabel(day.label)),
      domain
    };
  }, [weather]);

  if (!weather || !kind) {
    return (
      <div className="weather-card">
        <p className="weather-tip">天气加载中…</p>
      </div>
    );
  }

  return (
    <div className="weather-card">
      <div className="weather-head">
        <img
          className="weather-icon"
          src={weatherIconUrl(msnCode(weather.code, isDay))}
          alt={weather.condition}
          draggable={false}
        />
        <div className="weather-readout">
          <span className="weather-temp">{Math.round(weather.temperature)}°</span>
          <span className="weather-label">
            {weather.condition}
            {weather.tempMin !== null && weather.tempMax !== null
              ? ` · ${Math.round(weather.tempMin)}~${Math.round(weather.tempMax)}°`
              : ""}
          </span>
        </div>
        <span className="weather-place">
          {[weather.province, weather.city].filter(Boolean).join(" ")}
        </span>
      </div>

      <p className="weather-tip">{tip}</p>

      {chart ? (
        <div className="weather-chart">
          <LineChart
            series={chart.series}
            categories={chart.categories}
            variant="area"
            domain={chart.domain}
            label="未来几天温度走势"
            formatValue={(value) => `${Math.round(value)}°`}
            formatTick={(value) => `${Math.round(value)}°`}
          >
            <LineChartPlot height={64} strokeWidth={1.5} showGrid={false} fadeEdges />
          </LineChart>
        </div>
      ) : null}
    </div>
  );
}

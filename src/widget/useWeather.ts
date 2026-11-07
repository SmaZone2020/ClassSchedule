import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { WeatherInfo } from "./weatherInfo";

const REFRESH_MS = 10 * 60_000;

export function useWeather() {
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    let alive = true;

    const load = (force: boolean) => {
      invoke<WeatherInfo>("get_weather", { force })
        .then((next) => {
          if (alive) setWeather(next);
        })
        .catch(() => {});
    };

    load(false);
    const timer = window.setInterval(() => load(true), REFRESH_MS);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  return weather;
}

import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AppData, Schedule, Settings, WallpaperInfo, WidgetRect } from "../types";
import { mergeSettings } from "../settingsDefaults";

/** Loads widget data and keeps it in sync with backend events. */
export function useWidgetData() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [wallpaper, setWallpaper] = useState<WallpaperInfo | null>(null);
  const [rect, setRect] = useState<WidgetRect | null>(null);
  const [animRect, setAnimRect] = useState<WidgetRect | null>(null);
  const [monitors, setMonitors] = useState<AppData["monitors"]>([]);
  const [now, setNow] = useState(() => new Date());
  const dataRef = useRef<AppData | null>(null);

  useEffect(() => {
    let alive = true;
    const disposers: Array<() => void> = [];

    invoke<AppData>("get_app_data")
      .then((next) => {
        if (!alive) return;
        dataRef.current = next;
        setSettings(mergeSettings(next.settings));
        setSchedule(next.schedule);
        setWallpaper(next.wallpaper);
        setRect(next.rect);
        setMonitors(next.monitors);
      })
      .catch(() => {
        if (alive) setSettings(mergeSettings({}));
      });

    listen<Settings>("settings-changed", (event) => {
      const next = mergeSettings(event.payload);
      const previous = dataRef.current?.settings;
      setSettings(next);
      if (
        previous &&
        (next.wallpaper.mode !== previous.wallpaper.mode ||
          next.wallpaper.customPath !== previous.wallpaper.customPath)
      ) {
        invoke<WallpaperInfo>("get_wallpaper").then(setWallpaper).catch(() => {});
      }
      if (dataRef.current) dataRef.current = { ...dataRef.current, settings: next };
    }).then((fn) => disposers.push(fn));

    listen<Schedule | null>("schedule-changed", (event) => {
      setSchedule(event.payload ?? null);
    }).then((fn) => disposers.push(fn));

    listen<WallpaperInfo>("wallpaper-changed", (event) => {
      setWallpaper(event.payload);
    }).then((fn) => disposers.push(fn));

    listen<WidgetRect>("layout-changed", (event) => {
      setRect(event.payload);
      setAnimRect(null);
    }).then((fn) => disposers.push(fn));

    listen<WidgetRect>("layout-animating", (event) => {
      setAnimRect(event.payload);
    }).then((fn) => disposers.push(fn));

    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      disposers.forEach((fn) => fn());
    };
  }, []);

  return { settings, schedule, setSchedule, wallpaper, rect, animRect, monitors, now };
}

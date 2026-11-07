import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppData, Settings, WallpaperInfo } from "../types";
import { persistSettings } from "./api";
import { PositionSection } from "./PositionSection";
import { DisplaySection } from "./DisplaySection";
import { WallpaperSection } from "./WallpaperSection";
import { ScheduleSection } from "./ScheduleSection";
import { PeriodsSection } from "./PeriodsSection";
import { CssSection } from "./CssSection";

interface SettingsAppProps {
  data: AppData;
  reload: () => Promise<void>;
}

export default function SettingsApp({ data, reload }: SettingsAppProps) {
  const [settings, setSettings] = useState<Settings>(data.settings);
  const [wallpaper, setWallpaper] = useState<WallpaperInfo | null>(data.wallpaper);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timerRef = useRef<number | null>(null);
  const latest = useRef(settings);
  latest.current = settings;
  const dirty = useRef(false);

  const patch = (value: Partial<Settings>) => {
    dirty.current = true;
    setSettings((previous) => ({ ...previous, ...value }));
  };

  useEffect(() => {
    if (!dirty.current) return;
    setState("saving");
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        const persisted = await persistSettings(latest.current);
        dirty.current = false;
        setSettings(persisted);
        setState("saved");
      } catch {
        setState("error");
      }
    }, 300);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [settings]);

  // Keep the wallpaper preview in sync when the native side re-reads it.
  useEffect(() => {
    invoke<WallpaperInfo>("get_wallpaper")
      .then(setWallpaper)
      .catch(() => {});
  }, []);

  const label =
    state === "saving" ? "保存中…" : state === "error" ? "保存失败" : "已保存";

  return (
    <div className="settings-shell" style={{ "--accent": settings.accent } as React.CSSProperties}>
      <h1>
        课表组件设置 <span className="status-pill">{label}</span>
      </h1>

      <ScheduleSection
        schedule={data.schedule}
        configDir={data.configDir}
        onChanged={reload}
      />
      <PositionSection settings={settings} monitors={data.monitors} onChange={patch} />
      <DisplaySection settings={settings} onChange={patch} />
      <WallpaperSection
        settings={settings}
        wallpaper={wallpaper}
        onChange={patch}
        onWallpaperChanged={setWallpaper}
      />
      <PeriodsSection settings={settings} onChange={patch} />
      <CssSection settings={settings} onChange={patch} />
    </div>
  );
}

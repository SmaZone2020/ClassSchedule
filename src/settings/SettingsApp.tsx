import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppData, FontCatalog, Settings, WallpaperInfo } from "../types";
import { persistSettings } from "./api";
import { applyAppFont, invalidateFontCache } from "../font";
import { Tabs } from "../ui/Tabs";
import { Bars, Clock, Code, Font, LayoutColumns, Palette } from "./icons";
import { PositionSection } from "./PositionSection";
import { AppearanceSection } from "./AppearanceSection";
import { FontSection } from "./FontSection";
import { WallpaperSection } from "./WallpaperSection";
import { ScheduleSection } from "./ScheduleSection";
import { PeriodsSection } from "./PeriodsSection";
import { CssSection } from "./CssSection";

interface SettingsAppProps {
  data: AppData;
  reload: () => Promise<void>;
}

const TABS = [
  { value: "appearance", label: "外观", icon: <Palette /> },
  { value: "font", label: "字体", icon: <Font /> },
  { value: "layout", label: "布局", icon: <LayoutColumns /> },
  { value: "schedule", label: "课表", icon: <Bars /> },
  { value: "periods", label: "作息", icon: <Clock /> },
  { value: "advanced", label: "高级", icon: <Code /> }
];

export default function SettingsApp({ data, reload }: SettingsAppProps) {
  const [tab, setTab] = useState("appearance");
  const [settings, setSettings] = useState<Settings>(data.settings);
  const [wallpaper, setWallpaper] = useState<WallpaperInfo | null>(data.wallpaper);
  const [catalog, setCatalog] = useState<FontCatalog | null>(null);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const timerRef = useRef<number | null>(null);
  const latest = useRef(settings);
  latest.current = settings;
  const dirty = useRef(false);

  const patch = (value: Partial<Settings>) => {
    dirty.current = true;
    setSettings((previous) => ({ ...previous, ...value }));
  };

  /** Update local state without queueing a save (the caller already persisted). */
  const patchSilent = (value: Partial<Settings>) => {
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

  useEffect(() => {
    applyAppFont(settings.font);
  }, [settings.font]);

  // Keep the wallpaper preview in sync when the native side re-reads it.
  useEffect(() => {
    invoke<WallpaperInfo>("get_wallpaper")
      .then(setWallpaper)
      .catch(() => {});
  }, []);

  useEffect(() => {
    invalidateFontCache();
    invoke<FontCatalog>("get_font_catalog")
      .then(setCatalog)
      .catch(() => setCatalog(null));
  }, [settings.font.dir]);

  const label =
    state === "saving" ? "保存中…" : state === "error" ? "保存失败" : state === "saved" ? "已保存" : "";

  const accent = useMemo(
    () => ({ "--accent": settings.accent }) as React.CSSProperties,
    [settings.accent]
  );

  return (
    <div className="settings-page" style={accent}>
      <div className="mx-auto flex min-h-screen w-full max-w-[860px] flex-col gap-5 px-6 pb-14 pt-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-[19px] font-semibold tracking-tight text-foreground">
              课表组件设置
            </h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              桌面小组件 · 修改会即时同步到桌面
            </p>
          </div>
          <span
            className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground tabular-nums"
            aria-live="polite"
          >
            {label || "自动保存"}
          </span>
        </header>

        <Tabs items={TABS} value={tab} onChange={setTab} className="self-start" />

        <div className="flex flex-col gap-4">
          {tab === "appearance" && (
            <>
              <AppearanceSection settings={settings} onChange={patch} />
              <WallpaperSection
                settings={settings}
                wallpaper={wallpaper}
                onChange={patch}
                onWallpaperChanged={setWallpaper}
              />
            </>
          )}

          {tab === "font" && (
            <FontSection
              settings={settings}
              catalog={catalog}
              onChange={patch}
              onCatalog={setCatalog}
              onSilentChange={patchSilent}
            />
          )}

          {tab === "layout" && (
            <PositionSection settings={settings} monitors={data.monitors} onChange={patch} />
          )}

          {tab === "schedule" && (
            <ScheduleSection
              schedule={data.schedule}
              configDir={data.configDir}
              onChanged={reload}
            />
          )}

          {tab === "periods" && <PeriodsSection settings={settings} onChange={patch} />}

          {tab === "advanced" && <CssSection settings={settings} onChange={patch} />}
        </div>
      </div>
    </div>
  );
}

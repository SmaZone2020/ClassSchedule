import { useEffect, useRef, useState } from "react";
import type { Settings } from "../types";
import { persistSettings } from "./useAppData";
import { PositionSection } from "./PositionSection";
import { DisplaySection } from "./DisplaySection";
import { ScheduleSection } from "./ScheduleSection";
import { PeriodsSection } from "./PeriodsSection";
import { CssSection } from "./CssSection";

interface SettingsAppProps {
  initialSettings: Settings;
  schedule: AppDataShape | null;
  configDir: string;
  reload: () => void;
}

interface AppDataShape {
  schedule: import("../types").Schedule | null;
}

export default function SettingsApp({
  initialSettings,
  schedule,
  configDir,
  reload
}: SettingsAppProps) {
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [saved, setSaved] = useState(false);
  const timerRef = useRef<number | null>(null);
  const latest = useRef(settings);
  latest.current = settings;

  const patch = (value: Partial<Settings>) => {
    setSettings((previous) => ({ ...previous, ...value }));
    setSaved(false);
  };

  useEffect(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      try {
        const persisted = await persistSettings(latest.current);
        setSettings(persisted);
        setSaved(true);
      } catch {
        setSaved(false);
      }
    }, 350);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [settings]);

  return (
    <div className="settings-shell">
      <h1>
        课表组件设置{" "}
        <span className="status-pill" style={{ marginLeft: 8 }}>
          {saved ? "已保存" : "保存中…"}
        </span>
      </h1>

      <ScheduleSection
        schedule={schedule?.schedule ?? null}
        configDir={configDir}
        onChanged={reload}
      />
      <PositionSection
        settings={settings}
        monitors={monitorsCache ?? []}
        onChange={patch}
      />
      <DisplaySection settings={settings} onChange={patch} />
      <PeriodsSection settings={settings} onChange={patch} />
      <CssSection settings={settings} onChange={patch} />
    </div>
  );
}

let monitorsCache: import("../types").MonitorInfo[] | null = null;

export function cacheMonitors(monitors: import("../types").MonitorInfo[]) {
  monitorsCache = monitors;
}

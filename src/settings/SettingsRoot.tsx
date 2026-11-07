import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppData } from "../types";
import { mergeSettings } from "../settingsDefaults";
import { applyAppFont } from "../font";
import SettingsApp from "./SettingsApp";

export default function SettingsRoot() {
  const [data, setData] = useState<AppData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await invoke<AppData>("get_app_data");
      const settings = mergeSettings(next.settings);
      applyAppFont(settings.font);
      setData({ ...next, settings });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="settings-page grid min-h-screen place-items-center">
        <p className="text-sm text-muted-foreground">
          {failed ? "加载失败，请重启应用" : "正在加载…"}
        </p>
      </div>
    );
  }

  return <SettingsApp data={data} reload={load} />;
}

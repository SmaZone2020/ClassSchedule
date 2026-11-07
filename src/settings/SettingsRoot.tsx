import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppData } from "../types";
import { mergeSettings } from "../settingsDefaults";
import SettingsApp from "./SettingsApp";

export default function SettingsRoot() {
  const [data, setData] = useState<AppData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      const next = await invoke<AppData>("get_app_data");
      setData({ ...next, settings: mergeSettings(next.settings) });
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
      <div className="settings-shell">
        <h1>课表组件设置</h1>
        <p>{failed ? "加载失败，请重启应用" : "正在加载…"}</p>
      </div>
    );
  }

  return <SettingsApp data={data} reload={load} />;
}

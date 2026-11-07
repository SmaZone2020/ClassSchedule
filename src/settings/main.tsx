import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppData } from "../types";
import { mergeSettings } from "../settingsDefaults";
import SettingsApp, { cacheMonitors } from "./SettingsApp";
import "../styles/global.css";

export default function SettingsRoot() {
  const [data, setData] = useState<AppData | null>(null);

  const load = () =>
    invoke<AppData>("get_app_data")
      .then((next) => {
        cacheMonitors(next.monitors);
        setData(next);
      })
      .catch(() => setData(null));

  useEffect(() => {
    load();
  }, []);

  if (!data) {
    return (
      <div className="settings-shell">
        <h1>课表组件设置</h1>
        <p>正在加载…（若长时间无响应，请重启应用）</p>
      </div>
    );
  }

  return (
    <SettingsApp
      key={data.configDir}
      initialSettings={mergeSettings(data.settings)}
      schedule={{ schedule: data.schedule }}
      configDir={data.configDir}
      reload={load}
    />
  );
}

import { createRoot } from "react-dom/client";

const container = document.getElementById("root")!;
createRoot(container).render(<SettingsRoot />);

import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { AppData, Settings } from "../types";
import { mergeSettings } from "../settingsDefaults";

export function useAppData() {
  const [data, setData] = useState<AppData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  const refresh = useCallback(async () => {
    const next = await invoke<AppData>("get_app_data");
    setData(next);
    setSettings(mergeSettings(next.settings));
  }, []);

  useEffect(() => {
    refresh().catch(() => setSettings(mergeSettings({})));
    let dispose: (() => void) | undefined;
    import("@tauri-apps/api/event").then(({ listen }) =>
      listen<Settings>("settings-changed", (event) => {
        setSettings(mergeSettings(event.payload));
      }).then((fn) => {
        dispose = fn;
      })
    );
    return () => dispose?.();
  }, [refresh]);

  return { data, settings, setSettings, refresh };
}

export async function persistSettings(settings: Settings): Promise<Settings> {
  return invoke<Settings>("update_settings", { settings });
}

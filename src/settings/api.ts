import { invoke } from "@tauri-apps/api/core";
import type { Settings } from "../types";

export async function persistSettings(settings: Settings): Promise<Settings> {
  return invoke<Settings>("update_settings", { settings });
}

export async function setWidgetVisible(visible: boolean): Promise<void> {
  await invoke("set_widget_visible", { visible });
}

import type { CustomCss, Settings } from "./types";

export const defaultSettings: Settings = {
  position: { monitor: null, x: 60, y: 60 },
  scale: 1,
  daysMode: "auto",
  align: "auto",
  clickThrough: true,
  desktopPin: true,
  theme: "auto",
  accent: "#4f8ef7",
  style: "frosted",
  panel: {
    radius: 20,
    opacity: 0.62,
    blur: 18,
    gap: 6,
    showLocation: true,
    showPeriodTime: true,
    showHeader: true
  },
  periods: [
    { index: 1, start: "08:00", end: "08:45" },
    { index: 2, start: "08:55", end: "09:40" },
    { index: 3, start: "10:00", end: "10:45" },
    { index: 4, start: "10:55", end: "11:40" },
    { index: 5, start: "14:00", end: "14:45" },
    { index: 6, start: "14:55", end: "15:40" },
    { index: 7, start: "16:00", end: "16:45" },
    { index: 8, start: "16:55", end: "17:40" }
  ],
  css: { enabled: false, container: "", course: "" } as CustomCss,
  wallpaper: { mode: "system", customPath: null, dim: 0.12 },
  widgetVisible: true
};

export function mergeSettings(raw: unknown): Settings {
  const value = (raw ?? {}) as Partial<Settings>;
  return {
    ...defaultSettings,
    ...value,
    position: { ...defaultSettings.position, ...(value.position ?? {}) },
    panel: { ...defaultSettings.panel, ...(value.panel ?? {}) },
    periods: value.periods?.length ? value.periods : defaultSettings.periods,
    css: { ...defaultSettings.css, ...(value.css ?? {}) },
    wallpaper: { ...defaultSettings.wallpaper, ...(value.wallpaper ?? {}) }
  };
}

/** Unscaled base size, must match `src-tauri/src/window_ops.rs`. */
export const DAY_WIDTH = 80;
export const PANEL_PAD = 14;
export const PANEL_GAP = 6;
export const MULTI_HEIGHT = 420;
export const TODAY_WIDTH = 320;
export const TODAY_HEIGHT = 380;

export function baseSize(columns: number): { width: number; height: number } {
  const cols = Math.min(Math.max(columns, 1), 7);
  if (cols <= 1) return { width: TODAY_WIDTH, height: TODAY_HEIGHT };
  return {
    width: PANEL_PAD * 2 + cols * DAY_WIDTH + (cols - 1) * PANEL_GAP,
    height: MULTI_HEIGHT
  };
}

export function slotWidth(): number {
  return baseSize(7).width;
}

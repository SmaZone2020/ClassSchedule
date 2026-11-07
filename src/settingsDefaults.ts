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
    shadow: 0.9,
    shadowSize: 14,
    titleMode: "full",
    compact: true,
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
  font: { family: "WidgetCustomFont", dir: "D:\\Font\\SiYuanSongTiRegular" },
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
    wallpaper: { ...defaultSettings.wallpaper, ...(value.wallpaper ?? {}) },
    font: { ...defaultSettings.font, ...(value.font ?? {}) }
  };
}

/* Layout constants — must match `src-tauri/src/window_ops.rs`. */

export const DAY_WIDTH = 80;
export const PANEL_PAD = 14;
export const PANEL_GAP = 6;
export const MULTI_HEIGHT = 420;
export const TODAY_WIDTH = 320;
export const TODAY_HEIGHT = 380;

/**
 * Transparent margin around the panel so the drop shadow has room to render.
 * Without it the shadow is clipped by the window edge and only the rounded
 * corners look shadowed.
 */

/** Transparent margin around the panel so the drop shadow has room to render. */
export function shadowPad(shadowSize: number): number {
  return Math.min(Math.max(Math.ceil(shadowSize * 2.6 + 8), 20), 72);
}

/** Panel (visible glass) size for the given visible column count. */
export function panelSize(columns: number): { width: number; height: number } {
  const cols = Math.min(Math.max(columns, 1), 7);
  if (cols <= 1) return { width: TODAY_WIDTH, height: TODAY_HEIGHT };
  return {
    width: PANEL_PAD * 2 + cols * DAY_WIDTH + (cols - 1) * PANEL_GAP,
    height: MULTI_HEIGHT
  };
}

/** Native window size, i.e. the panel plus the shadow margin. */
export function baseSize(
  columns: number,
  shadowSize = 14
): { width: number; height: number } {
  const panel = panelSize(columns);
  const pad = shadowPad(shadowSize);
  return { width: panel.width + pad * 2, height: panel.height + pad * 2 };
}

export function slotWidth(shadowSize = 14): number {
  return baseSize(7, shadowSize).width;
}

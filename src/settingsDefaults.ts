import type { CustomCss, Settings } from "./types";

export const defaultSettings: Settings = {
  position: { monitor: null, x: 60, y: 60 },
  scale: 1,
  daysMode: "auto",
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
  systemAcrylic: true,
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
    css: { ...defaultSettings.css, ...(value.css ?? {}) }
  };
}

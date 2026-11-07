export interface Position {
  monitor?: string | null;
  x: number;
  y: number;
}

export interface PanelStyle {
  radius: number;
  opacity: number;
  blur: number;
  gap: number;
  shadow: number;
  shadowSize: number;
  titleMode: "full" | "short";
  compact: boolean;
  showLocation: boolean;
  showPeriodTime: boolean;
  showHeader: boolean;
}

export interface PeriodTime {
  index: number;
  start: string;
  end: string;
}

export interface CustomCss {
  enabled: boolean;
  container: string;
  course: string;
}

export interface WallpaperSettings {
  mode: "system" | "custom";
  customPath: string | null;
  dim: number;
}

export interface FontSettings {
  /** CSS family. `WidgetCustomFont` means the `@font-face` loaded from `dir`. */
  family: string;
  /** Folder or single font file used for the custom face. */
  dir: string;
}

export interface FontFile {
  path: string;
  label: string;
  url: string;
  weight: number;
  style: string;
}

export interface FontCatalog {
  system: string[];
  custom: FontFile[];
  family: string;
}

export interface WallpaperInfo {
  dataUrl: string | null;
  style: "fill" | "fit" | "stretch" | "center" | "tile" | "span";
  source: "system" | "custom";
  path: string | null;
  error: string | null;
}

export type DaysMode = "auto" | "5" | "7" | "today";
export type AlignMode = "left" | "right" | "auto";

export interface Settings {
  position: Position;
  scale: number;
  daysMode: DaysMode;
  align: AlignMode;
  clickThrough: boolean;
  desktopPin: boolean;
  theme: "auto" | "light" | "dark";
  accent: string;
  style: "frosted" | "liquid";
  panel: PanelStyle;
  periods: PeriodTime[];
  css: CustomCss;
  wallpaper: WallpaperSettings;
  font: FontSettings;
  widgetVisible: boolean;
  autostart: boolean;
}

export interface MonitorInfo {
  name: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isPrimary: boolean;
}

export interface WidgetSize {
  width: number;
  height: number;
}

/** Widget rectangle in logical px relative to the monitor origin. */
export interface WidgetRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface AppData {
  settings: Settings;
  schedule: Schedule | null;
  scheduleError: string | null;
  monitors: MonitorInfo[];
  widgetSize: WidgetSize;
  rect: WidgetRect;
  wallpaper: WallpaperInfo;
  configDir: string;
}

export interface ValidationReport {
  valid: boolean;
  error: string | null;
  meta: ScheduleMeta | null;
  weeks: number;
  sessions: number;
  warnings: string[];
}

export interface ScheduleMeta {
  semester?: string;
  [key: string]: unknown;
}

export interface CourseInfo {
  name: string;
  shortName?: string;
  color?: string;
  [key: string]: unknown;
}

export interface Session {
  periods: unknown;
  course: string;
  courseShort?: string;
  location?: string;
  [key: string]: unknown;
}

export interface Day {
  weekday: string;
  date: string;
  dayOfMonth?: string;
  sessions: Session[];
}

export interface Week {
  week: number;
  startDate: string;
  endDate?: string;
  days: Day[];
}

export interface Schedule {
  meta?: ScheduleMeta;
  courses?: CourseInfo[];
  weeks?: Week[];
  sessions?: unknown[];
}

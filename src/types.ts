export interface Periods {
  start: number;
  end: number;
}

export interface Session {
  periods: Periods | string;
  periodLabel?: string;
  course: string;
  courseShort?: string;
  location?: string;
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
  endDate: string;
  days: Day[];
}

export interface CourseInfo {
  name: string;
  shortName?: string;
  sessionCount?: number;
  locations?: string[];
}

export interface ScheduleMeta {
  semester?: string;
  source?: string;
  periodRule?: string;
  note?: string;
}

export interface Schedule {
  meta?: ScheduleMeta;
  courses?: CourseInfo[];
  weeks: Week[];
  sessions?: ScheduleSession[];
}

export interface ScheduleSession {
  week: number;
  date: string;
  weekday: string;
  periods: string;
  course: string;
  location?: string;
}

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

export interface Settings {
  position: Position;
  scale: number;
  daysMode: "auto" | "5" | "7";
  clickThrough: boolean;
  desktopPin: boolean;
  theme: "auto" | "light" | "dark";
  accent: string;
  style: "frosted" | "liquid";
  panel: PanelStyle;
  systemAcrylic: boolean;
  periods: PeriodTime[];
  css: CustomCss;
  widgetVisible: boolean;
}

export interface MonitorInfo {
  name: string;
  label: string;
  width: number;
  height: number;
  isPrimary: boolean;
}

export interface WidgetSize {
  width: number;
  height: number;
}

export interface AppData {
  settings: Settings;
  schedule: Schedule | null;
  scheduleError: string | null;
  monitors: MonitorInfo[];
  widgetSize: WidgetSize;
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

import type { Day, Schedule, Settings, Week } from "./types";

const WEEKDAY_ORDER = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export interface PeriodRange {
  start: number;
  end: number;
}

export function isoDate(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function parseTime(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function sortedWeeks(schedule: Schedule | null): Week[] {
  if (!schedule?.weeks?.length) return [];
  return [...schedule.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** Week index that contains `now`, else the closest upcoming/past week. */
export function findCurrentWeekIndex(schedule: Schedule | null, now: Date): number {
  const weeks = sortedWeeks(schedule);
  if (!weeks.length) return -1;
  const today = isoDate(now);

  const inWindow = weeks.findIndex(
    (week) => today >= week.startDate && today <= addDays(week.startDate, 6)
  );
  if (inWindow >= 0) return inWindow;

  const upcoming = weeks.findIndex((week) => week.startDate > today);
  if (upcoming >= 0) return upcoming;

  return weeks.length - 1;
}

export function findCurrentWeek(
  schedule: Schedule | null,
  now: Date
): { week: Week | null; isBreak: boolean } {
  const weeks = sortedWeeks(schedule);
  const index = findCurrentWeekIndex(schedule, now);
  if (index < 0) return { week: null, isBreak: false };
  const week = weeks[index];
  const today = isoDate(now);
  const isBreak = !(today >= week.startDate && today <= addDays(week.startDate, 6));
  return { week, isBreak };
}

export function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

/** Compact `M.D` label used by the header date range. */
export function shortDate(iso: string): string {
  const parts = iso.split("-");
  if (parts.length < 3) return iso;
  return `${Number(parts[1])}.${Number(parts[2])}`;
}

/** `11.7` for a single day, `11.7-11.11` for a range. */
export function dateRangeLabel(days: Day[]): string {
  if (!days.length) return "";
  if (days.length === 1) return shortDate(days[0].date);
  return `${shortDate(days[0].date)}-${shortDate(days[days.length - 1].date)}`;
}

export function weekdayName(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return WEEKDAY_ORDER[(date.getDay() + 6) % 7] ?? "周一";
}

/** All seven days of the week, in Monday-first order, gaps filled in. */
export function weekDays(week: Week | null): Day[] {
  if (!week) return [];
  return withFullWeek(week).sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday)
  );
}

export function visibleDays(week: Week | null, settings: Settings, now: Date = new Date()): Day[] {
  if (!week) return [];
  const sorted = weekDays(week);

  if (settings.daysMode === "today") {
    const today = isoDate(now);
    const match = sorted.find((day) => day.date === today);
    return match ? [match] : [sorted[0]];
  }
  if (settings.daysMode === "7") return sorted;

  const weekendHasClass = sorted
    .filter((day) => day.weekday === "周六" || day.weekday === "周日")
    .some((day) => day.sessions.length > 0);

  if (settings.daysMode === "5" || !weekendHasClass) {
    return sorted.filter((day) => day.weekday !== "周六" && day.weekday !== "周日");
  }
  return sorted;
}

function withFullWeek(week: Week): Day[] {
  const days = [...week.days];
  const existing = new Set(days.map((day) => day.weekday));
  const monday = week.startDate;
  WEEKDAY_ORDER.forEach((weekday, index) => {
    if (existing.has(weekday)) return;
    const date = addDays(monday, index);
    days.push({ weekday, date, dayOfMonth: formatDayOfMonth(date), sessions: [] });
  });
  return days;
}

function formatDayOfMonth(iso: string): string {
  const date = new Date(`${iso}T00:00:00`);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function weekHasSessions(week: Week | null): boolean {
  return Boolean(week?.days.some((day) => day.sessions.length > 0));
}

export function weekFinished(week: Week | null, settings: Settings, now: Date): boolean {
  if (!week || !weekHasSessions(week)) return false;
  const today = isoDate(now);
  // Only days that actually hold a class can keep the week "running". An empty
  // Saturday/Sunday must not stop the notice on a weekend.
  return week.days.every((day) => {
    if (day.sessions.length === 0) return true;
    if (day.date < today) return true;
    if (day.date > today) return false;
    return day.sessions.every((session) => sessionEnded(session, settings, now));
  });
}

export function currentPeriod(settings: Settings, now: Date): number | null {
  const minutes = now.getHours() * 60 + now.getMinutes();
  for (const period of settings.periods) {
    const start = parseTime(period.start);
    const end = parseTime(period.end);
    if (start !== null && end !== null && minutes >= start && minutes <= end) {
      return period.index;
    }
  }
  return null;
}

export function sessionRange(session: { periods: unknown }): PeriodRange | null {
  const raw = session.periods;
  if (raw && typeof raw === "object" && "start" in raw && "end" in raw) {
    const { start, end } = raw as PeriodRange;
    return { start: Number(start), end: Number(end) };
  }
  if (typeof raw === "string") {
    const matches = [...raw.matchAll(/(\d+)/g)].map((match) => Number(match[1]));
    if (matches.length >= 2) return { start: matches[0], end: matches[1] };
    if (matches.length === 1) return { start: matches[0], end: matches[0] };
  }
  return null;
}

export function sessionEnded(
  session: { periods: unknown },
  settings: Settings,
  now: Date
): boolean {
  const range = sessionRange(session);
  if (!range) return false;
  const period = settings.periods.find((item) => item.index === range.end);
  const endMinutes = period ? parseTime(period.end) : null;
  const fallbackEnd = settings.periods.length
    ? parseTime(settings.periods[settings.periods.length - 1].end)
    : null;
  const limit = endMinutes ?? fallbackEnd ?? 18 * 60;
  return now.getHours() * 60 + now.getMinutes() > limit;
}

export function sessionStartLabel(
  session: { periods: unknown },
  settings: Settings
): string | null {
  const range = sessionRange(session);
  if (!range) return null;
  const period = settings.periods.find((item) => item.index === range.start);
  return period ? period.start : null;
}

export function periodRangeLabel(session: { periods: unknown }): string {
  const raw = session.periods;
  if (typeof raw === "string") return raw;
  const range = sessionRange(session);
  if (!range) return "";
  return range.start === range.end
    ? `第${range.start}节`
    : `第${range.start}-${range.end}节`;
}

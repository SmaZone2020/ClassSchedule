import type { Day, Schedule, Settings, Week } from "./types";

const WEEKDAY_ORDER = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

export function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function findCurrentWeek(schedule: Schedule | null): { week: Week | null; isBreak: boolean } {
  if (!schedule?.weeks?.length) return { week: null, isBreak: false };
  const today = todayIso();
  const exact = schedule.weeks.find((week) =>
    week.days.some((day) => day.date === today)
  );
  if (exact) return { week: exact, isBreak: false };

  const byDate = [...schedule.weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const nowTime = new Date(today).getTime();
  const containing = byDate.find((week) => {
    const start = new Date(week.startDate).getTime();
    const end = new Date(week.endDate).getTime() + 86_399_000;
    return nowTime >= start && nowTime <= end;
  });
  if (containing) return { week: containing, isBreak: false };

  const next = byDate.find((week) => new Date(week.startDate).getTime() > nowTime);
  if (next) return { week: next, isBreak: true };

  const last = byDate[byDate.length - 1];
  return { week: last, isBreak: true };
}

export function visibleDays(week: Week | null, settings: Settings): Day[] {
  if (!week) return [];
  const sorted = [...week.days].sort(
    (a, b) => WEEKDAY_ORDER.indexOf(a.weekday) - WEEKDAY_ORDER.indexOf(b.weekday)
  );
  if (settings.daysMode === "7") return sorted;

  const weekendHasClass = sorted
    .filter((day) => day.weekday === "周六" || day.weekday === "周日")
    .some((day) => day.sessions.length > 0);
  if (settings.daysMode === "5" || !weekendHasClass) {
    return sorted.filter((day) => day.weekday !== "周六" && day.weekday !== "周日");
  }
  return sorted;
}

export function weekHasSessions(week: Week | null): boolean {
  return Boolean(week?.days.some((day) => day.sessions.length > 0));
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

export function dayIsFinished(day: Day, settings: Settings, now: Date): boolean {
  if (!day.sessions.length) return false;
  const lastPeriod = day.sessions
    .map((session) => sessionPeriodStart(session, settings))
    .filter((value): value is number => value !== null)
    .sort((a, b) => b - a)[0];
  if (lastPeriod === undefined) return false;
  const minutes = now.getHours() * 60 + now.getMinutes();
  return minutes > lastPeriod;
}

function sessionPeriodStart(session: { periods: unknown }, settings: Settings): number | null {
  const raw = session.periods;
  let startIndex: number | null = null;
  if (typeof raw === "string") {
    const match = raw.match(/(\d+)/);
    startIndex = match ? Number(match[1]) : null;
  } else if (raw && typeof raw === "object" && "start" in raw) {
    startIndex = Number((raw as { start: number }).start);
  }
  if (startIndex === null) return null;
  const period = settings.periods.find((item) => item.index === startIndex);
  if (period) return parseTime(period.end);
  const fallback = settings.periods.find((item) => item.index === startIndex);
  return fallback ? parseTime(fallback.end) : null;
}

export function parseTime(value: string): number | null {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function sessionStartLabel(
  session: { periods: unknown },
  settings: Settings
): string | null {
  let startIndex: number | null = null;
  const raw = session.periods;
  if (typeof raw === "string") {
    const match = raw.match(/(\d+)/);
    startIndex = match ? Number(match[1]) : null;
  } else if (raw && typeof raw === "object" && "start" in raw) {
    startIndex = Number((raw as { start: number }).start);
  }
  if (startIndex === null) return null;
  const period = settings.periods.find((item) => item.index === startIndex);
  return period ? period.start : null;
}

export function periodRangeLabel(session: { periods: unknown }): string {
  const raw = session.periods;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object" && "start" in raw) {
    const { start, end } = raw as { start: number; end: number };
    return `第${start}-${end}节`;
  }
  return "";
}

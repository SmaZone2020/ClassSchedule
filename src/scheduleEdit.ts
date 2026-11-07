import type { Day, Schedule, Session, Week } from "./types";
import { addDays, periodRangeLabel, sessionRange, weekdayName } from "./scheduleUtils";

export interface SessionRef {
  date: string;
  index: number;
}

export interface SessionValues {
  course: string;
  courseShort?: string;
  location?: string;
  start: number;
  end: number;
}

function clone(schedule: Schedule): Schedule {
  return JSON.parse(JSON.stringify(schedule)) as Schedule;
}

function findWeek(schedule: Schedule, date: string): Week | null {
  for (const week of schedule.weeks ?? []) {
    const start = week.startDate;
    const end = week.endDate ?? addDays(start, 6);
    if (date >= start && date <= end) return week;
    if (week.days?.some((day) => day.date === date)) return week;
  }
  return null;
}

function findDay(schedule: Schedule, date: string): { week: Week; day: Day } | null {
  for (const week of schedule.weeks ?? []) {
    const day = week.days?.find((item) => item.date === date);
    if (day) return { week, day };
  }
  return null;
}

/** Synthesised days (filled in by weekDays) must exist before a session lands. */
function ensureDay(schedule: Schedule, date: string): Day | null {
  const existing = findDay(schedule, date);
  if (existing) return existing.day;
  const week = findWeek(schedule, date);
  if (!week) return null;
  week.days = week.days ?? [];
  const day: Day = { weekday: weekdayName(date), date, sessions: [] };
  week.days.push(day);
  return day;
}

export function findSession(schedule: Schedule | null, ref: SessionRef): Session | null {
  if (!schedule) return null;
  return findDay(schedule, ref.date)?.day.sessions[ref.index] ?? null;
}

/** Sessions of one day, in their stored order. */
export function daySessions(schedule: Schedule | null, date: string): Session[] {
  if (!schedule) return [];
  return findDay(schedule, date)?.day.sessions ?? [];
}

/**
 * True when `[start, end]` does not intersect any session of the day.
 * `ignore` skips the session being edited / moved.
 */
export function rangeFree(
  sessions: Session[],
  start: number,
  end: number,
  ignore = -1
): boolean {
  const low = Math.min(start, end);
  const high = Math.max(start, end);
  return !sessions.some((session, index) => {
    if (index === ignore) return false;
    const range = sessionRange(session);
    if (!range) return false;
    return low <= range.end && high >= range.start;
  });
}

/** Last period a course starting at `start` may reach before hitting a neighbour. */
export function maxEndAt(sessions: Session[], start: number, ignore = -1): number {
  let limit = Number.POSITIVE_INFINITY;
  sessions.forEach((session, index) => {
    if (index === ignore) return;
    const range = sessionRange(session);
    if (!range || range.start <= start) return;
    limit = Math.min(limit, range.start - 1);
  });
  return limit;
}

/** Clamp a resize target so it never grows into the next course. */
export function clampResizeEnd(
  sessions: Session[],
  index: number,
  start: number,
  end: number,
  boundsMax: number
): number {
  const limit = Math.min(boundsMax, maxEndAt(sessions, start, index));
  return Math.min(Math.max(end, start), limit);
}

function sortSessions(sessions: Session[]): Session[] {
  return [...sessions].sort((a, b) => {
    const left = sessionRange(a)?.start ?? 0;
    const right = sessionRange(b)?.start ?? 0;
    return left - right;
  });
}

function applyValues(session: Session, values: SessionValues) {
  session.course = values.course;
  if (values.courseShort) session.courseShort = values.courseShort;
  else delete session.courseShort;
  if (values.location) session.location = values.location;
  else delete session.location;
  session.periods = { start: values.start, end: values.end };
}

/** Edit the fields of one session in place. */
export function updateSession(
  schedule: Schedule,
  ref: SessionRef,
  values: SessionValues
): Schedule {
  const next = clone(schedule);
  const day = findDay(next, ref.date)?.day;
  const session = day?.sessions[ref.index];
  if (!day || !session) return schedule;
  // Courses may never overlap, so reject a range that collides with a neighbour.
  if (!rangeFree(day.sessions, values.start, values.end, ref.index)) return schedule;
  applyValues(session, values);
  findDay(next, ref.date)!.day.sessions = sortSessions(findDay(next, ref.date)!.day.sessions);
  return rebuildFlat(next);
}

/** Move a session to another day (or another slot of the same day). */
export function moveSession(
  schedule: Schedule,
  ref: SessionRef,
  toDate: string,
  start: number,
  end: number
): Schedule {
  const next = clone(schedule);
  const from = findDay(next, ref.date);
  if (!from) return schedule;
  const target = ensureDay(next, toDate);
  if (!target) return schedule;

  const sameDay = from.day === target;
  const ignore = sameDay ? ref.index : -1;
  if (!rangeFree(target.sessions, start, end, ignore)) return schedule;

  const [session] = from.day.sessions.splice(ref.index, 1);
  if (!session) return schedule;

  session.periods = { start, end };
  target.sessions.push(session);
  target.sessions = sortSessions(target.sessions);
  from.day.sessions = sortSessions(from.day.sessions);

  return rebuildFlat(next);
}

export function createSession(
  schedule: Schedule,
  toDate: string,
  values: SessionValues
): Schedule {
  const next = clone(schedule);
  const day = ensureDay(next, toDate);
  if (!day) return schedule;
  if (!rangeFree(day.sessions, values.start, values.end)) return schedule;
  const session: Session = { periods: { start: values.start, end: values.end }, course: "" };
  applyValues(session, values);
  day.sessions.push(session);
  day.sessions = sortSessions(day.sessions);
  return rebuildFlat(next);
}

export function removeSession(schedule: Schedule, ref: SessionRef): Schedule {
  const next = clone(schedule);
  const found = findDay(next, ref.date);
  if (!found || !found.day.sessions[ref.index]) return schedule;
  found.day.sessions.splice(ref.index, 1);
  return rebuildFlat(next);
}

/**
 * The flat `sessions` array is a derived mirror used for validation counts, so
 * keep it in sync with the week/day tree after every edit.
 */
function rebuildFlat(schedule: Schedule): Schedule {
  const sessions: Array<Record<string, unknown>> = [];
  for (const week of schedule.weeks ?? []) {
    for (const day of week.days ?? []) {
      for (const session of day.sessions ?? []) {
        sessions.push({
          week: week.week,
          date: day.date,
          weekday: day.weekday,
          periods: periodRangeLabel(session),
          course: session.course,
          location: session.location
        });
      }
    }
  }
  return { ...schedule, sessions };
}

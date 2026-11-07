import { useMemo } from "react";
import type { Schedule, Settings } from "../types";
import {
  findCurrentWeekIndex,
  isoDate,
  sortedWeeks,
  visibleDays,
  weekDays,
  weekFinished
} from "../scheduleUtils";
import { buildWeekGrid } from "../periodGrid";

export interface WeekModelOptions {
  settings: Settings | null;
  schedule: Schedule | null;
  now: Date;
  weekOffset: number;
  dayOffset: number;
  viewDate: string | null;
  /** Edit mode keeps every period row so drop targets never shift. */
  editing: boolean;
}

export function useWeekModel({
  settings,
  schedule,
  now,
  weekOffset,
  dayOffset,
  viewDate,
  editing
}: WeekModelOptions) {
  return useMemo(() => {
    if (!settings) return null;
    const weeks = sortedWeeks(schedule);
    const baseIndex = findCurrentWeekIndex(schedule, now);
    const index = weeks.length
      ? Math.min(Math.max(baseIndex + weekOffset, 0), weeks.length - 1)
      : -1;
    const week = index >= 0 ? weeks[index] : null;
    const isCurrent = index === baseIndex;
    const all = weekDays(week);
    const mode = settings.daysMode;
    const singleDay = Boolean(viewDate) || mode === "today";

    let windowSize: number;
    if (singleDay) windowSize = 1;
    else if (mode === "5") windowSize = 5;
    else if (mode === "7") windowSize = 7;
    else windowSize = visibleDays(week, settings, now).length || 5;

    const maxOffset = Math.max(0, all.length - windowSize);
    const today = isoDate(now);
    const offset = viewDate
      ? Math.max(0, all.findIndex((day) => day.date === viewDate))
      : singleDay
        ? Math.max(0, all.findIndex((day) => day.date === today))
        : Math.min(Math.max(dayOffset, 0), maxOffset);

    const grid = buildWeekGrid(all, settings, editing);
    const days = all.slice(offset, offset + windowSize);

    return {
      weeks,
      week,
      index,
      baseIndex,
      total: weeks.length,
      isCurrent,
      all,
      days,
      columns: days.length,
      rows: grid.rows,
      template: grid.template,
      gridDays: grid.days.slice(offset, offset + windowSize),
      finished: isCurrent && weekFinished(week, settings, now),
      singleDay,
      scrollable: !singleDay && mode === "5" && maxOffset > 0,
      maxOffset,
      offset
    };
  }, [settings, schedule, now, weekOffset, dayOffset, viewDate, editing]);
}

export type WeekModel = NonNullable<ReturnType<typeof useWeekModel>>;

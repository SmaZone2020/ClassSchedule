import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { AppData, Schedule, Session, Settings, WallpaperInfo, WidgetRect } from "../types";
import { baseSize, mergeSettings, shadowPad } from "../settingsDefaults";
import { courseColor, courseVars } from "../courseColor";
import {
  addDays,
  currentPeriod,
  findCurrentWeekIndex,
  isoDate,
  periodRangeLabel,
  sessionEnded,
  sessionRange,
  sessionStartLabel,
  sortedWeeks,
  visibleDays,
  weekDays,
  weekFinished,
  weekHasSessions
} from "../scheduleUtils";
import LiquidGlassPanel from "./LiquidGlassPanel";
import CourseDetail, { detailAnchor, type DetailAnchor } from "./CourseDetail";
import WallpaperLayer, { resolveMonitor } from "./WallpaperLayer";
import { applyTheme } from "./theme";
import { buildWeekGrid } from "../periodGrid";

export default function Widget() {
  const [data, setData] = useState<AppData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [wallpaper, setWallpaper] = useState<WallpaperInfo | null>(null);
  const [rect, setRect] = useState<WidgetRect | null>(null);
  const [animRect, setAnimRect] = useState<WidgetRect | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [viewDate, setViewDate] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [detail, setDetail] = useState<
    { session: Session; weekday: string; date: string; anchor: DetailAnchor } | null
  >(null);
  const [now, setNow] = useState(() => new Date());
  const dataRef = useRef<AppData | null>(null);
  const viewRef = useRef<HTMLDivElement | null>(null);
  const wheelAt = useRef(0);
  const goDayRef = useRef<(delta: 1 | -1) => void>(() => {});

  useEffect(() => {
    let alive = true;
    const disposers: Array<() => void> = [];

    invoke<AppData>("get_app_data")
      .then((next) => {
        if (!alive) return;
        dataRef.current = next;
        setData(next);
        setSettings(mergeSettings(next.settings));
        setSchedule(next.schedule);
        setWallpaper(next.wallpaper);
        setRect(next.rect);
      })
      .catch(() => {
        if (alive) setSettings(mergeSettings({}));
      });

    listen<Settings>("settings-changed", (event) => {
      const next = mergeSettings(event.payload);
      const previous = dataRef.current?.settings;
      setSettings(next);
      if (
        previous &&
        (next.wallpaper.mode !== previous.wallpaper.mode ||
          next.wallpaper.customPath !== previous.wallpaper.customPath)
      ) {
        invoke<WallpaperInfo>("get_wallpaper").then(setWallpaper).catch(() => {});
      }
      if (dataRef.current) {
        dataRef.current = { ...dataRef.current, settings: next };
      }
    }).then((fn) => disposers.push(fn));

    listen<Schedule | null>("schedule-changed", (event) => {
      setSchedule(event.payload ?? null);
      setWeekOffset(0);
      setDayOffset(0);
      setViewDate(null);
    }).then((fn) => disposers.push(fn));

    listen<WallpaperInfo>("wallpaper-changed", (event) => {
      setWallpaper(event.payload);
    }).then((fn) => disposers.push(fn));

    listen<WidgetRect>("layout-changed", (event) => {
      setRect(event.payload);
      setAnimRect(null);
    }).then((fn) => disposers.push(fn));

    listen<WidgetRect>("layout-animating", (event) => {
      setAnimRect(event.payload);
    }).then((fn) => disposers.push(fn));

    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
      disposers.forEach((fn) => fn());
    };
  }, []);

  useEffect(() => {
    if (settings) applyTheme(settings.theme);
  }, [settings?.theme]);

  // Week switching, day focus and details need the mouse; reset when click-through is on.
  useEffect(() => {
    if (settings?.clickThrough) {
      setWeekOffset(0);
      setDayOffset(0);
      setViewDate(null);
      setDetail(null);
    }
  }, [settings?.clickThrough]);

  const model = useMemo(() => {
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

    // How many day columns the window shows at once. "5" can be scrolled
    // sideways through the rest of the week with the wheel.
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

    // Build the grid from the whole week so the period rail stays put while the
    // day window scrolls; only the day columns are sliced.
    const grid = buildWeekGrid(all, settings);
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
  }, [settings, schedule, now, weekOffset, dayOffset, viewDate]);

  const columns = model?.columns ?? 7;
  const isEmpty =
    !model ||
    model.finished ||
    !model.week ||
    !weekHasSessions(model.week);

  // An empty or finished week collapses to the single-day footprint instead of
  // keeping a full 5/7 column window around a short message.
  const displayColumns = isEmpty ? 1 : columns;

  // Keep the native window sized to the rendered column count.
  useEffect(() => {
    invoke("set_layout_columns", { columns: displayColumns }).catch(() => {});
  }, [displayColumns]);

  // Switching display mode drops any explicit day focus.
  useEffect(() => {
    setViewDate(null);
    setDayOffset(0);
  }, [settings?.daysMode]);

  /**
   * Step one day at a time, crossing week boundaries when needed. Used by the
   * header arrows and the wheel while a single day is on screen.
   */
  const goDay = (delta: 1 | -1) => {
    if (!settings || !model) return;
    const base =
      viewDate ??
      (settings.daysMode === "today" ? model.all[model.offset]?.date ?? null : null);
    if (!base) return;

    const target = addDays(base, delta);
    const weeks = model.weeks;
    if (!weeks.length) return;

    let targetIndex = weeks.findIndex(
      (week) => target >= week.startDate && target <= addDays(week.startDate, 6)
    );
    if (targetIndex < 0) {
      if (delta > 0) {
        targetIndex = weeks.findIndex((week) => week.startDate > target);
      } else {
        for (let i = weeks.length - 1; i >= 0; i -= 1) {
          if (addDays(weeks[i].startDate, 6) < target) {
            targetIndex = i;
            break;
          }
        }
      }
    }
    if (targetIndex < 0) return;

    const week = weeks[targetIndex];
    const start = week.startDate;
    const end = addDays(start, 6);
    const nextDate = target < start ? start : target > end ? end : target;

    setDirection(delta);
    setWeekOffset(targetIndex - model.baseIndex);
    setViewDate(nextDate);
  };
  goDayRef.current = goDay;

  const scrollable = Boolean(model?.scrollable) && !settings?.clickThrough;
  const singleDay = Boolean(model?.singleDay) && !settings?.clickThrough;
  const maxOffset = model?.maxOffset ?? 0;

  // Wheel steps through days in single-day view and slides the 5-day window.
  useEffect(() => {
    const element = viewRef.current;
    if (!element || (!scrollable && !singleDay)) return;

    const onWheel = (event: WheelEvent) => {
      const raw =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (Math.abs(raw) < 1) return;
      event.preventDefault();

      const stamp = Date.now();
      if (stamp - wheelAt.current < 220) return;
      wheelAt.current = stamp;

      const sign: 1 | -1 = raw > 0 ? 1 : -1;
      if (singleDay) {
        goDayRef.current(sign);
        return;
      }
      setDirection(sign);
      setDayOffset((value) => Math.min(Math.max(value + sign, 0), maxOffset));
    };

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [scrollable, singleDay, maxOffset]);

  if (!settings || !model) return null;

  const today = isoDate(now);
  const activePeriod = currentPeriod(settings, now);
  const courses = schedule?.courses;
  const accent = settings.accent;
  const monitor = data ? resolveMonitor(data.monitors, settings) : null;
  const pad = shadowPad(settings.panel.shadowSize);
  // While the native window tweens, follow the animating rect so the panel
  // grows/shrinks with it instead of snapping to the final footprint.
  const scale = Math.max(settings.scale, 0.1);
  const size = animRect
    ? { width: animRect.width / scale, height: animRect.height / scale }
    : baseSize(displayColumns, settings.panel.shadowSize);
  const liveRect = animRect ?? rect;
  const hasWallpaper = Boolean(wallpaper?.dataUrl && monitor && liveRect);
  const canInteract = !settings.clickThrough;
  const canSwitchWeek = canInteract && model.total > 1;
  const singleView = model.singleDay;
  const singleDayLabel = model.all[model.offset]?.weekday ?? "课表";

  // In today-only mode the visible day is fixed by the mode, so header clicks
  // would be a no-op; keep them disabled there.
  const canClickDay = canInteract && settings.daysMode !== "today";

  // The day heading doubles as the way back to the full week.
  const returnHead = singleView && Boolean(viewDate) && canInteract;

  const goWeek = (delta: 1 | -1) => {
    setDirection(delta);
    setDayOffset(0);
    setWeekOffset((value) => value + delta);
  };

  const periodTime = (index: number) => {
    const item = settings.periods.find((period) => period.index === index);
    return item ? `${item.start}` : "";
  };

  const panel = (
    <div
      ref={viewRef}
      className="schedule-panel"
      style={
        {
          "--panel-radius": `${settings.panel.radius}px`,
          "--panel-tint-alpha": hasWallpaper
            ? settings.panel.opacity * 0.5
            : settings.panel.opacity,
          "--panel-gap": `${settings.panel.gap}px`,
          "--shadow-alpha": Math.max(0, Math.min(1, settings.panel.shadow)) * 0.46,
          "--shadow-size": `${settings.panel.shadowSize}px`,
          "--accent": accent
        } as React.CSSProperties
      }
    >
      {settings.panel.showHeader && (
        <div className="schedule-header">
          {canInteract && (singleView || canSwitchWeek) ? (
            <div className="week-switch">
              <button
                className="week-nav"
                onClick={() => (singleView ? goDay(-1) : goWeek(-1))}
                disabled={!singleView && model.index <= 0}
                aria-label={singleView ? "前一天" : "上一周"}
              >
                ‹
              </button>
              <span className="schedule-title">
                {singleView
                  ? singleDayLabel
                  : model.week
                    ? `第 ${model.week.week} 周`
                    : (schedule?.meta?.semester ?? "课表")}
              </span>
              <button
                className="week-nav"
                onClick={() => (singleView ? goDay(1) : goWeek(1))}
                disabled={!singleView && model.index >= model.total - 1}
                aria-label={singleView ? "后一天" : "下一周"}
              >
                ›
              </button>
            </div>
          ) : (
            <span className="schedule-title">
              {singleView
                ? singleDayLabel
                : model.week
                  ? `第 ${model.week.week} 周`
                  : (schedule?.meta?.semester ?? "课表")}
            </span>
          )}
        </div>
      )}

      {model.finished ? (
        <div className="week-break" key={`done-${model.index}`}>
          <strong>本周课程已全部结束</strong>
          <span>好好休息，下周再见</span>
        </div>
      ) : !model.week || !weekHasSessions(model.week) ? (
        <div className="week-break" key="empty">
          <strong>暂无课表数据</strong>
          <span>托盘右键 → 设置 → 导入课表</span>
        </div>
      ) : (
        <div
          className={`week-view ${direction > 0 ? "from-right" : "from-left"}${
            model.scrollable || singleView ? " quick" : ""
          }`}
          key={`week-${model.index}-${model.offset}-${viewDate ?? ""}`}
        >
          <div className="timetable">
            <div className="period-rail">
              <div className="day-head spacer" />
              <div
                className="period-rail-rows"
                style={{ gridTemplateRows: model.template }}
              >
                {model.rows.map((row, index) =>
                  row.period === null ? (
                    <div className="period-gap" key={`gap-${index}`} />
                  ) : (
                    <div className="period-cell" key={`p-${row.period}`}>
                      <span className="period-index">{row.period}</span>
                      {settings.panel.showPeriodTime && (
                        <span className="period-time">{periodTime(row.period)}</span>
                      )}
                    </div>
                  )
                )}
              </div>
            </div>

            <div
              className={`schedule-days${columns === 1 ? " single" : ""}`}
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
            >
              {model.gridDays.map(({ day, cards, loose }, dayIndex) => {
                const isToday = day.date === today;
                return (
                  <div
                    className="schedule-day"
                    key={day.date}
                    style={{ "--day-index": dayIndex } as React.CSSProperties}
                  >
                    <div
                      className={`day-head${isToday ? " today" : ""}${
                        canClickDay ? " clickable" : ""
                      }${returnHead ? " back" : ""}`}
                      onClick={
                        canClickDay
                          ? () => {
                              if (returnHead) {
                                setViewDate(null);
                                return;
                              }
                              setViewDate((value) =>
                                value === day.date ? null : day.date
                              );
                            }
                          : undefined
                      }
                    >
                      {returnHead ? (
                        <span className="day-back">返回</span>
                      ) : (
                        <span>{day.weekday}</span>
                      )}
                      {isToday && <span className="today-dot" />}
                    </div>
                    <div
                      className="day-grid"
                      style={{ gridTemplateRows: model.template }}
                    >
                      {cards.length === 0 && loose.length === 0 && (
                        <div className="empty-day" style={{ gridRow: "1 / -1" }}>
                          无课
                        </div>
                      )}
                      {cards.map((card) => {
                        const { session, index } = card;
                        const color = courseColor(session.course, courses, accent);
                        const range = sessionRange(session);
                        const isCurrent =
                          isToday && activePeriod !== null && range?.start === activePeriod;
                        const isOver = isToday && sessionEnded(session, settings, now);
                        const startLabel = sessionStartLabel(session, settings);
                        const title =
                          settings.panel.titleMode === "short"
                            ? session.courseShort || session.course
                            : session.course;
                        const clickable = !settings.clickThrough;
                        return (
                          <div
                            key={`${day.date}-${index}`}
                            className={`course-card${isOver ? " finished" : ""}${
                              isCurrent ? " current" : ""
                            }${clickable ? " clickable" : ""}`}
                            style={
                              {
                                ...courseVars(color),
                                gridRow: `${card.start + 1} / span ${card.span}`,
                                "--card-index": dayIndex * 2 + index
                              } as React.CSSProperties
                            }
                            onClick={
                              clickable
                                ? (event) =>
                                    setDetail({
                                      session,
                                      weekday: day.weekday,
                                      date: day.date,
                                      anchor: detailAnchor(
                                        event.currentTarget,
                                        session,
                                        courses,
                                        accent,
                                        settings.scale,
                                        settings.panel.radius
                                      )
                                    })
                                : undefined
                            }
                          >
                            <div className="course-name">{title}</div>
                            {settings.panel.showLocation && session.location && (
                              <div className="course-meta">{session.location}</div>
                            )}
                            {settings.panel.showPeriodTime && (
                              <div className="course-time">
                                {periodRangeLabel(session)}
                                {startLabel ? ` · ${startLabel}` : ""}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {loose.map(({ session, index }) => {
                        const color = courseColor(session.course, courses, accent);
                        const title =
                          settings.panel.titleMode === "short"
                            ? session.courseShort || session.course
                            : session.course;
                        return (
                          <div
                            key={`loose-${index}`}
                            className="course-card loose"
                            style={{ ...courseVars(color) } as React.CSSProperties}
                          >
                            <div className="course-name">{title}</div>
                            {settings.panel.showLocation && session.location && (
                              <div className="course-meta">{session.location}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {wallpaper?.dataUrl && monitor && liveRect && (
        <WallpaperLayer
          wallpaper={wallpaper}
          settings={settings}
          monitor={monitor}
          rect={liveRect}
        />
      )}
      <div
        className="schedule-root"
        style={
          {
            "--scale": settings.scale,
            width: `${size.width}px`,
            height: `${size.height}px`
          } as React.CSSProperties
        }
      >
        <div className="schedule-stage" style={{ padding: pad }}>
          {settings.style === "liquid" ? (
            <LiquidGlassPanel radius={settings.panel.radius} blur={settings.panel.blur}>
              {panel}
            </LiquidGlassPanel>
          ) : (
            <div
              className={`panel-shell${hasWallpaper ? " has-wallpaper" : ""}`}
              style={{ borderRadius: settings.panel.radius }}
            >
              {panel}
            </div>
          )}
        </div>
        {settings.css.enabled && (
          <style>{`
.schedule-panel { ${settings.css.container} }
.course-card { ${settings.css.course} }
`}</style>
        )}
      </div>
      {detail && (
        <CourseDetail
          session={detail.session}
          settings={settings}
          weekday={detail.weekday}
          dateLabel={detail.date}
          anchor={detail.anchor}
          onClose={() => setDetail(null)}
        />
      )}
    </>
  );
}

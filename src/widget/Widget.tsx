import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type {
  AppData,
  Schedule,
  Settings,
  WallpaperInfo,
  WidgetRect
} from "../types";
import { baseSize, mergeSettings } from "../settingsDefaults";
import { courseColor, courseVars } from "../courseColor";
import {
  currentPeriod,
  findCurrentWeekIndex,
  isoDate,
  periodRangeLabel,
  sessionEnded,
  sessionRange,
  sessionStartLabel,
  sortedWeeks,
  visibleDays,
  weekFinished,
  weekHasSessions
} from "../scheduleUtils";
import LiquidGlassPanel from "./LiquidGlassPanel";
import WallpaperLayer, { resolveMonitor } from "./WallpaperLayer";
import { applyTheme } from "./theme";

export default function Widget() {
  const [data, setData] = useState<AppData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [wallpaper, setWallpaper] = useState<WallpaperInfo | null>(null);
  const [rect, setRect] = useState<WidgetRect | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const dataRef = useRef<AppData | null>(null);

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
    }).then((fn) => disposers.push(fn));

    listen<WallpaperInfo>("wallpaper-changed", (event) => {
      setWallpaper(event.payload);
    }).then((fn) => disposers.push(fn));

    listen<WidgetRect>("layout-changed", (event) => {
      setRect(event.payload);
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

  // Week switching is only available while the widget accepts the mouse.
  useEffect(() => {
    if (settings?.clickThrough) setWeekOffset(0);
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
    const days = visibleDays(week, settings, now);
    return {
      week,
      index,
      baseIndex,
      total: weeks.length,
      isCurrent,
      days,
      columns: days.length,
      finished: isCurrent && weekFinished(week, settings, now)
    };
  }, [settings, schedule, now, weekOffset]);

  const columns = model?.columns ?? 7;

  // Keep the native window sized to the rendered column count.
  useEffect(() => {
    invoke("set_layout_columns", { columns }).catch(() => {});
  }, [columns]);

  if (!settings || !model) return null;

  const today = isoDate(now);
  const activePeriod = currentPeriod(settings, now);
  const courses = schedule?.courses;
  const accent = settings.accent;
  const monitor = data ? resolveMonitor(data.monitors, settings) : null;
  const size = baseSize(columns);
  const hasWallpaper = Boolean(wallpaper?.dataUrl && monitor && rect);
  const canSwitchWeek = !settings.clickThrough && model.total > 1;

  const panel = (
    <div
      className="schedule-panel"
      style={
        {
          "--panel-radius": `${settings.panel.radius}px`,
          "--panel-tint-alpha": hasWallpaper
            ? settings.panel.opacity * 0.5
            : settings.panel.opacity,
          "--panel-gap": `${settings.panel.gap}px`,
          "--accent": accent
        } as React.CSSProperties
      }
    >
      {settings.panel.showHeader && (
        <div className="schedule-header">
          {canSwitchWeek ? (
            <button
              className="week-nav"
              onClick={() => setWeekOffset((value) => value - 1)}
              disabled={model.index <= 0}
              aria-label="上一周"
            >
              ‹
            </button>
          ) : null}
          <span className="schedule-title">
            {model.week
              ? `第 ${model.week.week} 周`
              : (schedule?.meta?.semester ?? "课表")}
          </span>
          {canSwitchWeek ? (
            <button
              className="week-nav"
              onClick={() => setWeekOffset((value) => value + 1)}
              disabled={model.index >= model.total - 1}
              aria-label="下一周"
            >
              ›
            </button>
          ) : null}
          <span className="schedule-week">
            {model.isCurrent ? "本周" : "非本周"}
          </span>
        </div>
      )}

      {model.finished ? (
        <div className="week-break">
          <strong>本周课程已全部结束</strong>
          <span>好好休息，下周再见</span>
        </div>
      ) : !model.week || !weekHasSessions(model.week) ? (
        <div className="week-break">
          <strong>暂无课表数据</strong>
          <span>托盘右键 → 设置 → 导入课表</span>
        </div>
      ) : (
        <div
          className={`schedule-days${columns === 1 ? " single" : ""}`}
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {model.days.map((day) => {
            const isToday = day.date === today;
            return (
              <div className="schedule-day" key={day.date}>
                <div className={`day-head${isToday ? " today" : ""}`}>
                  {day.weekday}
                  {isToday ? " 今天" : ""}
                </div>
                <div className="day-courses">
                  {day.sessions.length === 0 ? (
                    <div className="empty-day">无课</div>
                  ) : (
                    day.sessions.map((session, index) => {
                      const color = courseColor(session.course, courses, accent);
                      const range = sessionRange(session);
                      const isCurrent =
                        isToday && activePeriod !== null && range?.start === activePeriod;
                      const isOver = isToday && sessionEnded(session, settings, now);
                      const startLabel = sessionStartLabel(session, settings);
                      return (
                        <div
                          key={`${day.date}-${index}`}
                          className={`course-card${isOver ? " finished" : ""}${
                            isCurrent ? " current" : ""
                          }`}
                          style={courseVars(color)}
                        >
                          <div className="course-name">
                            {session.courseShort || session.course}
                          </div>
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
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return (
    <>
      {wallpaper?.dataUrl && monitor && rect && (
        <WallpaperLayer
          wallpaper={wallpaper}
          settings={settings}
          monitor={monitor}
          rect={rect}
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
        {settings.css.enabled && (
          <style>{`
.schedule-panel { ${settings.css.container} }
.course-card { ${settings.css.course} }
`}</style>
        )}
      </div>
    </>
  );
}

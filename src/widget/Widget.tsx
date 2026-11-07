import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Schedule, Settings } from "../types";
import { mergeSettings } from "../settingsDefaults";
import { courseColor, colorStyle } from "../courseColor";
import {
  currentPeriod,
  findCurrentWeek,
  parseTime,
  periodRangeLabel,
  sessionStartLabel,
  visibleDays,
  weekHasSessions
} from "../scheduleUtils";
import LiquidGlassPanel from "./LiquidGlassPanel";

export default function Widget() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    invoke<{ settings: unknown; schedule: Schedule | null }>("get_app_data")
      .then((data) => {
        setSettings(mergeSettings(data.settings));
        setSchedule(data.schedule);
      })
      .catch(() => setSettings(mergeSettings({})));

    const unlisten = import("@tauri-apps/api/event").then(({ listen }) =>
      listen<Settings>("settings-changed", (event) => {
        setSettings(mergeSettings(event.payload));
      })
    );

    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => {
      window.clearInterval(timer);
      unlisten.then((fn) => fn());
    };
  }, []);

  const model = useMemo(() => {
    if (!settings) return null;
    const { week, isBreak } = findCurrentWeek(schedule);
    const days = visibleDays(week, settings);
    const finishedAll = week !== null && !weekHasSessions(week);
    return { week, isBreak, days, finishedAll };
  }, [settings, schedule]);

  if (!settings || !model) return null;

  const today = todayLabel();
  const currentPeriodIndex = currentPeriod(settings, now);
  const courses = schedule?.courses;

  const panel = (
    <div
      className="schedule-panel"
      style={
        {
          "--panel-radius": `${settings.panel.radius}px`,
          "--panel-opacity": settings.panel.opacity,
          "--panel-blur": `${settings.panel.blur}px`,
          "--panel-gap": `${settings.panel.gap}px`,
          "--accent": settings.accent
        } as React.CSSProperties
      }
    >
      {settings.panel.showHeader && (
        <div className="schedule-header">
          <span className="schedule-title">{schedule?.meta?.semester ?? "课表"}</span>
          <span className="schedule-week">
            {model.week ? `第 ${model.week.week} 周` : "暂无课表"}
            {model.isBreak ? " · 非本周" : ""}
          </span>
        </div>
      )}

      {model.finishedAll ? (
        <div className="week-break">
          <strong>本周课程已全部结束 🎉</strong>
          <span>好好休息，下周再见</span>
        </div>
      ) : model.days.length === 0 ? (
        <div className="week-break">
          <strong>暂无课表数据</strong>
          <span>右键托盘图标 → 设置 → 导入课表</span>
        </div>
      ) : (
        <div
          className="schedule-days"
          style={{ gridTemplateColumns: `repeat(${model.days.length}, minmax(0, 1fr))` }}
        >
          {model.days.map((day) => {
            const isToday = day.date === today;
            return (
              <div className="schedule-day" key={day.date}>
                <div className={`day-head${isToday ? " today" : ""}`}>
                  {day.weekday}
                  {isToday ? " · 今天" : ""}
                </div>
                <div className="day-courses">
                  {day.sessions.length === 0 ? (
                    <div className="empty-day">无课</div>
                  ) : (
                    day.sessions.map((session, index) => {
                      const color = courseColor(session.course, courses, settings.accent);
                      const period = normalizePeriod(session);
                      const isCurrent =
                        isToday &&
                        currentPeriodIndex !== null &&
                        period?.start === currentPeriodIndex;
                      const finished =
                        isToday && dayIsFinishedSession(session, settings, now);
                      const startLabel = sessionStartLabel(session, settings);
                      return (
                        <div
                          key={index}
                          className={`course-card${finished ? " finished" : ""}${
                            isCurrent ? " current" : ""
                          }`}
                          style={colorStyle(color)}
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
    <div
      className="schedule-root"
      style={{ "--scale": settings.scale } as React.CSSProperties}
    >
      {settings.style === "liquid" ? (
        <LiquidGlassPanel radius={settings.panel.radius}>{panel}</LiquidGlassPanel>
      ) : (
        panel
      )}
      {settings.css.enabled && <ScopedCss css={settings.css} />}
    </div>
  );
}

function ScopedCss({ css }: { css: { container: string; course: string } }) {
  const text = useMemo(
    () => `
.schedule-panel { ${css.container} }
.course-card { ${css.course} }
`,
    [css.container, css.course]
  );
  return <style>{text}</style>;
}

function todayLabel(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function normalizePeriod(session: { periods: unknown }): { start: number; end: number } | null {
  const raw = session.periods;
  if (typeof raw === "string") return null;
  if (raw && typeof raw === "object" && "start" in raw) {
    return raw as { start: number; end: number };
  }
  return null;
}

function dayIsFinishedSession(
  session: { periods: unknown },
  settings: Settings,
  now: Date
): boolean {
  let endIndex: number | null = null;
  const raw = session.periods;
  if (typeof raw === "string") {
    const matches = [...raw.matchAll(/(\d+)/g)];
    endIndex = matches.length ? Number(matches[matches.length - 1][1]) : null;
  } else if (raw && typeof raw === "object" && "end" in raw) {
    endIndex = Number((raw as { end: number }).end);
  }
  if (endIndex === null) return false;
  const period = settings.periods.find((item) => item.index === endIndex);
  if (!period) return false;
  const endMinutes = parseTime(period.end);
  if (endMinutes === null) return false;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return nowMinutes > endMinutes;
}

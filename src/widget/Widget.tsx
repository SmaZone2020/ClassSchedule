import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Schedule, Settings } from "../types";
import { baseSize, shadowPad } from "../settingsDefaults";
import {
  addDays,
  currentPeriod,
  isoDate
} from "../scheduleUtils";
import LiquidGlassPanel from "./LiquidGlassPanel";
import CourseDetail, { detailAnchor, type DetailAnchor } from "./CourseDetail";
import WallpaperLayer, { resolveMonitor } from "./WallpaperLayer";
import { applyTheme } from "./theme";
import { applyAppFont } from "../font";
import WidgetHeader from "./WidgetHeader";
import Timetable from "./Timetable";
import CourseEditor from "./CourseEditor";
import { useWidgetData } from "./useWidgetData";
import { useWeekModel, isEmptyWeek } from "./useWeekModel";
import { useScheduleEditor } from "./useScheduleEditor";
import type { Slot } from "./DayColumn";

export default function Widget() {
  const { settings, schedule, setSchedule, wallpaper, rect, animRect, monitors, now } =
    useWidgetData();
  const [weekOffset, setWeekOffset] = useState(0);
  const [dayOffset, setDayOffset] = useState(0);
  const [viewDate, setViewDate] = useState<string | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [editing, setEditing] = useState(false);
  const [detail, setDetail] = useState<
    { session: Parameters<typeof detailAnchor>[1]; weekday: string; date: string; anchor: DetailAnchor } | null
  >(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const wheelAt = useRef(0);
  const goDayRef = useRef<(delta: 1 | -1) => void>(() => {});

  useEffect(() => {
    if (settings) applyTheme(settings.theme);
  }, [settings?.theme]);

  useEffect(() => {
    applyAppFont(settings?.font);
  }, [settings?.font]);

  useEffect(() => {
    if (!settings?.clickThrough) return;
    setWeekOffset(0);
    setDayOffset(0);
    setViewDate(null);
    setDetail(null);
    setEditing(false);
  }, [settings?.clickThrough]);

  const model = useWeekModel({
    settings,
    schedule,
    now,
    weekOffset,
    dayOffset,
    viewDate,
    editing
  });

  const empty = isEmptyWeek(model);
  const displayColumns = empty ? 1 : (model?.columns ?? 7);

  useEffect(() => {
    invoke("set_layout_columns", { columns: displayColumns }).catch(() => {});
  }, [displayColumns]);

  useEffect(() => {
    setViewDate(null);
    setDayOffset(0);
  }, [settings?.daysMode]);

  const commit = (next: Schedule) => {
    setSchedule(next);
    invoke("save_schedule", { schedule: next }).catch(() => {});
  };

  const editor = useScheduleEditor({
    schedule,
    commit,
    rows: model?.rows ?? []
  });

  // A desktop-pinned widget is `WS_EX_NOACTIVATE`: the form inside it would take
  // DOM focus but never see a keystroke. Lift the flag while editing (Esc, text
  // fields) and hand the desktop-pin behaviour back when edit mode ends.
  const needsKeyboard = editing || Boolean(editor.editor);
  useEffect(() => {
    invoke("set_widget_editable", { editable: needsKeyboard }).catch(() => {});
    return () => {
      if (needsKeyboard) invoke("set_widget_editable", { editable: false }).catch(() => {});
    };
  }, [needsKeyboard]);
  const goDay = (delta: 1 | -1) => {
    if (!settings || !model) return;
    const base =
      viewDate ??
      (settings.daysMode === "today" ? (model.all[model.offset]?.date ?? null) : null);
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

  const scrollable = Boolean(model?.scrollable) && !settings?.clickThrough && !editing;
  const singleDay = Boolean(model?.singleDay) && !settings?.clickThrough && !editing;
  const maxOffset = model?.maxOffset ?? 0;

  useEffect(() => {
    const element = panelRef.current;
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
  const accent = settings.accent;
  const monitor = resolveMonitor(monitors, settings);
  const pad = shadowPad(settings.panel.shadowSize);
  const scale = Math.max(settings.scale, 0.1);
  const size = animRect
    ? { width: animRect.width / scale, height: animRect.height / scale }
    : baseSize(displayColumns, settings.panel.shadowSize);
  const liveRect = animRect ?? rect;
  const hasWallpaper = Boolean(wallpaper?.dataUrl && monitor && liveRect);
  const canInteract = !settings.clickThrough;
  const canSwitchWeek = canInteract && model.total > 1;
  const canClickDay = canInteract && settings.daysMode !== "today";
  const returnHead = model.singleDay && Boolean(viewDate) && canInteract;

  const goWeek = (delta: 1 | -1) => {
    setDirection(delta);
    setDayOffset(0);
    setWeekOffset((value) => value + delta);
  };

  const toggleEditing = () => {
    setEditing((value) => !value);
    editor.closeEditor();
    setDetail(null);
  };

  const openEditorAt = (ref: { date: string; index: number }) => {
    const weekday = model.all.find((day) => day.date === ref.date)?.weekday ?? "";
    editor.openSession(ref, weekday);
  };

  const openSlotAt = (slot: Slot) => {
    const weekday = model.all.find((day) => day.date === slot.date)?.weekday ?? "";
    editor.openSlot(slot, weekday);
  };

  const bounds = () => panelRef.current?.getBoundingClientRect() ?? new DOMRect();

  const panel = (
    <div
      ref={panelRef}
      className={`schedule-panel${editing ? " editing" : ""}`}
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
        <WidgetHeader
          settings={settings}
          model={model}
          scheduleLabel={schedule?.meta?.semester ?? "课表"}
          canInteract={canInteract}
          canSwitchWeek={canSwitchWeek}
          editing={editing}
          onPrev={() => (model.singleDay ? goDay(-1) : goWeek(-1))}
          onNext={() => (model.singleDay ? goDay(1) : goWeek(1))}
          onToggleEdit={toggleEditing}
        />
      )}

      <Timetable
        settings={settings}
        model={model}
        schedule={schedule}
        accent={accent}
        now={now}
        today={today}
        activePeriod={activePeriod}
        direction={direction}
        viewDate={viewDate}
        editing={editing}
        canClickDay={canClickDay}
        returnHead={returnHead}
        dragPreview={editor.dragPreview}
        dragRef={editor.dragRef}
        onDayHead={(date) => {
          if (returnHead) {
            setViewDate(null);
            return;
          }
          setViewDate((value) => (value === date ? null : date));
        }}
        onOpenDetail={(session, weekday, date, element) =>
          setDetail({
            session,
            weekday,
            date,
            anchor: detailAnchor(
              element,
              session,
              schedule?.courses,
              accent,
              settings.scale,
              settings.panel.radius
            )
          })
        }
        onOpenEditor={openEditorAt}
        onDelete={editor.remove}
        onResize={editor.resize}
        onDragStart={editor.beginDrag}
        onCreateAt={openSlotAt}
      />
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

      {editor.editor && (
        <CourseEditor
          session={
            editor.editor.ref ? findEditorSession(schedule, editor.editor.ref) : null
          }
          settings={settings}
          weekday={editor.editor.weekday}
          date={editor.editor.date}
          bounds={bounds()}
          radius={settings.panel.radius * settings.scale}
          onSave={editor.save}
          onDelete={
            editor.editor.ref ? () => editor.remove(editor.editor!.ref!) : undefined
          }
          onClose={editor.closeEditor}
        />
      )}

      {editor.dragGhost && (
        <div
          className="drag-ghost"
          style={{ left: editor.dragGhost.x + 10, top: editor.dragGhost.y + 10 }}
        >
          <span className="drag-ghost-grip" />
        </div>
      )}

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

function findEditorSession(
  schedule: Schedule | null,
  ref: { date: string; index: number }
) {
  if (!schedule) return null;
  for (const week of schedule.weeks ?? []) {
    const day = week.days?.find((item) => item.date === ref.date);
    if (day) return day.sessions[ref.index] ?? null;
  }
  return null;
}

export type { Settings };

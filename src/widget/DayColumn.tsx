import { useRef, useState } from "react";
import type { CourseInfo, Session, Settings } from "../types";
import type { DayColumn as GridDay } from "../periodGrid";
import type { WeekModel } from "./useWeekModel";
import { courseColor, courseVars } from "../courseColor";
import {
  periodRangeLabel,
  sessionEnded,
  sessionRange,
  sessionStartLabel
} from "../scheduleUtils";
import { blockAt, periodAtPoint, periodBounds, rowOfPeriod, rowMetrics } from "./gridHit";
import { useElementHeight } from "./useElementHeight";
import EditCard from "./EditCard";
import type { SessionRef } from "../scheduleEdit";

export interface Slot {
  date: string;
  start: number;
  end: number;
}

interface DayColumnProps {
  column: GridDay;
  settings: Settings;
  model: WeekModel;
  courses?: CourseInfo[];
  accent: string;
  now: Date;
  today: string;
  activePeriod: number | null;
  editing: boolean;
  canClickDay: boolean;
  returnHead: boolean;
  preview: Slot | null;
  onDayHead: (date: string) => void;
  onOpenDetail: (session: Session, weekday: string, date: string, element: HTMLElement) => void;
  onOpenEditor: (ref: SessionRef) => void;
  onDelete: (ref: SessionRef) => void;
  onResize: (ref: SessionRef, end: number) => void;
  onDragStart: (ref: SessionRef, event: React.PointerEvent<HTMLElement>) => void;
  onCreateAt: (slot: Slot) => void;
  dragRef: SessionRef | null;
}

export default function DayColumn({
  column,
  settings,
  model,
  courses,
  accent,
  now,
  today,
  activePeriod,
  editing,
  canClickDay,
  returnHead,
  preview,
  onDayHead,
  onOpenDetail,
  onOpenEditor,
  onDelete,
  onResize,
  onDragStart,
  onCreateAt,
  dragRef
}: DayColumnProps) {
  const { day, cards, loose } = column;
  const gridRef = useRef<HTMLDivElement | null>(null);
  const height = useElementHeight(gridRef);
  const [hoverPeriod, setHoverPeriod] = useState<number | null>(null);
  const [selection, setSelection] = useState<{ start: number; end: number } | null>(null);
  const selecting = useRef<{ anchor: number; detach: () => void } | null>(null);

  const isToday = day.date === today;
  const metrics = rowMetrics(model.rows, height, settings.panel.gap);
  const bounds = periodBounds(model.rows);

  const previewBlock = preview
    ? blockAt(
        metrics,
        rowOfPeriod(model.rows, preview.start) ?? 0,
        (rowOfPeriod(model.rows, preview.end) ?? 0) -
          (rowOfPeriod(model.rows, preview.start) ?? 0) +
          1
      )
    : null;

  const hoverBlock =
    editing && hoverPeriod !== null && !preview && !selection
      ? blockAt(metrics, rowOfPeriod(model.rows, hoverPeriod) ?? 0, 1)
      : null;

  const handleMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!editing || dragRef) return;
    const target = event.target as HTMLElement;
    if (target.closest(".course-card")) {
      if (hoverPeriod !== null) setHoverPeriod(null);
      return;
    }
    const grid = gridRef.current;
    if (!grid) return;
    const period = periodAt(grid, model.rows, metrics, event.clientY);
    if (period !== null && period !== hoverPeriod) setHoverPeriod(period);
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
    if (settings.clickThrough) return;
    const target = event.target as HTMLElement;
    if (target.closest(".course-card")) return;
    const grid = gridRef.current;
    if (!grid) return;
    const period = periodAtPoint(grid, model.rows, event.clientY) ?? bounds.min;
    // A spacer row can map to an occupied period; only offer "add" where the
    // slot is actually free, otherwise just swallow the browser menu.
    event.preventDefault();
    if (!rangeFree(day.sessions, period, period)) return;
    onContextMenu({ kind: "slot", slot: { date: day.date, start: period, end: period } }, event);
  };

  return (
    <div
      className="schedule-day"
      data-date={day.date}
      style={{ "--day-index": model.days.findIndex((item) => item.date === day.date) } as React.CSSProperties}
    >
      <div
        className={`day-head${isToday ? " today" : ""}${canClickDay ? " clickable" : ""}${
          returnHead ? " back" : ""
        }`}
        onClick={canClickDay ? () => onDayHead(day.date) : undefined}
      >
        {returnHead ? <span className="day-back">返回</span> : <span>{day.weekday}</span>}
        {isToday && <span className="today-dot" />}
      </div>

      <div
        ref={gridRef}
        className={`day-grid${editing ? " editing" : ""}`}
        style={{ gridTemplateRows: model.template }}
        onPointerMove={handleMove}
        onPointerLeave={() => setHoverPeriod(null)}
        onContextMenu={handleContextMenu}
      >
        {cards.length === 0 && loose.length === 0 && !editing && (
          <div className="empty-day" style={{ gridRow: "1 / -1" }}>
            无课
          </div>
        )}

        {previewBlock && (
          <div
            className="drop-preview"
            style={{ top: previewBlock.top, height: previewBlock.height }}
          />
        )}

        {hoverBlock && (
          <div
            className="slot-preview"
            style={{ top: hoverBlock.top, height: hoverBlock.height }}
          />
        )}

        {cards.map((card) => {
          const { session, index } = card;
          const color = courseColor(session.course, courses, accent);
          const range = sessionRange(session);
          const title =
            settings.panel.titleMode === "short"
              ? session.courseShort || session.course
              : session.course;

          if (editing) {
            return (
              <EditCard
                key={`${day.date}-${index}`}
                session={session}
                index={index}
                date={day.date}
                color={color}
                settings={settings}
                isToday={isToday}
                activePeriod={activePeriod}
                now={now}
                rows={model.rows}
                metrics={metrics}
                dragging={dragRef?.date === day.date && dragRef?.index === index}
                onOpen={onOpenEditor}
                onDelete={onDelete}
                onResize={onResize}
                onDragStart={onDragStart}
              />
            );
          }

          const isCurrent = isToday && activePeriod !== null && range?.start === activePeriod;
          const isOver = isToday && sessionEnded(session, settings, now);
          const startLabel = sessionStartLabel(session, settings);
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
                  "--card-index": index
                } as React.CSSProperties
              }
              onClick={
                clickable
                  ? (event) => onOpenDetail(session, day.weekday, day.date, event.currentTarget)
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
              data-session-index={index}
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
}

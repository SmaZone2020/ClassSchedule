import { useRef, useState } from "react";
import type { Session, Settings } from "../types";
import { courseVars } from "../courseColor";
import {
  periodRangeLabel,
  sessionEnded,
  sessionRange,
  sessionStartLabel
} from "../scheduleUtils";
import type { GridRow } from "../periodGrid";
import { blockAt, periodAt, periodBounds, rowOfPeriod, type RowMetric } from "./gridHit";
import { Xmark } from "./icons";
import type { SessionRef } from "../scheduleEdit";

interface EditCardProps {
  session: Session;
  index: number;
  date: string;
  color: string;
  settings: Settings;
  isToday: boolean;
  activePeriod: number | null;
  now: Date;
  rows: GridRow[];
  metrics: RowMetric[];
  dragging: boolean;
  onOpen: (ref: SessionRef) => void;
  onDelete: (ref: SessionRef) => void;
  onResize: (ref: SessionRef, end: number) => void;
  onDragStart: (ref: SessionRef, event: React.PointerEvent<HTMLElement>) => void;
}

/** Absolutely positioned card so resizing animates top/height instead of snapping. */
export default function EditCard({
  session,
  index,
  date,
  color,
  settings,
  isToday,
  activePeriod,
  now,
  rows,
  metrics,
  dragging,
  onOpen,
  onDelete,
  onResize,
  onDragStart
}: EditCardProps) {
  const [hovered, setHovered] = useState(false);
  const [previewEnd, setPreviewEnd] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const range = sessionRange(session);
  const bounds = periodBounds(rows);
  const end = Math.min(previewEnd ?? range?.end ?? bounds.min, bounds.max);
  const start = range?.start ?? bounds.min;

  const startRow = rowOfPeriod(rows, start) ?? 0;
  const endRow = rowOfPeriod(rows, end) ?? startRow;
  const block = blockAt(metrics, startRow, endRow - startRow + 1);

  const title =
    settings.panel.titleMode === "short"
      ? session.courseShort || session.course
      : session.course;

  const beginResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!range) return;
    event.stopPropagation();
    event.preventDefault();
    const card = cardRef.current;
    const grid = card?.closest(".day-grid") as HTMLElement | null;
    if (!card || !grid) return;

    card.setPointerCapture(event.pointerId);
    const original = range.end;

    const onMove = (move: PointerEvent) => {
      const target = periodAt(grid, rows, metrics, move.clientY);
      if (target !== null) setPreviewEnd(Math.max(target, start));
    };

    const onUp = () => {
      card.releasePointerCapture(event.pointerId);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setPreviewEnd((value) => {
        if (value !== null && value !== original) onResize({ date, index }, value);
        return null;
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const isCurrent = isToday && activePeriod !== null && range?.start === activePeriod;
  const isOver = isToday && sessionEnded(session, settings, now);

  return (
    <div
      ref={cardRef}
      className={`course-card edit${hovered ? " hovered" : ""}${
        isOver ? " finished" : ""
      }${isCurrent ? " current" : ""}${dragging ? " dragging" : ""}`}
      style={
        {
          ...courseVars(color),
          top: block.top,
          height: block.height,
          zIndex: hovered || dragging ? 3 : 1
        } as React.CSSProperties
      }
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onPointerDown={(event) => onDragStart({ date, index }, event)}
      onClick={(event) => {
        event.stopPropagation();
        onOpen({ date, index });
      }}
    >
      <button
        className="edit-delete"
        onClick={(event) => {
          event.stopPropagation();
          onDelete({ date, index });
        }}
        aria-label="删除课程"
      >
        <Xmark width={10} height={10} />
      </button>

      <div className="course-name">{title}</div>
      {settings.panel.showLocation && session.location && (
        <div className="course-meta">{session.location}</div>
      )}
      {settings.panel.showPeriodTime && (
        <div className="course-time">
          {periodRangeLabel({ periods: { start, end } })}
          {sessionStartLabel(session, settings) ? ` · ${sessionStartLabel(session, settings)}` : ""}
        </div>
      )}

      <div
        className="edit-grip"
        onPointerDown={beginResize}
        onClick={(event) => event.stopPropagation()}
        aria-label="调整课程时长"
      >
        <span />
      </div>
    </div>
  );
}

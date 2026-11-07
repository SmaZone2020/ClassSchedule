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
import { blockAt, periodAtPoint, periodBounds, rowOfPeriod, type RowMetric } from "./gridHit";
import { Xmark } from "./icons";
import type { SessionRef } from "../scheduleEdit";
import type { MenuTarget } from "./DayColumn";

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
  /** Highest period this card may grow to before touching the next course. */
  limitEnd: number;
  dragging: boolean;
  onOpen: (ref: SessionRef) => void;
  onDelete: (ref: SessionRef) => void;
  onResize: (ref: SessionRef, end: number) => void;
  onDragStart: (ref: SessionRef, event: React.PointerEvent<HTMLElement>) => void;
  onContextMenu: (target: MenuTarget, event: React.MouseEvent) => void;
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
  onDragStart,
  onContextMenu
}: EditCardProps) {
  const [hovered, setHovered] = useState(false);
  const [previewEnd, setPreviewEnd] = useState<number | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);

  const range = sessionRange(session);
  const bounds = periodBounds(rows);
  const limit = Math.min(bounds.max, limitEnd);
  const end = Math.min(previewEnd ?? range?.end ?? bounds.min, limit);
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
    let last: number | null = null;

    const onMove = (move: PointerEvent) => {
      // Live measurement: memoised metrics lag a frame and used to teleport.
      const target = periodAtPoint(grid, rows, move.clientY);
      if (target === null) return;
      const next = Math.min(Math.max(target, start), limit);
      last = next;
      setPreviewEnd(next);
    };

    const onUp = () => {
      if (card.hasPointerCapture(event.pointerId)) {
        card.releasePointerCapture(event.pointerId);
      }
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setPreviewEnd(null);
      if (last !== null && last !== original) onResize({ date, index }, last);
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
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu({ kind: "session", ref: { date, index } }, event);
      }}
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

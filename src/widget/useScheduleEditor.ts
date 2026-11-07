import { useRef, useState } from "react";
import type { Schedule } from "../types";
import type { GridRow } from "../periodGrid";
import { sessionRange } from "../scheduleUtils";
import {
  clampResizeEnd,
  createSession,
  daySessions,
  findSession,
  moveSession,
  rangeFree,
  removeSession,
  updateSession,
  type SessionRef,
  type SessionValues
} from "../scheduleEdit";
import type { Slot } from "./DayColumn";
import { dateAt, gridAt, periodAtPoint, periodBounds } from "./gridHit";

interface DragState {
  ref: SessionRef;
  span: number;
  startX: number;
  startY: number;
  active: boolean;
  preview: Slot | null;
}

export interface EditorTarget {
  ref: SessionRef | null;
  date: string;
  weekday: string;
  slot: Slot;
}

interface Options {
  schedule: Schedule | null;
  commit: (next: Schedule) => void;
  rows: GridRow[];
}

/** All mutating schedule actions used by the widget. */
export function useScheduleEditor({ schedule, commit, rows }: Options) {
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [dragPreview, setDragPreview] = useState<Slot | null>(null);
  const [dragGhost, setDragGhost] = useState<{ x: number; y: number } | null>(null);
  const [dragRef, setDragRef] = useState<SessionRef | null>(null);
  const drag = useRef<DragState | null>(null);
  const suppressClick = useRef(false);
  const bounds = periodBounds(rows);

  const openSession = (ref: SessionRef, weekday: string) => {
    if (suppressClick.current) return;
    const range = sessionRange(findSession(schedule, ref) ?? { periods: null });
    setEditor({
      ref,
      date: ref.date,
      weekday,
      slot: { date: ref.date, start: range?.start ?? 1, end: range?.end ?? 1 }
    });
  };

  const openSlot = (slot: Slot, weekday: string) => {
    setEditor({ ref: null, date: slot.date, weekday, slot });
  };

  const closeEditor = () => setEditor(null);

  /** Returns an error message when the range collides, otherwise saves. */
  const save = (values: SessionValues): string | null => {
    if (!schedule || !editor) return "课表尚未载入";
    const ignore = editor.ref ? editor.ref.index : -1;
    const sameDay = !editor.ref || editor.ref.date === editor.date;
    if (sameDay && !rangeFree(daySessions(schedule, editor.date), values.start, values.end, ignore)) {
      return "该时间段已有课程";
    }
    const next = editor.ref
      ? updateSession(schedule, editor.ref, values)
      : createSession(schedule, editor.date, values);
    if (next === schedule) return "该时间段已有课程";
    commit(next);
    setEditor(null);
    return null;
  };

  const remove = (ref: SessionRef) => {
    if (!schedule) return;
    commit(removeSession(schedule, ref));
    setEditor(null);
  };

  const resize = (ref: SessionRef, end: number) => {
    if (!schedule) return;
    const session = findSession(schedule, ref);
    const range = sessionRange(session ?? { periods: null });
    if (!session || !range) return;
    const clamped = clampResizeEnd(
      daySessions(schedule, ref.date),
      ref.index,
      range.start,
      end,
      bounds.max
    );
    if (clamped === range.end) return;
    commit(
      updateSession(schedule, ref, {
        course: session.course,
        courseShort: session.courseShort,
        location: session.location,
        start: range.start,
        end: clamped
      })
    );
  };

  const beginDrag = (ref: SessionRef, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const session = findSession(schedule, ref);
    const range = sessionRange(session ?? { periods: null });
    if (!session || !range) return;

    drag.current = {
      ref,
      span: range.end - range.start + 1,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      preview: null
    };

    const onMove = (move: PointerEvent) => {
      const state = drag.current;
      if (!state) return;
      if (!state.active) {
        const distance =
          Math.abs(move.clientX - state.startX) + Math.abs(move.clientY - state.startY);
        if (distance < 6) return;
        state.active = true;
        suppressClick.current = true;
        setDragRef(state.ref);
        setEditor(null);
      }
      setDragGhost({ x: move.clientX, y: move.clientY });

      const date = dateAt(move.clientX, move.clientY);
      const grid = gridAt(move.clientX, move.clientY);
      if (!date || !grid) return;
      const period = periodAtPoint(grid, rows, move.clientY);
      if (period === null) return;

      const start = Math.min(
        Math.max(period, bounds.min),
        Math.max(bounds.min, bounds.max - state.span + 1)
      );
      const end = start + state.span - 1;
      // Same-day moves must ignore the dragged card, cross-day moves must not.
      const ignore =
        date === state.ref.date && schedule ? state.ref.index : -1;
      const free = !schedule || rangeFree(daySessions(schedule, date), start, end, ignore);

      if (!free) {
        state.preview = null;
        setDragPreview(null);
        return;
      }

      const preview = { date, start, end };
      state.preview = preview;
      setDragPreview(preview);
    };

    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const state = drag.current;
      drag.current = null;
      setDragGhost(null);
      setDragPreview(null);
      setDragRef(null);
      if (!state?.active || !state.preview || !schedule) {
        // A click that never turned into a drag should still open the editor.
        window.setTimeout(() => {
          suppressClick.current = false;
        }, 0);
        return;
      }
      commit(
        moveSession(
          schedule,
          state.ref,
          state.preview.date,
          state.preview.start,
          state.preview.end
        )
      );
      window.setTimeout(() => {
        suppressClick.current = false;
      }, 0);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return {
    editor,
    dragPreview,
    dragGhost,
    dragRef,
    openSession,
    openSlot,
    closeEditor,
    save,
    remove,
    resize,
    beginDrag
  };
}

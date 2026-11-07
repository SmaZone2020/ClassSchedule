import { useEffect, useState } from "react";
import type { Session, Settings } from "../types";
import { sessionRange } from "../scheduleUtils";
import type { SessionValues } from "../scheduleEdit";
import { Xmark } from "./icons";

interface CourseEditorProps {
  session: Session | null;
  settings: Settings;
  weekday: string;
  date: string;
  bounds: DOMRect;
  radius: number;
  onSave: (values: SessionValues) => void;
  onDelete?: () => void;
  onClose: () => void;
}

/** Create/edit form for a single session. */
export default function CourseEditor({
  session,
  settings,
  weekday,
  date,
  bounds,
  radius,
  onSave,
  onDelete,
  onClose
}: CourseEditorProps) {
  const range = sessionRange(session ?? { periods: null });
  const [course, setCourse] = useState(session?.course ?? "");
  const [courseShort, setCourseShort] = useState(session?.courseShort ?? "");
  const [location, setLocation] = useState(session?.location ?? "");
  const [start, setStart] = useState(range?.start ?? 1);
  const [end, setEnd] = useState(range?.end ?? 1);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const periods = [...settings.periods].sort((a, b) => a.index - b.index);

  const submit = () => {
    if (!course.trim()) return;
    onSave({
      course: course.trim(),
      courseShort: courseShort.trim(),
      location: location.trim(),
      start: Math.min(start, end),
      end: Math.max(start, end)
    });
  };

  return (
    <>
      <div
        className="detail-scrim"
        onClick={onClose}
        style={{
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          borderRadius: radius
        }}
      />
      <div
        className="editor-card"
        style={{
          left: bounds.left + (bounds.width - 300) / 2,
          top: bounds.top + Math.max(12, (bounds.height - 330) / 2)
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="editor-head">
          <span className="editor-title">{session ? "编辑课程" : "新增课程"}</span>
          <span className="editor-sub">
            {weekday} · {date}
          </span>
          <button className="detail-close" onClick={onClose} aria-label="关闭">
            <Xmark width={11} height={11} />
          </button>
        </div>

        <label className="editor-field">
          <span>课程名称</span>
          <input
            value={course}
            onChange={(event) => setCourse(event.target.value)}
            autoFocus
          />
        </label>
        <label className="editor-field">
          <span>简称</span>
          <input
            value={courseShort}
            onChange={(event) => setCourseShort(event.target.value)}
            placeholder="可选"
          />
        </label>
        <label className="editor-field">
          <span>地点</span>
          <input
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            placeholder="可选"
          />
        </label>

        <div className="editor-field">
          <span>节次</span>
          <div className="editor-periods">
            <select
              value={start}
              onChange={(event) => {
                const value = Number(event.target.value);
                setStart(value);
                if (value > end) setEnd(value);
              }}
            >
              {periods.map((period) => (
                <option key={period.index} value={period.index}>
                  {period.index}
                </option>
              ))}
            </select>
            <span className="editor-dash">–</span>
            <select
              value={end}
              onChange={(event) => {
                const value = Number(event.target.value);
                setEnd(value);
                if (value < start) setStart(value);
              }}
            >
              {periods.map((period) => (
                <option key={period.index} value={period.index}>
                  {period.index}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="editor-actions">
          {onDelete && (
            <button className="editor-btn danger" onClick={onDelete}>
              删除
            </button>
          )}
          <span className="editor-spacer" />
          <button className="editor-btn" onClick={onClose}>
            取消
          </button>
          <button className="editor-btn primary" onClick={submit} disabled={!course.trim()}>
            保存
          </button>
        </div>
      </div>
    </>
  );
}

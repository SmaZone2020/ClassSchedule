import { useMemo, useState } from "react";
import type { Session, Settings } from "../types";
import { sessionRange } from "../scheduleUtils";
import type { SessionValues } from "../scheduleEdit";
import { Xmark } from "./icons";
import { Button } from "@/components/motion/button";
import { Input } from "@/components/motion/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/motion/select";

interface CourseEditorProps {
  session: Session | null;
  settings: Settings;
  weekday: string;
  date: string;
  /** Pre-filled range for a new course (click / swept selection / right click). */
  initialRange?: { start: number; end: number };
  bounds: DOMRect;
  radius: number;
  /** Returns an error message when the range collides with another course. */
  onSave: (values: SessionValues) => string | null;
  onDelete?: () => void;
  onClose: () => void;
}

/** Create/edit form for a single session. */
export default function CourseEditor({
  session,
  settings,
  weekday,
  date,
  initialRange,
  bounds,
  radius,
  onSave,
  onDelete,
  onClose
}: CourseEditorProps) {
  const range = sessionRange(session ?? { periods: null }) ?? initialRange ?? null;
  const [course, setCourse] = useState(session?.course ?? "");
  const [courseShort, setCourseShort] = useState(session?.courseShort ?? "");
  const [location, setLocation] = useState(session?.location ?? "");
  const [start, setStart] = useState(range?.start ?? settings.periods[0]?.index ?? 1);
  const [end, setEnd] = useState(range?.end ?? settings.periods[0]?.index ?? 1);
  const [error, setError] = useState<string | null>(null);

  const periods = useMemo(
    () => [...settings.periods].sort((a, b) => a.index - b.index),
    [settings.periods]
  );

  const submit = () => {
    if (!course.trim()) return;
    const message = onSave({
      course: course.trim(),
      courseShort: courseShort.trim(),
      location: location.trim(),
      start: Math.min(start, end),
      end: Math.max(start, end)
    });
    setError(message);
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
        className="editor-card flex flex-col gap-3"
        style={{
          left: Math.max(8, bounds.left + (bounds.width - 300) / 2),
          top: bounds.top + 12,
          maxHeight: Math.max(200, bounds.height - 24)
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

        <Input
          label="课程名称"
          value={course}
          onChange={setCourse}
          autoFocus
        />
        <Input
          label="简称"
          value={courseShort}
          onChange={setCourseShort}
          placeholder="可选"
        />
        <Input
          label="地点"
          value={location}
          onChange={setLocation}
          placeholder="可选"
        />

        <div className="flex flex-col gap-1.5">
          <span className="px-1 text-sm font-medium text-foreground">节次</span>
          <div className="flex items-center gap-2">
            <Select
              value={String(start)}
              onValueChange={(value) => {
                const next = Number(value);
                setStart(next);
                if (next > end) setEnd(next);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="开始" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.index} value={String(period.index)}>
                    {String(period.index)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="shrink-0 text-sm text-muted-foreground">至</span>
            <Select
              value={String(end)}
              onValueChange={(value) => {
                const next = Number(value);
                setEnd(next);
                if (next < start) setStart(next);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="结束" />
              </SelectTrigger>
              <SelectContent>
                {periods.map((period) => (
                  <SelectItem key={period.index} value={String(period.index)}>
                    {String(period.index)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-1">
          {onDelete ? (
            <Button variant="outline" size="sm" onClick={onDelete}>
              删除
            </Button>
          ) : null}
          <span className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            取消
          </Button>
          <Button size="sm" onClick={submit} disabled={!course.trim()}>
            保存
          </Button>
        </div>

        {error ? <p className="editor-error">{error}</p> : null}
      </div>
    </>
  );
}

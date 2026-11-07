import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Session, Settings } from "../types";
import { courseColor, hexToRgba } from "../courseColor";
import { periodRangeLabel, sessionRange, sessionStartLabel } from "../scheduleUtils";
import { Xmark } from "./icons";

export interface DetailAnchor {
  /** Course card rect in screen px. */
  rect: DOMRect;
  /** Schedule panel rect in screen px; the overlay is clipped to it. */
  bounds: DOMRect;
  /** Panel corner radius in screen px. */
  radius: number;
  color: string;
}

interface CourseDetailProps {
  session: Session;
  settings: Settings;
  weekday: string;
  dateLabel: string;
  anchor: DetailAnchor;
  onClose: () => void;
}

const CLOSE_MS = 240;

/**
 * Detail sheet that grows out of the clicked course card and shrinks back into
 * it on close. The card is laid out at the origin and moved by a transform, so
 * opening and closing are the same transition played in opposite directions.
 */
export default function CourseDetail({
  session,
  settings,
  weekday,
  dateLabel,
  anchor,
  onClose
}: CourseDetailProps) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [closing, setClosing] = useState(false);
  const closed = useRef(false);

  const requestClose = () => {
    if (closed.current) return;
    closed.current = true;
    const box = boxRef.current;
    if (!box) {
      onClose();
      return;
    }
    const { rect } = anchor;
    const width = box.offsetWidth;
    const height = box.offsetHeight;
    box.style.transition = `transform ${CLOSE_MS}ms cubic-bezier(0.4, 0, 1, 1), opacity ${CLOSE_MS}ms ease`;
    box.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(${
      rect.width / width
    }, ${rect.height / height})`;
    box.style.opacity = "0";
    setClosing(true);
    window.setTimeout(onClose, CLOSE_MS);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const width = box.offsetWidth;
    const height = box.offsetHeight;
    const { rect, bounds } = anchor;

    const targetX = bounds.left + (bounds.width - width) / 2;
    const targetY = bounds.top + (bounds.height - height) / 2;

    box.style.transformOrigin = "top left";
    box.style.transform = `translate(${rect.left}px, ${rect.top}px) scale(${
      rect.width / width
    }, ${rect.height / height})`;
    box.style.opacity = "0";

    const frame = requestAnimationFrame(() => {
      box.style.transition =
        "transform 340ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms ease";
      box.style.transform = `translate(${targetX}px, ${targetY}px) scale(1, 1)`;
      box.style.opacity = "1";
    });
    return () => cancelAnimationFrame(frame);
  }, [anchor]);

  const range = sessionRange(session);
  const start = sessionStartLabel(session, settings);
  const endPeriod = range
    ? settings.periods.find((item) => item.index === range.end)
    : undefined;

  const rows: Array<[string, string]> = [
    ["星期", weekday],
    ["日期", dateLabel],
    ["节次", periodRangeLabel(session) || "—"],
    ["时间", start && endPeriod ? `${start} - ${endPeriod.end}` : (start ?? "—")],
    ["地点", session.location || "未注明"]
  ];

  const { bounds, radius } = anchor;

  return (
    <>
      <div
        className={`detail-scrim${closing ? " closing" : ""}`}
        onClick={requestClose}
        style={{
          left: bounds.left,
          top: bounds.top,
          width: bounds.width,
          height: bounds.height,
          borderRadius: radius
        }}
      />
      <div
        ref={boxRef}
        className="detail-card"
        onClick={(event) => event.stopPropagation()}
        style={
          {
            width: Math.min(340, Math.max(240, bounds.width - 32)),
            maxHeight: Math.max(180, bounds.height - 32),
            overflowY: "auto",
            "--detail-color": anchor.color,
            "--detail-soft": hexToRgba(anchor.color, 0.16),
            "--detail-glow": hexToRgba(anchor.color, 0.06)
          } as React.CSSProperties
        }
      >
        <div className="detail-head">
          <span className="detail-title">{session.course}</span>
          <button className="detail-close" onClick={requestClose} aria-label="关闭">
            <Xmark width={11} height={11} />
          </button>
        </div>
        <div className="detail-rows">
          {rows.map(([label, value]) => (
            <div className="detail-row" key={label}>
              <span className="detail-label">{label}</span>
              <span className="detail-value">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export function detailAnchor(
  element: HTMLElement,
  session: Session,
  courses: Parameters<typeof courseColor>[1],
  accent: string,
  scale: number,
  panelRadius: number
): DetailAnchor {
  const panel = element.closest(".schedule-panel") as HTMLElement | null;
  const bounds = panel?.getBoundingClientRect() ?? element.getBoundingClientRect();
  return {
    rect: element.getBoundingClientRect(),
    bounds,
    radius: panelRadius * scale,
    color: courseColor(session.course, courses, accent)
  };
}

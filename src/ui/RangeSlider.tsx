import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform
} from "motion/react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { SPRING_GLIDE } from "./motion";
import { cn } from "./utils";

const SPRING_BOUNCY = { type: "spring", stiffness: 500, damping: 14, mass: 0.7 } as const;

export interface RangeSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Render a tick dot at each step (skipped when there are too many). */
  showTicks?: boolean;
  className?: string;
  "aria-label"?: string;
}

export function RangeSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  showTicks = false,
  className,
  "aria-label": ariaLabel
}: RangeSliderProps) {
  const reduce = useReducedMotion();
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(240);
  const [dragging, setDragging] = useState(false);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const measure = () => {
      const width = track.getBoundingClientRect().width;
      if (width > 0) setTrackWidth(width);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(track);
    return () => observer.disconnect();
  }, []);

  const ratio = max === min ? 0 : (value - min) / (max - min);
  const percent = Math.min(100, Math.max(0, ratio * 100));

  const target = useMotionValue(percent);
  useEffect(() => {
    target.set(percent);
  }, [percent, target]);
  const smooth = useSpring(target, SPRING_GLIDE);
  const pos = reduce ? target : smooth;
  const thumbX = useTransform(pos, (p) => 8 + (Math.max(0, trackWidth - 20) * p) / 100);
  const fillX = useTransform(pos, (p) =>
    p >= 100 ? "0%" : `calc(${p - 100}% + ${14 - 0.16 * p}px)`
  );

  const quantize = useCallback(
    (raw: number) => {
      const stepped = Math.round((raw - min) / step) * step + min;
      const clamped = Math.min(max, Math.max(min, stepped));
      // Trim float noise like 0.30000000000000004.
      return Number(clamped.toFixed(6));
    },
    [min, max, step]
  );

  const valueAt = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const usable = Math.max(1, rect.width - 20);
      const p = Math.min(1, Math.max(0, (clientX - rect.left - 10) / usable));
      return quantize(min + p * (max - min));
    },
    [min, max, quantize, value]
  );

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onChange(valueAt(event.clientX));
  };

  const steps = Math.floor(Number(((max - min) / step).toFixed(6)));
  const ticks =
    showTicks && steps > 0 && steps <= 24
      ? Array.from({ length: steps + 1 }, (_, i) => Number((min + i * step).toFixed(6)))
      : [];

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={ariaLabel}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-disabled={disabled}
      onPointerDown={startDrag}
      onPointerMove={(event) => {
        if (dragging && !disabled) onChange(valueAt(event.clientX));
      }}
      onPointerUp={() => setDragging(false)}
      onPointerCancel={() => setDragging(false)}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          event.preventDefault();
          onChange(quantize(value - step));
        } else if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          event.preventDefault();
          onChange(quantize(value + step));
        } else if (event.key === "Home") {
          event.preventDefault();
          onChange(min);
        } else if (event.key === "End") {
          event.preventDefault();
          onChange(max);
        }
      }}
      className={cn(
        "relative flex h-9 w-full touch-none items-center overflow-hidden rounded-xl bg-muted outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring/40",
        disabled
          ? "pointer-events-none opacity-50"
          : "cursor-grab active:cursor-grabbing",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[2px] inset-y-0 overflow-hidden rounded-xl"
      >
        <motion.div className="absolute inset-0 rounded-xl bg-foreground/12" style={{ x: fillX }} />
      </div>

      {ticks.length ? (
        <div className="pointer-events-none absolute inset-x-[10px] inset-y-0">
          {ticks.map((tick) => {
            const tp = ((tick - min) / (max - min)) * 100;
            return (
              <span
                key={tick}
                className="absolute top-1/2 size-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/20"
                style={{ left: `${tp}%` }}
              />
            );
          })}
        </div>
      ) : null}

      <motion.div
        animate={reduce ? undefined : { scaleY: dragging ? 1.3 : 1 }}
        transition={SPRING_BOUNCY}
        className="pointer-events-none absolute left-0 top-1/2 h-5 w-1 rounded-full bg-foreground shadow-sm"
        style={{ x: thumbX, y: "-50%" }}
      />
    </div>
  );
}

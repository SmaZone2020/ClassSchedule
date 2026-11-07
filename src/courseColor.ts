import type { CourseInfo } from "./types";

const PALETTE = [
  "#4f8ef7",
  "#7c6cf7",
  "#f76c8a",
  "#f7a35c",
  "#2ec4a6",
  "#e8b73a",
  "#5cc8f7",
  "#a06cf7",
  "#f76c5c",
  "#63d471"
];

export function courseColor(
  courseName: string,
  courses?: CourseInfo[],
  accent?: string
): string {
  if (courses?.length) {
    const index = courses.findIndex((course) => course.name === courseName);
    if (index === 0 && accent) return accent;
    if (index > 0) return PALETTE[index % PALETTE.length];
  }
  let hash = 0;
  for (let i = 0; i < courseName.length; i++) {
    hash = (hash * 31 + courseName.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const full =
    value.length === 3
      ? value
          .split("")
          .map((char) => char + char)
          .join("")
      : value;
  const r = Number.parseInt(full.slice(0, 2), 16) || 0;
  const g = Number.parseInt(full.slice(2, 4), 16) || 0;
  const b = Number.parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function courseVars(color: string): React.CSSProperties {
  return {
    "--course-color": color,
    "--course-soft": hexToRgba(color, 0.22),
    "--course-glow": hexToRgba(color, 0.08)
  } as React.CSSProperties;
}

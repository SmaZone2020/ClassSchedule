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

export function colorStyle(color: string): React.CSSProperties {
  return {
    background: `linear-gradient(150deg, ${color}2e, ${color}14 60%, transparent), var(--card-bg)`,
    borderLeft: `3px solid ${color}`
  };
}

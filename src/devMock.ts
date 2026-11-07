import type { AppData, Schedule } from "./types";
import { defaultSettings } from "./settingsDefaults";

const mockSchedule: Schedule = {
  meta: { semester: "2026-2027学年第一学期" },
  courses: [
    { name: "高等数学", shortName: "高等数学" },
    { name: "大学英语", shortName: "大学英语" },
    { name: "C语言程序设计", shortName: "C语言" },
    { name: "电路分析基础", shortName: "电路分析" },
    { name: "大学体育", shortName: "大学体育" },
    { name: "思想道德与法治", shortName: "思政" }
  ],
  weeks: [
    {
      week: 11,
      startDate: "2026-11-02",
      endDate: "2026-11-08",
      days: [
        {
          weekday: "周一",
          date: "2026-11-02",
          sessions: [
            {
              periods: { start: 1, end: 2 },
              course: "高等数学",
              courseShort: "高等数学",
              location: "立德楼 6204"
            }
          ]
        },
        { weekday: "周二", date: "2026-11-03", sessions: [] },
        { weekday: "周三", date: "2026-11-04", sessions: [] },
        { weekday: "周四", date: "2026-11-05", sessions: [] },
        { weekday: "周五", date: "2026-11-06", sessions: [] }
      ]
    },
    {
      week: 12,
      startDate: "2026-11-09",
      endDate: "2026-11-13",
      days: [
        {
          weekday: "周一",
          date: "2026-11-09",
          sessions: [
            {
              periods: { start: 1, end: 2 },
              course: "高等数学",
              courseShort: "高等数学",
              location: "立德楼 6204"
            },
            {
              periods: { start: 5, end: 6 },
              course: "大学英语",
              courseShort: "大学英语",
              location: "立德楼 5608"
            }
          ]
        },
        {
          weekday: "周二",
          date: "2026-11-10",
          sessions: [
            {
              periods: { start: 3, end: 4 },
              course: "C语言程序设计",
              courseShort: "C语言",
              location: "立行楼 6103"
            },
            {
              periods: { start: 7, end: 8 },
              course: "大学体育",
              courseShort: "大学体育",
              location: "未注明"
            }
          ]
        },
        {
          weekday: "周三",
          date: "2026-11-11",
          sessions: [
            {
              periods: { start: 1, end: 2 },
              course: "电路分析基础",
              courseShort: "电路分析",
              location: "2号实训厂房"
            },
            {
              periods: { start: 3, end: 4 },
              course: "思想道德与法治",
              courseShort: "思政",
              location: "立德楼 5109"
            }
          ]
        },
        { weekday: "周四", date: "2026-11-12", sessions: [] },
        {
          weekday: "周五",
          date: "2026-11-13",
          sessions: [
            {
              periods: { start: 1, end: 2 },
              course: "大学英语",
              courseShort: "大学英语",
              location: "立德楼 5608"
            }
          ]
        }
      ]
    },
    {
      week: 13,
      startDate: "2026-11-16",
      endDate: "2026-11-20",
      days: [
        {
          weekday: "周一",
          date: "2026-11-16",
          sessions: [
            {
              periods: { start: 3, end: 4 },
              course: "C语言程序设计",
              courseShort: "C语言",
              location: "立行楼 6103"
            }
          ]
        },
        { weekday: "周二", date: "2026-11-17", sessions: [] },
        { weekday: "周三", date: "2026-11-18", sessions: [] },
        { weekday: "周四", date: "2026-11-19", sessions: [] },
        { weekday: "周五", date: "2026-11-20", sessions: [] }
      ]
    }
  ]
};

export function installDevMock() {
  if (typeof window === "undefined") return;
  if (!window.location.search.includes("mock")) return;
  if ("__TAURI_INTERNALS__" in window) return;

  const data: AppData = {
    settings: defaultSettings,
    schedule: mockSchedule,
    scheduleError: null,
    monitors: [
      {
        name: "mock",
        label: "Mock 显示器",
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        isPrimary: true
      }
    ],
    widgetSize: { width: 652, height: 420 },
    rect: { x: 60, y: 60, width: 652, height: 420 },
    wallpaper: {
      dataUrl:
        "data:image/svg+xml;utf8," +
        encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
            <defs>
              <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stop-color="#1b3a6b"/>
                <stop offset="0.5" stop-color="#6b2d7a"/>
                <stop offset="1" stop-color="#d9822b"/>
              </linearGradient>
            </defs>
            <rect width="1920" height="1080" fill="url(#g)"/>
            <circle cx="1500" cy="260" r="180" fill="#ffd8a8" opacity="0.55"/>
            <circle cx="420" cy="820" r="240" fill="#7fd1ff" opacity="0.35"/>
          </svg>`
        ),
      style: "fill",
      source: "system",
      path: null,
      error: null
    },
    configDir: "C:\\mock\\data"
  };

  const internals = {
    transformCallback: () => 1,
    unregisterCallback: () => {},
    convertFileSrc: (path: string) => path,
    invoke: async (command: string, args: Record<string, unknown>) => {
      if (command === "get_app_data") return data;
      if (command === "update_settings") {
        data.settings = args.settings as AppData["settings"];
        return data.settings;
      }
      if (command === "set_layout_columns") return null;
      if (command === "import_schedule_from_path") {
        return {
          report: { valid: true, error: null, meta: null, weeks: 3, sessions: 9, warnings: [] },
          schedule: mockSchedule
        };
      }
      return null;
    }
  };

  (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = internals;
}

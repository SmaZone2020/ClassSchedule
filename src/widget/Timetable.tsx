import type { Schedule, Session, Settings } from "../types";
import type { WeekModel } from "./useWeekModel";
import { weekHasSessions } from "../scheduleUtils";
import DayColumn, { type Slot } from "./DayColumn";
import type { SessionRef } from "../scheduleEdit";

interface TimetableProps {
  settings: Settings;
  model: WeekModel;
  schedule: Schedule | null;
  accent: string;
  now: Date;
  today: string;
  activePeriod: number | null;
  direction: 1 | -1;
  viewDate: string | null;
  editing: boolean;
  canClickDay: boolean;
  returnHead: boolean;
  dragPreview: Slot | null;
  dragRef: SessionRef | null;
  onDayHead: (date: string) => void;
  onOpenDetail: (
    session: Session,
    weekday: string,
    date: string,
    element: HTMLElement
  ) => void;
  onOpenEditor: (ref: SessionRef) => void;
  onDelete: (ref: SessionRef) => void;
  onResize: (ref: SessionRef, end: number) => void;
  onDragStart: (ref: SessionRef, event: React.PointerEvent<HTMLElement>) => void;
  onCreateAt: (slot: Slot) => void;
}

export default function Timetable({
  settings,
  model,
  schedule,
  accent,
  now,
  today,
  activePeriod,
  direction,
  viewDate,
  editing,
  canClickDay,
  returnHead,
  dragPreview,
  dragRef,
  onDayHead,
  onOpenDetail,
  onOpenEditor,
  onDelete,
  onResize,
  onDragStart,
  onCreateAt
}: TimetableProps) {
  if (model.finished) {
    return (
      <div className="week-break" key={`done-${model.index}`}>
        <strong>本周课程已全部结束</strong>
        <span>好好休息，下周再见</span>
      </div>
    );
  }

  if (!model.week || !weekHasSessions(model.week)) {
    return (
      <div className="week-break" key="empty">
        <strong>暂无课表数据</strong>
        <span>托盘右键 → 设置 → 导入课表</span>
      </div>
    );
  }

  const periodTime = (index: number) =>
    settings.periods.find((period) => period.index === index)?.start ?? "";

  return (
    <div
      className={`week-view ${direction > 0 ? "from-right" : "from-left"}${
        model.scrollable || model.singleDay ? " quick" : ""
      }`}
      key={`week-${model.index}-${model.offset}-${viewDate ?? ""}`}
    >
      <div className="timetable">
        <div className="period-rail">
          <div className="day-head spacer" />
          <div className="period-rail-rows" style={{ gridTemplateRows: model.template }}>
            {model.rows.map((row, index) =>
              row.period === null ? (
                <div className="period-gap" key={`gap-${index}`} />
              ) : (
                <div className="period-cell" key={`p-${row.period}`}>
                  <span className="period-index">{row.period}</span>
                  {settings.panel.showPeriodTime && (
                    <span className="period-time">{periodTime(row.period)}</span>
                  )}
                </div>
              )
            )}
          </div>
        </div>

        <div
          className={`schedule-days${model.columns === 1 ? " single" : ""}`}
          style={{ gridTemplateColumns: `repeat(${model.columns}, minmax(0, 1fr))` }}
        >
          {model.gridDays.map((column) => (
            <DayColumn
              key={column.day.date}
              column={column}
              settings={settings}
              model={model}
              courses={schedule?.courses}
              accent={accent}
              now={now}
              today={today}
              activePeriod={activePeriod}
              editing={editing}
              canClickDay={canClickDay}
              returnHead={returnHead}
              preview={dragPreview?.date === column.day.date ? dragPreview : null}
              onDayHead={onDayHead}
              onOpenDetail={onOpenDetail}
              onOpenEditor={onOpenEditor}
              onDelete={onDelete}
              onResize={onResize}
              onDragStart={onDragStart}
              onCreateAt={onCreateAt}
              dragRef={dragRef}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

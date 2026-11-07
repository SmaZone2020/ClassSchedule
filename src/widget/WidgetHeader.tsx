import type { Settings } from "../types";
import type { WeekModel } from "./useWeekModel";
import { dateRangeLabel } from "../scheduleUtils";
import { ArrowChevronLeft, ArrowChevronRight, Check, Pencil } from "./icons";

interface WidgetHeaderProps {
  settings: Settings;
  model: WeekModel;
  scheduleLabel: string;
  canInteract: boolean;
  canSwitchWeek: boolean;
  editing: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToggleEdit: () => void;
}

export default function WidgetHeader({
  settings,
  model,
  scheduleLabel,
  canInteract,
  canSwitchWeek,
  editing,
  onPrev,
  onNext,
  onToggleEdit
}: WidgetHeaderProps) {
  const singleView = model.singleDay;
  const title = singleView
    ? (model.all[model.offset]?.weekday ?? "课表")
    : model.week
      ? `第 ${model.week.week} 周`
      : scheduleLabel;
  const range = dateRangeLabel(model.days);
  const showSwitch = canInteract && !editing && (singleView || canSwitchWeek);

  return (
    <div className="schedule-header">
      <div className="header-left">
        {showSwitch ? (
          <div className="week-switch">
            <button
              className="week-nav"
              onClick={onPrev}
              disabled={!singleView && model.index <= 0}
              aria-label={singleView ? "前一天" : "上一周"}
            >
              <ArrowChevronLeft width={12} height={12} />
            </button>
            <span className="schedule-title">{title}</span>
            <button
              className="week-nav"
              onClick={onNext}
              disabled={!singleView && model.index >= model.total - 1}
              aria-label={singleView ? "后一天" : "下一周"}
            >
              <ArrowChevronRight width={12} height={12} />
            </button>
          </div>
        ) : (
          <span className="schedule-title">{title}</span>
        )}
      </div>

      {settings.panel.showHeader && range && <span className="header-range">{range}</span>}

      {canInteract && (
        <button
          className={`edit-toggle${editing ? " active" : ""}`}
          onClick={onToggleEdit}
          aria-label={editing ? "退出编辑" : "编辑课表"}
          title={editing ? "退出编辑" : "编辑课表"}
        >
          {editing ? <Check width={13} height={13} /> : <Pencil width={13} height={13} />}
        </button>
      )}
    </div>
  );
}

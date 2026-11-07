import type { PeriodTime, Settings } from "../types";

interface PeriodsSectionProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

export function PeriodsSection({ settings, onChange }: PeriodsSectionProps) {
  const update = (index: number, patch: Partial<PeriodTime>) => {
    onChange({
      periods: settings.periods.map((period) =>
        period.index === index ? { ...period, ...patch } : period
      )
    });
  };

  return (
    <div className="settings-card">
      <h2>作息时间（用于高亮当前课、判断当天是否结束）</h2>
      <div className="settings-grid">
        {settings.periods.map((period) => (
          <div className="settings-row" key={period.index}>
            <label style={{ width: 56 }}>第{period.index}节</label>
            <input
              type="time"
              value={period.start}
              onChange={(event) => update(period.index, { start: event.target.value })}
            />
            <span>—</span>
            <input
              type="time"
              value={period.end}
              onChange={(event) => update(period.index, { end: event.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

import type { MonitorInfo, Settings } from "../types";

interface PositionSectionProps {
  settings: Settings;
  monitors: MonitorInfo[];
  onChange: (patch: Partial<Settings>) => void;
}

export function PositionSection({ settings, monitors, onChange }: PositionSectionProps) {
  return (
    <div className="settings-card">
      <h2>位置与缩放</h2>
      <div className="settings-grid">
        <div className="settings-row">
          <label>显示器</label>
          <select
            value={settings.position.monitor ?? ""}
            onChange={(event) =>
              onChange({
                position: {
                  ...settings.position,
                  monitor: event.target.value || null
                }
              })
            }
          >
            <option value="">主显示器</option>
            {monitors.map((monitor) => (
              <option key={monitor.name} value={monitor.name}>
                {monitor.label} ({Math.round(monitor.width)}×{Math.round(monitor.height)})
                {monitor.isPrimary ? " · 主" : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="settings-row">
          <label>缩放 {Math.round(settings.scale * 100)}%</label>
          <input
            type="range"
            min={0.3}
            max={2}
            step={0.05}
            value={settings.scale}
            onChange={(event) => onChange({ scale: Number(event.target.value) })}
          />
        </div>
        <div className="settings-row">
          <label>X 位置</label>
          <input
            type="number"
            value={Math.round(settings.position.x)}
            onChange={(event) =>
              onChange({
                position: { ...settings.position, x: Number(event.target.value) }
              })
            }
          />
        </div>
        <div className="settings-row">
          <label>Y 位置</label>
          <input
            type="number"
            value={Math.round(settings.position.y)}
            onChange={(event) =>
              onChange({
                position: { ...settings.position, y: Number(event.target.value) }
              })
            }
          />
        </div>
        <div className="settings-row">
          <label>鼠标穿透</label>
          <input
            type="checkbox"
            checked={settings.clickThrough}
            onChange={(event) => onChange({ clickThrough: event.target.checked })}
          />
        </div>
        <div className="settings-row">
          <label>显示组件</label>
          <input
            type="checkbox"
            checked={settings.widgetVisible}
            onChange={(event) => onChange({ widgetVisible: event.target.checked })}
          />
        </div>
      </div>
      <p className="settings-hint">
        X/Y 为组件左上角在所选显示器上的逻辑坐标（不含任务栏偏移）；开启鼠标穿透后组件不再接收鼠标，需要调整时先关闭穿透。
      </p>
    </div>
  );
}

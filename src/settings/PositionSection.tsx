import type { MonitorInfo, Settings } from "../types";
import { baseSize, slotWidth } from "../settingsDefaults";

interface PositionSectionProps {
  settings: Settings;
  monitors: MonitorInfo[];
  onChange: (patch: Partial<Settings>) => void;
}

const COLUMNS: Record<string, number> = { auto: 5, "5": 5, "7": 7, today: 1 };

export function PositionSection({ settings, monitors, onChange }: PositionSectionProps) {
  const monitor =
    monitors.find((item) => item.name === settings.position.monitor) ??
    monitors.find((item) => item.isPrimary) ??
    monitors[0];
  const columns = COLUMNS[settings.daysMode] ?? 5;
  const size = baseSize(columns);
  const slot = slotWidth() * settings.scale;
  const width = size.width * settings.scale;
  const height = size.height * settings.scale;

  const monitorWidth = monitor?.width ?? 1920;
  const monitorHeight = monitor?.height ?? 1080;

  const room = Math.max(0, slot - width);
  const autoRight =
    settings.position.x + slot / 2 > monitorWidth / 2;
  const shift =
    settings.align === "right"
      ? room
      : settings.align === "auto" && autoRight
        ? room
        : 0;

  const maxX = Math.max(0, Math.round(monitorWidth - width));
  const maxY = Math.max(0, Math.round(monitorHeight - height));
  const actualX = Math.min(Math.max(0, settings.position.x + shift), maxX);
  const actualY = Math.min(Math.max(0, settings.position.y), maxY);

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
                position: { ...settings.position, monitor: event.target.value || null }
              })
            }
          >
            <option value="">主显示器</option>
            {monitors.map((item) => (
              <option key={item.name} value={item.name}>
                {item.label} ({Math.round(item.width)}×{Math.round(item.height)})
                {item.isPrimary ? " · 主" : ""}
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
          <label>水平 X</label>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={0}
              max={maxX}
              value={Math.min(settings.position.x, maxX)}
              onChange={(event) =>
                onChange({
                  position: { ...settings.position, x: Number(event.target.value) }
                })
              }
            />
            <input
              type="number"
              value={Math.round(settings.position.x)}
              onChange={(event) =>
                onChange({
                  position: { ...settings.position, x: Number(event.target.value) || 0 }
                })
              }
            />
          </span>
        </div>
        <div className="settings-row">
          <label>垂直 Y</label>
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              type="range"
              min={0}
              max={maxY}
              value={Math.min(settings.position.y, maxY)}
              onChange={(event) =>
                onChange({
                  position: { ...settings.position, y: Number(event.target.value) }
                })
              }
            />
            <input
              type="number"
              value={Math.round(settings.position.y)}
              onChange={(event) =>
                onChange({
                  position: { ...settings.position, y: Number(event.target.value) || 0 }
                })
              }
            />
          </span>
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
        X/Y 是 7 天布局的左上角锚点（逻辑像素）。当前显示 {columns} 天，组件尺寸{" "}
        {Math.round(width)}×{Math.round(height)}，实际左上角 ({Math.round(actualX)},{" "}
        {Math.round(actualY)})。对齐模式决定从 7 天收窄时向哪一侧收缩：左对齐保持左边缘不动，右对齐保持右边缘不动，自动按组件在屏幕左右侧判断。
      </p>
    </div>
  );
}

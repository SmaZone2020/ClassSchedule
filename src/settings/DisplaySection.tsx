import type { Settings } from "../types";
import { defaultSettings } from "../settingsDefaults";

interface DisplaySectionProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

const ACCENTS = ["#4f8ef7", "#7c6cf7", "#2ec4a6", "#f76c8a", "#f7a35c", "#5cc8f7"];

export function DisplaySection({ settings, onChange }: DisplaySectionProps) {
  const panel = settings.panel;
  const panelPatch = (patch: Partial<Settings["panel"]>) =>
    onChange({ panel: { ...panel, ...patch } });

  return (
    <div className="settings-card">
      <h2>显示与样式</h2>
      <div className="settings-grid">
        <div className="settings-row">
          <label>显示范围</label>
          <select
            value={settings.daysMode}
            onChange={(event) =>
              onChange({ daysMode: event.target.value as Settings["daysMode"] })
            }
          >
            <option value="auto">自动</option>
            <option value="5">固定 5 天</option>
            <option value="7">固定 7 天</option>
            <option value="today">仅显示当天课表</option>
          </select>
        </div>
        <div className="settings-row">
          <label>对齐模式</label>
          <select
            value={settings.align}
            onChange={(event) =>
              onChange({ align: event.target.value as Settings["align"] })
            }
          >
            <option value="auto">自动</option>
            <option value="left">左对齐</option>
            <option value="right">右对齐</option>
          </select>
        </div>
        <div className="settings-row">
          <label>课程名称</label>
          <select
            value={settings.panel.titleMode}
            onChange={(event) =>
              panelPatch({ titleMode: event.target.value as "full" | "short" })
            }
          >
            <option value="full">完整名称</option>
            <option value="short">使用简称</option>
          </select>
        </div>
        <div className="settings-row">
          <label>玻璃风格</label>
          <select
            value={settings.style}
            onChange={(event) => onChange({ style: event.target.value as Settings["style"] })}
          >
            <option value="frosted">磨砂</option>
            <option value="liquid">液态玻璃</option>
          </select>
        </div>
        <div className="settings-row">
          <label>主题</label>
          <select
            value={settings.theme}
            onChange={(event) => onChange({ theme: event.target.value as Settings["theme"] })}
          >
            <option value="auto">跟随系统</option>
            <option value="light">浅色</option>
            <option value="dark">深色</option>
          </select>
        </div>
        <div className="settings-row">
          <label>强调色</label>
          <span className="swatch-row">
            {ACCENTS.map((color) => (
              <button
                key={color}
                aria-label={color}
                className={`swatch ${settings.accent === color ? "active" : "idle"}`}
                onClick={() => onChange({ accent: color })}
                style={{ background: color }}
              />
            ))}
          </span>
        </div>
        <div className="settings-row">
          <label>圆角 {panel.radius}px</label>
          <input
            type="range"
            min={0}
            max={36}
            value={panel.radius}
            onChange={(event) => panelPatch({ radius: Number(event.target.value) })}
          />
        </div>
        <div className="settings-row">
          <label>不透明度 {Math.round(panel.opacity * 100)}%</label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.02}
            value={panel.opacity}
            onChange={(event) => panelPatch({ opacity: Number(event.target.value) })}
          />
        </div>
        <div className="settings-row">
          <label>背景模糊 {panel.blur}px</label>
          <input
            type="range"
            min={0}
            max={60}
            value={panel.blur}
            onChange={(event) => panelPatch({ blur: Number(event.target.value) })}
          />
        </div>
        <div className="settings-row">
          <label>阴影强度 {Math.round(panel.shadow * 100)}%</label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={panel.shadow}
            onChange={(event) => panelPatch({ shadow: Number(event.target.value) })}
          />
        </div>
        <div className="settings-row">
          <label>阴影大小 {panel.shadowSize}px</label>
          <input
            type="range"
            min={0}
            max={24}
            value={panel.shadowSize}
            onChange={(event) => panelPatch({ shadowSize: Number(event.target.value) })}
          />
        </div>
        <div className="settings-row">
          <label>卡片间距 {panel.gap}px</label>
          <input
            type="range"
            min={2}
            max={18}
            value={panel.gap}
            onChange={(event) => panelPatch({ gap: Number(event.target.value) })}
          />
        </div>
      </div>
      <div className="settings-grid">
        <label className="settings-row">
          <span>显示地点</span>
          <input
            type="checkbox"
            checked={panel.showLocation}
            onChange={(event) => panelPatch({ showLocation: event.target.checked })}
          />
        </label>
        <label className="settings-row">
          <span>显示节次时间</span>
          <input
            type="checkbox"
            checked={panel.showPeriodTime}
            onChange={(event) => panelPatch({ showPeriodTime: event.target.checked })}
          />
        </label>
        <label className="settings-row">
          <span>压缩无课节次</span>
          <input
            type="checkbox"
            checked={panel.compact}
            onChange={(event) => panelPatch({ compact: event.target.checked })}
          />
        </label>
        <label className="settings-row">
          <span>显示标题栏</span>
          <input
            type="checkbox"
            checked={panel.showHeader}
            onChange={(event) => panelPatch({ showHeader: event.target.checked })}
          />
        </label>
        <button
          className="secondary"
          onClick={() => onChange({ panel: defaultSettings.panel })}
        >
          恢复默认样式
        </button>
      </div>
    </div>
  );
}

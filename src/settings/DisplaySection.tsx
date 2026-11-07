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
            <option value="auto">自动（周末无课只显示 5 天）</option>
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
            <option value="auto">自动（按组件在屏幕左右侧判断）</option>
            <option value="left">左对齐（宽度变化时向左收缩）</option>
            <option value="right">右对齐（宽度变化时向右收缩）</option>
          </select>
        </div>
        <div className="settings-row">
          <label>玻璃风格</label>
          <select
            value={settings.style}
            onChange={(event) => onChange({ style: event.target.value as Settings["style"] })}
          >
            <option value="frosted">磨砂（桌面壁纸对齐模糊）</option>
            <option value="liquid">液态玻璃（liquid glass）</option>
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
      <p className="settings-hint">
        关闭鼠标穿透后，组件标题栏会出现 ‹ › 按钮，可手动切换上一周/下一周；开启穿透时自动回到本周。对齐模式决定从 7 天收窄到 5 天或 1 天时，课表向哪一侧收缩。
      </p>
    </div>
  );
}

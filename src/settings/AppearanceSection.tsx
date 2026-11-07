import type { Settings } from "../types";
import { defaultSettings } from "../settingsDefaults";
import { Card, Grid, Row } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Switch } from "../ui/Switch";
import { RangeSlider } from "../ui/RangeSlider";
import { Check } from "./icons";

interface AppearanceSectionProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

const ACCENTS = ["#4f8ef7", "#7c6cf7", "#2ec4a6", "#f76c8a", "#f7a35c", "#5cc8f7"];

const RANGES = [
  { key: "radius", label: "圆角", min: 0, max: 36, step: 1, unit: "px", scale: 1 },
  { key: "opacity", label: "不透明度", min: 0.1, max: 1, step: 0.02, unit: "%", scale: 100 },
  { key: "blur", label: "背景模糊", min: 0, max: 60, step: 1, unit: "px", scale: 1 },
  { key: "shadow", label: "阴影强度", min: 0, max: 1, step: 0.05, unit: "%", scale: 100 },
  { key: "shadowSize", label: "阴影大小", min: 0, max: 24, step: 1, unit: "px", scale: 1 },
  { key: "gap", label: "卡片间距", min: 2, max: 18, step: 1, unit: "px", scale: 1 }
] as const;

const TOGGLES = [
  { key: "showLocation", label: "显示地点" },
  { key: "showPeriodTime", label: "显示节次时间" },
  { key: "compact", label: "压缩无课节次" },
  { key: "showHeader", label: "显示标题栏" }
] as const;

export function AppearanceSection({ settings, onChange }: AppearanceSectionProps) {
  const panel = settings.panel;
  const panelPatch = (patch: Partial<Settings["panel"]>) =>
    onChange({ panel: { ...panel, ...patch } });

  return (
    <>
      <Card
        title="显示与样式"
        description="控制组件的玻璃质感、密度和课程名称的显示方式。"
        index={0}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange({ panel: defaultSettings.panel })}
          >
            恢复默认
          </Button>
        }
      >
        <Grid>
          <Select
            label="显示范围"
            value={settings.daysMode}
            onChange={(value) => onChange({ daysMode: value as Settings["daysMode"] })}
            options={[
              { value: "auto", label: "自动（周末无课显示 5 天）" },
              { value: "5", label: "固定 5 天" },
              { value: "7", label: "固定 7 天" },
              { value: "today", label: "仅显示当天" }
            ]}
          />
          <Select
            label="对齐模式"
            value={settings.align}
            onChange={(value) => onChange({ align: value as Settings["align"] })}
            options={[
              { value: "auto", label: "自动" },
              { value: "left", label: "左对齐" },
              { value: "right", label: "右对齐" }
            ]}
          />
          <Select
            label="课程名称"
            value={panel.titleMode}
            onChange={(value) => panelPatch({ titleMode: value as "full" | "short" })}
            options={[
              { value: "full", label: "完整名称" },
              { value: "short", label: "使用简称" }
            ]}
          />
          <Select
            label="玻璃风格"
            value={settings.style}
            onChange={(value) => onChange({ style: value as Settings["style"] })}
            options={[
              { value: "frosted", label: "磨砂玻璃" },
              { value: "liquid", label: "液态玻璃" }
            ]}
          />
          <Select
            label="主题"
            value={settings.theme}
            onChange={(value) => onChange({ theme: value as Settings["theme"] })}
            options={[
              { value: "auto", label: "跟随系统" },
              { value: "light", label: "浅色" },
              { value: "dark", label: "深色" }
            ]}
          />
          <Row label="强调色">
            <div className="flex items-center gap-1.5">
              {ACCENTS.map((color) => {
                const active = settings.accent === color;
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={active}
                    onClick={() => onChange({ accent: color })}
                    className="grid size-6 place-items-center rounded-full outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-ring/50"
                    style={{
                      background: color,
                      boxShadow: active
                        ? `0 0 0 2px var(--color-card), 0 0 0 3.5px ${color}`
                        : "none"
                    }}
                  >
                    {active ? <Check className="size-3 text-white" /> : null}
                  </button>
                );
              })}
            </div>
          </Row>
        </Grid>
      </Card>

      <Card title="玻璃参数" description="拖动即时预览。" index={1}>
        <div className="grid gap-x-6 sm:grid-cols-2">
          {RANGES.map((range) => {
            const value = panel[range.key];
            return (
              <Row
                key={range.key}
                stacked
                label={
                  <span className="flex items-center justify-between gap-2">
                    <span>{range.label}</span>
                    <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                      {Math.round(value * range.scale)}
                      {range.unit}
                    </span>
                  </span>
                }
              >
                <RangeSlider
                  value={value}
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  aria-label={range.label}
                  onChange={(next) => panelPatch({ [range.key]: next })}
                />
              </Row>
            );
          })}
        </div>

        <div className="mt-3 grid gap-x-6 border-t border-border pt-3 sm:grid-cols-2">
          {TOGGLES.map((toggle) => (
            <Row key={toggle.key} label={toggle.label}>
              <Switch
                checked={panel[toggle.key]}
                ariaLabel={toggle.label}
                onCheckedChange={(checked) => panelPatch({ [toggle.key]: checked })}
              />
            </Row>
          ))}
        </div>
      </Card>
    </>
  );
}

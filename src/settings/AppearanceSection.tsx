import type { Settings } from "../types";
import { defaultSettings } from "../settingsDefaults";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/motion/card";
import { Button } from "@/components/motion/button";
import { Switch } from "@/components/motion/switch";
import { RangeSlider } from "@/components/motion/range-slider";
import { cn } from "@/lib/utils";
import { Choice } from "./Choice";
import { Field, ToggleRow } from "./Field";

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
      <Card>
        <CardHeader>
          <CardTitle as="h2">显示与样式</CardTitle>
          <CardDescription>控制组件的玻璃质感、密度和课程名称的显示方式。</CardDescription>
          <CardAction>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ panel: defaultSettings.panel })}
            >
              恢复默认
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Choice
            label="显示范围"
            value={settings.daysMode}
            onChange={(value) => onChange({ daysMode: value as Settings["daysMode"] })}
            options={[
              { value: "auto", label: "自动" },
              { value: "5", label: "固定 5 天" },
              { value: "7", label: "固定 7 天" },
              { value: "today", label: "仅当天" }
            ]}
          />
          <Choice
            label="对齐模式"
            value={settings.align}
            onChange={(value) => onChange({ align: value as Settings["align"] })}
            options={[
              { value: "auto", label: "自动" },
              { value: "left", label: "左对齐" },
              { value: "right", label: "右对齐" }
            ]}
          />
          <Choice
            label="课程名称"
            value={panel.titleMode}
            onChange={(value) => panelPatch({ titleMode: value as "full" | "short" })}
            options={[
              { value: "full", label: "完整名称" },
              { value: "short", label: "使用简称" }
            ]}
          />
          <Choice
            label="玻璃风格"
            value={settings.style}
            onChange={(value) => onChange({ style: value as Settings["style"] })}
            options={[
              { value: "frosted", label: "磨砂玻璃" },
              { value: "liquid", label: "液态玻璃" }
            ]}
          />
          <Choice
            label="主题"
            value={settings.theme}
            onChange={(value) => onChange({ theme: value as Settings["theme"] })}
            options={[
              { value: "auto", label: "跟随系统" },
              { value: "light", label: "浅色" },
              { value: "dark", label: "深色" }
            ]}
          />
          <Field label="强调色">
            <div className="flex h-10 items-center gap-2">
              {ACCENTS.map((color) => {
                const active = settings.accent === color;
                return (
                  <button
                    key={color}
                    type="button"
                    aria-label={color}
                    aria-pressed={active}
                    onClick={() => onChange({ accent: color })}
                    className={cn(
                      "size-6 rounded-full outline-none transition-transform",
                      "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      active && "ring-2 ring-foreground ring-offset-2 ring-offset-background"
                    )}
                    style={{ background: color }}
                  />
                );
              })}
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">玻璃参数</CardTitle>
          <CardDescription>拖动即时预览。</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          {RANGES.map((range) => {
            const value = panel[range.key];
            return (
              <Field
                key={range.key}
                label={range.label}
                value={`${Math.round(value * range.scale)}${range.unit}`}
              >
                <RangeSlider
                  value={value}
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  aria-label={range.label}
                  onValueChange={(next) => panelPatch({ [range.key]: next })}
                />
              </Field>
            );
          })}
        </CardContent>
        <CardContent className="grid gap-1 border-t border-border pt-4 sm:grid-cols-2">
          {TOGGLES.map((toggle) => (
            <ToggleRow key={toggle.key} label={toggle.label}>
              <Switch
                checked={panel[toggle.key]}
                ariaLabel={toggle.label}
                onCheckedChange={(checked) => panelPatch({ [toggle.key]: checked })}
              />
            </ToggleRow>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

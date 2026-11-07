import type { MonitorInfo, Settings } from "../types";
import { panelSize } from "../settingsDefaults";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from "@/components/motion/card";
import { Switch } from "@/components/motion/switch";
import { Input } from "@/components/motion/input";
import { RangeSlider } from "@/components/motion/range-slider";
import { Choice } from "./Choice";
import { Field, ToggleRow } from "./Field";

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
  const size = panelSize(columns);
  const width = size.width * settings.scale;
  const height = size.height * settings.scale;

  const monitorWidth = monitor?.width ?? 1920;
  const monitorHeight = monitor?.height ?? 1080;

  const maxX = Math.max(0, Math.round(monitorWidth - width));
  const maxY = Math.max(0, Math.round(monitorHeight - height));

  const setPosition = (patch: { x?: number; y?: number }) =>
    onChange({ position: { ...settings.position, ...patch } });

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle as="h2">位置与缩放</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <Choice
            label="显示器"
            value={settings.position.monitor ?? ""}
            onChange={(value) =>
              onChange({ position: { ...settings.position, monitor: value || null } })
            }
            options={[
              { value: "", label: "主显示器" },
              ...monitors.map((item) => ({
                value: item.name,
                label: `${item.label} (${Math.round(item.width)}×${Math.round(item.height)})${
                  item.isPrimary ? " · 主" : ""
                }`
              }))
            ]}
          />
          <Field label="缩放" value={`${Math.round(settings.scale * 100)}%`}>
            <RangeSlider
              value={settings.scale}
              min={0.3}
              max={2}
              step={0.05}
              showTicks={false}
              aria-label="缩放"
              onValueChange={(value) => onChange({ scale: value })}
            />
          </Field>
          <Field label="水平 X">
            <div className="flex items-center gap-3">
              <RangeSlider
                value={Math.min(settings.position.x, maxX)}
                min={0}
                max={maxX}
                step={1}
                showTicks={false}
                aria-label="水平位置"
                onValueChange={(value) => setPosition({ x: value })}
                className="flex-1"
              />
              <Input
                type="number"
                value={String(Math.round(settings.position.x))}
                onChange={(value) => setPosition({ x: Number(value) || 0 })}
                className="w-[86px] shrink-0"
                aria-label="水平位置数值"
              />
            </div>
          </Field>
          <Field label="垂直 Y">
            <div className="flex items-center gap-3">
              <RangeSlider
                value={Math.min(settings.position.y, maxY)}
                min={0}
                max={maxY}
                step={1}
                showTicks={false}
                aria-label="垂直位置"
                onValueChange={(value) => setPosition({ y: value })}
                className="flex-1"
              />
              <Input
                type="number"
                value={String(Math.round(settings.position.y))}
                onChange={(value) => setPosition({ y: Number(value) || 0 })}
                className="w-[86px] shrink-0"
                aria-label="垂直位置数值"
              />
            </div>
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">窗口行为</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-1">
          <ToggleRow
            label="始终置底"
            hint="固定在桌面层，不会挡住其它窗口；开启后每秒重新压回底层。"
          >
            <Switch
              checked={settings.desktopPin}
              ariaLabel="始终置底"
              onCheckedChange={(checked) => onChange({ desktopPin: checked })}
            />
          </ToggleRow>
          <ToggleRow label="鼠标穿透" hint="开启后鼠标点击直接落到桌面，组件不响应。">
            <Switch
              checked={settings.clickThrough}
              ariaLabel="鼠标穿透"
              onCheckedChange={(checked) => onChange({ clickThrough: checked })}
            />
          </ToggleRow>
          <ToggleRow label="显示组件">
            <Switch
              checked={settings.widgetVisible}
              ariaLabel="显示组件"
              onCheckedChange={(checked) => onChange({ widgetVisible: checked })}
            />
          </ToggleRow>
        </CardContent>
      </Card>
    </>
  );
}

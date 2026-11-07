import type { MonitorInfo, Settings } from "../types";
import { panelSize } from "../settingsDefaults";
import { Card, Grid, Row } from "../ui/Card";
import { Select } from "../ui/Select";
import { Switch } from "../ui/Switch";
import { Input } from "../ui/Input";
import { RangeSlider } from "../ui/RangeSlider";

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
      <Card
        title="位置与缩放"
        description="X/Y 是可见面板左上角的锚点，单位为逻辑像素。"
        index={0}
      >
        <Grid>
          <Select
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
          <Row
            stacked
            label={
              <span className="flex items-center justify-between gap-2">
                <span>缩放</span>
                <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
                  {Math.round(settings.scale * 100)}%
                </span>
              </span>
            }
          >
            <RangeSlider
              value={settings.scale}
              min={0.3}
              max={2}
              step={0.05}
              aria-label="缩放"
              onChange={(value) => onChange({ scale: value })}
            />
          </Row>
        </Grid>

        <div className="mt-2 grid gap-x-6 border-t border-border pt-2 sm:grid-cols-2">
          <Row label="水平 X">
            <div className="flex w-full items-center gap-2">
              <RangeSlider
                value={Math.min(settings.position.x, maxX)}
                min={0}
                max={maxX}
                step={1}
                aria-label="水平位置"
                onChange={(value) => setPosition({ x: value })}
                className="flex-1"
              />
              <Input
                type="number"
                shape="box"
                value={Math.round(settings.position.x)}
                onChange={(value) => setPosition({ x: Number(value) || 0 })}
                className="w-[78px] shrink-0"
                aria-label="水平位置数值"
              />
            </div>
          </Row>
          <Row label="垂直 Y">
            <div className="flex w-full items-center gap-2">
              <RangeSlider
                value={Math.min(settings.position.y, maxY)}
                min={0}
                max={maxY}
                step={1}
                aria-label="垂直位置"
                onChange={(value) => setPosition({ y: value })}
                className="flex-1"
              />
              <Input
                type="number"
                shape="box"
                value={Math.round(settings.position.y)}
                onChange={(value) => setPosition({ y: Number(value) || 0 })}
                className="w-[78px] shrink-0"
                aria-label="垂直位置数值"
              />
            </div>
          </Row>
        </div>
      </Card>

      <Card title="窗口行为" index={1}>
        <Row
          label="始终置底"
          hint="固定在桌面层，不会挡住其它窗口；开启后每秒重新压回底层。"
        >
          <Switch
            checked={settings.desktopPin}
            ariaLabel="始终置底"
            onCheckedChange={(checked) => onChange({ desktopPin: checked })}
          />
        </Row>
        <Row label="鼠标穿透" hint="开启后鼠标点击直接落到桌面，组件不响应。">
          <Switch
            checked={settings.clickThrough}
            ariaLabel="鼠标穿透"
            onCheckedChange={(checked) => onChange({ clickThrough: checked })}
          />
        </Row>
        <Row label="显示组件">
          <Switch
            checked={settings.widgetVisible}
            ariaLabel="显示组件"
            onCheckedChange={(checked) => onChange({ widgetVisible: checked })}
          />
        </Row>
      </Card>
    </>
  );
}

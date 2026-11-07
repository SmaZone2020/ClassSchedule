import type { PeriodTime, Settings } from "../types";
import { Card, Row } from "../ui/Card";
import { Input } from "../ui/Input";
import { Clock } from "./icons";

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
    <Card
      title="作息时间"
      description="用于高亮当前课程、判断当天是否已经结束。"
      icon={<Clock />}
      index={0}
    >
      <div className="grid gap-x-6 sm:grid-cols-2">
        {settings.periods.map((period) => (
          <Row key={period.index} label={`第 ${period.index} 节`}>
            <div className="flex w-full items-center gap-1.5">
              <Input
                type="time"
                shape="box"
                value={period.start}
                onChange={(value) => update(period.index, { start: value })}
                className="flex-1"
                aria-label={`第 ${period.index} 节开始`}
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="time"
                shape="box"
                value={period.end}
                onChange={(value) => update(period.index, { end: value })}
                className="flex-1"
                aria-label={`第 ${period.index} 节结束`}
              />
            </div>
          </Row>
        ))}
      </div>
    </Card>
  );
}

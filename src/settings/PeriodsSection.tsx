import type { PeriodTime, Settings } from "../types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/motion/card";
import { Input } from "@/components/motion/input";
import { Field } from "./Field";

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
    <Card>
      <CardHeader>
        <CardTitle as="h2">作息时间</CardTitle>
        <CardDescription>用于高亮当前课程、判断当天是否已经结束。</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {settings.periods.map((period) => (
          <Field key={period.index} label={`第 ${period.index} 节`}>
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={period.start}
                onChange={(value) => update(period.index, { start: value })}
                className="flex-1"
                aria-label={`第 ${period.index} 节开始`}
              />
              <span className="text-sm text-muted-foreground">–</span>
              <Input
                type="time"
                value={period.end}
                onChange={(value) => update(period.index, { end: value })}
                className="flex-1"
                aria-label={`第 ${period.index} 节结束`}
              />
            </div>
          </Field>
        ))}
      </CardContent>
    </Card>
  );
}

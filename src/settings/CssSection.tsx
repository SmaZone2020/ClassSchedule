import type { CustomCss, Settings } from "../types";
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
import { cn } from "@/lib/utils";
import { Field, ToggleRow } from "./Field";

interface CssSectionProps {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
}

const CONTAINER_PLACEHOLDER = `/* 课表容器（.schedule-panel）示例 */
background: linear-gradient(135deg, rgba(79,142,247,.35), rgba(124,108,247,.25));
border-radius: 24px;
box-shadow: 0 20px 60px rgba(0,0,0,.35);`;

const COURSE_PLACEHOLDER = `/* 课程卡（.course-card）示例 */
background: rgba(255,255,255,.16);
border-radius: 14px;
backdrop-filter: blur(10px);`;

/** Same surface as beUI's RangeSlider track, so the form reads as one set. */
const EDITOR_CLASS =
  "min-h-[132px] w-full resize-y rounded-lg bg-muted px-3 py-2.5 font-mono text-xs leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:ring-2 focus-visible:ring-ring";

export function CssSection({ settings, onChange }: CssSectionProps) {
  const css = settings.css;
  const patch = (value: Partial<CustomCss>) => onChange({ css: { ...css, ...value } });

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">高级 CSS</CardTitle>
        <CardDescription>以行内声明形式注入，无需写选择器和大括号。</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={() => patch({ container: "", course: "" })}>
            清空
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ToggleRow label="启用自定义 CSS">
          <Switch
            checked={css.enabled}
            ariaLabel="启用自定义 CSS"
            onCheckedChange={(checked) => patch({ enabled: checked })}
          />
        </ToggleRow>

        <Field label="课表容器 · .schedule-panel">
          <textarea
            className={cn(EDITOR_CLASS)}
            spellCheck={false}
            placeholder={CONTAINER_PLACEHOLDER}
            value={css.container}
            onChange={(event) => patch({ container: event.target.value })}
          />
        </Field>

        <Field label="课程项 · .course-card">
          <textarea
            className={cn(EDITOR_CLASS)}
            spellCheck={false}
            placeholder={COURSE_PLACEHOLDER}
            value={css.course}
            onChange={(event) => patch({ course: event.target.value })}
          />
        </Field>
      </CardContent>
    </Card>
  );
}

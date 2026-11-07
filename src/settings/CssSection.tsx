import type { CustomCss, Settings } from "../types";
import { Card, Row } from "../ui/Card";
import { Button } from "../ui/Button";
import { Switch } from "../ui/Switch";
import { Code } from "./icons";

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

const EDITOR_CLASS =
  "w-full min-h-[132px] resize-y rounded-xl border border-border bg-muted/40 px-3 py-2.5 font-mono text-[12px] leading-5 text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:ring-2 focus:ring-ring/25";

export function CssSection({ settings, onChange }: CssSectionProps) {
  const css = settings.css;
  const patch = (value: Partial<CustomCss>) => onChange({ css: { ...css, ...value } });

  return (
    <Card
      title="高级 CSS"
      description="以行内声明形式注入，无需写选择器和大括号。"
      icon={<Code />}
      index={0}
      actions={
        <Button
          variant="ghost"
          size="sm"
          onClick={() => patch({ container: "", course: "" })}
        >
          清空
        </Button>
      }
    >
      <Row label="启用自定义 CSS">
        <Switch
          checked={css.enabled}
          ariaLabel="启用自定义 CSS"
          onCheckedChange={(checked) => patch({ enabled: checked })}
        />
      </Row>

      <div className="mt-2 space-y-3">
        <div>
          <div className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
            课表容器 · .schedule-panel
          </div>
          <textarea
            className={EDITOR_CLASS}
            spellCheck={false}
            placeholder={CONTAINER_PLACEHOLDER}
            value={css.container}
            onChange={(event) => patch({ container: event.target.value })}
          />
        </div>
        <div>
          <div className="mb-1.5 px-1 text-[11px] font-semibold tracking-wide text-muted-foreground">
            课程项 · .course-card
          </div>
          <textarea
            className={EDITOR_CLASS}
            spellCheck={false}
            placeholder={COURSE_PLACEHOLDER}
            value={css.course}
            onChange={(event) => patch({ course: event.target.value })}
          />
        </div>
      </div>
    </Card>
  );
}

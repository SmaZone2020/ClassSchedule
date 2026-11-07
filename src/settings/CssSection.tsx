import type { CustomCss, Settings } from "../types";

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

export function CssSection({ settings, onChange }: CssSectionProps) {
  const css = settings.css;
  const patch = (value: Partial<CustomCss>) => onChange({ css: { ...css, ...value } });

  return (
    <div className="settings-card">
      <h2>高级 CSS</h2>
      <label className="settings-row">
        <span>启用自定义 CSS</span>
        <input
          type="checkbox"
          checked={css.enabled}
          onChange={(event) => patch({ enabled: event.target.checked })}
        />
      </label>
      <p className="settings-hint">
        代码以行内声明形式注入对应选择器（无需写选择器和大括号）。容器：.schedule-panel；课程项：.course-card。
      </p>
      <div className="css-scope-label">课表容器 (.schedule-panel)</div>
      <textarea
        className="css-editor"
        spellCheck={false}
        placeholder={CONTAINER_PLACEHOLDER}
        value={css.container}
        onChange={(event) => patch({ container: event.target.value })}
      />
      <div className="css-scope-label">课程项 (.course-card)</div>
      <textarea
        className="css-editor"
        spellCheck={false}
        placeholder={COURSE_PLACEHOLDER}
        value={css.course}
        onChange={(event) => patch({ course: event.target.value })}
      />
      <div className="settings-row" style={{ justifyContent: "flex-start", gap: 10 }}>
        <button className="secondary" onClick={() => patch({ container: "", course: "" })}>
          清空自定义 CSS
        </button>
      </div>
    </div>
  );
}

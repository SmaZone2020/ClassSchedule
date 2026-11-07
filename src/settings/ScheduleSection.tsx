import { useState } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Schedule, ValidationReport } from "../types";
import { Card, Row } from "../ui/Card";
import { Button } from "../ui/Button";
import { Bars } from "./icons";

interface ScheduleSectionProps {
  schedule: Schedule | null;
  configDir: string;
  onChanged: () => void;
}

export function ScheduleSection({ schedule, configDir, onChanged }: ScheduleSectionProps) {
  const [report, setReport] = useState<ValidationReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importSchedule = async () => {
    setBusy(true);
    setError(null);
    try {
      const path = await open({
        filters: [{ name: "课表 JSON", extensions: ["json"] }]
      });
      if (typeof path !== "string") return;
      const result = await invoke<{ report: ValidationReport; schedule: Schedule }>(
        "import_schedule_from_path",
        { path }
      );
      setReport(result.report);
      onChanged();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const downloadTemplate = async () => {
    setBusy(true);
    setError(null);
    try {
      const path = await save({
        defaultPath: "课表模板.json",
        filters: [{ name: "课表 JSON", extensions: ["json"] }]
      });
      if (!path) return;
      await invoke("export_template", { path });
      setReport({
        valid: true,
        error: null,
        meta: null,
        weeks: 0,
        sessions: 0,
        warnings: [`模板已保存到 ${path}`]
      });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const clearSchedule = async () => {
    setBusy(true);
    try {
      await invoke("clear_schedule");
      setReport(null);
      onChanged();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const summary = schedule
    ? `${schedule.meta?.semester ?? "未命名学期"} · ${schedule.weeks?.length ?? 0} 周 · ${
        schedule.sessions?.length ?? 0
      } 节课`
    : "尚未导入课表";

  return (
    <Card
      title="课表数据"
      description="导入 JSON 课表，或导出一份可编辑的模板。"
      icon={<Bars />}
      index={0}
      actions={
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
          {schedule ? "已导入" : "空"}
        </span>
      }
    >
      <Row label="当前课表" stacked>
        <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5 text-[13px] text-foreground">
          {summary}
        </div>
      </Row>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button onClick={importSchedule} disabled={busy}>
          导入 课表.json
        </Button>
        <Button variant="secondary" onClick={downloadTemplate} disabled={busy}>
          下载模板
        </Button>
        {schedule && (
          <Button variant="danger" onClick={clearSchedule} disabled={busy}>
            清除课表
          </Button>
        )}
      </div>

      <p className="mt-3 break-all text-[11px] leading-5 text-muted-foreground">
        数据目录：{configDir}
      </p>

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {report && (
        <div
          className={`mt-3 rounded-xl border px-3.5 py-2.5 text-xs leading-6 ${
            report.valid
              ? "border-success/25 bg-success/8 text-success"
              : "border-destructive/25 bg-destructive/8 text-destructive"
          }`}
        >
          {report.valid ? (
            <>
              <div>
                校验通过：{report.weeks} 周，{report.sessions} 节课
              </div>
              {report.warnings.map((warning) => (
                <div key={warning} className="text-muted-foreground">
                  {warning}
                </div>
              ))}
            </>
          ) : (
            <div>{report.error}</div>
          )}
        </div>
      )}
    </Card>
  );
}

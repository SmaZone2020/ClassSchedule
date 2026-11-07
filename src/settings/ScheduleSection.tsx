import { useState } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Schedule, ValidationReport } from "../types";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/motion/card";
import { Button } from "@/components/motion/button";
import { ToggleRow } from "./Field";

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
    <Card>
      <CardHeader>
        <CardTitle as="h2">课表数据</CardTitle>
        <CardDescription>导入 JSON 课表，或导出一份可编辑的模板。</CardDescription>
        <CardAction>
          <span className="text-xs text-muted-foreground">{schedule ? "已导入" : "空"}</span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ToggleRow label="当前课表">
          <span className="text-sm text-muted-foreground">{summary}</span>
        </ToggleRow>

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={importSchedule} disabled={busy}>
            导入JSON
          </Button>
          <Button variant="secondary" onClick={downloadTemplate} disabled={busy}>
            下载模板
          </Button>
          {schedule ? (
            <Button variant="outline" onClick={clearSchedule} disabled={busy}>
              清除课表
            </Button>
          ) : null}
        </div>

        <p className="break-all text-xs leading-relaxed text-muted-foreground">
          数据目录：{configDir}
        </p>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {report ? (
          <div className="text-sm leading-relaxed">
            {report.valid ? (
              <>
                <p className="text-foreground">
                  校验通过：{report.weeks} 周，{report.sessions} 节课
                </p>
                {report.warnings.map((warning) => (
                  <p key={warning} className="text-muted-foreground">
                    {warning}
                  </p>
                ))}
              </>
            ) : (
              <p className="text-destructive">{report.error}</p>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

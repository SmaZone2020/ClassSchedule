import { useState } from "react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Schedule, ValidationReport } from "../types";

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

  return (
    <div className="settings-card">
      <h2>课表数据</h2>
      <div className="settings-row">
        <span>
          {schedule
            ? `${schedule.meta?.semester ?? "未命名学期"} · ${schedule.weeks?.length ?? 0} 周 · ${
                schedule.sessions?.length ?? 0
              } 节课`
            : "尚未导入课表"}
        </span>
        <span className="status-pill">{schedule ? "已导入" : "空"}</span>
      </div>
      <div className="settings-row" style={{ justifyContent: "flex-start", gap: 10 }}>
        <button className="primary" onClick={importSchedule} disabled={busy}>
          导入 课表.json
        </button>
        <button className="secondary" onClick={downloadTemplate} disabled={busy}>
          下载模板
        </button>
        {schedule && (
          <button className="danger" onClick={clearSchedule} disabled={busy}>
            清除课表
          </button>
        )}
      </div>
      <p className="settings-hint">数据目录：{configDir}</p>
      {error && <div className="report-box bad">{error}</div>}
      {report && (
        <div className={`report-box ${report.valid ? "ok" : "bad"}`}>
          {report.valid ? (
            <>
              <div>✔ 校验通过：{report.weeks} 周，{report.sessions} 节课</div>
              {report.warnings.map((warning) => (
                <div key={warning}>⚠ {warning}</div>
              ))}
            </>
          ) : (
            <div>✘ {report.error}</div>
          )}
        </div>
      )}
    </div>
  );
}

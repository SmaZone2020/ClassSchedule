import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { FontCatalog, Settings } from "../types";
import { CUSTOM_FAMILY } from "../font";
import { Card, Row } from "../ui/Card";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { Font, Picture } from "./icons";

interface FontSectionProps {
  settings: Settings;
  catalog: FontCatalog | null;
  onChange: (patch: Partial<Settings>) => void;
  onCatalog: (catalog: FontCatalog) => void;
  onSilentChange: (patch: Partial<Settings>) => void;
}

const PREVIEW = "课表组件 Aa Bb 0123 高等数学 · 08:00";

export function FontSection({
  settings,
  catalog,
  onChange,
  onCatalog,
  onSilentChange
}: FontSectionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customCount = catalog?.custom.length ?? 0;

  const options = useMemo(() => {
    const list = [
      {
        value: CUSTOM_FAMILY,
        label: customCount
          ? `思源宋体（自定义，${customCount} 个字重）`
          : "思源宋体（自定义，未找到字体文件）"
      }
    ];
    for (const family of catalog?.system ?? []) {
      list.push({ value: family, label: family });
    }
    if (!list.some((item) => item.value === settings.font.family)) {
      list.push({ value: settings.font.family, label: settings.font.family });
    }
    return list;
  }, [catalog, customCount, settings.font.family]);

  const pickFolder = async () => {
    setBusy(true);
    setError(null);
    try {
      const picked = await open({ directory: true, multiple: false });
      if (typeof picked !== "string") return;
      const next = await invoke<FontCatalog>("set_font_dir", { dir: picked });
      onCatalog(next);
      onSilentChange({ font: { family: CUSTOM_FAMILY, dir: picked } });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    setBusy(true);
    setError(null);
    try {
      const picked = await open({
        multiple: false,
        filters: [{ name: "字体文件", extensions: ["ttf", "otf", "ttc", "woff2"] }]
      });
      if (typeof picked !== "string") return;
      const next = await invoke<FontCatalog>("set_font_dir", { dir: picked });
      onCatalog(next);
      onSilentChange({ font: { family: CUSTOM_FAMILY, dir: picked } });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const previewFont =
    settings.font.family === CUSTOM_FAMILY && customCount
      ? `"${CUSTOM_FAMILY}", "Source Han Serif CN", serif`
      : `"${settings.font.family}", "Microsoft YaHei", sans-serif`;

  return (
    <>
      <Card
        title="全局字体"
        description="同时作用于桌面组件与详情弹窗；默认使用 D 盘的思源宋体。"
        icon={<Font />}
        index={0}
      >
        <Select
          label="字体"
          value={settings.font.family}
          onChange={(value) => onChange({ font: { ...settings.font, family: value } })}
          options={options}
        />

        <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/40 px-4 py-6 text-center">
          <div
            className="text-[22px] leading-relaxed text-foreground"
            style={{ fontFamily: previewFont }}
          >
            {PREVIEW}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {settings.font.family === CUSTOM_FAMILY ? "自定义字体文件" : "系统已安装字体"}
          </div>
        </div>
      </Card>

      <Card
        title="自定义字体"
        description="选择字体文件夹或单个字体文件，无需安装到系统。"
        icon={<Picture />}
        index={1}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={pickFolder} disabled={busy}>
              选择文件夹…
            </Button>
            <Button variant="outline" size="sm" onClick={pickFile} disabled={busy}>
              选择文件…
            </Button>
          </div>
        }
      >
        <Row label="字体目录" stacked>
          <Input
            value={settings.font.dir}
            shape="box"
            readOnly
            onChange={() => {}}
            aria-label="字体目录"
          />
        </Row>

        <Row label="已识别的字重">
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {customCount ? `${customCount} 个` : "无"}
          </span>
        </Row>

        {customCount ? (
          <div className="mt-1 flex flex-wrap gap-1.5">
            {catalog?.custom.map((face) => (
              <span
                key={face.path}
                className="rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground"
                title={face.path}
              >
                {face.label} · {face.weight}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            默认目录 D:\Font\SiYuanSongTiRegular 不存在或没有字体文件，组件会回退到系统宋体。
          </p>
        )}

        {error && (
          <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}
      </Card>
    </>
  );
}

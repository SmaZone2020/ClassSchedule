import { useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { FontCatalog, Settings } from "../types";
import { CUSTOM_FAMILY } from "../font";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from "@/components/motion/card";
import { Button } from "@/components/motion/button";
import { Input } from "@/components/motion/input";
import { Choice } from "./Choice";
import { ToggleRow } from "./Field";

interface FontSectionProps {
  settings: Settings;
  catalog: FontCatalog | null;
  onChange: (patch: Partial<Settings>) => void;
  onCatalog: (catalog: FontCatalog) => void;
  onSilentChange: (patch: Partial<Settings>) => void;
}

const PREVIEW = "课表组件 Aa Bb 0123 高等数学 · 08:00";
const DEFAULT_FAMILY = "";

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
      { value: DEFAULT_FAMILY, label: "系统默认" },
      {
        value: CUSTOM_FAMILY,
        label: customCount
          ? `自定义字体（${customCount} 个字重）`
          : "自定义字体（未找到字体文件）"
      }
    ];
    for (const family of catalog?.system ?? []) {
      list.push({ value: family, label: family });
    }
    if (
      settings.font.family &&
      !list.some((item) => item.value === settings.font.family)
    ) {
      list.push({ value: settings.font.family, label: settings.font.family });
    }
    return list;
  }, [catalog, customCount, settings.font.family]);

  const pick = async (directory: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const picked = directory
        ? await open({ directory: true, multiple: false })
        : await open({
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
      ? `"${CUSTOM_FAMILY}", serif`
      : settings.font.family
        ? `"${settings.font.family}", sans-serif`
        : undefined;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle as="h2">全局字体</CardTitle>
          <CardDescription>默认跟随系统字体，也可以指定已安装字体或自定义字体文件。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Choice
            label="字体"
            value={settings.font.family}
            onChange={(value) => onChange({ font: { ...settings.font, family: value } })}
            options={options}
          />
          <div
            className="rounded-2xl bg-muted px-4 py-8 text-center text-[22px] leading-relaxed text-foreground"
            style={{ fontFamily: previewFont }}
          >
            {PREVIEW}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2">自定义字体</CardTitle>
          <CardDescription>选择字体文件夹或单个字体文件，无需安装到系统。</CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => pick(true)} disabled={busy}>
                选择文件夹…
              </Button>
              <Button variant="outline" size="sm" onClick={() => pick(false)} disabled={busy}>
                选择文件…
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Input
            label="字体目录"
            value={settings.font.dir}
            placeholder="尚未选择"
            readOnly
            onChange={() => {}}
          />
          <ToggleRow label="已识别的字重">
            <span className="text-sm tabular-nums text-muted-foreground">
              {customCount ? `${customCount} 个` : "无"}
            </span>
          </ToggleRow>
          <div className="flex flex-wrap gap-1.5">
            {customCount ? (
              catalog?.custom.map((face) => (
                <span
                  key={face.path}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  title={face.path}
                >
                  {face.label} · {face.weight}
                </span>
              ))
            ) : (
              <p className="text-sm leading-relaxed text-muted-foreground">
                还没有选择自定义字体文件，组件会使用上面的全局字体。
              </p>
            )}
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
        <CardFooter className="text-xs text-muted-foreground">
          {settings.font.family === CUSTOM_FAMILY
            ? "当前使用自定义字体文件"
            : settings.font.family
              ? "当前使用系统已安装字体"
              : "当前使用系统默认字体"}
        </CardFooter>
      </Card>
    </>
  );
}

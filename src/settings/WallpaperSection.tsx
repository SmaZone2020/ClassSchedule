import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Settings, WallpaperInfo } from "../types";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/motion/card";
import { Button } from "@/components/motion/button";
import { RangeSlider } from "@/components/motion/range-slider";
import { Field, ToggleRow } from "./Field";

interface WallpaperSectionProps {
  settings: Settings;
  wallpaper: WallpaperInfo | null;
  onChange: (patch: Partial<Settings>) => void;
  onWallpaperChanged: (info: WallpaperInfo) => void;
}

export function WallpaperSection({
  settings,
  wallpaper,
  onChange,
  onWallpaperChanged
}: WallpaperSectionProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const value = settings.wallpaper;

  const patch = (next: Partial<Settings["wallpaper"]>) =>
    onChange({ wallpaper: { ...value, ...next } });

  const pickImage = async () => {
    setBusy(true);
    setError(null);
    try {
      const path = await open({
        filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg", "webp", "bmp"] }]
      });
      if (typeof path !== "string") return;
      const info = await invoke<WallpaperInfo>("import_wallpaper", { path });
      onWallpaperChanged(info);
      patch({ mode: "custom", customPath: info.path });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const useSystem = async () => {
    setBusy(true);
    setError(null);
    try {
      const info = await invoke<WallpaperInfo>("set_wallpaper_mode", { mode: "system" });
      onWallpaperChanged(info);
      patch({ mode: "system" });
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const status = wallpaper?.error
    ? wallpaper.error
    : wallpaper?.dataUrl
      ? `已载入${wallpaper.source === "system" ? "系统壁纸" : "自定义壁纸"}`
      : "未载入壁纸";

  return (
    <Card>
      <CardHeader>
        <CardTitle as="h2">背景壁纸</CardTitle>
        <CardDescription>壁纸画进组件并按屏幕位置裁剪，所以模糊只作用于组件背景。</CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <Button
              variant={value.mode === "system" ? "primary" : "secondary"}
              size="sm"
              onClick={useSystem}
              disabled={busy}
            >
              跟随系统
            </Button>
            <Button variant="outline" size="sm" onClick={pickImage} disabled={busy}>
              选择图片…
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ToggleRow label="当前壁纸">
          <span className="max-w-[320px] truncate text-sm text-muted-foreground">{status}</span>
        </ToggleRow>
        <Field label="背景压暗" value={`${Math.round(value.dim * 100)}%`}>
          <RangeSlider
            value={value.dim}
            min={0}
            max={0.8}
            step={0.02}
            showTicks={false}
            aria-label="背景压暗"
            onValueChange={(next) => patch({ dim: next })}
          />
        </Field>
        {value.mode === "custom" && value.customPath ? (
          <p className="break-all text-xs leading-relaxed text-muted-foreground">
            当前文件：{value.customPath}
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}

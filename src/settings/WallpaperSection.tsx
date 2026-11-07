import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Settings, WallpaperInfo } from "../types";
import { Card, Row } from "../ui/Card";
import { Button } from "../ui/Button";
import { RangeSlider } from "../ui/RangeSlider";
import { Picture } from "./icons";

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
    <Card
      title="背景壁纸"
      description="壁纸画进组件并按屏幕位置裁剪，所以模糊只作用于组件背景。"
      icon={<Picture />}
      index={2}
      actions={
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
      }
    >
      <Row label="当前壁纸">
        <span className="max-w-[320px] truncate rounded-full bg-muted px-2.5 py-1 text-[11px] text-muted-foreground">
          {status}
        </span>
      </Row>

      <Row
        stacked
        label={
          <span className="flex items-center justify-between gap-2">
            <span>背景压暗</span>
            <span className="text-[11px] font-normal text-muted-foreground tabular-nums">
              {Math.round(value.dim * 100)}%
            </span>
          </span>
        }
      >
        <RangeSlider
          value={value.dim}
          min={0}
          max={0.8}
          step={0.02}
          aria-label="背景压暗"
          onChange={(next) => patch({ dim: next })}
        />
      </Row>

      {value.mode === "custom" && value.customPath && (
        <p className="mt-1 break-all text-[11px] leading-5 text-muted-foreground">
          当前文件：{value.customPath}
        </p>
      )}

      {error && (
        <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
    </Card>
  );
}

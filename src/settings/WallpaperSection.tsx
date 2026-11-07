import { useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import type { Settings, WallpaperInfo } from "../types";

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
    <div className="settings-card">
      <h2>背景壁纸</h2>
      <div className="settings-row">
        <span>
          壁纸来源
          <span className="status-pill" style={{ marginLeft: 8 }}>
            {status}
          </span>
        </span>
        <span style={{ display: "flex", gap: 8 }}>
          <button
            className={value.mode === "system" ? "primary" : "secondary"}
            onClick={useSystem}
            disabled={busy}
          >
            跟随系统
          </button>
          <button className="secondary" onClick={pickImage} disabled={busy}>
            选择图片…
          </button>
        </span>
      </div>
      <div className="settings-row">
        <label>背景压暗 {Math.round(value.dim * 100)}%</label>
        <input
          type="range"
          min={0}
          max={0.8}
          step={0.02}
          value={value.dim}
          onChange={(event) => patch({ dim: Number(event.target.value) })}
        />
      </div>
      <p className="settings-hint">
        组件窗口本身是透明的，无法直接模糊桌面。这里会把壁纸画进组件，并按组件在屏幕上的位置裁剪对齐，因此模糊只作用于组件背景，移动后仍与桌面壁纸严丝合缝。自定义壁纸会复制到数据目录。
      </p>
      {value.mode === "custom" && value.customPath && (
        <p className="settings-hint">当前文件：{value.customPath}</p>
      )}
      {error && <div className="report-box bad">{error}</div>}
    </div>
  );
}

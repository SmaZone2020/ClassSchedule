import type { MonitorInfo, Settings, WallpaperInfo, WidgetRect } from "../types";
import { shadowPad } from "../settingsDefaults";

interface WallpaperLayerProps {
  wallpaper: WallpaperInfo;
  settings: Settings;
  monitor: MonitorInfo;
  rect: WidgetRect;
}

export function resolveMonitor(
  monitors: MonitorInfo[],
  settings: Settings
): MonitorInfo | null {
  return (
    monitors.find((item) => item.name === settings.position.monitor) ??
    monitors.find((item) => item.isPrimary) ??
    monitors[0] ??
    null
  );
}

function backgroundSize(style: WallpaperInfo["style"]): string {
  switch (style) {
    case "stretch":
      return "100% 100%";
    case "fit":
      return "contain";
    case "center":
    case "tile":
      return "auto";
    default:
      return "cover";
  }
}

/**
 * Paints the desktop wallpaper crop behind the widget.
 *
 * The photo element is exactly monitor-sized and offset by the panel's screen
 * position, so it lines up pixel-for-pixel with the real desktop wallpaper. A
 * padded wrapper carries the blur so the filter never fades at a visible edge.
 * Only this layer is blurred; the desktop itself is untouched.
 */
export default function WallpaperLayer({
  wallpaper,
  settings,
  monitor,
  rect
}: WallpaperLayerProps) {
  if (!wallpaper.dataUrl) return null;

  const scale = Math.max(settings.scale, 0.1);
  const pad = shadowPad(settings.panel.shadowSize) * scale;
  const blur = Math.max(0, settings.panel.blur);
  const bleed = Math.ceil(blur * 2 + 8);
  const radius = settings.panel.radius * scale;

  // `rect` is the window; the visible panel starts one shadow margin inside it.
  const panelX = rect.x + pad;
  const panelY = rect.y + pad;

  return (
    <div
      className="wallpaper-clip"
      style={{ left: pad, top: pad, right: pad, bottom: pad, borderRadius: `${radius}px` }}
      aria-hidden="true"
    >
      <div
        className="wallpaper-blur"
        style={{
          left: -panelX - bleed,
          top: -panelY - bleed,
          width: monitor.width + bleed * 2,
          height: monitor.height + bleed * 2,
          filter: blur > 0 ? `blur(${blur}px) saturate(140%)` : "saturate(140%)"
        }}
      >
        <div
          className="wallpaper-photo"
          style={{
            left: bleed,
            top: bleed,
            width: monitor.width,
            height: monitor.height,
            backgroundImage: `url("${wallpaper.dataUrl}")`,
            backgroundSize: backgroundSize(wallpaper.style),
            backgroundPosition: "center",
            backgroundRepeat: wallpaper.style === "tile" ? "repeat" : "no-repeat"
          }}
        />
      </div>
      {settings.wallpaper.dim > 0 && (
        <div
          className="wallpaper-dim"
          style={{ background: `rgba(0, 0, 0, ${settings.wallpaper.dim})` }}
        />
      )}
    </div>
  );
}

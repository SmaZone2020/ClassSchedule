import { invoke } from "@tauri-apps/api/core";
import type { FontCatalog, FontSettings } from "./types";

const STYLE_ID = "app-font-faces";
export const CUSTOM_FAMILY = "WidgetCustomFont";

const FALLBACK = '"Segoe UI", "Microsoft YaHei", system-ui, sans-serif';

let cachedDir: string | null = null;
let cachedCatalog: FontCatalog | null = null;

function quote(family: string) {
  return `"${family.replace(/"/g, '\\"')}"`;
}

function writeFaces(catalog: FontCatalog) {
  const faces = catalog.custom
    .map(
      (face) => `@font-face {
  font-family: "${CUSTOM_FAMILY}";
  src: url("${face.url}");
  font-weight: ${face.weight};
  font-style: ${face.style};
  font-display: swap;
}`
    )
    .join("\n");

  let element = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
  if (!element) {
    element = document.createElement("style");
    element.id = STYLE_ID;
    document.head.appendChild(element);
  }
  element.textContent = faces;
}

/**
 * Resolve the custom font folder once per process. The folder scan walks the
 * disk, so keep the result around and only re-read when `dir` changes.
 */
export async function loadFontCatalog(dir: string): Promise<FontCatalog> {
  if (cachedDir === dir && cachedCatalog) return cachedCatalog;
  const catalog = await invoke<FontCatalog>("get_font_catalog");
  cachedDir = dir;
  cachedCatalog = catalog;
  return catalog;
}

export function invalidateFontCache() {
  cachedDir = null;
  cachedCatalog = null;
}

/**
 * Apply the user's font choice to the document.
 *
 * Custom faces are served by the `font://` protocol and declared here, so the
 * widget can use a font file that was never installed system-wide.
 */
export async function applyAppFont(font: FontSettings | undefined) {
  if (!font) return;
  const root = document.documentElement;

  // Empty means "no custom font": the document keeps its own default stack.
  if (!font.family) {
    root.style.removeProperty("--app-font");
    return;
  }

  if (font.family !== CUSTOM_FAMILY) {
    root.style.setProperty("--app-font", `${quote(font.family)}, ${FALLBACK}`);
    return;
  }

  try {
    const catalog = await loadFontCatalog(font.dir);
    if (catalog.custom.length) {
      writeFaces(catalog);
      root.style.setProperty("--app-font", `"${CUSTOM_FAMILY}", ${FALLBACK}`);
      return;
    }
  } catch {
    // Fall through to the default stack when the folder is missing.
  }

  root.style.removeProperty("--app-font");
}

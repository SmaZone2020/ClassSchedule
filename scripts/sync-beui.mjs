/**
 * Re-download the beUI components used by the settings window.
 *
 * The files are copied verbatim from the registry (default styling included)
 * into `src/`, so the components keep exactly the look and behaviour beUI
 * ships. `@/lib/*` and `@/components/motion/*` resolve through the `@` alias
 * in vite.config.ts / tsconfig.json.
 *
 * Only two edits are applied after download:
 *  - `inert={!open}` / bare `inert` become `""`, because React 18 types the
 *    attribute as a string and drops a boolean `true`.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const plan = {
  button: [
    "components/motion/button/index.tsx",
    "components/motion/button/base.tsx",
    "lib/ease.ts",
    "lib/hooks/use-hover-capable.ts",
    "lib/utils.ts"
  ],
  checkbox: ["components/motion/checkbox.tsx"],
  switch: ["components/motion/switch.tsx"],
  "range-slider": ["components/motion/range-slider.tsx", "lib/hooks/use-slider.ts", "lib/touch.ts"],
  select: [
    "components/motion/select.tsx",
    "lib/hooks/use-listbox.ts",
    "lib/hooks/use-on-open.ts",
    "lib/hooks/use-row-cursor.ts"
  ],
  input: ["components/motion/input.tsx"],
  tabs: ["components/motion/tabs.tsx"],
  card: ["components/motion/card.tsx"]
};

const root = process.cwd();

for (const [slug, paths] of Object.entries(plan)) {
  const res = await fetch(`https://beui.dev/r/${slug}`);
  if (!res.ok) throw new Error(`${slug}: ${res.status}`);
  const json = await res.json();
  for (const file of json.files) {
    if (!paths.includes(file.path)) continue;
    const target = join(root, "src", file.path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, file.content, "utf8");
    console.log("wrote", target);
  }
}

// React 18 typing fix: `inert` must be "" rather than a boolean.
for (const relative of ["src/components/motion/select.tsx", "src/components/motion/tabs.tsx"]) {
  const file = join(root, relative);
  const source = readFileSync(file, "utf8");
  const patched = source
    .replace("inert={!open}", 'inert={open ? undefined : ""}')
    .replace(/^(\s*)inert$/m, '$1inert=""');
  if (patched !== source) writeFileSync(file, patched, "utf8");
}

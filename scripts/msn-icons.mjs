#!/usr/bin/env node
/**
 * MSN 天气图标同步 / 去重脚本
 *
 * 用法:
 *   node scripts/msn-icons.mjs            # 下载缺失 + 去重 + 生成清单与预览页
 *   node scripts/msn-icons.mjs --dry-run  # 只报告，不改动文件
 *
 * 做的事:
 *   1. 按官方代码表 d000~d907 / n000~n907 下载 Condition_Card 下的 SVG
 *   2. 按文件内容(SHA-256)去重：同一张图只保留一个物理文件
 *   3. 被删除的名字写进 aliases，天气代码 → 实际文件 的映射写进 codes
 *      这样按 d320 之类代码取图时自动指向保留下来的那个文件
 *   4. 产出 msn_icon/_manifest.json 与 msn_icon_preview.html
 */

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "msn_icon");
const PREVIEW = path.join(ROOT, "msn_icon_preview.html");
const DRY = process.argv.includes("--dry-run");

const BASE =
  "https://assets.msn.cn/weathermapdata/1/static/weather/Icons/taskbar_v10/Condition_Card/";

/** 官方天气代码 → 图标名（取自 assets.msn.cn 天气前端 bundle，顺序即优先级） */
const CODES = {
  d000: "SunnyDayV3",
  d100: "MostlySunnyDay",
  d200: "D200PartlySunnyV2",
  d210: "D210LightRainShowersV2",
  d211: "D211LightRainSowShowersV2",
  d212: "D212LightSnowShowersV2",
  d220: "LightRainShowerDay",
  d221: "D221RainSnowShowersV2",
  d222: "SnowShowersDayV2",
  d240: "D240TstormsV2",
  d300: "MostlyCloudyDayV2",
  d310: "D310LightRainShowersV2",
  d311: "D311LightRainSnowShowersV2",
  d312: "LightSnowShowersDay",
  d320: "RainShowersDayV2",
  d321: "D321RainSnowShowersV2",
  d322: "SnowShowersDayV2",
  d340: "D340TstormsV2",
  d400: "CloudyV3",
  d410: "LightRainV3",
  d411: "RainSnowV2",
  d412: "LightSnowV2",
  d420: "HeavyDrizzle",
  d421: "RainSnowV2",
  d422: "Snow",
  d430: "ModerateRainV2",
  d431: "RainSnowV2",
  d432: "HeavySnowV2",
  d440: "Thunderstorm",
  d500: "MostlyCloudyDayV2",
  d600: "FogV2",
  d603: "FreezingRainV2",
  d605: "IcePelletsV2",
  d705: "BlowingHailV2",
  d900: "Haze",
  d905: "BlowingHailV2",
  d907: "Haze",
  n000: "ClearNightV3",
  n100: "MostlyClearNight",
  n200: "PartlyCloudyNightV2",
  n210: "N210LightRainShowersV2",
  n211: "N211LightRainSnowShowersV2",
  n212: "N212LightSnowShowersV2",
  n220: "LightRainShowerNight",
  n221: "N221RainSnowShowersV2",
  n222: "N222SnowShowersV2",
  n240: "N240TstormsV2",
  n300: "MostlyCloudyNightV2",
  n310: "N310LightRainShowersV2",
  n311: "N311LightRainSnowShowersV2",
  n312: "LightSnowShowersNight",
  n320: "RainShowersNightV2",
  n321: "N321RainSnowShowersV2",
  n322: "N322SnowShowersV2",
  n340: "N340TstormsV2",
  n400: "CloudyV3",
  n410: "LightRainV3",
  n411: "RainSnowV2",
  n412: "LightSnowV2",
  n420: "HeavyDrizzle",
  n421: "RainSnowShowersNightV2",
  n422: "N422SnowV2",
  n430: "ModerateRainV2",
  n431: "RainSnowV2",
  n432: "HeavySnowV2",
  n440: "Thunderstorm",
  n500: "PartlyCloudyNightV2",
  n600: "FogV2",
  n603: "FreezingRainV2",
  n605: "BlowingHailV2",
  n705: "BlowingHailV2",
  n900: "Hazy-Night",
  n905: "BlowingHailV2",
  n907: "Hazy-Night",
  xxxx1: "WindyV2",
};

/** 服务器上存在、但当前官方代码表没有引用的图标（保留，标记为 extra） */
const EXTRA = [
  "BlowingSnowV2",
  "Dust",
  "Dust1",
  "Fair",
  "HailDayV2",
  "HailNightV2",
  "HazySmokeV2",
  "IcePellets",
  "LightRainV2",
  "PartlyCloudyDayV3",
  "SmokeNight",
  "SnowShowersNightV2",
  "Thunderstorms",
  "ThunderstormsV2",
];

// ---------------------------------------------------------------- 工具函数

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const log = (...a) => console.log(...a);

async function download(name) {
  const url = BASE + encodeURIComponent(name) + ".svg";
  const res = await fetch(url);
  if (!res.ok) return null;
  const buf = Buffer.from(await res.arrayBuffer());
  const head = buf.toString("utf8", 0, 200);
  if (!/<svg/i.test(head)) return null;
  return buf;
}

// ---------------------------------------------------------------- 主流程

/** 名字 → 优先级（官方代码出现顺序，extras 排后面） */
function buildRank() {
  const rank = new Map();
  Object.values(CODES).forEach((name, i) => {
    if (!rank.has(name)) rank.set(name, i);
  });
  EXTRA.forEach((name, i) => {
    if (!rank.has(name)) rank.set(name, 10000 + i);
  });
  return rank;
}

async function main() {
  await mkdir(DIR, { recursive: true });
  const rank = buildRank();
  const wanted = [...rank.keys()].sort((a, b) => rank.get(a) - rank.get(b));

  // ---- 1. 补齐缺失文件（已被判为重复的名字不再下载）
  const existing = new Set(
    (await readdir(DIR).catch(() => []))
      .filter((f) => f.toLowerCase().endsWith(".svg"))
      .map((f) => f.replace(/\.svg$/i, "")),
  );

  const knownAliases = new Set();
  try {
    const prev = JSON.parse(await readFile(path.join(DIR, "_manifest.json"), "utf8"));
    for (const k of Object.keys(prev.aliases ?? {})) knownAliases.add(k);
  } catch {
    /* 首次运行，没有旧清单 */
  }

  const missing = wanted.filter((n) => !existing.has(n) && !knownAliases.has(n));
  if (missing.length) log(`下载 ${missing.length} 个缺失图标…`);
  let downloaded = 0;
  for (const name of missing) {
    const buf = await download(name);
    if (!buf) {
      log(`  ! 跳过 ${name}（服务器无此文件）`);
      continue;
    }
    if (!DRY) await writeFile(path.join(DIR, name + ".svg"), buf);
    downloaded++;
  }
  if (downloaded) log(`  已下载 ${downloaded} 个`);

  // ---- 2. 计算内容指纹并分组
  const files = (await readdir(DIR))
    .filter((f) => f.toLowerCase().endsWith(".svg"))
    .map((f) => f.replace(/\.svg$/i, ""));

  const byHash = new Map();
  for (const name of files) {
    const buf = await readFile(path.join(DIR, name + ".svg"));
    const h = sha256(buf);
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(name);
  }

  // ---- 3. 每组选一个规范名：官方优先 → 代码顺序靠前 → 名字短 → 字典序
  // 旧清单里的别名先继承下来，避免被跳过的重复名丢失映射
  const aliases = {};
  try {
    const prev = JSON.parse(await readFile(path.join(DIR, "_manifest.json"), "utf8"));
    for (const [k, v] of Object.entries(prev.aliases ?? {})) {
      if (files.includes(v)) aliases[k] = v;
    }
  } catch {
    /* 首次运行 */
  }

  const removed = Object.keys(aliases).sort();
  for (const [hash, group] of byHash) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => {
      const ra = rank.has(a) ? rank.get(a) : 20000;
      const rb = rank.has(b) ? rank.get(b) : 20000;
      if (ra !== rb) return ra - rb;
      if (a.length !== b.length) return a.length - b.length;
      return a.localeCompare(b);
    });
    const keep = sorted[0];
    for (const name of sorted.slice(1)) {
      aliases[name] = keep;
      if (!removed.includes(name)) removed.push(name);
      if (!DRY) await rm(path.join(DIR, name + ".svg"), { force: true });
      else log(`  (dry) 将删除 ${name}.svg → ${keep}.svg`);
    }
    log(`去重: ${sorted.slice(1).join(", ")} → ${keep}`);
  }
  removed.sort();

  // ---- 4. 生成清单
  const finalNames = (await readdir(DIR))
    .filter((f) => f.toLowerCase().endsWith(".svg"))
    .map((f) => f.replace(/\.svg$/i, ""))
    .sort((a, b) => a.localeCompare(b));

  const checksums = {};
  for (const name of finalNames) {
    checksums[name] = sha256(await readFile(path.join(DIR, name + ".svg")));
  }

  const resolve = (name) => aliases[name] ?? name;
  const codes = {};
  for (const [code, name] of Object.entries(CODES)) {
    codes[code] = { file: resolve(name) + ".svg", name: resolve(name) };
    if (aliases[name]) codes[code].alias = name;
  }

  const manifest = {
    source: BASE,
    generatedAt: new Date().toISOString(),
    totalFiles: finalNames.length,
    removedDuplicates: removed.sort(),
    aliases,
    codes,
    extras: EXTRA.filter((n) => finalNames.includes(n)).map((n) => ({
      name: n,
      file: n + ".svg",
    })),
    files: finalNames.map((n) => ({
      name: n,
      file: n + ".svg",
      sha256: checksums[n],
      codes: Object.keys(codes).filter((c) => codes[c].name === n),
    })),
  };

  if (!DRY) {
    await writeFile(
      path.join(DIR, "_manifest.json"),
      JSON.stringify(manifest, null, 2) + "\n",
      "utf8",
    );
    await writePreview(manifest);
    await writeReadme(manifest);
  }

  log("");
  log(`唯一图标: ${finalNames.length}`);
  log(`合并重复: ${removed.length}`);
  log(`天气代码: ${Object.keys(codes).length}`);
}

// ---------------------------------------------------------------- README

async function writeReadme(manifest) {
  const rows = manifest.files
    .map((f) => `| \`${f.name}\` | ${f.codes.length ? f.codes.map((c) => `\`${c}\``).join(" ") : "—"} |`)
    .join("\n");

  const aliasRows = manifest.removedDuplicates
    .map((n) => `| \`${n}\` | \`${manifest.aliases[n]}\` |`)
    .join("\n");

  const md = `# MSN 天气图标（Condition_Card）

共 **${manifest.totalFiles}** 个唯一图标，覆盖 **${Object.keys(manifest.codes).length}** 个天气代码。
来源：\`${manifest.source}\`

## 怎么用

天气代码（\`d000\`~\`d907\` 为白天，\`n000\`~\`n907\` 为夜间）→ 文件名，查 \`msn_icon/_manifest.json\` 的 \`codes\` 字段：

\`\`\`ts
import manifest from "./msn_icon/_manifest.json";

const icon = (code: string) =>
  new URL(\`./msn_icon/\${manifest.codes[code]?.file ?? "CloudyV3.svg"}\`, import.meta.url).href;
\`\`\`

重复图案已经合并成一个文件，被合并的名字仍保留在 \`aliases\` 里。
所以 \`d320\` 会自动指向 \`LightRainShowerDay.svg\`，不需要你手工删文件或改代码。

## 重新同步

\`\`\`bash
node scripts/msn-icons.mjs            # 下载缺失 + 去重 + 重写清单/预览
node scripts/msn-icons.mjs --dry-run  # 只看会做什么
\`\`\`

## 图标 → 天气代码

| 文件 | 天气代码 |
| --- | --- |
${rows}

## 已合并的重复名

| 被合并的名字 | 实际使用 |
| --- | --- |
${aliasRows}

> 这些图案在 MSN 侧本身就是同一张图（例如 \`d221\`/\`d311\`/\`d321\` 共用一份图形），
> 不是下载错误。合并只删物理文件，不丢代码映射。
`;

  await writeFile(path.join(DIR, "README.md"), md, "utf8");
  log("说明文档已生成: msn_icon/README.md");
}

// ---------------------------------------------------------------- 预览页

async function writePreview(manifest) {
  const card = (f) => {
    const dup = manifest.files.find((x) => x.file === f.file);
    const aliasLine =
      dup && dup.name !== undefined
        ? Object.keys(manifest.aliases)
            .filter((k) => manifest.aliases[k] === dup.name)
            .join(", ")
        : "";
    const codeLine = dup ? dup.codes.join(" ") : "";
    return `<div class="card">
  <img src="msn_icon/${f.file}" alt="${f.name}" loading="lazy">
  <div class="n">${f.name}</div>
  ${codeLine ? `<div class="c">${codeLine}</div>` : ""}
  ${aliasLine ? `<div class="a">合并: ${aliasLine}</div>` : ""}
</div>`;
  };

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>MSN 天气图标 · ${manifest.totalFiles}</title>
<style>
  :root { color-scheme: light }
  body { font-family: "Segoe UI", system-ui, -apple-system, sans-serif; margin: 0; padding: 28px; background: #f4f6f9; color: #101828 }
  h1 { font-size: 19px; margin: 0 0 4px }
  p.sub { margin: 0 0 22px; color: #667085; font-size: 13px; line-height: 1.6 }
  code { background: #eaecf0; padding: 1px 5px; border-radius: 4px; font-size: 12px }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(136px, 1fr)); gap: 12px }
  .card { background: #fff; border: 1px solid #e4e7ec; border-radius: 12px; padding: 12px 10px; text-align: center; box-shadow: 0 1px 2px rgba(16,24,40,.04); transition: box-shadow .15s, transform .15s }
  .card:hover { box-shadow: 0 4px 12px rgba(16,24,40,.08); transform: translateY(-1px) }
  .card img { width: 72px; height: 72px; display: block; margin: 0 auto 6px }
  .n { font-size: 10.5px; color: #344054; word-break: break-word; line-height: 1.35; font-weight: 500 }
  .c { margin-top: 5px; font-size: 9.5px; color: #98a2b3; font-family: ui-monospace, Consolas, monospace; line-height: 1.4 }
  .a { margin-top: 4px; font-size: 9.5px; color: #b54708; line-height: 1.35 }
</style>
</head>
<body>
<h1>MSN 天气 · Condition_Card</h1>
<p class="sub">
  共 <strong>${manifest.totalFiles}</strong> 个唯一图标，覆盖 <strong>${Object.keys(manifest.codes).length}</strong> 个天气代码，
  已合并 <strong>${manifest.removedDuplicates.length}</strong> 个重复文件（名称保留在 <code>msn_icon/_manifest.json</code> 的 <code>aliases</code> 中）。<br>
  路径：<code>${manifest.source}</code>
</p>
<div class="grid">
${manifest.files.map(card).join("\n")}
</div>
</body>
</html>
`;

  await writeFile(PREVIEW, html, "utf8");
  log(`预览页已生成: ${path.relative(ROOT, PREVIEW)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

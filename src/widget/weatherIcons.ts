import manifest from "../../msn_icon/_manifest.json";

const urls = import.meta.glob("/msn_icon/*.svg", {
  eager: true,
  query: "?url",
  import: "default"
}) as Record<string, string>;

const byName = new Map<string, string>();
for (const [path, url] of Object.entries(urls)) {
  byName.set(path.split("/").pop() ?? path, url);
}

const fallback = byName.get("CloudyV3.svg") ?? "";

/** Resolve an MSN code such as `d310` to the bundled SVG url. */
export function weatherIconUrl(code: string): string {
  const entry = (manifest.codes as Record<string, { file: string }>)[code];
  return (entry && byName.get(entry.file)) || fallback;
}

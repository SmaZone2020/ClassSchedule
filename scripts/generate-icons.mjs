import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve("src-tauri/icons");
mkdirSync(outDir, { recursive: true });

const crcTable = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function roundedSdf(x, y, left, top, right, bottom, radius) {
  const cx = (left + right) / 2;
  const cy = (top + bottom) / 2;
  const hw = (right - left) / 2;
  const hh = (bottom - top) / 2;
  const dx = Math.abs(x - cx) - (hw - radius);
  const dy = Math.abs(y - cy) - (hh - radius);
  const ax = Math.max(dx, 0);
  const ay = Math.max(dy, 0);
  return Math.sqrt(ax * ax + ay * ay) + Math.min(Math.max(dx, dy), 0) - radius;
}

const SAMPLES = [
  [0, 0],
  [0.25, 0.25],
  [0.5, 0.5],
  [0.75, 0.75],
  [0.25, 0.75],
  [0.75, 0.25],
  [0.5, 0],
  [0, 0.5],
  [1, 0.5],
  [0.5, 1]
];

function sampleColor(x, y, size) {
  const s = size / 32;
  const pad = 1.5 * s;
  const radius = 8.5 * s;

  if (roundedSdf(x, y, pad, pad, size - pad, size - pad, radius) > 0) return null;

  const t = (x / size) * 0.55 + (y / size) * 0.45;
  let r = 46 + t * 44;
  let g = 120 + t * 78;
  let b = 240 + t * 15;

  const cardLeft = 6.5 * s;
  const cardTop = 7.5 * s;
  const cardRight = 25.5 * s;
  const cardBottom = 24.5 * s;
  if (roundedSdf(x, y, cardLeft, cardTop, cardRight, cardBottom, 3 * s) < 0) {
    r = 250;
    g = 252;
    b = 255;

    if (y < cardTop + 6 * s) {
      r = 208;
      g = 230;
      b = 252;
    } else {
      const cols = [9.5, 14, 18.5, 23].map((v) => v * s);
      const rows = [16.8, 20.6].map((v) => v * s);
      for (const gx of cols) {
        for (const gy of rows) {
          if (Math.hypot(x - gx, y - gy) < 1.15 * s) {
            const active = gx === cols[1] && gy === rows[0];
            r = active ? 62 : 176;
            g = active ? 132 : 196;
            b = active ? 246 : 222;
          }
        }
      }
    }
  }

  return [r, g, b];
}

function render(size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * stride + 1 + x * 4;
      let rs = 0;
      let gs = 0;
      let bs = 0;
      let hits = 0;
      for (const [ox, oy] of SAMPLES) {
        const c = sampleColor(x + ox, y + oy, size);
        if (!c) continue;
        rs += c[0];
        gs += c[1];
        bs += c[2];
        hits++;
      }
      if (!hits) continue;
      raw[i] = Math.round(rs / hits);
      raw[i + 1] = Math.round(gs / hits);
      raw[i + 2] = Math.round(bs / hits);
      raw[i + 3] = Math.round((255 * hits) / SAMPLES.length);
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = 6 + pngs.length * 16;
  const entries = pngs.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const files = [
  [32, "32x32.png"],
  [128, "128x128.png"],
  [256, "128x128@2x.png"],
  [512, "icon.png"]
];

for (const [size, name] of files) writeFileSync(resolve(outDir, name), render(size));

writeFileSync(
  resolve(outDir, "icon.ico"),
  ico([32, 64, 128, 256].map((size) => ({ size, data: render(size) })))
);

writeFileSync(resolve(outDir, "icon.icns"), render(512));
console.log("icons generated");

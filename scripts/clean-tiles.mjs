import { writeFile, mkdir, readdir, copyFile } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "public", "tiles");
const DST = join(ROOT, "public", "tiles-clean");
const ICONS = join(ROOT, "public", "mapicons.json");
const SPRITE = 15;
const TILE_PX = 256;
const PPS = 8;
const NATIVE_Z = 3;
const TOL = Number(process.env.TOL ?? 16);
const FRAME_MATCH = Number(process.env.FRAME_MATCH ?? 0.8);
const SEARCH = 3;

if (!existsSync(ICONS)) {
  console.error("public/mapicons.json not found. Run: node scripts/fetch-icons.mjs");
  process.exit(1);
}
if (!existsSync(SRC)) {
  console.error("public/tiles not found. Run: node scripts/fetch-tiles.mjs");
  process.exit(1);
}

const meta = JSON.parse(readFileSync(ICONS, "utf8"));

const sprites = [];
for (const [key, d] of Object.entries(meta.types)) {
  if (key.startsWith("unlisted_")) continue;
  const p = join(ROOT, "public", "mapicons", d.file);
  if (!existsSync(p)) continue;
  const im = PNG.sync.read(readFileSync(p));
  if (im.width === SPRITE && im.height === SPRITE) sprites.push(im);
}
const disc = [];
const frame = [];
for (let y = 0; y < SPRITE; y++) {
  for (let x = 0; x < SPRITE; x++) {
    const i = (SPRITE * y + x) << 2;
    let opaque = 0;
    let same = 0;
    const f = sprites[0].data;
    for (const s of sprites) {
      if (s.data[i + 3] > 200) opaque++;
      if (s.data[i + 3] > 200 && s.data[i] === f[i] && s.data[i + 1] === f[i + 1] && s.data[i + 2] === f[i + 2]) same++;
    }
    if (opaque / sprites.length >= 0.92) disc.push([x, y]);
    if (same === sprites.length) frame.push([x, y, f[i], f[i + 1], f[i + 2]]);
  }
}
const inDisc = new Set(disc.map(([x, y]) => y * SPRITE + x));
console.log(`${sprites.length} sprites, ${frame.length} frame pixels, ${disc.length} disc pixels`);

const C = (SPRITE - 1) / 2;

function erase(im, ox, oy) {
  const src = Buffer.from(im.data);
  for (const [x, y] of disc) {
    let dx = x - C;
    let dy = y - C;
    const len = Math.hypot(dx, dy) || 1;
    dx /= len;
    dy /= len;
    let sx = x;
    let sy = y;
    for (let step = 1; step <= SPRITE; step++) {
      const nx = Math.round(x + dx * step);
      const ny = Math.round(y + dy * step);
      if (!inDisc.has(ny * SPRITE + nx)) {
        sx = nx;
        sy = ny;
        break;
      }
    }
    const tx = ox + sx;
    const ty = oy + sy;
    const px = ox + x;
    const py = oy + y;
    if (px < 0 || py < 0 || px >= im.width || py >= im.height) continue;
    const s = (im.width * Math.min(im.height - 1, Math.max(0, ty)) + Math.min(im.width - 1, Math.max(0, tx))) << 2;
    const d = (im.width * py + px) << 2;
    im.data[d] = src[s];
    im.data[d + 1] = src[s + 1];
    im.data[d + 2] = src[s + 2];
  }
}

function frameScore(im, ox, oy) {
  let h = 0;
  for (const [x, y, r, g, b] of frame) {
    const px = ox + x;
    const py = oy + y;
    if (px < 0 || py < 0 || px >= im.width || py >= im.height) continue;
    const j = (im.width * py + px) << 2;
    if (Math.abs(im.data[j] - r) <= TOL && Math.abs(im.data[j + 1] - g) <= TOL && Math.abs(im.data[j + 2] - b) <= TOL) h++;
  }
  return h / frame.length;
}

const levels = (await readdir(SRC)).filter((d) => /^\d+$/.test(d)).map(Number).sort();
let erased = 0;
let missed = 0;
let copied = 0;

for (const z of levels) {
  const span = TILE_PX / (1 << z);
  const scale = TILE_PX / span;
  const byTile = new Map();

  for (const [, wx, wy] of meta.icons) {
    const tx = Math.floor(wx / span);
    const ty = Math.floor(wy / span);
    const k = `${tx}_${ty}`;
    const cx = (wx - tx * span) * scale;
    const cy = ((ty + 1) * span - wy) * scale;
    if (!byTile.has(k)) byTile.set(k, []);
    byTile.get(k).push([cx, cy]);
  }

  await mkdir(join(DST, String(z)), { recursive: true });
  const files = (await readdir(join(SRC, String(z)))).filter((f) => f.endsWith(".png"));

  for (const f of files) {
    const key = f.slice(0, -4);
    const hits = byTile.get(key);
    const from = join(SRC, String(z), f);
    const to = join(DST, String(z), f);

    if (!hits) {
      await copyFile(from, to);
      copied++;
      continue;
    }

    const im = PNG.sync.read(readFileSync(from));
    let touched = false;
    for (const [cx, cy] of hits) {
      let best = { s: 0, ox: 0, oy: 0 };
      for (let dy = -SEARCH; dy <= SEARCH; dy++) {
        for (let dx = -SEARCH; dx <= SEARCH; dx++) {
          const ox = Math.round(cx - C) + dx;
          const oy = Math.round(cy - C) + dy;
          const s = frameScore(im, ox, oy);
          if (s > best.s) best = { s, ox, oy };
        }
      }
      if (best.s < FRAME_MATCH) {
        missed++;
        continue;
      }
      erase(im, best.ox, best.oy);
      erased++;
      touched = true;
    }
    await writeFile(to, PNG.sync.write(im));
    if (!touched) copied++;
  }
  process.stdout.write(`\r  z${z}: done`);
}

console.log();
console.log(`erased ${erased} baked icons, ${missed} not found at the expected spot, ${copied} tiles copied untouched`);
console.log(`clean tiles in public/tiles-clean/, originals untouched in public/tiles/`);

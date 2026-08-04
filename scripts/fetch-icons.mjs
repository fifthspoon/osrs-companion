// Builds the map icon overlay by scanning the downloaded tiles for the wiki's
// own icon sprites. Run fetch-tiles.mjs first. See CONTRIBUTING.md
// "The icon overlay" for why it works this way.
//
// CALIBRATE=1 additionally scores the result against the wiki's 2019 placement
// data and reports recall and invention rates instead of writing output.

import { writeFile, mkdir, readdir } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://maps.runescape.wiki/osrs";
const DEFS = `${BASE}/data/iconLists/MainIcons.json`;
const TRUTH = `${BASE}/data/overlayMaps/MainMapIconLoc.json`;
const UA = "osrs-companion/0.1 (personal local tool)";

const TILES = join(ROOT, "public", "tiles", "3");
const OUT_DIR = join(ROOT, "public", "mapicons");
const TILE_PX = 256;
const SPAN = 32;
const PPS = TILE_PX / SPAN;
const PAD = 8;
const ANCHORS = Number(process.env.ANCHORS ?? 25);
const THRESHOLD = Number(process.env.THRESHOLD ?? 0.75);
const CALIBRATE = process.env.CALIBRATE === "1";
const TOL = Number(process.env.TOL ?? 16);

if (!existsSync(TILES)) {
  console.error("public/tiles/3 not found. Run: node scripts/fetch-tiles.mjs");
  process.exit(1);
}

async function getJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} on ${url}`);
  return r.json();
}

const defs = await getJson(DEFS);
await mkdir(OUT_DIR, { recursive: true });

const sprites = [];
const types = {};
let pulled = 0;

for (const [key, d] of Object.entries(defs.icons)) {
  const dest = join(OUT_DIR, d.filename);
  if (!existsSync(dest)) {
    const r = await fetch(`${defs.folder}${d.filename}`, { headers: { "User-Agent": UA } });
    if (!r.ok) continue;
    await writeFile(dest, Buffer.from(await r.arrayBuffer()));
    pulled++;
  }
  const im = PNG.sync.read(readFileSync(dest));
  const opaque = [];
  for (let y = 0; y < im.height; y++) {
    for (let x = 0; x < im.width; x++) {
      const i = (im.width * y + x) << 2;
      if (im.data[i + 3] > 200) opaque.push([x, y, im.data[i], im.data[i + 1], im.data[i + 2]]);
    }
  }
  if (!opaque.length) continue;
  sprites.push({ key, w: im.width, h: im.height, opaque });
  types[key] = { file: d.filename, name: d.name, category: d.category ?? "" };
}
console.log(`${sprites.length} sprites (${pulled} newly downloaded)`);

// Anchor on the rarest colours. Every sprite shares the near-black outline, so
// indexing on that would put all 108 candidates behind one key and make the
// scan exhaustive again.
const freq = new Map();
for (const s of sprites) for (const [, , r, g, b] of s.opaque) {
  const k = (r << 16) | (g << 8) | b;
  freq.set(k, (freq.get(k) ?? 0) + 1);
}
const index = new Map();
for (const s of sprites) {
  const ranked = [...s.opaque].sort(
    (a, b) => freq.get((a[2] << 16) | (a[3] << 8) | a[4]) - freq.get((b[2] << 16) | (b[3] << 8) | b[4]),
  );
  const seen = new Set();
  let taken = 0;
  for (const [x, y, r, g, b] of ranked) {
    const k = (r << 16) | (g << 8) | b;
    if (seen.has(k)) continue;
    seen.add(k);
    if (!index.has(k)) index.set(k, []);
    index.get(k).push({ s, dx: x, dy: y });
    if (++taken >= ANCHORS) break;
  }
}
console.log(`index: ${index.size} colours, ${[...index.values()].reduce((n, v) => n + v.length, 0)} entries`);

const tileFiles = (await readdir(TILES)).filter((f) => f.endsWith(".png"));
const have = new Set(tileFiles.map((f) => f.slice(0, -4)));
const cache = new Map();

function tile(tx, ty) {
  const k = `${tx}_${ty}`;
  if (!have.has(k)) return null;
  let im = cache.get(k);
  if (!im) {
    im = PNG.sync.read(readFileSync(join(TILES, `${k}.png`)));
    if (cache.size > 96) cache.delete(cache.keys().next().value);
    cache.set(k, im);
  }
  return im;
}

// Padded canvas so an icon straddling a tile seam is still matched whole.
const SIDE = TILE_PX + PAD * 2;
const buf = new Uint8Array(SIDE * SIDE * 3);

function padded(tx, ty) {
  buf.fill(0);
  for (let ny = -1; ny <= 1; ny++) {
    for (let nx = -1; nx <= 1; nx++) {
      const im = tile(tx + nx, ty - ny);
      if (!im) continue;
      const offX = nx * TILE_PX + PAD;
      const offY = ny * TILE_PX + PAD;
      const x0 = Math.max(0, -offX), x1 = Math.min(TILE_PX, SIDE - offX);
      const y0 = Math.max(0, -offY), y1 = Math.min(TILE_PX, SIDE - offY);
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const src = (im.width * y + x) << 2;
          const dst = ((offY + y) * SIDE + offX + x) * 3;
          buf[dst] = im.data[src];
          buf[dst + 1] = im.data[src + 1];
          buf[dst + 2] = im.data[src + 2];
        }
      }
    }
  }
}

function scanTile(tx, ty) {
  padded(tx, ty);
  const hits = [];
  const tried = new Set();
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      const p = (y * SIDE + x) * 3;
      const cands = index.get((buf[p] << 16) | (buf[p + 1] << 8) | buf[p + 2]);
      if (!cands) continue;
      for (const { s, dx, dy } of cands) {
        const ox = x - dx, oy = y - dy;
        if (ox < 0 || oy < 0 || ox + s.w > SIDE || oy + s.h > SIDE) continue;
        const id = ((oy * SIDE + ox) << 8) | sprites.indexOf(s);
        if (tried.has(id)) continue;
        tried.add(id);
        let hit = 0;
        for (const [sx, sy, r, g, b] of s.opaque) {
          const j = ((oy + sy) * SIDE + ox + sx) * 3;
          if (Math.abs(buf[j] - r) <= TOL && Math.abs(buf[j + 1] - g) <= TOL && Math.abs(buf[j + 2] - b) <= TOL) hit++;
        }
        const frac = hit / s.opaque.length;
        if (frac < THRESHOLD) continue;
        // Centre in this tile's own pixel space, so seam matches are only
        // claimed by the tile that actually contains them.
        const cx = ox + s.w / 2 - PAD;
        const cy = oy + s.h / 2 - PAD;
        if (cx < 0 || cx >= TILE_PX || cy < 0 || cy >= TILE_PX) continue;
        hits.push({ key: s.key, frac, cx, cy });
      }
    }
  }
  hits.sort((a, b) => b.frac - a.frac);
  const keep = [];
  for (const h of hits) {
    if (keep.some((k) => Math.abs(k.cx - h.cx) < 6 && Math.abs(k.cy - h.cy) < 6)) continue;
    keep.push(h);
  }
  return keep.map((h) => [
    h.key,
    Math.round((tx * SPAN + h.cx / PPS) * 10) / 10,
    Math.round(((ty + 1) * SPAN - h.cy / PPS) * 10) / 10,
    Math.round(h.frac * 100),
  ]);
}

const coords = tileFiles.map((f) => f.slice(0, -4).split("_").map(Number));
const icons = [];
const started = Date.now();

for (let i = 0; i < coords.length; i++) {
  const [tx, ty] = coords[i];
  icons.push(...scanTile(tx, ty));
  if (i % 100 === 0 || i === coords.length - 1) {
    const pct = ((i + 1) / coords.length) * 100;
    const secs = (Date.now() - started) / 1000;
    process.stdout.write(`\r  ${i + 1}/${coords.length} tiles (${pct.toFixed(1)}%), ${icons.length} icons, ${secs.toFixed(0)}s`);
  }
}
console.log();

const counts = {};
for (const [k] of icons) counts[k] = (counts[k] ?? 0) + 1;

if (CALIBRATE) {
  const truth = (await getJson(TRUTH)).features
    .filter((f) => f.properties.mapID === 0 && f.geometry.coordinates[2] === 0)
    .map((f) => [f.properties.icon, f.geometry.coordinates[0], f.geometry.coordinates[1]]);

  // Only score where the 2019 data is trustworthy. Post-2019 regions legitimately
  // have icons it never knew about, so counting those as inventions is wrong.
  const box = (x, y) => x >= 2900 && x <= 3400 && y >= 3150 && y <= 3550;
  const t = truth.filter(([, x, y]) => box(x, y));
  const g = icons.filter(([, x, y]) => box(x, y));
  const near = (a, b) => Math.abs(a[1] - b[1]) < 3 && Math.abs(a[2] - b[2]) < 3;

  const found = t.filter((x) => g.some((y) => y[0] === x[0] && near(x, y)));
  const invented = g.filter((y) => !t.some((x) => x[0] === y[0] && near(x, y)));
  console.log(`\nCALIBRATION over the pre-2019 core (Varrock, Falador, Lumbridge, Barbarian Village)`);
  console.log(`  threshold          ${THRESHOLD}`);
  console.log(`  2019 icons in box  ${t.length}`);
  console.log(`  scanned in box     ${g.length}`);
  console.log(`  recall             ${found.length}/${t.length} = ${((100 * found.length) / t.length).toFixed(1)}%`);
  console.log(`  unmatched by 2019  ${invented.length} = ${((100 * invented.length) / Math.max(1, g.length)).toFixed(1)}% of scanned`);
  const weak = invented.filter((x) => x[3] < 80).length;
  console.log(`  of those, under 80% pixel match: ${weak}`);
  process.exit(0);
}

await writeFile(
  join(ROOT, "public", "mapicons.json"),
  JSON.stringify({ source: "scanned from tiles", threshold: THRESHOLD, types, icons }),
);

console.log(`\nwrote ${icons.length} icons across ${Object.keys(counts).length} types to public/mapicons.json`);
console.log(
  "most common:",
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}=${v}`).join(" "),
);


import { writeFile, mkdir, readdir } from "node:fs/promises";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
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
const SPRITE = 15;
const FRAME_MATCH = Number(process.env.FRAME_MATCH ?? 0.80);
const THRESHOLD = Number(process.env.THRESHOLD ?? 0.75);
const CALIBRATE = process.env.CALIBRATE === "1";
const TOL = Number(process.env.TOL ?? 16);
const PROBE = process.env.PROBE === "1";

const EXTRA_SPRITES = [];
const PROBE_RANGE = [1448, 1900];

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

const catalogue = Object.entries(defs.icons).map(([key, d]) => ({ key, file: d.filename, name: d.name, category: d.category ?? "" }));

if (PROBE) {
  const known = new Set(catalogue.map((c) => parseInt(c.file)));
  const hits = [];
  for (let id = PROBE_RANGE[0]; id <= PROBE_RANGE[1]; id++) {
    if (known.has(id)) continue;
    const r = await fetch(`${defs.folder}${id}-0.png`, { headers: { "User-Agent": UA } });
    if (r.ok) hits.push(id);
  }
  console.log(`probe over ${PROBE_RANGE[0]}..${PROBE_RANGE[1]} found ${hits.length} sprites absent from MainIcons.json:`);
  console.log(`  const EXTRA_SPRITES = [${hits.join(", ")}];`);
  process.exit(0);
}

for (const id of EXTRA_SPRITES) {
  catalogue.push({ key: `extra_${id}`, file: `${id}-0.png`, name: `Map icon ${id}`, category: "unlisted" });
}

const sprites = [];
const types = {};
let pulled = 0;

for (const d of catalogue) {
  const key = d.key;
  const dest = join(OUT_DIR, d.file);
  if (!existsSync(dest)) {
    const r = await fetch(`${defs.folder}${d.file}`, { headers: { "User-Agent": UA } });
    if (!r.ok) continue;
    await writeFile(dest, Buffer.from(await r.arrayBuffer()));
    pulled++;
  }
  const im = PNG.sync.read(readFileSync(dest));
  if (im.width !== SPRITE || im.height !== SPRITE) continue;
  sprites.push({ key, data: im.data });
  types[key] = { file: d.file, name: d.name, category: d.category };
}
console.log(`${sprites.length} sprites (${pulled} newly downloaded)`);

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
if (!frame.length) throw new Error("no shared frame found across sprites");
const FRAME_RGB = [frame[0][2], frame[0][3], frame[0][4]];
console.log(`frame: ${frame.length} shared pixels, colour ${FRAME_RGB.join(",")}; disc: ${disc.length} pixels`);

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

const unlisted = new Map();

function classify(ox, oy) {
  let best = { key: null, frac: 0 };
  for (const s of sprites) {
    let m = 0, n = 0;
    for (let y = 0; y < SPRITE; y++) {
      for (let x = 0; x < SPRITE; x++) {
        const i = (SPRITE * y + x) << 2;
        if (s.data[i + 3] <= 200) continue;
        n++;
        const j = ((oy + y) * SIDE + ox + x) * 3;
        if (Math.abs(buf[j] - s.data[i]) <= TOL && Math.abs(buf[j + 1] - s.data[i + 1]) <= TOL && Math.abs(buf[j + 2] - s.data[i + 2]) <= TOL) m++;
      }
    }
    if (m / n > best.frac) best = { key: s.key, frac: m / n };
  }
  if (best.frac >= THRESHOLD) return best;

  const px = Buffer.alloc(SPRITE * SPRITE * 4);
  let sig = "";
  for (const [x, y] of disc) {
    const j = ((oy + y) * SIDE + ox + x) * 3;
    const i = (SPRITE * y + x) << 2;
    px[i] = buf[j];
    px[i + 1] = buf[j + 1];
    px[i + 2] = buf[j + 2];
    px[i + 3] = 255;
    sig += `${buf[j]},${buf[j + 1]},${buf[j + 2]};`;
  }
  const hash = createHash("sha1").update(sig).digest("hex").slice(0, 10);
  return { key: `unlisted_${hash}`, frac: best.frac, hash, px };
}

function scanTile(tx, ty) {
  padded(tx, ty);
  const hits = [];
  const tried = new Set();
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      const p = (y * SIDE + x) * 3;
      if (buf[p] !== FRAME_RGB[0] || buf[p + 1] !== FRAME_RGB[1] || buf[p + 2] !== FRAME_RGB[2]) continue;
      for (const [fx, fy] of frame) {
        const ox = x - fx, oy = y - fy;
        if (ox < 0 || oy < 0 || ox + SPRITE > SIDE || oy + SPRITE > SIDE) continue;
        const id = oy * SIDE + ox;
        if (tried.has(id)) continue;
        tried.add(id);
        let h = 0;
        for (const [gx, gy, r, g, b] of frame) {
          const j = ((oy + gy) * SIDE + ox + gx) * 3;
          if (Math.abs(buf[j] - r) <= TOL && Math.abs(buf[j + 1] - g) <= TOL && Math.abs(buf[j + 2] - b) <= TOL) h++;
        }
        if (h / frame.length < FRAME_MATCH) continue;
        const cx = ox + SPRITE / 2 - PAD;
        const cy = oy + SPRITE / 2 - PAD;
        if (cx < 0 || cx >= TILE_PX || cy < 0 || cy >= TILE_PX) continue;
        const c = classify(ox, oy);
        hits.push({ key: c.key, frac: c.frac, cx, cy, hash: c.hash, px: c.px });
      }
    }
  }
  hits.sort((a, b) => b.frac - a.frac);
  const keep = [];
  for (const h of hits) {
    if (keep.some((k) => Math.abs(k.cx - h.cx) < 6 && Math.abs(k.cy - h.cy) < 6)) continue;
    if (h.hash && !unlisted.has(h.hash)) unlisted.set(h.hash, h.px);
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

for (const [hash, px] of unlisted) {
  const png = new PNG({ width: SPRITE, height: SPRITE });
  px.copy(png.data);
  await writeFile(join(OUT_DIR, `unlisted-${hash}.png`), PNG.sync.write(png));
  types[`unlisted_${hash}`] = { file: `unlisted-${hash}.png`, name: "Unlisted map icon", category: "unlisted" };
}
const unlistedPlacements = icons.filter(([k]) => k.startsWith("unlisted_")).length;
console.log(`${unlisted.size} icon types found that no catalogue lists, at ${unlistedPlacements} places`);

await writeFile(
  join(ROOT, "public", "mapicons.json"),
  JSON.stringify({ source: "scanned from tiles", threshold: THRESHOLD, types, icons }),
);

console.log(`\nwrote ${icons.length} icons across ${Object.keys(counts).length} types to public/mapicons.json`);
console.log(
  "most common:",
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}=${v}`).join(" "),
);

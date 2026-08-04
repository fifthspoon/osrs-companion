// Builds the map icon overlay set. See CONTRIBUTING.md "The icon overlay" for
// why this exists and what its known gaps are.

import { writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = "https://maps.runescape.wiki/osrs";
const DEFS = `${BASE}/data/iconLists/MainIcons.json`;
const LOCS = `${BASE}/data/overlayMaps/MainMapIconLoc.json`;
const UA = "osrs-companion/0.1 (personal local tool)";

const BOUNDS = { minX: 1024, minY: 2048, maxX: 4096, maxY: 4224 };
const SOURCE_VINTAGE = "2019-10-31_1";

async function getJson(url) {
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`${r.status} on ${url}`);
  return r.json();
}

const defs = await getJson(DEFS);
const locs = await getJson(LOCS);

const icons = [];
let offPlane = 0;
let offMap = 0;
let offBounds = 0;
let undefinedType = 0;

for (const feat of locs.features) {
  if (feat.properties.mapID !== 0) {
    offMap++;
    continue;
  }
  const [wx, wy, plane] = feat.geometry.coordinates;
  // The viewer draws ground level only, so an icon on an upper floor would sit
  // on terrain it does not belong to.
  if (plane !== 0) {
    offPlane++;
    continue;
  }
  if (wx < BOUNDS.minX || wx > BOUNDS.maxX || wy < BOUNDS.minY || wy > BOUNDS.maxY) {
    offBounds++;
    continue;
  }
  const key = feat.properties.icon;
  if (!defs.icons[key]) {
    undefinedType++;
    continue;
  }
  icons.push([key, wx, wy]);
}

const used = [...new Set(icons.map((i) => i[0]))].sort();
console.log(`${icons.length} icons across ${used.length} types`);
console.log(`skipped: ${offMap} non-surface, ${offPlane} above ground, ${offBounds} out of bounds, ${undefinedType} undefined type`);

await mkdir(join(ROOT, "public", "mapicons"), { recursive: true });

const types = {};
let pulled = 0;
let failed = 0;

for (const key of used) {
  const d = defs.icons[key];
  types[key] = { file: d.filename, name: d.name, category: d.category ?? "" };

  const r = await fetch(`${defs.folder}${d.filename}`, { headers: { "User-Agent": UA } });
  if (!r.ok) {
    failed++;
    console.warn(`  ${r.status} on ${d.filename} (${key})`);
    continue;
  }
  await writeFile(join(ROOT, "public", "mapicons", d.filename), Buffer.from(await r.arrayBuffer()));
  pulled++;
  process.stdout.write(`\r  ${pulled}/${used.length} images`);
}

await writeFile(
  join(ROOT, "public", "mapicons.json"),
  JSON.stringify({ sourceVintage: SOURCE_VINTAGE, types, icons }),
);

const counts = {};
for (const [k] of icons) counts[k] = (counts[k] ?? 0) + 1;

console.log(`\nwrote public/mapicons.json and ${pulled} images to public/mapicons/`);
if (failed) console.log(`${failed} images failed, those types will not render`);
console.log(
  "most common:",
  Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => `${k}=${v}`).join(" "),
);

import type { RouteDef } from "./routes";
import {
  loadMarkers, saveMarkers,
  worldToPx, pxToWorld,
  pickTileZoom, tileSpan, tileBaseSize, tileOrigin, tileRange, tileUrl,
  PX_PER_SQUARE, WORLD_BOUNDS, BASE_W, BASE_H,
} from "./worldmap";
import type { CustomMarker } from "./worldmap";

// Pan and zoom viewer over the world map.
//
// The map is a tile pyramid, not one big image, so only the tiles actually on
// screen are in the DOM at any moment and each zoom level is served at its own
// native resolution instead of being stretched. That is what keeps it sharp.
//
// Everything on top of it is placed from in-game world coordinates through an
// exact transform, so nothing is positioned by hand.

export interface ViewCtx {
  visited: (stopId: string) => boolean;
  nextId: string | null;
  onVisit: (stopId: string) => void;
}

type Mode = { kind: "view" } | { kind: "addmarker" };

interface LabelDef {
  name: string;
  wx: number;
  wy: number;
  type: string;
  len: number;
  tier: number;
}

let markers: CustomMarker[] = loadMarkers();
let mode: Mode = { kind: "view" };

const LABELS_KEY = "osrs-companion:labels:v1";
let labelsOn = localStorage.getItem(LABELS_KEY) !== "0";
let labelData: LabelDef[] = [];
let labelsLoading: Promise<void> | null = null;

// Ranking labels by importance. Article length alone is a bad signal: the
// longest article in the set is Castle Wars, a minigame, at twice the length of
// Varrock. Type alone is also unreliable, since 148 locations have no type at
// all and Brimhaven is filed as "maplink". So score on type first with length
// only as a tiebreaker within a type.
const TYPE_WEIGHT: Record<string, number> = {
  region: 100, kingdom: 100, city: 85, settlement: 80, island: 60,
  maplink: 55, guild: 50, minigame: 48, dungeon: 40, boss: 40,
  mine: 34, "hunter area": 30,
};

function scoreOf(l: { type: string; len: number }): number {
  return (TYPE_WEIGHT[l.type] ?? 20) + Math.min(20, l.len / 2000);
}

// Tier by rank rather than by an absolute score, so each zoom level shows a
// predictable number of names no matter how the underlying data shifts.
function assignTiers(list: LabelDef[]): void {
  list.sort((a, b) => scoreOf(b) - scoreOf(a));
  list.forEach((l, i) => {
    l.tier = i < 20 ? 0 : i < 80 ? 1 : i < 220 ? 2 : 3;
  });
}

// Wiki titles carry disambiguators that mean nothing on a map.
function cleanName(n: string): string {
  return n.replace(/\s*\((location|island|area|region|surface)\)\s*$/i, "");
}

// How big labels render, as a multiplier on their CSS font size.
//
// The obvious counter-scale (1/zoom) pins labels to a constant screen size at
// every zoom, which sounds correct and reads badly: zoomed right in the terrain
// is at 16 px per game square and the names are still 10 px, so they look tiny
// against everything around them.
//
// So let them grow with zoom, but clamped hard at both ends. The floor stops
// them ever becoming unreadable, the ceiling stops them swamping the map. Cube
// root because linear growth is far too aggressive across a 60x zoom range.
function labelScale(perSquare: number): number {
  return Math.min(2.2, Math.max(1, Math.cbrt(Math.max(perSquare, 0.01)) * 0.75));
}

// Labels are text, so they are only worth drawing once the map is big enough to
// read them against. Thresholds are in screen pixels per game square.
function tierForZoom(perSquare: number): number {
  if (perSquare < 0.35) return 0;
  if (perSquare < 0.9) return 1;
  if (perSquare < 2.5) return 2;
  return 3;
}

function ensureLabels(onReady: () => void): void {
  if (labelData.length || labelsLoading) return;
  labelsLoading = fetch("/labels.json")
    .then((r) => (r.ok ? r.json() : []))
    .then((raw: Omit<LabelDef, "tier">[]) => {
      labelData = raw.map((l) => ({ ...l, name: cleanName(l.name), tier: 3 }));
      assignTiers(labelData);
      onReady();
    })
    .catch(() => {
      // No labels file is survivable: the map still works without names.
      labelData = [];
    });
}

// Viewport transform: base pixel space -> screen, via scale + offset.
let zoom = 0.03;
let offX = 0;
let offY = 0;
let inited = false;

// Past this the tiles are being upscaled beyond what the wiki actually renders,
// so there is no more detail to reveal, only bigger pixels.
const MAX_ZOOM = 2;

export function render(route: RouteDef, ctx: ViewCtx, rerender: () => void): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "wmwrap";

  const stage = document.createElement("div");
  stage.className = "wmstage";
  if (mode.kind !== "view") stage.classList.add("picking");

  const layer = document.createElement("div");
  layer.className = "wmlayer";

  const tileHost = document.createElement("div");
  tileHost.className = "wmtiles";
  layer.appendChild(tileHost);

  const labelHost = document.createElement("div");
  labelHost.className = "wmlabels";
  layer.appendChild(labelHost);

  // Route line through the stops, in base pixel space.
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${BASE_W} ${BASE_H}`);
  svg.setAttribute("width", String(BASE_W));
  svg.setAttribute("height", String(BASE_H));
  svg.classList.add("wmlines");
  const pts = route.stops
    .map((s) => worldToPx(s.world.wx, s.world.wy))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");
  const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  poly.setAttribute("points", pts);
  poly.setAttribute("class", "wmroute");
  svg.appendChild(poly);
  layer.appendChild(svg);

  // Route pins.
  route.stops.forEach((s, i) => {
    const p = worldToPx(s.world.wx, s.world.wy);
    const done = ctx.visited(s.id);
    const isNext = ctx.nextId === s.id;
    const pin = document.createElement("button");
    pin.className = `wmpin${done ? " done" : ""}${isNext ? " next" : ""}`;
    pin.style.left = `${p.x}px`;
    pin.style.top = `${p.y}px`;
    pin.innerHTML = `<span class="wmpindot">${done ? "✓" : i + 1}</span><span class="wmpinlabel">${s.name}</span>`;
    pin.addEventListener("click", (e) => {
      e.stopPropagation();
      if (mode.kind === "view") ctx.onVisit(s.id);
    });
    layer.appendChild(pin);
  });

  // Custom markers.
  for (const m of markers) {
    const p = worldToPx(m.wx, m.wy);
    const el = document.createElement("button");
    el.className = "wmpin custom";
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    el.innerHTML = `<span class="wmpindot">◆</span><span class="wmpinlabel">${m.label}</span>`;
    el.title = "Click to remove";
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (mode.kind !== "view") return;
      markers = markers.filter((x) => x.id !== m.id);
      saveMarkers(markers);
      rerender();
    });
    layer.appendChild(el);
  }

  stage.appendChild(layer);
  wrap.appendChild(stage);
  wrap.appendChild(controls(route, rerender, () => {
    inited = false;
    fit();
  }));

  // One container per tile zoom level. Keeping the outgoing level around until
  // the incoming one has finished loading is what stops a zoom step from
  // flashing through empty background.
  interface Level { el: HTMLDivElement; tiles: Map<string, HTMLImageElement> }
  const levels = new Map<number, Level>();

  function levelFor(z: number): Level {
    let lv = levels.get(z);
    if (!lv) {
      const el = document.createElement("div");
      el.className = "wmlevel";
      tileHost.appendChild(el);
      lv = { el, tiles: new Map() };
      levels.set(z, lv);
    }
    return lv;
  }

  function purgeStale(current: number) {
    const lv = levels.get(current);
    if (!lv) return;
    for (const im of lv.tiles.values()) {
      if (!im.complete) return;
    }
    for (const [z, other] of [...levels]) {
      if (z === current) continue;
      other.el.remove();
      levels.delete(z);
    }
  }

  function syncTiles() {
    const r = stage.getBoundingClientRect();
    if (r.width <= 0) return;

    const z = pickTileZoom(zoom);
    const lv = levelFor(z);
    const size = tileBaseSize(z);
    const span = tileSpan(z);

    // Visible rectangle in base pixel space, padded by one tile so panning
    // reveals loaded tiles rather than blank space.
    const x0 = -offX / zoom - size;
    const y0 = -offY / zoom - size;
    const x1 = (r.width - offX) / zoom + size;
    const y1 = (r.height - offY) / zoom + size;
    const rng = tileRange(z, x0, y0, x1, y1);

    const need = new Set<string>();
    for (let tx = rng.tx0; tx <= rng.tx1; tx++) {
      for (let ty = rng.ty0; ty <= rng.ty1; ty++) {
        // Nothing was pulled outside these bounds, so do not even request it.
        if ((tx + 1) * span <= WORLD_BOUNDS.minX || tx * span >= WORLD_BOUNDS.maxX) continue;
        if ((ty + 1) * span <= WORLD_BOUNDS.minY || ty * span >= WORLD_BOUNDS.maxY) continue;

        const key = `${tx}_${ty}`;
        need.add(key);
        if (lv.tiles.has(key)) continue;

        const o = tileOrigin(z, tx, ty);
        const im = document.createElement("img");
        im.className = "wmtile";
        im.draggable = false;
        im.alt = "";
        im.style.left = `${o.x}px`;
        im.style.top = `${o.y}px`;
        im.style.width = `${size}px`;
        im.style.height = `${size}px`;
        // Ocean and out-of-world tiles legitimately do not exist.
        im.addEventListener("error", () => {
          im.style.visibility = "hidden";
          purgeStale(pickTileZoom(zoom));
        });
        im.addEventListener("load", () => purgeStale(pickTileZoom(zoom)));
        im.src = tileUrl(z, tx, ty);
        lv.el.appendChild(im);
        lv.tiles.set(key, im);
      }
    }

    for (const [k, im] of [...lv.tiles]) {
      if (need.has(k)) continue;
      im.remove();
      lv.tiles.delete(k);
    }

    // Only past native resolution is nearest-neighbour the right call. Below
    // it we want the averaging, or downscaled tiles crawl with aliasing.
    lv.el.style.imageRendering = zoom * PX_PER_SQUARE > (1 << z) ? "pixelated" : "auto";
    purgeStale(z);
  }

  // Live text, not baked pixels, so names stay crisp at every zoom and can be
  // thinned out as you zoom away instead of turning the map into a wall of
  // text. Elements are reused by name so dragging does not churn the DOM.
  const liveLabels = new Map<string, HTMLElement>();

  function syncLabels() {
    const r = stage.getBoundingClientRect();
    if (r.width <= 0) return;

    if (!labelsOn || !labelData.length) {
      for (const el of liveLabels.values()) el.remove();
      liveLabels.clear();
      return;
    }

    const perSquare = zoom * PX_PER_SQUARE;
    const maxTier = tierForZoom(perSquare);
    const inv = labelScale(perSquare) / zoom;
    const x0 = -offX / zoom;
    const y0 = -offY / zoom;
    const x1 = (r.width - offX) / zoom;
    const y1 = (r.height - offY) / zoom;

    const need = new Set<string>();
    for (const l of labelData) {
      if (l.tier > maxTier) continue;
      const p = worldToPx(l.wx, l.wy);
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;

      need.add(l.name);
      let el = liveLabels.get(l.name);
      if (!el) {
        el = document.createElement("div");
        el.className = `wmlabel t${l.tier}`;
        el.textContent = l.name;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
        labelHost.appendChild(el);
        liveLabels.set(l.name, el);
      }
      el.style.transform = `translate(-50%, -50%) scale(${inv})`;
    }

    for (const [k, el] of [...liveLabels]) {
      if (need.has(k)) continue;
      el.remove();
      liveLabels.delete(k);
    }
  }

  ensureLabels(() => apply());

  // Fit the map once the stage actually has a size. ResizeObserver rather than
  // requestAnimationFrame on purpose: rAF is paused while the page isn't
  // compositing (background tab, hidden window), which would leave the map
  // untransformed and looking broken on return.
  // `applied` is per render, `inited` is module wide. The zoom/offset should
  // only be reset the very first time, but EVERY freshly built layer still
  // needs apply() called on it, otherwise marking a stop rebuilds the DOM and
  // leaves the new layer with no transform at all.
  let applied = false;
  function fit() {
    const r = stage.getBoundingClientRect();
    if (r.width <= 0) return;
    if (!inited) {
      const tl = worldToPx(WORLD_BOUNDS.minX, WORLD_BOUNDS.maxY);
      const br = worldToPx(WORLD_BOUNDS.maxX, WORLD_BOUNDS.minY);
      const w = br.x - tl.x;
      const h = br.y - tl.y;
      zoom = Math.min(r.width / w, r.height / h);
      offX = -tl.x * zoom + (r.width - w * zoom) / 2;
      offY = -tl.y * zoom + (r.height - h * zoom) / 2;
      inited = true;
    }
    apply();
    applied = true;
  }
  new ResizeObserver(fit).observe(stage);
  fit();
  // ResizeObserver delivery is also part of the rendering lifecycle, so it can
  // be starved in a hidden window. Timers are not, so retry briefly until the
  // stage reports a real size.
  let tries = 0;
  const poll = () => {
    if (applied || tries++ > 20) return;
    fit();
    if (!applied) setTimeout(poll, 50);
  };
  setTimeout(poll, 0);

  function apply() {
    layer.style.transform = `translate(${offX}px, ${offY}px) scale(${zoom})`;
    // Counter-scale pins so they stay a readable size at any zoom.
    const inv = 1 / zoom;
    layer.querySelectorAll<HTMLElement>(".wmpin").forEach((el) => {
      el.style.transform = `translate(-50%, -50%) scale(${inv})`;
    });
    layer.querySelectorAll<SVGElement>(".wmroute").forEach((el) => {
      el.setAttribute("stroke-width", String(Math.max(2, 3 * inv)));
    });
    syncTiles();
    syncLabels();
  }

  // Wheel zoom, anchored on the cursor.
  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const next = Math.min(MAX_ZOOM, Math.max(0.02, zoom * factor));
      const k = next / zoom;
      offX = cx - (cx - offX) * k;
      offY = cy - (cy - offY) * k;
      zoom = next;
      apply();
    },
    { passive: false },
  );

  // Drag to pan, with either button. Right drag exists so that during
  // add-marker mode the map can be repositioned with no risk of dropping a
  // pick, since only button 0 can ever pick.
  let dragging = false;
  let moved = false;
  let panButton = -1;
  let sx = 0;
  let sy = 0;
  stage.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 && e.button !== 2) return;
    dragging = true;
    moved = false;
    panButton = e.button;
    sx = e.clientX - offX;
    sy = e.clientY - offY;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const nx = e.clientX - sx;
    const ny = e.clientY - sy;
    if (Math.abs(nx - offX) + Math.abs(ny - offY) > 3) moved = true;
    offX = nx;
    offY = ny;
    apply();
  });
  stage.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    stage.releasePointerCapture(e.pointerId);
    if (panButton === 2 || moved || mode.kind === "view") return;
    // A left click (not a drag) while in add-marker mode.
    const r = stage.getBoundingClientRect();
    const px = (e.clientX - r.left - offX) / zoom;
    const py = (e.clientY - r.top - offY) / zoom;
    handlePick(px, py, rerender);
  });

  // A cancelled drag would otherwise leave the map stuck following the cursor.
  stage.addEventListener("pointercancel", () => {
    dragging = false;
  });

  // Otherwise the browser menu pops on every right drag.
  stage.addEventListener("contextmenu", (e) => e.preventDefault());

  return wrap;
}

function handlePick(px: number, py: number, rerender: () => void) {
  if (mode.kind !== "addmarker") return;
  const w = pxToWorld(px, py);
  const label = prompt("Marker name?");
  if (label) {
    const wx = Math.round(w.wx);
    const wy = Math.round(w.wy);
    markers = [...markers, { id: `m${markers.length}_${wx}_${wy}`, label, wx, wy }];
    saveMarkers(markers);
  }
  mode = { kind: "view" };
  rerender();
}

function controls(route: RouteDef, rerender: () => void, refit: () => void): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "wmbar";

  const status = document.createElement("span");
  status.className = "note";
  status.textContent =
    mode.kind === "addmarker"
      ? "Click anywhere to drop a marker. Right drag to pan."
      : `Scroll to zoom, drag to pan. ${route.stops.length} stops placed from world coords.`;
  bar.appendChild(status);

  const btns = document.createElement("span");
  btns.className = "mapbtns";

  const mk = (text: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.className = "linkbtn";
    b.textContent = text;
    b.addEventListener("click", onClick);
    btns.appendChild(b);
  };

  if (mode.kind === "view") {
    mk(labelsOn ? "labels on" : "labels off", () => {
      labelsOn = !labelsOn;
      localStorage.setItem(LABELS_KEY, labelsOn ? "1" : "0");
      rerender();
    });
    mk("reset view", refit);
    mk("add marker", () => {
      mode = { kind: "addmarker" };
      rerender();
    });
  } else {
    mk("cancel", () => {
      mode = { kind: "view" };
      rerender();
    });
  }

  bar.appendChild(btns);
  return bar;
}

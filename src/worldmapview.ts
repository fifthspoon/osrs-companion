import type { RouteDef } from "./routes";
import {
  loadMarkers, saveMarkers,
  worldToPx, pxToWorld,
  pickTileZoom, tileSpan, tileBaseSize, tileOrigin, tileRange, tileUrl,
  PX_PER_SQUARE, WORLD_BOUNDS, BASE_W, BASE_H,
} from "./worldmap";
import type { CustomMarker } from "./worldmap";

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

const ICONS_KEY = "osrs-companion:mapicons:v1";
let iconsOn = localStorage.getItem(ICONS_KEY) !== "0";
let iconData: IconData | null = null;
let iconsLoading: Promise<void> | null = null;

const ICON_MIN_PER_SQUARE = 1.5;

interface IconData {
  source: string;
  threshold: number;
  types: Record<string, { file: string; name: string; category: string }>;
  icons: [string, number, number, number][];
}

const SIZE_KEY = "osrs-companion:mapsize:v1";
const SIZE_MIN = 0.5;
const SIZE_MAX = 3;
const SIZE_DEFAULTS = { pin: 1, label: 1, icon: 1 };
type SizePrefs = typeof SIZE_DEFAULTS;

function clampMul(v: unknown): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : 1;
  return Math.min(SIZE_MAX, Math.max(SIZE_MIN, n));
}

function loadSizes(): SizePrefs {
  try {
    const raw = localStorage.getItem(SIZE_KEY);
    if (!raw) return { ...SIZE_DEFAULTS };
    const p = JSON.parse(raw) as Partial<SizePrefs>;
    return { pin: clampMul(p.pin), label: clampMul(p.label), icon: clampMul(p.icon) };
  } catch {
    return { ...SIZE_DEFAULTS };
  }
}

let sizePrefs: SizePrefs = loadSizes();

function saveSizes(): void {
  localStorage.setItem(SIZE_KEY, JSON.stringify(sizePrefs));
}

const TYPE_WEIGHT: Record<string, number> = {
  region: 100, kingdom: 100, city: 85, settlement: 80, island: 60,
  maplink: 55, guild: 50, minigame: 48, dungeon: 40, boss: 40,
  mine: 34, "hunter area": 30,
};

function scoreOf(l: { type: string; len: number }): number {
  return (TYPE_WEIGHT[l.type] ?? 20) + Math.min(20, l.len / 2000);
}

function assignTiers(list: LabelDef[]): void {
  list.sort((a, b) => scoreOf(b) - scoreOf(a));
  list.forEach((l, i) => {
    l.tier = i < 20 ? 0 : i < 80 ? 1 : i < 220 ? 2 : 3;
  });
}

function cleanName(n: string): string {
  return n.replace(/\s*\((location|island|area|region|surface)\)\s*$/i, "");
}

function labelScale(perSquare: number): number {
  return growth(perSquare, 2.2) * sizePrefs.label;
}

function pinScale(perSquare: number): number {
  return growth(perSquare, 2.6) * sizePrefs.pin;
}

function iconScale(perSquare: number): number {
  return growth(perSquare, 3, 1) * sizePrefs.icon;
}

function growth(perSquare: number, ceiling: number, coeff = 0.75): number {
  return Math.min(ceiling, Math.max(1, Math.cbrt(Math.max(perSquare, 0.01)) * coeff));
}

function tierForZoom(perSquare: number): number {
  if (perSquare < 0.35) return 0;
  if (perSquare < 0.9) return 1;
  if (perSquare < 2.5) return 2;
  return 3;
}

function ensureIcons(onReady: () => void): void {
  if (iconData || iconsLoading) return;
  iconsLoading = fetch("/mapicons.json")
    .then((r) => (r.ok ? r.json() : null))
    .then((raw: IconData | null) => {
      iconData = raw;
      onReady();
    })
    .catch(() => {
      iconData = null;
    });
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
      labelData = [];
    });
}

let zoom = 0.03;
let offX = 0;
let offY = 0;
let inited = false;
let minZoom = 0.02;

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

  const iconHost = document.createElement("div");
  iconHost.className = "wmicons";
  layer.appendChild(iconHost);

  const labelHost = document.createElement("div");
  labelHost.className = "wmlabels";
  layer.appendChild(labelHost);

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
  }, () => {
    apply();
  }));

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

    const x0 = -offX / zoom - size;
    const y0 = -offY / zoom - size;
    const x1 = (r.width - offX) / zoom + size;
    const y1 = (r.height - offY) / zoom + size;
    const rng = tileRange(z, x0, y0, x1, y1);

    const need = new Set<string>();
    for (let tx = rng.tx0; tx <= rng.tx1; tx++) {
      for (let ty = rng.ty0; ty <= rng.ty1; ty++) {
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

    lv.el.style.imageRendering = zoom * PX_PER_SQUARE > (1 << z) ? "pixelated" : "auto";
    purgeStale(z);
  }

  const liveIcons = new Map<number, HTMLElement>();

  function syncIcons() {
    const r = stage.getBoundingClientRect();
    if (r.width <= 0) return;

    const perSquare = zoom * PX_PER_SQUARE;
    if (!iconsOn || !iconData || perSquare < ICON_MIN_PER_SQUARE) {
      for (const el of liveIcons.values()) el.remove();
      liveIcons.clear();
      return;
    }

    const inv = iconScale(perSquare) / zoom;
    const x0 = -offX / zoom;
    const y0 = -offY / zoom;
    const x1 = (r.width - offX) / zoom;
    const y1 = (r.height - offY) / zoom;

    const need = new Set<number>();
    iconData.icons.forEach(([key, wx, wy], i) => {
      const p = worldToPx(wx, wy);
      if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) return;

      need.add(i);
      let el = liveIcons.get(i);
      if (!el) {
        const def = iconData!.types[key];
        if (!def) return;
        el = document.createElement("img");
        el.className = "wmicon";
        (el as HTMLImageElement).src = `/mapicons/${def.file}`;
        (el as HTMLImageElement).alt = "";
        (el as HTMLImageElement).draggable = false;
        el.title = def.name;
        el.style.left = `${p.x}px`;
        el.style.top = `${p.y}px`;
        iconHost.appendChild(el);
        liveIcons.set(i, el);
      }
      el.style.transform = `translate(-50%, -50%) scale(${inv})`;
    });

    for (const [k, el] of [...liveIcons]) {
      if (need.has(k)) continue;
      el.remove();
      liveIcons.delete(k);
    }
  }

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
  ensureIcons(() => apply());

  let applied = false;
  function fit() {
    const r = stage.getBoundingClientRect();
    if (r.width <= 0) return;
    const tl = worldToPx(WORLD_BOUNDS.minX, WORLD_BOUNDS.maxY);
    const br = worldToPx(WORLD_BOUNDS.maxX, WORLD_BOUNDS.minY);
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    minZoom = Math.min(r.width / w, r.height / h);
    if (!inited) {
      zoom = minZoom;
      offX = -tl.x * zoom + (r.width - w * zoom) / 2;
      offY = -tl.y * zoom + (r.height - h * zoom) / 2;
      inited = true;
    }
    apply();
    applied = true;
  }
  new ResizeObserver(fit).observe(stage);
  fit();
  let tries = 0;
  const poll = () => {
    if (applied || tries++ > 20) return;
    fit();
    if (!applied) setTimeout(poll, 50);
  };
  setTimeout(poll, 0);

  function clampView() {
    const r = stage.getBoundingClientRect();
    if (r.width <= 0) return;
    if (zoom < minZoom) zoom = minZoom;

    const tl = worldToPx(WORLD_BOUNDS.minX, WORLD_BOUNDS.maxY);
    const br = worldToPx(WORLD_BOUNDS.maxX, WORLD_BOUNDS.minY);
    const w = (br.x - tl.x) * zoom;
    const h = (br.y - tl.y) * zoom;

    if (w >= r.width) {
      offX = Math.min(-tl.x * zoom, Math.max(r.width - br.x * zoom, offX));
    } else {
      offX = (r.width - w) / 2 - tl.x * zoom;
    }
    if (h >= r.height) {
      offY = Math.min(-tl.y * zoom, Math.max(r.height - br.y * zoom, offY));
    } else {
      offY = (r.height - h) / 2 - tl.y * zoom;
    }
  }

  function apply() {
    clampView();
    layer.style.transform = `translate(${offX}px, ${offY}px) scale(${zoom})`;
    const pinInv = pinScale(zoom * PX_PER_SQUARE) / zoom;
    const lineInv = 1 / zoom;
    layer.querySelectorAll<HTMLElement>(".wmpin").forEach((el) => {
      el.style.transform = `translate(-50%, -50%) scale(${pinInv})`;
    });
    layer.querySelectorAll<SVGElement>(".wmroute").forEach((el) => {
      el.setAttribute("stroke-width", String(Math.max(2, 3 * lineInv)));
    });
    syncTiles();
    syncIcons();
    syncLabels();
  }

  stage.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      const cx = e.clientX - r.left;
      const cy = e.clientY - r.top;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const next = Math.min(MAX_ZOOM, Math.max(minZoom, zoom * factor));
      const k = next / zoom;
      offX = cx - (cx - offX) * k;
      offY = cy - (cy - offY) * k;
      zoom = next;
      apply();
    },
    { passive: false },
  );

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
    const r = stage.getBoundingClientRect();
    const px = (e.clientX - r.left - offX) / zoom;
    const py = (e.clientY - r.top - offY) / zoom;
    handlePick(px, py, rerender);
  });

  stage.addEventListener("pointercancel", () => {
    dragging = false;
  });

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

function controls(
  route: RouteDef,
  rerender: () => void,
  refit: () => void,
  onSizes: () => void,
): HTMLElement {
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

  const sizer = (text: string, key: keyof SizePrefs) => {
    const wrap = document.createElement("label");
    wrap.className = "wmsize";

    const name = document.createElement("span");
    name.textContent = text;
    wrap.appendChild(name);

    const input = document.createElement("input");
    input.type = "range";
    input.min = String(SIZE_MIN);
    input.max = String(SIZE_MAX);
    input.step = "0.1";
    input.value = String(sizePrefs[key]);

    const out = document.createElement("span");
    out.className = "wmsizeval";
    out.textContent = `${sizePrefs[key].toFixed(1)}x`;

    input.addEventListener("input", () => {
      sizePrefs[key] = clampMul(parseFloat(input.value));
      out.textContent = `${sizePrefs[key].toFixed(1)}x`;
      saveSizes();
      onSizes();
    });

    wrap.appendChild(input);
    wrap.appendChild(out);
    btns.appendChild(wrap);
  };

  if (mode.kind === "view") {
    mk(labelsOn ? "labels on" : "labels off", () => {
      labelsOn = !labelsOn;
      localStorage.setItem(LABELS_KEY, labelsOn ? "1" : "0");
      rerender();
    });
    mk(iconsOn ? "map icons on" : "map icons off", () => {
      iconsOn = !iconsOn;
      localStorage.setItem(ICONS_KEY, iconsOn ? "1" : "0");
      rerender();
    });
    sizer("pins", "pin");
    sizer("icons", "icon");
    sizer("labels", "label");
    mk("reset sizes", () => {
      sizePrefs = { ...SIZE_DEFAULTS };
      saveSizes();
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

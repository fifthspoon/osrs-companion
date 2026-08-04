import {
  loadMarkers, saveMarkers,
  worldToPx, pxToWorld,
  pickTileZoom, tileSpan, tileBaseSize, tileOrigin, tileRange, tileUrl,
  PX_PER_SQUARE, WORLD_BOUNDS, BASE_W, BASE_H,
} from "../worldmap";
import type { CustomMarker } from "../worldmap";
import { ensureIcons, ensureLabels, icons, labels, tierForZoom } from "./data";
import { iconTypeOn, iconsOn, labelsOn, sizes, tooltipsOn } from "./prefs";
import { overlay, repaintIconTypes } from "./overlay";
import type { MapApi } from "./overlay";
import { search } from "./search";
import type { SearchResult } from "./search";

export interface MapPoint {
  wx: number;
  wy: number;
}

export interface MapPin extends MapPoint {
  badge: string;
  label: string;
  className?: string;
  title?: string;
  onClick?: () => void;
}

export interface MapPath {
  points: MapPoint[];
  className?: string;
}

export interface MapOptions {
  id: string;
  onChange: () => void;
  pins?: MapPin[];
  paths?: MapPath[];
  status?: string;
  markers?: boolean;
  addMarker?: boolean;
}

interface ViewState {
  zoom: number;
  offX: number;
  offY: number;
  inited: boolean;
  minZoom: number;
  picking: boolean;
  pane: string | null;
  query: string;
}

const ICON_BASE_PX = 22;
const MAX_ZOOM = 2;
const FLY_ZOOM = 0.75;

const views = new Map<string, ViewState>();

function viewFor(id: string): ViewState {
  let v = views.get(id);
  if (!v) {
    v = {
      zoom: 0.03, offX: 0, offY: 0, inited: false, minZoom: 0.02,
      picking: false, pane: null, query: "",
    };
    views.set(id, v);
  }
  return v;
}

let markers: CustomMarker[] = loadMarkers();

export function createMap(opts: MapOptions): HTMLElement {
  const view = viewFor(opts.id);
  const showMarkers = opts.markers !== false;
  const canAddMarker = opts.addMarker !== false;
  if (!canAddMarker) view.picking = false;

  let result: SearchResult | null = search(view.query);

  const wrap = document.createElement("div");
  wrap.className = "wmwrap";

  const stage = document.createElement("div");
  stage.className = "wmstage";
  if (view.picking) stage.classList.add("picking");

  const layer = document.createElement("div");
  layer.className = "wmlayer";

  const tileHost = document.createElement("div");
  tileHost.className = "wmtiles";
  layer.appendChild(tileHost);

  const iconCanvas = document.createElement("canvas");
  iconCanvas.className = "wmiconcanvas";
  const ictx = iconCanvas.getContext("2d");

  const olayer = document.createElement("div");
  olayer.className = "wmlayer";

  const labelHost = document.createElement("div");
  labelHost.className = "wmlabels";
  olayer.appendChild(labelHost);

  const tip = document.createElement("div");
  tip.className = "wmtip";
  tip.hidden = true;

  for (const path of opts.paths ?? []) {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", `0 0 ${BASE_W} ${BASE_H}`);
    svg.setAttribute("width", String(BASE_W));
    svg.setAttribute("height", String(BASE_H));
    svg.classList.add("wmlines");
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    poly.setAttribute(
      "points",
      path.points.map((p) => worldToPx(p.wx, p.wy)).map((p) => `${p.x},${p.y}`).join(" "),
    );
    poly.setAttribute("class", path.className ?? "wmroute");
    svg.appendChild(poly);
    olayer.appendChild(svg);
  }

  function addPin(pin: MapPin): void {
    const p = worldToPx(pin.wx, pin.wy);
    const el = document.createElement("button");
    el.className = pin.className ? `wmpin ${pin.className}` : "wmpin";
    el.style.left = `${p.x}px`;
    el.style.top = `${p.y}px`;
    if (pin.title) el.title = pin.title;

    const dot = document.createElement("span");
    dot.className = "wmpindot";
    dot.textContent = pin.badge;
    el.appendChild(dot);

    const name = document.createElement("span");
    name.className = "wmpinlabel";
    name.textContent = pin.label;
    el.appendChild(name);

    el.addEventListener("click", (e) => {
      e.stopPropagation();
      if (view.picking) return;
      pin.onClick?.();
    });
    olayer.appendChild(el);
  }

  for (const pin of opts.pins ?? []) addPin(pin);

  if (showMarkers) {
    for (const m of markers) {
      addPin({
        wx: m.wx,
        wy: m.wy,
        badge: "◆",
        label: m.label,
        className: "custom",
        title: "Click to remove",
        onClick: () => removeMarker(m.id),
      });
    }
  }

  function removeMarker(id: string): void {
    markers = markers.filter((x) => x.id !== id);
    saveMarkers(markers);
    opts.onChange();
  }

  stage.appendChild(layer);
  stage.appendChild(iconCanvas);
  stage.appendChild(olayer);
  stage.appendChild(tip);

  const api: MapApi = {
    status: opts.status ?? "Scroll to zoom, drag to pan.",
    canAddMarker,
    showMarkers,
    get picking() {
      return view.picking;
    },
    cancelPicking() {
      view.picking = false;
      opts.onChange();
    },
    query: () => view.query,
    setQuery(q) {
      view.query = q;
      result = search(q);
    },
    results: () => result,
    redraw: () => apply(),
    refit() {
      view.inited = false;
      fit();
    },
    zoomBy(factor) {
      const r = stage.getBoundingClientRect();
      if (r.width <= 0) return;
      zoomAbout(r.width / 2, r.height / 2, factor);
    },
    flyTo(wx, wy) {
      const r = stage.getBoundingClientRect();
      if (r.width <= 0) return;
      const p = worldToPx(wx, wy);
      view.zoom = Math.min(MAX_ZOOM, Math.max(view.minZoom, FLY_ZOOM));
      view.offX = r.width / 2 - p.x * view.zoom;
      view.offY = r.height / 2 - p.y * view.zoom;
      apply();
    },
    startPicking() {
      view.picking = true;
      opts.onChange();
    },
    rerender: opts.onChange,
    pane: () => view.pane,
    setPane(name) {
      view.pane = name;
    },
    markers: () => markers,
    removeMarker,
  };

  const chrome = overlay(api);
  stage.appendChild(chrome);
  wrap.appendChild(stage);

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

    const z = pickTileZoom(view.zoom);
    const lv = levelFor(z);
    const size = tileBaseSize(z);
    const span = tileSpan(z);

    const x0 = -view.offX / view.zoom - size;
    const y0 = -view.offY / view.zoom - size;
    const x1 = (r.width - view.offX) / view.zoom + size;
    const y1 = (r.height - view.offY) / view.zoom + size;
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
          purgeStale(pickTileZoom(view.zoom));
        });
        im.addEventListener("load", () => purgeStale(pickTileZoom(view.zoom)));
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

    lv.el.style.imageRendering = view.zoom * PX_PER_SQUARE > (1 << z) ? "pixelated" : "auto";
    purgeStale(z);
  }

  const iconImages = new Map<string, HTMLImageElement>();
  let iconPending = false;

  function iconImage(file: string): HTMLImageElement {
    let img = iconImages.get(file);
    if (img === undefined) {
      img = new Image();
      img.onload = () => {
        if (iconPending) return;
        iconPending = true;
        setTimeout(() => {
          iconPending = false;
          drawIcons();
        }, 0);
      };
      img.src = `/mapicons/${file}`;
      iconImages.set(file, img);
    }
    return img;
  }

  function visibleIcons(width: number, height: number) {
    const data = icons();
    const out: { key: string; sx: number; sy: number; half: number }[] = [];
    if (!iconsOn() || !data) return out;
    const size = ICON_BASE_PX * sizes().icon;
    const half = size / 2;
    for (const [key, wx, wy] of data.icons) {
      if (!iconTypeOn(key)) continue;
      const p = worldToPx(wx, wy);
      const sx = p.x * view.zoom + view.offX;
      const sy = p.y * view.zoom + view.offY;
      if (sx < -half || sy < -half || sx > width + half || sy > height + half) continue;
      out.push({ key, sx, sy, half });
    }
    return out;
  }

  function drawIcons() {
    const r = stage.getBoundingClientRect();
    if (!ictx || r.width <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(r.width * dpr);
    const h = Math.round(r.height * dpr);
    if (iconCanvas.width !== w || iconCanvas.height !== h) {
      iconCanvas.width = w;
      iconCanvas.height = h;
    }
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ictx.clearRect(0, 0, r.width, r.height);

    const data = icons();
    if (!iconsOn() || !data) return;

    ictx.imageSmoothingEnabled = false;
    const size = ICON_BASE_PX * sizes().icon;

    for (const { key, sx, sy, half } of visibleIcons(r.width, r.height)) {
      const def = data.types[key];
      if (!def) continue;
      const img = iconImage(def.file);
      if (!img.complete || !img.naturalWidth) continue;
      const matched = !result || result.matchedTypes.has(key);
      ictx.globalAlpha = matched ? 1 : 0.12;
      ictx.drawImage(img, sx - half, sy - half, size, size);
      if (result && matched) {
        ictx.globalAlpha = 1;
        ictx.strokeStyle = "#7bc455";
        ictx.lineWidth = 2;
        ictx.strokeRect(sx - half - 2, sy - half - 2, size + 4, size + 4);
      }
    }
    ictx.globalAlpha = 1;
  }

  const liveLabels = new Map<string, HTMLElement>();

  function syncLabels() {
    const r = stage.getBoundingClientRect();
    if (r.width <= 0) return;

    const data = labels();
    if (!labelsOn() || !data.length) {
      for (const el of liveLabels.values()) el.remove();
      liveLabels.clear();
      return;
    }

    const perSquare = view.zoom * PX_PER_SQUARE;
    const maxTier = tierForZoom(perSquare);
    const inv = sizes().label / view.zoom;
    const x0 = -view.offX / view.zoom;
    const y0 = -view.offY / view.zoom;
    const x1 = (r.width - view.offX) / view.zoom;
    const y1 = (r.height - view.offY) / view.zoom;

    const need = new Set<string>();
    for (const l of data) {
      const matched = result !== null && l.name.toLowerCase().includes(result.query);
      if (!matched && l.tier > maxTier) continue;
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
      el.classList.toggle("hit", matched);
      el.classList.toggle("dim", result !== null && !matched);
      el.style.transform = `translate(-50%, -50%) scale(${inv})`;
    }

    for (const [k, el] of [...liveLabels]) {
      if (need.has(k)) continue;
      el.remove();
      liveLabels.delete(k);
    }
  }

  ensureLabels(() => apply());
  ensureIcons(() => {
    repaintIconTypes(chrome);
    apply();
  });

  let applied = false;
  function fit() {
    const r = stage.getBoundingClientRect();
    if (r.width <= 0) return;
    const tl = worldToPx(WORLD_BOUNDS.minX, WORLD_BOUNDS.maxY);
    const br = worldToPx(WORLD_BOUNDS.maxX, WORLD_BOUNDS.minY);
    const w = br.x - tl.x;
    const h = br.y - tl.y;
    view.minZoom = Math.min(r.width / w, r.height / h);
    if (!view.inited) {
      view.zoom = view.minZoom;
      view.offX = -tl.x * view.zoom + (r.width - w * view.zoom) / 2;
      view.offY = -tl.y * view.zoom + (r.height - h * view.zoom) / 2;
      view.inited = true;
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
    if (view.zoom < view.minZoom) view.zoom = view.minZoom;

    const tl = worldToPx(WORLD_BOUNDS.minX, WORLD_BOUNDS.maxY);
    const br = worldToPx(WORLD_BOUNDS.maxX, WORLD_BOUNDS.minY);
    const w = (br.x - tl.x) * view.zoom;
    const h = (br.y - tl.y) * view.zoom;

    if (w >= r.width) {
      view.offX = Math.min(-tl.x * view.zoom, Math.max(r.width - br.x * view.zoom, view.offX));
    } else {
      view.offX = (r.width - w) / 2 - tl.x * view.zoom;
    }
    if (h >= r.height) {
      view.offY = Math.min(-tl.y * view.zoom, Math.max(r.height - br.y * view.zoom, view.offY));
    } else {
      view.offY = (r.height - h) / 2 - tl.y * view.zoom;
    }
  }

  function apply() {
    clampView();
    const t = `translate(${view.offX}px, ${view.offY}px) scale(${view.zoom})`;
    layer.style.transform = t;
    olayer.style.transform = t;
    const pinInv = sizes().pin / view.zoom;
    const lineInv = 1 / view.zoom;
    olayer.querySelectorAll<HTMLElement>(".wmpin").forEach((el) => {
      el.style.transform = `translate(-50%, -50%) scale(${pinInv})`;
    });
    olayer.querySelectorAll<SVGElement>(".wmroute").forEach((el) => {
      el.setAttribute("stroke-width", String(Math.max(2, 3 * lineInv)));
    });
    syncTiles();
    drawIcons();
    syncLabels();
  }

  function zoomAbout(cx: number, cy: number, factor: number) {
    const next = Math.min(MAX_ZOOM, Math.max(view.minZoom, view.zoom * factor));
    const k = next / view.zoom;
    view.offX = cx - (cx - view.offX) * k;
    view.offY = cy - (cy - view.offY) * k;
    view.zoom = next;
    apply();
  }

  stage.addEventListener(
    "wheel",
    (e) => {
      if (e.target instanceof Element && e.target.closest(".wmoverlay")) return;
      e.preventDefault();
      const r = stage.getBoundingClientRect();
      zoomAbout(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
    },
    { passive: false },
  );

  let dragging = false;
  let moved = false;
  let panButton = -1;
  let sx = 0;
  let sy = 0;
  stage.addEventListener("pointerdown", (e) => {
    if (e.target instanceof Element && e.target.closest(".wmoverlay")) return;
    if (e.button !== 0 && e.button !== 2) return;
    dragging = true;
    moved = false;
    panButton = e.button;
    sx = e.clientX - view.offX;
    sy = e.clientY - view.offY;
    stage.setPointerCapture(e.pointerId);
  });
  stage.addEventListener("pointermove", (e) => {
    if (dragging) {
      const nx = e.clientX - sx;
      const ny = e.clientY - sy;
      if (Math.abs(nx - view.offX) + Math.abs(ny - view.offY) > 3) moved = true;
      view.offX = nx;
      view.offY = ny;
      tip.hidden = true;
      apply();
      return;
    }
    showTip(e);
  });
  stage.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    dragging = false;
    stage.releasePointerCapture(e.pointerId);
    if (panButton === 2 || moved || !view.picking) return;
    const r = stage.getBoundingClientRect();
    const px = (e.clientX - r.left - view.offX) / view.zoom;
    const py = (e.clientY - r.top - view.offY) / view.zoom;
    dropMarker(px, py, view, opts.onChange);
  });

  stage.addEventListener("pointercancel", () => {
    dragging = false;
  });

  stage.addEventListener("pointerleave", () => {
    tip.hidden = true;
  });

  stage.addEventListener("contextmenu", (e) => e.preventDefault());

  function showTip(e: PointerEvent) {
    if (!tooltipsOn() || view.picking) {
      tip.hidden = true;
      return;
    }
    if (e.target instanceof Element && e.target.closest(".wmoverlay")) {
      tip.hidden = true;
      return;
    }
    const r = stage.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const data = icons();
    if (!data) {
      tip.hidden = true;
      return;
    }
    const candidates = visibleIcons(r.width, r.height);
    let found: { key: string; sx: number; sy: number } | null = null;
    for (const c of candidates) {
      if (Math.abs(mx - c.sx) > c.half || Math.abs(my - c.sy) > c.half) continue;
      found = c;
    }
    if (!found) {
      tip.hidden = true;
      return;
    }
    tip.textContent = data.types[found.key]?.name ?? "Map icon";
    tip.style.left = `${found.sx}px`;
    tip.style.top = `${found.sy}px`;
    tip.hidden = false;
  }

  return wrap;
}

function dropMarker(px: number, py: number, view: ViewState, onChange: () => void): void {
  const w = pxToWorld(px, py);
  const label = prompt("Marker name?");
  if (label) {
    const wx = Math.round(w.wx);
    const wy = Math.round(w.wy);
    markers = [...markers, { id: `m${markers.length}_${wx}_${wy}`, label, wx, wy }];
    saveMarkers(markers);
  }
  view.picking = false;
  onChange();
}

import {
  SIZE_MAX, SIZE_MIN,
  iconTypeOn, iconsOn, labelsOn, resetSizes, searchPinned,
  setIconTypeOn, setIconTypesOn, setIconsOn, setLabelsOn, setSearchPinned,
  setSize, setTooltipsOn, sizes, tooltipsOn,
} from "./prefs";
import type { SizeKey } from "./prefs";
import { namedIconTypes, unlistedIconTypes } from "../../data/mapData";
import type { SearchResult } from "./search";
import type { CustomMarker } from "../../lib/worldmap";

export interface MapApi {
  status: string;
  canAddMarker: boolean;
  showMarkers: boolean;
  picking: boolean;
  cancelPicking(): void;
  query(): string;
  setQuery(q: string): void;
  results(): SearchResult | null;
  redraw(): void;
  refit(): void;
  zoomBy(factor: number): void;
  flyTo(wx: number, wy: number): void;
  startPicking(): void;
  rerender(): void;
  pane(): string | null;
  setPane(name: string | null): void;
  markers(): CustomMarker[];
  removeMarker(id: string): void;
}

type PaneName = "search" | "display" | "icons" | "markers";

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function iconButton(glyph: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = el("button", "wmbtn", glyph);
  b.type = "button";
  b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

function toggleRow(label: string, on: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = el("div", "wmrow");
  row.appendChild(el("label", undefined, label));
  const sw = el("button", on ? "wmsw on" : "wmsw");
  sw.type = "button";
  sw.setAttribute("aria-pressed", String(on));
  sw.addEventListener("click", () => {
    const next = !sw.classList.contains("on");
    sw.classList.toggle("on", next);
    sw.setAttribute("aria-pressed", String(next));
    onChange(next);
  });
  row.appendChild(sw);
  return row;
}

function sliderRow(label: string, key: SizeKey, onChange: () => void): HTMLElement {
  const row = el("div", "wmrow");
  row.appendChild(el("label", undefined, label));

  const input = el("input");
  input.type = "range";
  input.min = String(SIZE_MIN);
  input.max = String(SIZE_MAX);
  input.step = "0.1";
  input.value = String(sizes()[key]);

  const out = el("span", "wmval", `${sizes()[key].toFixed(1)}x`);
  input.addEventListener("input", () => {
    const v = setSize(key, parseFloat(input.value));
    out.textContent = `${v.toFixed(1)}x`;
    onChange();
  });

  row.appendChild(input);
  row.appendChild(out);
  return row;
}

function checkRow(name: string, count: number, on: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = el("label", on ? "wmchk on" : "wmchk");
  const box = el("span", "wmbox", "✓");
  row.appendChild(box);
  row.appendChild(el("span", "wmchkname", name));
  row.appendChild(el("span", "wmchkcount", String(count)));
  row.addEventListener("click", (e) => {
    e.preventDefault();
    const next = !row.classList.contains("on");
    row.classList.toggle("on", next);
    onChange(next);
  });
  return row;
}

export function overlay(api: MapApi): HTMLElement {
  const root = el("div", "wmoverlay");

  if (api.picking) {
    const banner = el("div", "wmcard wmpicking");
    banner.appendChild(el("span", undefined, "Click anywhere to drop a marker. Right drag to pan."));
    const cancel = el("button", "wmtext", "Cancel");
    cancel.type = "button";
    cancel.addEventListener("click", () => api.cancelPicking());
    banner.appendChild(cancel);
    root.appendChild(banner);
    return root;
  }

  const rail = el("div", "wmcard wmrail");
  const paneHost = el("div", "wmcard wmpane");
  const searchDock = el("div", "wmcard wmsearchdock");

  const panes = new Map<PaneName, HTMLElement>();
  const railButtons = new Map<PaneName, HTMLButtonElement>();

  function showPane(want: PaneName | null) {
    const name = want !== null && panes.has(want) ? want : null;
    api.setPane(name);
    for (const [key, node] of panes) node.hidden = key !== name;
    for (const [key, btn] of railButtons) btn.classList.toggle("on", key === name);
    paneHost.hidden = name === null;
  }

  function railButton(name: PaneName, glyph: string, title: string) {
    const b = iconButton(glyph, title, () => showPane(api.pane() === name ? null : name));
    railButtons.set(name, b);
    rail.appendChild(b);
    return b;
  }

  function paneShell(name: PaneName, title: string): HTMLElement {
    const pane = el("div", "wmpanebody");
    const head = el("div", "wmpanehead");
    head.appendChild(el("h3", undefined, title));
    head.appendChild(iconButton("×", "Close", () => showPane(null)));
    pane.appendChild(head);
    panes.set(name, pane);
    paneHost.appendChild(pane);
    return pane;
  }

  function buildSearch(host: HTMLElement, pinned: boolean) {
    const field = el("div", "wmfield");

    const input = el("input");
    input.type = "search";
    input.placeholder = "Search places and icons";
    input.value = api.query();
    field.appendChild(input);

    const count = el("span", "wmcount");
    field.appendChild(count);

    const pin = iconButton(pinned ? "●" : "○", pinned ? "Tuck search into the rail" : "Keep search visible", () => {
      setSearchPinned(!pinned);
      api.rerender();
    });
    pin.classList.add("wmpin-toggle");
    pin.classList.toggle("on", pinned);
    field.appendChild(pin);

    host.appendChild(field);

    const results = el("div", "wmresults");
    host.appendChild(results);

    function paint() {
      const r = api.results();
      results.innerHTML = "";
      if (!r) {
        count.textContent = "";
        results.hidden = true;
        return;
      }
      count.textContent = String(r.total);
      results.hidden = false;

      if (!r.places.length && !r.types.length) {
        results.appendChild(el("div", "wmres empty", "Nothing matches"));
        return;
      }
      for (const p of r.places) {
        const row = el("div", "wmres");
        row.appendChild(el("span", "wmreskind", "place"));
        row.appendChild(el("span", "wmresname", p.name));
        row.addEventListener("click", () => api.flyTo(p.wx, p.wy));
        results.appendChild(row);
      }
      for (const t of r.types) {
        const row = el("div", "wmres static");
        row.appendChild(el("span", "wmreskind", "icon"));
        row.appendChild(el("span", "wmresname", t.name));
        row.appendChild(el("span", "wmrescount", String(t.count)));
        results.appendChild(row);
      }
    }

    input.addEventListener("input", () => {
      api.setQuery(input.value);
      api.redraw();
      paint();
    });
    input.addEventListener("search", () => {
      api.setQuery(input.value);
      api.redraw();
      paint();
    });

    paint();
    return input;
  }

  const pinned = searchPinned();

  if (!pinned) railButton("search", "⌕", "Search");
  railButton("display", "⚙", "Display");
  railButton("icons", "◉", "Icon types");
  if (api.showMarkers) railButton("markers", "◆", "Markers");

  if (!pinned) {
    const pane = paneShell("search", "Search");
    const body = el("div", "wmsect");
    buildSearch(body, false);
    pane.appendChild(body);
  }

  {
    const pane = paneShell("display", "Display");

    const scale = el("div", "wmsect");
    scale.appendChild(el("h3", "wmsub", "Scale"));
    scale.appendChild(sliderRow("Pins", "pin", () => api.redraw()));
    scale.appendChild(sliderRow("Icons", "icon", () => api.redraw()));
    scale.appendChild(sliderRow("Labels", "label", () => api.redraw()));
    const reset = el("button", "wmtext", "Reset sizes");
    reset.type = "button";
    reset.addEventListener("click", () => {
      resetSizes();
      api.rerender();
    });
    scale.appendChild(reset);
    pane.appendChild(scale);

    const show = el("div", "wmsect");
    show.appendChild(el("h3", "wmsub", "Show"));
    show.appendChild(toggleRow("Place labels", labelsOn(), (v) => {
      setLabelsOn(v);
      api.redraw();
    }));
    show.appendChild(toggleRow("Map icons", iconsOn(), (v) => {
      setIconsOn(v);
      api.redraw();
    }));
    show.appendChild(toggleRow("Hover tooltips", tooltipsOn(), (v) => setTooltipsOn(v)));
    pane.appendChild(show);
  }

  {
    const pane = paneShell("icons", "Icon types");
    const body = el("div", "wmsect");

    const filter = el("div", "wmfield small");
    const finput = el("input");
    finput.type = "search";
    finput.placeholder = "Filter types";
    filter.appendChild(finput);
    body.appendChild(filter);

    const bulk = el("div", "wmbulk");
    const all = el("button", "wmtext", "All");
    const none = el("button", "wmtext", "None");
    all.type = "button";
    none.type = "button";
    bulk.appendChild(all);
    bulk.appendChild(none);
    body.appendChild(bulk);

    const list = el("div", "wmscroll");
    body.appendChild(list);

    const unlistedWrap = el("div", "wmunlisted");
    body.appendChild(unlistedWrap);

    function paintList() {
      const term = finput.value.trim().toLowerCase();
      const named = namedIconTypes();
      list.innerHTML = "";
      if (!named.length) {
        list.appendChild(el("div", "wmres empty", "Map icons have not loaded"));
        return;
      }
      let shown = 0;
      for (const t of named) {
        if (term && !t.name.toLowerCase().includes(term)) continue;
        shown++;
        list.appendChild(checkRow(t.name, t.count, iconTypeOn(t.key), (v) => {
          setIconTypeOn(t.key, v);
          api.redraw();
        }));
      }
      if (!shown) list.appendChild(el("div", "wmres empty", "No type matches"));
    }

    function paintUnlisted() {
      const unl = unlistedIconTypes();
      unlistedWrap.innerHTML = "";
      if (!unl.length) return;
      const count = unl.reduce((n, t) => n + t.count, 0);
      const on = unl.some((t) => iconTypeOn(t.key));
      unlistedWrap.appendChild(checkRow(`Unlisted (${unl.length} types)`, count, on, (v) => {
        setIconTypesOn(unl.map((t) => t.key), v);
        api.redraw();
      }));
    }

    finput.addEventListener("input", paintList);
    all.addEventListener("click", () => {
      setIconTypesOn(namedIconTypes().map((t) => t.key), true);
      paintList();
      api.redraw();
    });
    none.addEventListener("click", () => {
      setIconTypesOn(namedIconTypes().map((t) => t.key), false);
      paintList();
      api.redraw();
    });

    paneHost.addEventListener("wmpaint", () => {
      paintList();
      paintUnlisted();
    });

    paintList();
    paintUnlisted();
    pane.appendChild(body);
  }

  if (api.showMarkers) {
    const pane = paneShell("markers", "Markers");
    const body = el("div", "wmsect");
    const list = api.markers();
    if (!list.length) {
      body.appendChild(el("div", "wmres empty", "No markers yet"));
    } else {
      for (const m of list) {
        const row = el("div", "wmrow marker");
        row.appendChild(el("label", undefined, `◆ ${m.label}`));
        row.appendChild(iconButton("×", `Remove ${m.label}`, () => api.removeMarker(m.id)));
        body.appendChild(row);
      }
    }
    if (api.canAddMarker) {
      const add = el("button", "wmadd", "Add marker");
      add.type = "button";
      add.addEventListener("click", () => api.startPicking());
      body.appendChild(add);
    }
    pane.appendChild(body);
  }

  const topleft = el("div", "wmtopleft");
  const column = el("div", "wmleftcol");
  if (pinned) {
    buildSearch(searchDock, true);
    column.appendChild(searchDock);
  }
  column.appendChild(paneHost);
  topleft.appendChild(rail);
  topleft.appendChild(column);
  root.appendChild(topleft);

  const zoom = el("div", "wmcard wmzoom");
  zoom.appendChild(iconButton("+", "Zoom in", () => api.zoomBy(1.4)));
  zoom.appendChild(iconButton("−", "Zoom out", () => api.zoomBy(1 / 1.4)));
  zoom.appendChild(iconButton("▢", "Reset view", () => api.refit()));
  root.appendChild(zoom);

  const hint = el("div", "wmcard wmhint", api.status);
  root.appendChild(hint);

  showPane(api.pane() as PaneName | null);
  return root;
}

export function repaintIconTypes(root: HTMLElement): void {
  root.querySelector(".wmpane")?.dispatchEvent(new Event("wmpaint"));
}

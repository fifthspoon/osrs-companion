import { fetchMarket, computeFlips, gp, age, TAX_RATE } from "./ge";
import type { Market, Flip, FlipOpts } from "./ge";

const KEY = "osrs-companion:ge:v1";

interface Settings extends FlipOpts {
  rows: number;
}

const DEFAULTS: Settings = {
  capital: 5_000_000,
  minVolume: 100,
  maxAgeSec: 1800,
  minRoi: 0,
  maxBuy: 0,
  membersOk: true,
  rows: 15,
};

function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
  }
  return { ...DEFAULTS };
}

let s: Settings = loadSettings();
let market: Market | null = null;
let loading = false;
let error: string | null = null;
let filtersOpen = false;
let timer: number | null = null;

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
  }
}

export function stop(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
}

async function load(rerender: () => void) {
  if (loading) return;
  loading = true;
  error = null;
  rerender();
  try {
    market = await fetchMarket();
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  loading = false;
  rerender();
}

export function render(rerender: () => void): HTMLElement {
  stop();

  const wrap = document.createElement("div");
  wrap.className = "gewrap";

  if (!market && !loading && !error) load(rerender);

  timer = window.setInterval(() => {
    if (!loading) load(rerender);
  }, 60_000);

  wrap.appendChild(topBar(rerender));

  if (error) {
    wrap.appendChild(msg("Could not reach the price API", error));
    wrap.appendChild(filters(rerender, 0, 0));
    return wrap;
  }

  if (!market) {
    wrap.appendChild(msg("Loading live prices…", "Three requests to the wiki's real-time API."));
    return wrap;
  }

  const flips = computeFlips(market, s);
  const priced = Object.keys(market.latest).length;

  if (!flips.length) {
    wrap.appendChild(
      msg(
        "Nothing passed your filters",
        "No item cleared the liquidity, freshness and capital thresholds. Loosen them below, or check back in a few minutes.",
      ),
    );
  } else {
    wrap.appendChild(topCard(flips[0]));
    if (flips.length > 1) wrap.appendChild(table(flips.slice(1, s.rows + 1)));
  }

  wrap.appendChild(filters(rerender, flips.length, priced));

  const foot = document.createElement("p");
  foot.className = "note";
  foot.textContent =
    `Live from the OSRS Wiki real-time prices API, updated ${age(Math.floor((Date.now() - market.fetchedAt) / 1000))} ago. ` +
    `Tax is ${(TAX_RATE * 100).toFixed(0)}% (changed from 1% on 29 May 2025), rounded down, capped at 5m, and 48 items are exempt.`;
  wrap.appendChild(foot);

  return wrap;
}

function msg(title: string, note: string): HTMLElement {
  const d = document.createElement("div");
  d.className = "card idle";
  d.innerHTML = `<div class="name"></div><div class="note"></div>`;
  (d.querySelector(".name") as HTMLElement).textContent = title;
  (d.querySelector(".note") as HTMLElement).textContent = note;
  return d;
}

function topBar(rerender: () => void): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "gebar";

  const label = document.createElement("label");
  label.append("Capital ");
  const cap = document.createElement("input");
  cap.type = "text";
  cap.value = String(s.capital);
  cap.inputMode = "numeric";
  cap.addEventListener("change", () => {
    const n = parseGp(cap.value);
    if (n > 0) {
      s.capital = n;
      save();
      rerender();
    }
  });
  label.appendChild(cap);
  bar.appendChild(label);

  const refresh = document.createElement("button");
  refresh.className = "linkbtn";
  refresh.textContent = loading ? "refreshing…" : "refresh";
  refresh.addEventListener("click", () => load(rerender));
  bar.appendChild(refresh);

  return bar;
}

function parseGp(v: string): number {
  const raw = v.trim().toLowerCase().replace(/[, ]/g, "");
  const mult = raw.endsWith("b") ? 1e9 : raw.endsWith("m") ? 1e6 : raw.endsWith("k") ? 1e3 : 1;
  const n = parseFloat(raw) * mult;
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : -1;
}

function filters(rerender: () => void, shown: number, priced: number): HTMLElement {
  const box = document.createElement("details");
  box.className = "picker gefilters";
  box.open = filtersOpen;
  box.addEventListener("toggle", () => (filtersOpen = box.open));

  const sum = document.createElement("summary");
  sum.textContent = priced
    ? `Filters (${shown} of ${priced} priced items pass)`
    : "Filters";
  box.appendChild(sum);

  const grid = document.createElement("div");
  grid.className = "gefiltergrid";
  box.appendChild(grid);

  const sel = (
    text: string,
    opts: [number, string][],
    get: () => number,
    set: (n: number) => void,
    hint: string,
  ) => {
    const l = document.createElement("label");
    l.append(text);
    const e = document.createElement("select");
    e.className = "minisel";
    for (const [v, t] of opts) {
      const o = document.createElement("option");
      o.value = String(v);
      o.textContent = t;
      if (v === get()) o.selected = true;
      e.appendChild(o);
    }
    e.addEventListener("change", () => {
      set(Number(e.value));
      save();
      rerender();
    });
    l.appendChild(e);
    grid.appendChild(l);
    const h = document.createElement("p");
    h.className = "note gehint";
    h.textContent = hint;
    grid.appendChild(h);
  };

  sel(
    "Min volume per hour",
    [[0, "any"], [10, "10"], [50, "50"], [100, "100"], [500, "500"], [2000, "2,000"], [10000, "10,000"]],
    () => s.minVolume,
    (n) => (s.minVolume = n),
    "Units traded in the last hour. The single most important filter: a fat margin on something nobody trades will never fill.",
  );

  sel(
    "Max price age",
    [[300, "5 min"], [900, "15 min"], [1800, "30 min"], [3600, "1 hour"], [21600, "6 hours"], [86400, "any"]],
    () => s.maxAgeSec,
    (n) => (s.maxAgeSec = n),
    "How stale the older side of the spread may be. An old price describes a spread that may no longer exist.",
  );

  sel(
    "Min ROI",
    [[0, "any"], [0.01, "1%"], [0.02, "2%"], [0.05, "5%"], [0.1, "10%"], [0.2, "20%"]],
    () => s.minRoi,
    (n) => (s.minRoi = n),
    "Profit as a share of what you tie up. High ROI on a cheap item can beat a big margin on an expensive one.",
  );

  sel(
    "Rows shown",
    [[5, "5"], [15, "15"], [30, "30"], [50, "50"], [100, "100"]],
    () => s.rows,
    (n) => (s.rows = n),
    "Below the headline pick.",
  );

  const mb = document.createElement("label");
  mb.append("Max price per item");
  const mbIn = document.createElement("input");
  mbIn.type = "text";
  mbIn.className = "minisel";
  mbIn.value = s.maxBuy ? String(s.maxBuy) : "";
  mbIn.placeholder = "no limit";
  mbIn.addEventListener("change", () => {
    const n = mbIn.value.trim() === "" ? 0 : parseGp(mbIn.value);
    if (n >= 0) {
      s.maxBuy = n;
      save();
      rerender();
    }
  });
  mb.appendChild(mbIn);
  grid.appendChild(mb);
  const mbHint = document.createElement("p");
  mbHint.className = "note gehint";
  mbHint.textContent = "Skip items above this unit price. Useful when you want volume rather than one big position.";
  grid.appendChild(mbHint);

  const mem = document.createElement("label");
  const memIn = document.createElement("input");
  memIn.type = "checkbox";
  memIn.checked = s.membersOk;
  memIn.addEventListener("change", () => {
    s.membersOk = memIn.checked;
    save();
    rerender();
  });
  mem.appendChild(memIn);
  mem.append(" Include members items");
  grid.appendChild(mem);
  const memHint = document.createElement("p");
  memHint.className = "note gehint";
  memHint.textContent = "Turn off on a free-to-play account.";
  grid.appendChild(memHint);

  const reset = document.createElement("button");
  reset.className = "linkbtn geresetbtn";
  reset.textContent = "reset to defaults";
  reset.addEventListener("click", () => {
    const cap = s.capital; // Capital is yours, not a filter. Keep it.
    s = { ...DEFAULTS, capital: cap };
    save();
    rerender();
  });
  box.appendChild(reset);

  return box;
}

function topCard(f: Flip): HTMLElement {
  const c = document.createElement("div");
  c.className = "card ready getop";
  c.innerHTML = `
    <div>
      <div class="name"></div>
      <div class="tp"></div>
      <div class="note"></div>
    </div>
    <div class="geprofit">
      <div class="gepnum">${gp(f.profit)}</div>
      <div class="note">per 4h limit</div>
    </div>`;
  (c.querySelector(".name") as HTMLElement).textContent = f.name;
  (c.querySelector(".tp") as HTMLElement).textContent =
    `Buy at ${gp(f.buy)}, sell at ${gp(f.sell)}. ${gp(f.net)} each after ${gp(f.tax)} tax.`;
  (c.querySelector("div > .note") as HTMLElement).textContent =
    `Buy ${f.qty.toLocaleString()} of a ${f.limit.toLocaleString()} limit. ${f.volume.toLocaleString()} traded in the last hour, last price ${age(f.ageSec)} ago.`;
  return c;
}

function table(flips: Flip[]): HTMLElement {
  const t = document.createElement("table");
  t.className = "getable";
  t.innerHTML = `<thead><tr>
    <th>Item</th><th>Buy</th><th>Sell</th><th>Net</th><th>ROI</th>
    <th>Qty</th><th>Profit</th><th>Vol/h</th><th>Age</th>
  </tr></thead>`;
  const body = document.createElement("tbody");
  for (const f of flips) {
    const tr = document.createElement("tr");
    const cells = [
      f.name,
      gp(f.buy),
      gp(f.sell),
      gp(f.net),
      `${(f.roi * 100).toFixed(1)}%`,
      f.qty.toLocaleString(),
      gp(f.profit),
      f.volume.toLocaleString(),
      age(f.ageSec),
    ];
    cells.forEach((v, i) => {
      const td = document.createElement("td");
      td.textContent = v;
      if (i === 0) td.className = "gename";
      if (i === 6) td.className = "geprofitcell";
      tr.appendChild(td);
    });
    body.appendChild(tr);
  }
  t.appendChild(body);
  return t;
}

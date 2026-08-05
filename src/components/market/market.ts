import { fetchMarket } from "../../lib/market/api";
import type { Market } from "../../lib/market/api";
import { buildCandidates } from "../../lib/market/flip";
import type { Candidate } from "../../lib/market/flip";
import { TAX_HINT } from "../../lib/market/tax";
import { SLOTS_F2P, SLOTS_MEMBERS } from "../../lib/market/allocate";
import { s, save, resetTuning } from "../../lib/market/settings";
import type { Mode } from "../../lib/market/settings";
import { renderBasic } from "./basic";
import { renderAdvanced } from "./advanced";
import { gp, parseGp, age } from "../../lib/market/fmt";

const REFRESH_MS = 60_000;

let market: Market | null = null;
let loading = false;
let error: string | null = null;
let timer: number | null = null;

export function stop(): void {
  if (timer !== null) {
    clearInterval(timer);
    timer = null;
  }
  document.getElementById("app")?.classList.remove("wide");
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
  wrap.className = "mkwrap";

  if (s.mode === "advanced") document.getElementById("app")?.classList.add("wide");

  if (!market && !loading && !error) load(rerender);
  timer = window.setInterval(() => {
    if (!loading) load(rerender);
  }, REFRESH_MS);

  wrap.appendChild(topBar(rerender));

  if (error) {
    wrap.appendChild(msg("Could not reach the price API", error));
    return wrap;
  }

  if (!market) {
    wrap.appendChild(
      msg("Loading live prices", "Five requests to the wiki real time prices API."),
    );
    return wrap;
  }

  const candidates = buildCandidates(market, s.gates);

  if (s.mode === "basic") {
    wrap.appendChild(renderBasic(candidates, s, rerender));
  } else {
    wrap.appendChild(renderAdvanced(candidates, s, rerender));
  }

  wrap.appendChild(filters(candidates, rerender));
  wrap.appendChild(footnote(market));

  return wrap;
}

function msg(title: string, note: string): HTMLElement {
  const d = document.createElement("div");
  d.className = "card idle";
  const n = document.createElement("div");
  n.className = "name";
  n.textContent = title;
  const p = document.createElement("div");
  p.className = "note";
  p.textContent = note;
  d.append(n, p);
  return d;
}

function topBar(rerender: () => void): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "mkbar";

  bar.appendChild(modeToggle(rerender));

  const cap = document.createElement("label");
  cap.append("Bank ");
  const capIn = document.createElement("input");
  capIn.type = "text";
  capIn.value = gp(s.capital);
  capIn.inputMode = "numeric";
  capIn.addEventListener("change", () => {
    const n = parseGp(capIn.value);
    if (n > 0) {
      s.capital = n;
      save();
      rerender();
    }
  });
  cap.appendChild(capIn);
  bar.appendChild(cap);

  const slots = document.createElement("label");
  slots.append("Slots ");
  const slotSel = document.createElement("select");
  slotSel.className = "minisel";
  for (let i = 1; i <= SLOTS_MEMBERS; i++) {
    const o = document.createElement("option");
    o.value = String(i);
    o.textContent = i === SLOTS_MEMBERS ? "8 (members)" : i === SLOTS_F2P ? "3 (f2p)" : String(i);
    if (i === s.slots) o.selected = true;
    slotSel.appendChild(o);
  }
  slotSel.addEventListener("change", () => {
    s.slots = Number(slotSel.value);
    save();
    rerender();
  });
  slots.appendChild(slotSel);
  bar.appendChild(slots);

  const back = document.createElement("label");
  back.append("Back in ");
  const backSel = document.createElement("select");
  backSel.className = "minisel";
  for (const [v, t] of [[0.25, "15 min"], [0.5, "30 min"], [1, "1 hour"], [2, "2 hours"], [4, "4 hours"], [8, "8 hours"]] as [number, string][]) {
    const o = document.createElement("option");
    o.value = String(v);
    o.textContent = t;
    if (v === s.checkInHours) o.selected = true;
    backSel.appendChild(o);
  }
  backSel.title =
    "How long before you next look at the Grand Exchange. Offers are sized to finish in about that time, so a shorter interval ties up less gp for the same rate.";
  backSel.addEventListener("change", () => {
    s.checkInHours = Number(backSel.value);
    save();
    rerender();
  });
  back.appendChild(backSel);
  bar.appendChild(back);

  const refresh = document.createElement("button");
  refresh.className = "linkbtn";
  refresh.textContent = loading ? "refreshing" : "refresh";
  refresh.addEventListener("click", () => load(rerender));
  bar.appendChild(refresh);

  return bar;
}

function modeToggle(rerender: () => void): HTMLElement {
  const g = document.createElement("div");
  g.className = "mkmode";
  for (const m of ["basic", "advanced"] as Mode[]) {
    const b = document.createElement("button");
    b.textContent = m === "basic" ? "Basic" : "Advanced";
    if (s.mode === m) b.classList.add("active");
    b.addEventListener("click", () => {
      if (s.mode === m) return;
      s.mode = m;
      save();
      rerender();
    });
    g.appendChild(b);
  }
  return g;
}

function filters(candidates: Candidate[], rerender: () => void): HTMLElement {
  const passing = candidates.filter((c) => c.failed.length === 0).length;

  const box = document.createElement("details");
  box.className = "picker mkfilters";

  const sum = document.createElement("summary");
  sum.textContent = `Gates (${passing} of ${candidates.length} priced items pass)`;
  box.appendChild(sum);

  const grid = document.createElement("div");
  grid.className = "mkfiltergrid";
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
    h.className = "note mkhint";
    h.textContent = hint;
    grid.appendChild(h);
  };

  sel(
    "Max price age",
    [[300, "5 min"], [900, "15 min"], [1800, "30 min"], [3600, "1 hour"], [21600, "6 hours"], [86400, "any"]],
    () => s.gates.maxAgeSec,
    (n) => (s.gates.maxAgeSec = n),
    "How stale the older side of the spread may be. A fresh bid against a six hour old ask describes a spread that no longer exists.",
  );

  sel(
    "Min flow per side",
    [[0, "any"], [5, "5/hr"], [25, "25/hr"], [100, "100/hr"], [500, "500/hr"], [2000, "2,000/hr"]],
    () => s.gates.minFlowPerSide,
    (n) => (s.gates.minFlowPerSide = n),
    "Units traded each way in the last hour. Both legs have to fill, so this is checked per side rather than on the total.",
  );

  sel(
    "Max flow skew",
    [[1000, "any"], [20, "20x"], [10, "10x"], [5, "5x"], [3, "3x"]],
    () => s.gates.maxFlowSkew,
    (n) => (s.gates.maxFlowSkew = n),
    "How lopsided the two sides may be. Heavy flow one way and none the other means you get stuck holding it.",
  );

  sel(
    "Max spread vs normal",
    [[99, "any"], [4, "4x"], [3, "3x"], [2, "2x"], [1.5, "1.5x"]],
    () => s.gates.maxSpreadRatio,
    (n) => (s.gates.maxSpreadRatio = n),
    "A spread several times wider than its own 24 hour average is usually one stale print, not an opportunity. This is the gate that removes most junk.",
  );

  sel(
    "Max outlier vs last hour",
    [[1, "any"], [0.2, "20%"], [0.1, "10%"], [0.05, "5%"], [0.02, "2%"]],
    () => s.gates.maxOutlierBand,
    (n) => (s.gates.maxOutlierBand = n),
    "How far the two latest prints may sit outside what actually traded in the last hour. On a volatile item the bid and the ask are two separate trades at two separate moments, and price drift between them fakes a margin that was never there.",
  );

  sel(
    "Min profit per slot",
    [[0, "any"], [10_000, "10k"], [50_000, "50k"], [250_000, "250k"], [1_000_000, "1m"]],
    () => s.minSlotProfit,
    (n) => (s.minSlotProfit = n),
    "A slot costs you clicks and four hours of attention. Below this the allocator leaves it empty rather than filling it with something not worth placing.",
  );

  const mem = document.createElement("label");
  const memIn = document.createElement("input");
  memIn.type = "checkbox";
  memIn.checked = s.gates.membersOk;
  memIn.addEventListener("change", () => {
    s.gates.membersOk = memIn.checked;
    save();
    rerender();
  });
  mem.appendChild(memIn);
  mem.append(" Include members items");
  grid.appendChild(mem);
  const memHint = document.createElement("p");
  memHint.className = "note mkhint";
  memHint.textContent = "Turn off on a free to play account, and set slots to 3.";
  grid.appendChild(memHint);

  const reset = document.createElement("button");
  reset.className = "linkbtn mkreset";
  reset.textContent = "reset gates to defaults";
  reset.addEventListener("click", () => {
    resetTuning();
    rerender();
  });
  box.appendChild(reset);

  return box;
}

function footnote(m: Market): HTMLElement {
  const foot = document.createElement("p");
  foot.className = "note";
  foot.textContent =
    `Live from the OSRS Wiki real time prices API, updated ${age(Math.floor((Date.now() - m.fetchedAt) / 1000))} ago. ` +
    TAX_HINT;
  return foot;
}

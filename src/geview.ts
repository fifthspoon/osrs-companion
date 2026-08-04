import { fetchMarket, computeFlips, gp, age, TAX_RATE } from "./ge";
import type { Market, Flip } from "./ge";

// The flips tab.
//
// Same rule as the rest of the app: one loud answer, everything else quiet.
// A wall of 4000 rows sorted by margin is what the paid sites do and it is
// useless, because the top of that list is always illiquid junk that will never
// fill. This shows the single best realistic flip large, then a short ranked
// list, and it shows volume and price age on every row so the judgement is
// visible rather than hidden.

const CAP_KEY = "osrs-companion:ge:capital";
const MEM_KEY = "osrs-companion:ge:members";

let market: Market | null = null;
let loading = false;
let error: string | null = null;
let capital = Number(localStorage.getItem(CAP_KEY)) || 5_000_000;
let membersOk = localStorage.getItem(MEM_KEY) !== "0";

let timer: number | null = null;

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

  // The API sets a 60 second cache, so refreshing faster than that just serves
  // the same bytes back. Matching it exactly is both polite and pointless to beat.
  timer = window.setInterval(() => {
    if (!loading) load(rerender);
  }, 60_000);

  wrap.appendChild(controls(rerender));

  if (error) {
    const e = document.createElement("div");
    e.className = "card idle";
    e.innerHTML = `<div class="name">Could not reach the price API</div><div class="note">${error}</div>`;
    wrap.appendChild(e);
    return wrap;
  }

  if (!market) {
    const l = document.createElement("div");
    l.className = "card idle";
    l.innerHTML = `<div class="name">Loading live prices…</div><div class="note">Three requests to the wiki's real-time API.</div>`;
    wrap.appendChild(l);
    return wrap;
  }

  const flips = computeFlips(market, {
    capital,
    minVolume: 100,
    maxAgeSec: 1800,
    membersOk,
  });

  if (!flips.length) {
    const n = document.createElement("div");
    n.className = "card idle";
    n.innerHTML = `<div class="name">Nothing worth flipping right now</div><div class="note">No item passed the liquidity and freshness filters with your capital. Try raising capital, or check back in a few minutes.</div>`;
    wrap.appendChild(n);
    return wrap;
  }

  wrap.appendChild(topCard(flips[0]));
  wrap.appendChild(table(flips.slice(1, 16)));

  const foot = document.createElement("p");
  foot.className = "note";
  foot.textContent =
    `Live from the OSRS Wiki real-time prices API, updated ${age(Math.floor((Date.now() - market.fetchedAt) / 1000))} ago. ` +
    `Tax is ${(TAX_RATE * 100).toFixed(0)}% (changed from 1% on 29 May 2025), rounded down, capped at 5m, and 48 items are exempt. ` +
    `Only items traded in the last 30 minutes with 100+ hourly volume are shown.`;
  wrap.appendChild(foot);

  return wrap;
}

function controls(rerender: () => void): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "gebar";

  const capLabel = document.createElement("label");
  capLabel.textContent = "Capital ";
  const cap = document.createElement("input");
  cap.type = "text";
  cap.value = String(capital);
  cap.inputMode = "numeric";
  cap.addEventListener("change", () => {
    // Accept 10m / 500k as well as raw digits, because nobody types 10000000.
    const raw = cap.value.trim().toLowerCase().replace(/[, ]/g, "");
    const mult = raw.endsWith("b") ? 1e9 : raw.endsWith("m") ? 1e6 : raw.endsWith("k") ? 1e3 : 1;
    const n = parseFloat(raw) * mult;
    if (Number.isFinite(n) && n > 0) {
      capital = Math.floor(n);
      localStorage.setItem(CAP_KEY, String(capital));
      rerender();
    }
  });
  capLabel.appendChild(cap);
  bar.appendChild(capLabel);

  const memLabel = document.createElement("label");
  const mem = document.createElement("input");
  mem.type = "checkbox";
  mem.checked = membersOk;
  mem.addEventListener("change", () => {
    membersOk = mem.checked;
    localStorage.setItem(MEM_KEY, membersOk ? "1" : "0");
    rerender();
  });
  memLabel.appendChild(mem);
  memLabel.append(" Members items");
  bar.appendChild(memLabel);

  const refresh = document.createElement("button");
  refresh.className = "linkbtn";
  refresh.textContent = loading ? "refreshing…" : "refresh";
  refresh.addEventListener("click", () => load(rerender));
  bar.appendChild(refresh);

  return bar;
}

function topCard(f: Flip): HTMLElement {
  const c = document.createElement("div");
  c.className = "card ready getop";
  c.innerHTML = `
    <div>
      <div class="name">${f.name}</div>
      <div class="tp">Buy at ${gp(f.buy)}, sell at ${gp(f.sell)}. ${gp(f.net)} each after ${gp(f.tax)} tax.</div>
      <div class="note">Buy ${f.qty.toLocaleString()} of a ${f.limit.toLocaleString()} limit. ${f.volume.toLocaleString()} traded in the last hour, last price ${age(f.ageSec)} ago.</div>
    </div>
    <div class="geprofit">
      <div class="gepnum">${gp(f.profit)}</div>
      <div class="note">per 4h limit</div>
    </div>`;
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
    tr.innerHTML = `
      <td class="gename">${f.name}</td>
      <td>${gp(f.buy)}</td>
      <td>${gp(f.sell)}</td>
      <td>${gp(f.net)}</td>
      <td>${(f.roi * 100).toFixed(1)}%</td>
      <td>${f.qty.toLocaleString()}</td>
      <td class="geprofitcell">${gp(f.profit)}</td>
      <td>${f.volume.toLocaleString()}</td>
      <td>${age(f.ageSec)}</td>`;
    body.appendChild(tr);
  }
  t.appendChild(body);
  return t;
}

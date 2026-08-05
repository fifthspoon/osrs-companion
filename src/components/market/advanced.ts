import { sizeFor, GATE_LABEL } from "../../lib/market/flip";
import type { Candidate, Sized } from "../../lib/market/flip";
import type { Settings } from "../../lib/market/settings";
import { save } from "../../lib/market/settings";
import { gp, count, age, duration } from "../../lib/market/fmt";

interface Row {
  c: Candidate;
  z: Sized | null;
}

function pct(v: number | null): string {
  if (v === null) return "-";
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(1)}%`;
}

interface Column {
  key: string;
  label: string;
  hint: string;
  cell: (r: Row) => string;
  sort: (r: Row) => number | string;
}

const COLUMNS: Column[] = [
  {
    key: "item",
    label: "Item",
    hint: "Item name",
    cell: (r) => r.c.name,
    sort: (r) => r.c.name,
  },
  {
    key: "buy",
    label: "Buy",
    hint: "What you place your buy offer at, the current bid",
    cell: (r) => count(r.c.buy),
    sort: (r) => r.c.buy,
  },
  {
    key: "sell",
    label: "Sell",
    hint: "What you place your sell offer at, the current ask",
    cell: (r) => count(r.c.sell),
    sort: (r) => r.c.sell,
  },
  {
    key: "tax",
    label: "Tax",
    hint: "2% of the sale price, rounded down, capped at 5m. Zero on the 48 exempt items",
    cell: (r) => count(r.c.tax),
    sort: (r) => r.c.tax,
  },
  {
    key: "net",
    label: "Net/ea",
    hint: "Profit per unit after tax",
    cell: (r) => gp(r.c.net),
    sort: (r) => r.c.net,
  },
  {
    key: "qty",
    label: "Qty",
    hint: "How many you can buy, the smaller of your bank and the 4 hour buy limit",
    cell: (r) => (r.z ? count(r.z.qty) : "-"),
    sort: (r) => r.z?.qty ?? -1,
  },
  {
    key: "spend",
    label: "Spend",
    hint: "Capital tied up in the position",
    cell: (r) => (r.z ? gp(r.z.spend) : "-"),
    sort: (r) => r.z?.spend ?? -1,
  },
  {
    key: "profit",
    label: "Profit",
    hint: "Net per unit times the quantity you can actually buy",
    cell: (r) => (r.z ? gp(r.z.profit) : "-"),
    sort: (r) => r.z?.profit ?? -Infinity,
  },
  {
    key: "rate",
    label: "Profit/hr",
    hint: "The smaller of what order flow allows and what the 4 hour buy limit allows. This is the number that matters",
    cell: (r) => (r.z ? gp(r.z.profitPerHour) : "-"),
    sort: (r) => r.z?.profitPerHour ?? -Infinity,
  },
  {
    key: "margin",
    label: "Margin",
    hint: "Net as a share of what you tie up",
    cell: (r) => `${(r.c.margin * 100).toFixed(1)}%`,
    sort: (r) => r.c.margin,
  },
  {
    key: "spread",
    label: "Spread",
    hint: "Current spread against this item's own 24 hour average spread. Well above 1x usually means one stale print",
    cell: (r) => (r.c.spreadRatio === null ? "-" : `${r.c.spreadRatio.toFixed(1)}x`),
    sort: (r) => r.c.spreadRatio ?? -1,
  },
  {
    key: "vsday",
    label: "vs 24h",
    hint: "Current buy price against the 24 hour average buy price",
    cell: (r) => pct(r.c.vsDay),
    sort: (r) => r.c.vsDay ?? -Infinity,
  },
  {
    key: "buyvh",
    label: "Buy vs 1h",
    hint: "Latest bid against the average bid over the last hour. Far below means you are pricing off an outlier print",
    cell: (r) => pct(r.c.buyVsHour),
    sort: (r) => r.c.buyVsHour ?? -Infinity,
  },
  {
    key: "sellvh",
    label: "Sell vs 1h",
    hint: "Latest ask against the average ask over the last hour. Far above means the sell price you are counting on has not actually traded",
    cell: (r) => pct(r.c.sellVsHour),
    sort: (r) => r.c.sellVsHour ?? -Infinity,
  },
  {
    key: "limit",
    label: "Limit",
    hint: "Units you may buy per rolling 4 hours",
    cell: (r) => (r.c.limit > 0 ? count(r.c.limit) : "-"),
    sort: (r) => r.c.limit,
  },
  {
    key: "dvol",
    label: "Vol/day",
    hint: "Units traded in the last day, both directions",
    cell: (r) => count(r.c.dailyVolume),
    sort: (r) => r.c.dailyVolume,
  },
  {
    key: "bflow",
    label: "Buy flow",
    hint: "Units sold into the bid in the last hour. This is what fills your buy offer",
    cell: (r) => count(r.c.buyFlow),
    sort: (r) => r.c.buyFlow,
  },
  {
    key: "sflow",
    label: "Sell flow",
    hint: "Units bought off the ask in the last hour. This is what fills your sell offer",
    cell: (r) => count(r.c.sellFlow),
    sort: (r) => r.c.sellFlow,
  },
  {
    key: "fill",
    label: "Fill",
    hint: "Rough time for both legs at the current rate. Optimistic, it assumes you capture the whole flow",
    cell: (r) => (r.z ? duration(r.z.cycleHours) : "-"),
    sort: (r) => r.z?.cycleHours ?? Infinity,
  },
  {
    key: "age",
    label: "Age",
    hint: "How old the older of the two prices is",
    cell: (r) => age(r.c.ageSec),
    sort: (r) => r.c.ageSec,
  },
  {
    key: "gates",
    label: "Status",
    hint: "Which gates this item failed, if any",
    cell: (r) => (r.c.failed.length ? `${r.c.failed.length} failed` : "ok"),
    sort: (r) => r.c.failed.length,
  },
];

const DEFAULT_COLS = [
  "item", "buy", "sell", "net", "qty", "profit", "rate", "margin", "limit", "dvol", "age", "gates",
];

export function renderAdvanced(
  candidates: Candidate[],
  s: Settings,
  rerender: () => void,
): HTMLElement {
  const wrap = document.createElement("section");
  wrap.className = "mkadv";

  const rows: Row[] = candidates.map((c) => ({
    c,
    z: sizeFor(c, s.capital, s.checkInHours),
  }));

  const table = document.createElement("table");
  table.className = "mktable";
  const head = document.createElement("thead");
  const body = document.createElement("tbody");
  table.append(head, body);

  const scroll = document.createElement("div");
  scroll.className = "mkscroll";
  scroll.appendChild(table);

  const status = document.createElement("p");
  status.className = "note";

  let query = "";

  const visible = () => COLUMNS.filter((col) => (s.cols ?? DEFAULT_COLS).includes(col.key));

  const paint = () => {
    const cols = visible();

    head.innerHTML = "";
    const hr = document.createElement("tr");
    for (const col of cols) {
      const th = document.createElement("th");
      th.textContent = col.label;
      th.title = col.hint;
      if (s.sortCol === col.key) th.classList.add(s.sortDir === "desc" ? "down" : "up");
      th.addEventListener("click", () => {
        if (s.sortCol === col.key) s.sortDir = s.sortDir === "desc" ? "asc" : "desc";
        else {
          s.sortCol = col.key;
          s.sortDir = "desc";
        }
        save();
        paint();
      });
      hr.appendChild(th);
    }
    head.appendChild(hr);

    let list = rows;
    if (!s.gatesOff) list = list.filter((r) => r.c.failed.length === 0);
    if (query) list = list.filter((r) => r.c.name.toLowerCase().includes(query));

    const col = COLUMNS.find((x) => x.key === s.sortCol) ?? COLUMNS[8];
    const dir = s.sortDir === "desc" ? -1 : 1;
    list = [...list].sort((a, b) => {
      const va = col.sort(a);
      const vb = col.sort(b);
      if (typeof va === "string" || typeof vb === "string") {
        return dir * String(va).localeCompare(String(vb));
      }
      return dir * (va - vb);
    });

    const shown = list.slice(0, s.rows);

    body.innerHTML = "";
    for (const r of shown) {
      const tr = document.createElement("tr");
      if (r.c.failed.length) tr.classList.add("gated");
      for (const c of cols) {
        const td = document.createElement("td");
        td.textContent = c.cell(r);
        if (c.key === "item") td.className = "mkname";
        if (c.key === "rate" || c.key === "profit") td.className = "mkpos";
        if (c.key === "gates" && r.c.failed.length) td.className = "mkbad";
        tr.appendChild(td);
      }

      const detail = document.createElement("tr");
      detail.className = "mkdetail";
      detail.hidden = true;
      const td = document.createElement("td");
      td.colSpan = cols.length;
      td.appendChild(detailBox(r));
      detail.appendChild(td);

      tr.addEventListener("click", () => {
        detail.hidden = !detail.hidden;
      });

      body.append(tr, detail);
    }

    status.textContent = `Showing ${shown.length} of ${list.length} matching, ${rows.length} priced items in total.`;
  };

  wrap.appendChild(controls(s, rows, (q) => { query = q; paint(); }, paint, rerender));
  wrap.append(scroll, status);
  paint();

  return wrap;
}

function detailBox(r: Row): HTMLElement {
  const box = document.createElement("div");
  box.className = "mkdetailbox";

  const gates = document.createElement("div");
  gates.className = "mkgates";
  if (r.c.failed.length) {
    gates.textContent = `Failed: ${r.c.failed.map((f) => GATE_LABEL[f]).join(", ")}.`;
    gates.classList.add("mkbad");
  } else {
    gates.textContent = "Passes every gate.";
  }

  const facts = document.createElement("div");
  facts.className = "note";
  const bits = [
    `Buy ${count(r.c.buy)}, sell ${count(r.c.sell)}, tax ${count(r.c.tax)}, net ${count(r.c.net)} each.`,
    `Buy limit ${count(r.c.limit)} per 4 hours.`,
    `Flow last hour: ${count(r.c.buyFlow)} into the bid, ${count(r.c.sellFlow)} off the ask.`,
  ];
  if (r.z) {
    bits.push(
      `Sized at ${count(r.z.qty)} units for ${gp(r.z.spend)}, worth ${gp(r.z.profit)} a round.`,
      `Held back by ${r.z.bound === "limit" ? "the buy limit" : r.z.bound === "capital" ? "your bank" : "how fast it trades"}, giving ${gp(r.z.profitPerHour)} per hour, both legs in ${duration(r.z.cycleHours)}.`,
    );
  }
  if (r.c.spreadRatio !== null) {
    bits.push(`Current spread is ${r.c.spreadRatio.toFixed(1)}x its own 24 hour average.`);
  }
  if (r.c.buyVsHour !== null || r.c.sellVsHour !== null) {
    bits.push(
      `Against the last hour the bid sits ${pct(r.c.buyVsHour)} and the ask ${pct(r.c.sellVsHour)}.`,
    );
  }
  facts.textContent = bits.join(" ");

  box.append(gates, facts);
  return box;
}

function controls(
  s: Settings,
  rows: Row[],
  onSearch: (q: string) => void,
  paint: () => void,
  rerender: () => void,
): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "mkadvbar";

  const search = document.createElement("input");
  search.type = "search";
  search.className = "mksearch";
  search.placeholder = `Search ${rows.length} items`;
  search.addEventListener("input", () => onSearch(search.value.toLowerCase().trim()));
  bar.appendChild(search);

  const rowSel = document.createElement("select");
  rowSel.className = "minisel";
  for (const n of [25, 50, 100, 250, 1000]) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = `${n} rows`;
    if (n === s.rows) o.selected = true;
    rowSel.appendChild(o);
  }
  rowSel.addEventListener("change", () => {
    s.rows = Number(rowSel.value);
    save();
    paint();
  });
  bar.appendChild(rowSel);

  const raw = document.createElement("label");
  raw.className = "mktoggle";
  const rawIn = document.createElement("input");
  rawIn.type = "checkbox";
  rawIn.checked = s.gatesOff;
  rawIn.addEventListener("change", () => {
    s.gatesOff = rawIn.checked;
    save();
    paint();
  });
  raw.appendChild(rawIn);
  raw.append(" Show gated items");
  bar.appendChild(raw);

  bar.appendChild(columnPicker(s, paint));

  const reset = document.createElement("button");
  reset.className = "linkbtn";
  reset.textContent = "reset columns";
  reset.addEventListener("click", () => {
    s.cols = [...DEFAULT_COLS];
    save();
    rerender();
  });
  bar.appendChild(reset);

  return bar;
}

function columnPicker(s: Settings, paint: () => void): HTMLElement {
  const box = document.createElement("details");
  box.className = "mkcols";

  const sum = document.createElement("summary");
  sum.textContent = "Columns";
  box.appendChild(sum);

  const grid = document.createElement("div");
  grid.className = "mkcolgrid";

  for (const col of COLUMNS) {
    if (col.key === "item") continue;
    const l = document.createElement("label");
    const i = document.createElement("input");
    i.type = "checkbox";
    i.checked = (s.cols ?? DEFAULT_COLS).includes(col.key);
    i.addEventListener("change", () => {
      const current = new Set(s.cols ?? DEFAULT_COLS);
      if (i.checked) current.add(col.key);
      else current.delete(col.key);
      s.cols = COLUMNS.filter((c) => current.has(c.key)).map((c) => c.key);
      save();
      paint();
    });
    l.appendChild(i);
    l.append(` ${col.label}`);
    l.title = col.hint;
    grid.appendChild(l);
  }

  box.appendChild(grid);
  return box;
}

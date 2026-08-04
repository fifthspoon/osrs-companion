import "./style.css";
import { TASKS } from "./tasks";
import { load, save, isReady } from "./store";
import type { Store } from "./store";
import { render as renderDailies } from "./ui";
import { render as renderRoute } from "./routeview";
import { render as renderMap } from "./mapview";
import { ROUTES } from "./routes";
import * as fightview from "./fightview";
import * as market from "./market/view";
import { requestPermission, fire, clear } from "./notify";

const root = document.getElementById("app") as HTMLElement;
let store: Store = load();

type Tab = "dailies" | string; // string = a route id
let tab: Tab = (localStorage.getItem("osrs-companion:tab") as Tab) || "dailies";
if (tab === "flips") tab = "market";

const wasReady = new Map<string, boolean>();
for (const t of TASKS) {
  wasReady.set(t.id, isReady(t, store[t.id], Date.now()));
}

const handlers = {
  onDone(id: string) {
    store[id].lastDone = Date.now();
    clear(id);
    wasReady.set(id, false);
    persistAndDraw();
  },
  onUndo(id: string) {
    store[id].lastDone = null;
    clear(id);
    persistAndDraw();
  },
  onToggle(id: string) {
    store[id].enabled = !store[id].enabled;
    persistAndDraw();
  },
  async onEnableNotifications() {
    await requestPermission();
    persistAndDraw();
  },
};

function persistAndDraw() {
  save(store);
  draw();
}

function setTab(next: Tab) {
  tab = next;
  localStorage.setItem("osrs-companion:tab", next);
  draw();
}

function tabBar(): HTMLElement {
  const bar = document.createElement("nav");
  bar.className = "tabs";
  const items: [Tab, string][] = [
    ["dailies", "Dailies"],
    ...ROUTES.map((r) => [r.id, r.name] as [Tab, string]),
    ["map", "Map"],
    ["market", "Market"],
    ["fight", "Fire cape (WIP)"],
  ];
  for (const [id, label] of items) {
    const b = document.createElement("button");
    b.textContent = label;
    if (tab === id) b.classList.add("active");
    b.addEventListener("click", () => setTab(id));
    bar.appendChild(b);
  }
  return bar;
}

function footer(): HTMLElement {
  const f = document.createElement("footer");
  f.className = "sitefoot";

  const line = document.createElement("p");
  line.className = "sitefoot-loud";
  line.textContent =
    "This is free, and always will be. If anyone charged you for it, you were scammed.";
  f.appendChild(line);

  const sub = document.createElement("p");
  sub.appendChild(
    document.createTextNode("Free and open source under AGPL-3.0. Get it, and the source, at "),
  );
  const a = document.createElement("a");
  a.href = "https://github.com/fifthspoon/osrs-companion";
  a.textContent = "github.com/fifthspoon/osrs-companion";
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  sub.appendChild(a);
  sub.appendChild(document.createTextNode(". Not affiliated with Jagex."));
  f.appendChild(sub);

  return f;
}

function draw() {
  fightview.stop();
  market.stop();

  root.innerHTML = "";
  root.appendChild(tabBar());
  const body = document.createElement("div");
  body.className = "body";
  root.appendChild(body);
  root.appendChild(footer());

  if (tab === "dailies") {
    renderDailies(body, store, Date.now(), handlers);
  } else if (tab === "map") {
    body.appendChild(renderMap(draw));
  } else if (tab === "market") {
    body.appendChild(market.render(draw));
  } else if (tab === "fight") {
    body.appendChild(fightview.render());
  } else {
    const route = ROUTES.find((r) => r.id === tab);
    if (route) body.appendChild(renderRoute(route, draw));
    else setTab("dailies");
  }
}

function tick() {
  const now = Date.now();
  for (const t of TASKS) {
    if (!store[t.id].enabled) continue;
    const ready = isReady(t, store[t.id], now);
    if (ready && !wasReady.get(t.id)) fire(t.id, t.name);
    wasReady.set(t.id, ready);
  }
  if (tab === "dailies") draw();
}

draw();
setInterval(tick, 1000);
